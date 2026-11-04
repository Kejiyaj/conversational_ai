"""Interactive CLI: `python -m wealth_agent` (requires a local Ollama server)."""

from __future__ import annotations

import sys

from wealth_agent.agent import ask, build_agent
from wealth_agent.model import build_model
from wealth_agent.prompts import PROMPT_VERSION


def main() -> int:
    agent = build_agent(build_model(), quiet=True)
    print(f"Wealth agent (demo data, prompt {PROMPT_VERSION}). Type 'exit' to quit.")
    while True:
        try:
            text = input("\nyou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if text.lower() in {"exit", "quit"}:
            return 0
        if not text:
            continue
        try:
            print(f"\nagent> {ask(agent, text)}")
        except Exception as exc:  # noqa: BLE001 - keep the REPL alive, show a short reason
            print(
                f"\nerror> model call failed ({type(exc).__name__}). Is Ollama running?",
                file=sys.stderr,
            )


if __name__ == "__main__":
    sys.exit(main())
