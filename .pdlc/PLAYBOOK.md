# PDLC playbook: requirement to pull request

This playbook is the single source of truth for the `/pdlc` flow. Claude Code, Cursor and GitHub
Copilot each have a thin command that points here, so all three follow the same steps:

- Claude Code: `.claude/skills/pdlc/SKILL.md`
- Cursor: `.cursor/commands/pdlc.md`
- Copilot: `.github/prompts/pdlc.prompt.md`

Settings live in `.pdlc/config.yaml`. Read it before every step and use its values instead of
guessing: project keys, issue types, status names, branch pattern, verify commands and gates.

## Input

`/pdlc <inputs>` accepts any mix of:

- A Confluence page URL (`…atlassian.net/wiki/…`).
- A Jira ticket key (`PROJ-123`) or URL (`…atlassian.net/browse/PROJ-123`).
- A Figma URL (`figma.com/design/…` or `figma.com/file/…`).
- `resume`, or nothing: continue the run for the current branch.

You need at least one Confluence page or Jira ticket to start a new run. If there is neither, ask
for one and stop.

## Rules for every step

1. **Order.** Run the steps in order. Never skip a step. A step can end as `skipped` only where
   this playbook allows it, and the reason must be recorded.
2. **State.** Keep the run's progress in `.pdlc/runs/<branch>.json` (format below). Update it at
   the end of every step. On `resume`, read it and continue from the first step that isn't
   finished.
3. **Gates.** When `gates.<name>` is true in the config, stop at that gate. Show a short summary
   and the file paths, then ask the user to approve or request changes. Record the approval time
   in `approvals`. Silence is not approval.
4. **Outward actions.** Creating or changing Jira tickets, commenting in Confluence, pushing and
   opening a PR all affect other people. Do them only after the matching gate is approved.
5. **Source of truth.** The Jira ticket and Confluence pages describe *what* to build. Spec Kit
   files in `specs/<feature>/` hold the agreed version. If the sources disagree, ask the user;
   don't pick one silently.
6. **Project rules.** Follow `CLAUDE.md` and `.specify/memory/constitution.md`. Write tests
   before code, and run the test suites before calling anything done.
7. **Protected branches.** Never push to `git.protected_branches`. Every change goes through a
   pull request.

### Running a Spec Kit step

The Spec Kit commands live in `.claude/skills/speckit-<name>/SKILL.md`. In Claude Code, invoke the
skill (`/speckit-specify`, …). In other tools, open that file and follow its instructions exactly;
its bash scripts are in `.specify/scripts/bash/`.

## Steps

### 0. Setup

1. Read `.pdlc/config.yaml`.
2. Check that the Atlassian MCP server (Confluence and Jira) is connected, and the Figma one too
   if a Figma link was given. If a server needs sign-in, start the sign-in and wait for it.
3. Make sure the working tree is clean. If it isn't, stop and ask what to do with the changes.
4. Update `git.base_branch` from the remote, then create the feature branch from it:
   - With a ticket: `branch_pattern`, e.g. `CONVAI-123-input-disclaimer`.
   - Without a ticket: the next Spec Kit number, e.g. `006-input-disclaimer`.
   - If `git.use_worktrees` is true, create a worktree for it instead.
5. Create `.pdlc/runs/<branch>.json`.

### 1. Read the requirements

- **Jira ticket:** read its summary, description, acceptance criteria (`jira.fields.acceptance_criteria`
  if set), type, status, comments, attachments, parent and children, and linked issues. Collect any
  Confluence and Figma links it contains.
- **Confluence:** read each page given or linked. Follow child pages when
  `confluence.follow_child_pages` is true, and linked pages up to `confluence.follow_links_depth`.
- Write everything you read to `.pdlc/runs/<branch>/requirements.md`. Use one section per source,
  each with its URL and the date you read it. Keep the wording as written; don't summarise.
- Then add an **Understanding** section, in your own words:
  - The goal, and who it is for.
  - The user journeys.
  - Rules and constraints.
  - Anything out of scope.
  - Open questions.
  - Conflicts between sources.

### 2. Spec

1. Run Spec Kit **specify** with the Understanding section and the requirements file as input.
   Put the Jira key and the source URLs in the spec header.
2. Run Spec Kit **clarify** for the open questions and conflicts. Ask the user; don't guess.
3. Copy `requirements.md` into `<feature_dir>/source.md`.
4. **Gate `spec`:** the user approves the spec.

### 3. Design

1. Find the Figma link: the command arguments first, then the Jira ticket or Confluence pages,
   then `figma.default_file_url`. If none is found, ask the user for one, and tell them they can
   say "no designs".
