from django.conf import settings
from .base import LLMProvider


def get_provider() -> LLMProvider:
    provider = (settings.LLM_PROVIDER or "claude").lower()
    if provider == "ollama_cloud":
        from .ollama_cloud import OllamaCloudProvider
        return OllamaCloudProvider()
    from .claude import ClaudeProvider
    return ClaudeProvider()
