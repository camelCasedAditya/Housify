from __future__ import annotations
import json
from typing import Iterator, Optional
from django.conf import settings
from .base import LLMProvider, Tool, Message, CompletionResult


class OllamaCloudProvider(LLMProvider):
    """Ollama Cloud chat API. Uses tool/function calling when models support it."""
    name = "ollama_cloud"
    # Cloud-hosted open models — small flat estimate; cost guard is conservative.
    price_in_per_mtok = 0.5
    price_out_per_mtok = 1.0

    def __init__(self, model: Optional[str] = None):
        from ollama import Client
        self.model = model or settings.OLLAMA_CLOUD_MODEL
        self.client = Client(
            host=settings.OLLAMA_CLOUD_HOST,
            headers={"Authorization": f"Bearer {settings.OLLAMA_CLOUD_API_KEY}"} if settings.OLLAMA_CLOUD_API_KEY else None,
        )

    def _to_messages(self, messages: list[Message]):
        out = []
        for m in messages:
            entry = {"role": m.role, "content": m.content}
            if m.role == "tool" and m.tool_name:
                entry["name"] = m.tool_name
            out.append(entry)
        return out

    def _to_tools(self, tools: Optional[list[Tool]]):
        if not tools:
            return None
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                },
            }
            for t in tools
        ]

    def complete(self, messages, tools=None, max_tokens=2048, temperature=0.2) -> CompletionResult:
        resp = self.client.chat(
            model=self.model,
            messages=self._to_messages(messages),
            tools=self._to_tools(tools),
            options={"temperature": temperature, "num_predict": max_tokens},
        )
        msg = resp.get("message") or {}
        text = msg.get("content") or ""
        tcs = []
        for tc in (msg.get("tool_calls") or []):
            fn = tc.get("function") or {}
            args = fn.get("arguments")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            tcs.append({"id": tc.get("id", ""), "name": fn.get("name", ""), "arguments": args or {}})
        return CompletionResult(
            text=text,
            tool_calls=tcs,
            input_tokens=resp.get("prompt_eval_count", 0) or 0,
            output_tokens=resp.get("eval_count", 0) or 0,
        )

    def stream(self, messages, tools=None, max_tokens=2048, temperature=0.2) -> Iterator[dict]:
        in_tokens = 0
        out_tokens = 0
        tool_calls_buffer = []
        for chunk in self.client.chat(
            model=self.model,
            messages=self._to_messages(messages),
            tools=self._to_tools(tools),
            stream=True,
            options={"temperature": temperature, "num_predict": max_tokens},
        ):
            msg = chunk.get("message") or {}
            if msg.get("content"):
                yield {"type": "delta", "text": msg["content"]}
            for tc in (msg.get("tool_calls") or []):
                fn = tc.get("function") or {}
                args = fn.get("arguments")
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                tool_calls_buffer.append({"id": tc.get("id", ""), "name": fn.get("name", ""), "arguments": args or {}})
            if chunk.get("done"):
                in_tokens = chunk.get("prompt_eval_count", 0) or 0
                out_tokens = chunk.get("eval_count", 0) or 0
        for tc in tool_calls_buffer:
            yield {"type": "tool_call", **tc}
        yield {"type": "done", "usage": {"input_tokens": in_tokens, "output_tokens": out_tokens}}
