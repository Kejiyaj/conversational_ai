# CLAUDE.md

## Development workflow

- **Spec Kit owns specs, plans, and tasks.** Use `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, and `/speckit-tasks` for all feature definition and planning (artifacts live in `specs/`). Do not use Superpowers' `brainstorming` or `writing-plans` to produce competing specs or plans.
- **Superpowers owns implementation discipline**, when the Superpowers plugin is installed: `test-driven-development` while working through `tasks.md`, `systematic-debugging` for failures, `using-git-worktrees` for per-spec branches, and `requesting-code-review` / `verification-before-completion` before merging.
- **Fallback:** if Superpowers skills are not available in the session, use Spec Kit for the whole lifecycle: `/speckit-implement` to execute `tasks.md`, `/speckit-analyze` and `/speckit-converge` to check the implementation against the spec, and still write tests before code and run the test suite before declaring work done.
