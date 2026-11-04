"""Model factory (FR-006). The only file to change when moving to Bedrock / AgentCore.

Configuration (environment variables):
    WEALTH_AGENT_PROVIDER  default "ollama" (the only provider implemented)
    OLLAMA_HOST            default "http://localhost:11434"
    OLLAMA_MODEL           default "llama3.2"
"""

from __future__ import annotations

import os
from collections.abc import Mapping

from strands.models.model import Model

DEFAULT_PROVIDER = "ollama"
DEFAULT_OLLAMA_HOST = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3.2"


class ModelConfigError(ValueError):
    pass


def build_model(env: Mapping[str, str] | None = None) -> Model:
    env = os.environ if env is None else env
    provider = env.get("WEALTH_AGENT_PROVIDER", DEFAULT_PROVIDER).strip().lower()

    if provider == "ollama":
        from strands.models.ollama import OllamaModel

        return OllamaModel(
            host=env.get("OLLAMA_HOST", DEFAULT_OLLAMA_HOST),
            model_id=env.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
            temperature=0,
        )

    # Future: "bedrock" -> strands.models.BedrockModel(model_id=..., temperature=0)
    raise ModelConfigError(f"unsupported provider: {provider!r} (supported: 'ollama')")
