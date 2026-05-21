from __future__ import annotations
import json
from typing import Iterator, Optional
from django.conf import settings
from .base import LLMProvider, Tool, Message, CompletionResult


class ClaudeProvider(LLMProvider):
    name = "claude"
    # claude-haiku-4-5 indicative pricing (USD per 1M tokens)
    price_in_per_mtok = 1.0
    price_out_per_mtok = 5.0

    def __init__(self, model: Optional[str] = None):
        from anthropic import Anthropic
        self.model = model or settings.ANTHROPIC_MODEL
        kwargs = {"api_key": settings.ANTHROPIC_API_KEY}
        base_url = getattr(settings, "ANTHROPIC_BASE_URL", "") or ""
        if base_url:
            kwargs["base_url"] = base_url
        self.client = Anthropic(**kwargs)

    def _to_anthropic_messages(self, messages: list[Message]):
        system_parts = [m.content for m in messages if m.role == "system"]
        rest = [m for m in messages if m.role != "system"]
        out = []
        for m in rest:
            if m.role == "tool":
                out.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": m.tool_call_id or "",
                        "content": m.content,
                    }],
                })
            else:
                out.append({"role": m.role, "content": m.content})
        return "\n\n".join(system_parts), out

    def _to_anthropic_tools(self, tools: Optional[list[Tool]]):
        if not tools:
            return None
        return [
            {"name": t.name, "description": t.description, "input_schema": t.input_schema}
            for t in tools
        ]

    def complete(self, messages, tools=None, max_tokens=2048, temperature=0.2) -> CompletionResult:
        system, msgs = self._to_anthropic_messages(messages)
        resp = self.client.messages.create(
            model=self.model,
            system=system or "You are a helpful AI architect.",
            messages=msgs,
            tools=self._to_anthropic_tools(tools) or [],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        text_parts = []
        tool_calls = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })
        return CompletionResult(
            text="".join(text_parts),
            tool_calls=tool_calls,
            input_tokens=resp.usage.input_tokens,
            output_tokens=resp.usage.output_tokens,
        )

    def stream(self, messages, tools=None, max_tokens=2048, temperature=0.2) -> Iterator[dict]:
        system, msgs = self._to_anthropic_messages(messages)
        anthro_tools = self._to_anthropic_tools(tools) or []
        with self.client.messages.stream(
            model=self.model,
            system=system or "You are a helpful AI architect.",
            messages=msgs,
            tools=anthro_tools,
            max_tokens=max_tokens,
            temperature=temperature,
        ) as stream:
            current_tool = None
            current_json = ""
            for event in stream:
                et = event.type
                if et == "content_block_start" and getattr(event.content_block, "type", None) == "tool_use":
                    current_tool = {"id": event.content_block.id, "name": event.content_block.name}
                    current_json = ""
                elif et == "content_block_delta":
                    d = event.delta
                    if d.type == "text_delta":
                        yield {"type": "delta", "text": d.text}
                    elif d.type == "input_json_delta":
                        current_json += d.partial_json
                elif et == "content_block_stop" and current_tool is not None:
                    try:
                        args = json.loads(current_json) if current_json else {}
                    except json.JSONDecodeError:
                        args = {}
                    yield {"type": "tool_call", "id": current_tool["id"], "name": current_tool["name"], "arguments": args}
                    current_tool = None
                    current_json = ""
            final = stream.get_final_message()
            yield {
                "type": "done",
                "usage": {
                    "input_tokens": final.usage.input_tokens,
                    "output_tokens": final.usage.output_tokens,
                },
            }
