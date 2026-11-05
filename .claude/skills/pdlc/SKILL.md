---
name: "pdlc"
description: "End-to-end delivery from a Confluence page or Jira ticket to a pull request: read requirements, spec, Figma design (or a proposal), plan, Jira tickets, TDD build, verify, PR. Use when the user gives a Confluence or Jira link and wants it built, or says /pdlc or resume."
argument-hint: "<confluence-url | JIRA-KEY | jira-url> [figma-url] | resume"
user-invocable: true
disable-model-invocation: false
---

## Input

```text
$ARGUMENTS
```

## What to do

Follow `.pdlc/PLAYBOOK.md` exactly, step by step. Read it now, along with `.pdlc/config.yaml`.
If the playbook and this file ever disagree, the playbook wins.

## Claude Code specifics

- **Atlassian (Confluence and Jira):** use the Atlassian MCP tools. In this setup they are
  `mcp__plugin_engineering_atlassian__*`; another install may use a different prefix, so search
  for them with ToolSearch (`atlassian confluence jira`).
  - If only `authenticate` is listed, call it, give the user the sign-in link, then call
    `complete_authentication`.
  - `getAccessibleAtlassianResources` returns the `cloudId` when `atlassian.cloud_id` is blank.
- **Figma:** use the Figma MCP tools, found with ToolSearch (`figma`). Sign in the same way.
  Typical tools are `get_design_context`, `get_screenshot`, `get_metadata` and
  `get_variable_defs`; pass the `node-id` from the Figma URL.
- **Spec Kit steps:** invoke the skills `speckit-specify`, `speckit-clarify`, `speckit-plan`,
  `speckit-tasks`, `speckit-analyze`, `speckit-implement` and `speckit-converge`. Pass this
  run's inputs as the argument.
- **Gates:** use AskUserQuestion with "Approve" and "Request changes" options. Put the file paths
  in the question, since the user may see only the dialog.
- **Build:** if Superpowers skills are available, use `test-driven-development`. Otherwise use
  `speckit-implement`.
- **Review:** in step 7, run `/code-review` on the branch diff.
- **Guard hook:** `.pdlc/hooks/guard.py` blocks pushes to protected branches, and blocks
  `gh pr create` while the run's verify step hasn't passed. If it blocks you, fix the cause;
  don't work around it.
- Keep the user posted with one short line per step, e.g. "Step 3/8 Design: reading 4 Figma
  frames".
