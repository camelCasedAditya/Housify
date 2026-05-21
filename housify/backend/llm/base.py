"""LLM provider abstraction.

A provider takes a list of normalized messages plus an optional list of tools
and returns either a full text response or a structured tool-call. Streaming
is implemented as a generator of dict events with shape:

    {"type": "delta", "text": "..."}
    {"type": "tool_call", "name": "...", "arguments": {...}}
    {"type": "done", "usage": {"input_tokens": int, "output_tokens": int}}
    {"type": "error", "message": "..."}
"""
from __future__ import annotations
from typing import Iterator, Optional, Any
from dataclasses import dataclass, field


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict  # JSON Schema


@dataclass
class Message:
    role: str  # 'system' | 'user' | 'assistant' | 'tool'
    content: str = ""
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None


@dataclass
class CompletionResult:
    text: str = ""
    tool_calls: list = field(default_factory=list)  # [{name, arguments}]
    input_tokens: int = 0
    output_tokens: int = 0


class LLMProvider:
    name: str = "base"
    # Approximate $ per 1M tokens (override per provider/model).
    price_in_per_mtok: float = 0.0
    price_out_per_mtok: float = 0.0

    def complete(
        self,
        messages: list[Message],
        tools: Optional[list[Tool]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> CompletionResult:
        raise NotImplementedError

    def stream(
        self,
        messages: list[Message],
        tools: Optional[list[Tool]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> Iterator[dict]:
        raise NotImplementedError

    # ---- budget helpers ----
    def estimate_cost_usd(self, in_tokens: int, out_tokens: int) -> float:
        return (in_tokens / 1_000_000) * self.price_in_per_mtok + (
            out_tokens / 1_000_000
        ) * self.price_out_per_mtok