2. **With Figma:** use the Figma MCP tools to read each frame the feature touches: layout,
   components, text, colours and spacing. Take screenshots for reference. Map the design onto
   what already exists:
   - colours and sizes to the tokens in `figma.design_tokens`;
   - components to `figma.components_dir`.
   List anything in the design that has no match.
3. **Without Figma:** if `figma.required` is true, stop. Otherwise propose a design from the
   requirements, using only the existing components and tokens. Include a layout sketch (ASCII
   or a quick mock-up), the states (empty, loading, error) and accessibility notes. Mark it
   clearly as a proposal.
4. Write the result to `<feature_dir>/design.md`, with Figma frame links or the proposal.
5. **Gate `design`:** the user approves.

### 4. Plan

1. Run Spec Kit **plan**. Pass the design notes as input. The plan must pass the constitution
   check.
2. Run Spec Kit **tasks**.
3. Run Spec Kit **analyze**, and fix any critical or high findings.
4. **Gate `plan`:** the user approves the plan and tasks.

### 5. Jira

1. Choose the parent ticket:
   - **Ticket given:** that ticket is the parent.
   - **No ticket:** create an Epic in `jira.default_project_key` with the spec's title and summary,
     links to the source pages and the spec path. If no project key is set, ask for one.
2. Plan the children from `tasks.md` and `jira.breakdown`:
   - Under an Epic: one Story per user story.
   - Under a Story or Task: one Sub-task per phase.
   - Each child gets its acceptance criteria and the task IDs it covers (`T001–T006`).
3. If the parent already has children, match them to the planned ones by meaning. Reuse the
   matches, and create only what's missing. Never create duplicates.
4. **Gate `jira_create`:** show a table of what will be created or reused, then wait for approval.
5. Create the tickets using `jira.issue_types`, `labels`, `components`, `assignee` and `fields`.
6. Write the ticket keys back into `tasks.md`, next to each user story or phase heading, and into
   the run state.

### 6. Build

1. Move the parent ticket to `jira.statuses.in_progress`.
2. Work through `tasks.md` in order: write tests first, see them fail, then write the code.
   - In Claude Code with Superpowers, use `test-driven-development`.
   - Otherwise, use Spec Kit **implement**.
3. When a child ticket's tasks are all done, move it to `done` and comment with what changed.
4. Commit after each phase, with the Jira key at the start of the message.

### 7. Verify

1. Run every command in `verify`. Any failure makes this step `failed`: fix it and run all of
   them again.
2. Run Spec Kit **converge** to check the code against the spec. Add any missing work as tasks
   and go back to step 6.
3. Review the full diff against the base branch for bugs, security and leftover debug code. In
   Claude Code, use `/code-review`.
4. Only when everything passes, set this step to `passed` and record the commands' results.

### 8. Pull request

1. **Gate `push_and_pr`:** show the branch, the commits, the verify results and the PR text,
   then wait for approval.
2. Push the feature branch. Never push to a protected branch.
3. Open the PR against `git.base_branch`:
   - Title: `<KEY>: <spec title>`.
   - Body: summary, Jira and Confluence links, the spec path, test results and screenshots for
     UI changes.
   - Add `github.reviewers` and `github.labels`, and open it as a draft when `github.draft_pr`
     is true.
   - Use `gh pr create`. If `gh` isn't installed, use a GitHub MCP server. Failing both, give
     the user the compare URL: `https://github.com/<github.repo>/compare/<base>...<branch>`.
4. Link the PR on the parent ticket, and move it to `jira.statuses.in_review`.
5. Report the PR link, the ticket links and anything left open.

## Run state: `.pdlc/runs/<branch>.json`

```json
{
  "branch": "CONVAI-123-input-disclaimer",
  "started_at": "2026-11-05T10:00:00+05:30",
  "inputs": { "jira": "CONVAI-123", "confluence": ["https://…/wiki/…"], "figma": null },
  "feature_dir": "specs/006-input-disclaimer",
  "design_mode": "figma | proposal",
  "jira": { "parent": "CONVAI-123", "children": { "US1": "CONVAI-130", "US2": "CONVAI-131" } },
  "steps": {
    "setup": "done", "read": "done", "spec": "done", "design": "pending",
    "plan": "pending", "jira": "pending", "build": "pending", "verify": "pending", "pr": "pending"
  },
  "approvals": { "spec": "2026-11-05T10:40:00+05:30" },
  "verify_results": [],
  "pr": null,
  "notes": []
}
```

Step values: `pending`, `in_progress`, `done`, `skipped` (with a note), `failed`, `passed` (verify
only). The guard hook in Claude Code reads `steps.verify`. It blocks opening a PR for a run whose
verify step hasn't passed.
