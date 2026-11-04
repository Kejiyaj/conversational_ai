# Plan: Local wealth management agent

*Written manually following `/speckit-plan`. Constitution check: to be confirmed at review.*

## Approach
Strands Agents SDK with `OllamaModel` running `llama3.2` locally. Tools are plain Python functions with code-level validation, wrapped with Strands `@tool`. The agent is constructed by a function that takes a model, so tests inject a stub and AgentCore later only changes the model factory and adds a `BedrockAgentCoreApp` entrypoint.

## Technology
- Python 3.10+ (local is 3.10.18).
- `strands-agents[ollama]` pinned to an exact current version in `requirements.txt` (versions to verify at T001).
- pytest + ruff from `agent/requirements-dev.txt`.
- No AWS SDKs, no network beyond `localhost:11434`.

## Components
| File | Responsibility |
|---|---|
| `src/wealth_agent/data/portfolio.json` | Synthetic portfolio, target allocation, adversarial note |
| `src/wealth_agent/portfolio.py` | Load and validate data; pure calculation functions |
| `src/wealth_agent/tools.py` | Argument validation, `{ok,...}` handlers, Strands `@tool` wrappers |
| `src/wealth_agent/prompts.py` | Versioned system prompt (`PROMPT_VERSION`) and disclaimer text |
| `src/wealth_agent/model.py` | `build_model()` — reads `WEALTH_AGENT_PROVIDER`, `OLLAMA_HOST`, `OLLAMA_MODEL` |
| `src/wealth_agent/agent.py` | `build_agent(model)`, `ask(agent, text)` that appends the disclaimer |
| `src/wealth_agent/__main__.py` | Interactive CLI loop |
| `tests/` | Unit tests for calculations, validation, handler shapes, disclaimer (stub model) |
| `evals/cases.jsonl`, `evals/run_eval.py` | Live golden-case evaluation against Ollama |
| `README.md`, `requirements.txt` | Setup and run instructions |

## Design decisions
- Calculations separated from Strands wrappers so unit tests need neither Strands models nor Ollama.
- Disclaimer appended in `ask()` (code), satisfying FR-005 regardless of model behaviour.
- `temperature=0` for repeatability; small model accepted, tolerance in eval threshold documented.
- Code lives in `agent/` (`agent/src/wealth_agent`, `agent/tests`, `agent/evals`); `agent/pyproject.toml` sets `pythonpath = ["src"]` so `pytest` from `agent/` runs these tests. The existing AgentCore stub `agent/agent.py` is untouched; wiring it to `ask()` is the migration step below.
- Eval records tool calls by reading tool-use blocks from `agent.messages` after each case.

## Migration path to AgentCore (not in scope now)
Add a `bedrock` branch in `build_model()` using `BedrockModel`, and make the `@app.entrypoint` in `agent/agent.py` call `ask()`. Tools, prompt, tests and evals are unchanged.

## Risks
- `llama3.2` (3B) tool-calling is unreliable → may miss the eval threshold; mitigation: report baseline honestly, optional upgrade to a larger model.
- Strands API drift → pin version; verify imports in T001.
