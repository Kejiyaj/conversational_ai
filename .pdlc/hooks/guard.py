#!/usr/bin/env python3
"""PDLC guard hook for Claude Code (see .claude/settings.json).

PreToolUse (Bash):
  - blocks `git push` that targets a protected branch (git.protected_branches in .pdlc/config.yaml)
  - blocks `gh pr create` for a /pdlc run whose verify step hasn't passed
UserPromptSubmit:
  - when the prompt has a Confluence/Jira link or a known Jira key, reminds Claude about /pdlc

Exit 2 blocks the tool call and shows stderr to Claude. Anything unexpected exits 0: the guard
must never break normal work.
"""

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

DEFAULT_PROTECTED = ["main", "master"]


def load_config(project_dir):
    path = Path(project_dir) / ".pdlc" / "config.yaml"
    if not path.is_file():
        return {}
    text = path.read_text()
    try:
        import yaml

        return yaml.safe_load(text) or {}
    except ImportError:
        # Minimal fallback: only the inline lists the guard needs.
        def inline_list(key):
            m = re.search(rf"^\s*{key}:\s*\[([^\]]*)\]", text, re.M)
            return [v.strip().strip("'\"") for v in m.group(1).split(",") if v.strip()] if m else None

        return {"git": {"protected_branches": inline_list("protected_branches")},
                "jira": {"project_keys": inline_list("project_keys")}}


def current_branch(cwd):
    out = subprocess.run(["git", "-C", cwd, "symbolic-ref", "--short", "-q", "HEAD"],
                         capture_output=True, text=True)
    return out.stdout.strip() or None


def segments(command):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
    lexer.whitespace_split = True
    seg = []
    for tok in lexer:
        if tok and set(tok) <= set(";&|"):
            if seg:
                yield seg
            seg = []
        else:
            seg.append(tok)
    if seg:
        yield seg


def push_targets(tokens, branch):
    """Branches a `git push` segment would update, or None if it isn't a push."""
    if not tokens or os.path.basename(tokens[0]) != "git" or "push" not in tokens:
        return None
    args = tokens[tokens.index("push") + 1:]
    if any(a in ("--all", "--mirror") for a in args):
        return ["*all*"]
    positional = [a for a in args if not a.startswith("-")]
    refspecs = positional[1:]
    if not refspecs:
        return [branch] if branch else []
    targets = []
    for spec in refspecs:
        spec = spec.lstrip("+")
        dst = spec.split(":", 1)[1] if ":" in spec else spec
        if dst == "HEAD":
            dst = branch or "HEAD"
        targets.append(re.sub(r"^refs/heads/", "", dst))
    return targets


def is_pr_create(tokens):
    return len(tokens) >= 3 and os.path.basename(tokens[0]) == "gh" and tokens[1:3] == ["pr", "create"]


def block(message):
    print(message, file=sys.stderr)
    sys.exit(2)


def pre_tool_use(payload, project_dir, config):
    if payload.get("tool_name") != "Bash":
        return
    command = (payload.get("tool_input") or {}).get("command") or ""
    cwd = payload.get("cwd") or project_dir
    protected = (config.get("git") or {}).get("protected_branches") or DEFAULT_PROTECTED
    branch = current_branch(cwd)
    for tokens in segments(command):
        targets = push_targets(tokens, branch)
        if targets:
            hit = [t for t in targets if t in protected or t == "*all*"]
            if hit:
                block(f"PDLC guard: pushing to protected branch {', '.join(hit)} is blocked. "
                      "Push a feature branch and open a pull request instead "
                      "(see git.protected_branches in .pdlc/config.yaml).")
        if is_pr_create(tokens) and branch:
            state_file = Path(project_dir) / ".pdlc" / "runs" / f"{branch}.json"
            if state_file.is_file():
                verify = (json.loads(state_file.read_text()).get("steps") or {}).get("verify")
                if verify != "passed":
                    block(f"PDLC guard: the /pdlc run for '{branch}' has verify = {verify!r}. "
                          "Run step 7 (Verify) until every check passes before opening the PR.")


def user_prompt_submit(payload, config):
    text = payload.get("prompt") or ""
    if text.lstrip().startswith("/pdlc"):
        return
    keys = (config.get("jira") or {}).get("project_keys") or []
    found = re.search(r"atlassian\.net/(wiki|browse)/", text)
    if not found and keys:
        found = re.search(r"\b(" + "|".join(map(re.escape, keys)) + r")-\d+\b", text)
    if found:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": "The user mentioned a Confluence page or Jira ticket. If they want it "
                                 "built end to end, offer to run /pdlc with it (.pdlc/PLAYBOOK.md).",
        }}))


def main():
    try:
        payload = json.loads(sys.stdin.read())
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
        config = load_config(project_dir)
        event = payload.get("hook_event_name")
        if event == "PreToolUse":
            pre_tool_use(payload, project_dir, config)
        elif event == "UserPromptSubmit":
            user_prompt_submit(payload, config)
    except SystemExit:
        raise
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
