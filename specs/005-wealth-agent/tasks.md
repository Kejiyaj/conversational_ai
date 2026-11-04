# Tasks: Local wealth management agent

*Written manually following `/speckit-tasks`; consistency checked manually in place of `/speckit-analyze`. To be executed with TDD per task.*

- [ ] T001 Create a virtualenv, install pinned `strands-agents[ollama]`, verify `Agent`, `tool`, `OllamaModel` imports; write `requirements.txt`
- [ ] T002 Add synthetic `portfolio.json` (incl. target allocation and adversarial note) and failing tests for loading/validation (FR-001)
- [ ] T003 Write failing tests for holdings value and allocation/drift calculations (FR-002); implement in `portfolio.py`
- [ ] T004 Write failing tests for rebalancing summary and savings projection, incl. bounds (FR-002, FR-003); implement
- [ ] T005 Write failing tests for tool argument validation, unknown args and never-raise handlers (FR-003); implement `tools.py`
- [ ] T006 Add a test that no registered tool name or description implies trading/transfers (FR-004)
- [ ] T007 Add versioned prompt and disclaimer; failing test that `ask()` appends the disclaimer using a stub model (FR-005); implement `agent.py`
- [ ] T008 Implement `build_model()` with env configuration and a test for provider selection / unknown provider error (FR-006)
- [ ] T009 Implement CLI `__main__.py`; manual smoke run against local Ollama (AC-004)
- [ ] T010 Write 14 golden cases (9 normal incl. 3 greetings, 2 edge, 3 critical) (FR-007, FR-008)
- [ ] T011 Write `run_eval.py` (live run, records tool calls + answer, scores, non-zero exit on critical failure or < threshold); run baseline
- [ ] T012 Add pytest/ruff config (`pythonpath = ["src"]`) to `agent/pyproject.toml`; run `ruff check`, `ruff format --check`, full `pytest`
- [ ] T013 README; definition-of-done check; baseline evaluation report
