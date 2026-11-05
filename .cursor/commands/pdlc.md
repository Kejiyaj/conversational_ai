# /pdlc: requirement to pull request

Inputs follow the command: a Confluence URL, a Jira key or URL, an optional Figma URL, or `resume`.

Follow `.pdlc/PLAYBOOK.md` exactly, step by step, using the settings in `.pdlc/config.yaml`.

Cursor specifics:

- **MCP tools:** Confluence, Jira and Figma come from the MCP servers in `.cursor/mcp.json`.
  Sign in when Cursor asks.
- **Spec Kit steps:** open `.claude/skills/speckit-<name>/SKILL.md` and follow its instructions
  exactly. For example, use `speckit-specify` for the spec step.
- **Gates:** stop and ask in chat. Don't continue until the user replies "approve".
- **Protected branches:** Cursor doesn't run the Claude guard hook, so check the branch yourself
  before every `git push`. Never push to `git.protected_branches`.
