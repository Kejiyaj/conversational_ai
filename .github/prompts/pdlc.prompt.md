---
mode: agent
description: "Requirement to pull request: Confluence/Jira → spec → Figma design → plan → Jira tickets → TDD build → verify → PR"
---

# /pdlc: requirement to pull request

Inputs follow the command: a Confluence URL, a Jira key or URL, an optional Figma URL, or `resume`.

Follow `.pdlc/PLAYBOOK.md` exactly, step by step, using the settings in `.pdlc/config.yaml`.

Copilot specifics:

- **MCP tools:** Confluence, Jira and Figma come from the MCP servers in `.vscode/mcp.json`.
  Start them from the MCP view, and sign in when prompted.
- **Spec Kit steps:** open `.claude/skills/speckit-<name>/SKILL.md` and follow its instructions
  exactly. For example, use `speckit-specify` for the spec step.
- **Gates:** stop and ask in chat. Don't continue until the user replies "approve".
- **Protected branches:** Copilot doesn't run the Claude guard hook, so check the branch yourself
  before every `git push`. Never push to `git.protected_branches`.
