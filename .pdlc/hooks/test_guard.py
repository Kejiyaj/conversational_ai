"""Tests for the PDLC guard hook. Run: python3 -m unittest discover -s .pdlc/hooks"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GUARD = Path(__file__).with_name("guard.py")


def run(payload, cwd):
    proc = subprocess.run(
        [sys.executable, str(GUARD)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=cwd,
        env={**os.environ, "CLAUDE_PROJECT_DIR": cwd},
    )
    return proc.returncode, proc.stdout, proc.stderr


def bash(command, cwd):
    return run({"hook_event_name": "PreToolUse", "tool_name": "Bash",
                "tool_input": {"command": command}, "cwd": cwd}, cwd)


def prompt(text, cwd):
    return run({"hook_event_name": "UserPromptSubmit", "prompt": text, "cwd": cwd}, cwd)


class GuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        subprocess.run(["git", "init", "-q", "-b", "feature-x", self.dir], check=True)
        (Path(self.dir) / ".pdlc").mkdir()
        (Path(self.dir) / ".pdlc" / "config.yaml").write_text(
            "git:\n  protected_branches: [main, release]\njira:\n  project_keys: [CONVAI]\n"
        )

    def tearDown(self):
        self.tmp.cleanup()

    def checkout(self, branch):
        subprocess.run(["git", "-C", self.dir, "checkout", "-q", "-b", branch], check=True)

    def write_state(self, branch, verify):
        runs = Path(self.dir) / ".pdlc" / "runs"
        runs.mkdir(exist_ok=True)
        (runs / f"{branch}.json").write_text(json.dumps({"steps": {"verify": verify}}))

    # --- pushes ---------------------------------------------------------------

    def test_blocks_push_to_protected_branch_by_refspec(self):
        for cmd in ["git push origin main", "git push origin feature-x:main",
                    "git push -u origin +HEAD:refs/heads/main", "cd x && git push origin release"]:
            with self.subTest(cmd=cmd):
                code, _, err = bash(cmd, self.dir)
                self.assertEqual(code, 2)
                self.assertIn("protected", err)

    def test_blocks_bare_push_while_on_protected_branch(self):
        self.checkout("main")
        code, _, _ = bash("git push", self.dir)
        self.assertEqual(code, 2)

    def test_allows_push_of_feature_branch(self):
        for cmd in ["git push -u origin feature-x", "git push", "git push origin HEAD"]:
            with self.subTest(cmd=cmd):
                self.assertEqual(bash(cmd, self.dir)[0], 0)

    def test_blocks_head_push_while_on_protected_branch(self):
        self.checkout("main")
        self.assertEqual(bash("git push origin HEAD", self.dir)[0], 2)

    def test_ignores_unrelated_commands(self):
        for cmd in ["git status", "echo git push origin main is blocked", "ls main"]:
            with self.subTest(cmd=cmd):
                self.assertEqual(bash(cmd, self.dir)[0], 0)

    def test_default_protected_branches_without_config(self):
        (Path(self.dir) / ".pdlc" / "config.yaml").unlink()
        self.assertEqual(bash("git push origin master", self.dir)[0], 2)
        self.assertEqual(bash("git push origin feature-x", self.dir)[0], 0)

    # --- pull requests ----------------------------------------------------------

    def test_blocks_pr_when_run_verify_not_passed(self):
        self.write_state("feature-x", "failed")
        code, _, err = bash("gh pr create --fill", self.dir)
        self.assertEqual(code, 2)
        self.assertIn("verify", err)

    def test_allows_pr_when_verify_passed(self):
        self.write_state("feature-x", "passed")
        self.assertEqual(bash("gh pr create --fill", self.dir)[0], 0)

    def test_allows_pr_outside_a_pdlc_run(self):
        self.assertEqual(bash("gh pr create --fill", self.dir)[0], 0)

    # --- prompt nudges ----------------------------------------------------------

    def test_suggests_pdlc_for_confluence_or_jira_links(self):
        for text in ["build this https://acme.atlassian.net/wiki/spaces/X/pages/1",
                     "pick up https://acme.atlassian.net/browse/ABC-9",
                     "please do CONVAI-42"]:
            with self.subTest(text=text):
                code, out, _ = prompt(text, self.dir)
                self.assertEqual(code, 0)
                ctx = json.loads(out)["hookSpecificOutput"]["additionalContext"]
                self.assertIn("/pdlc", ctx)

    def test_no_nudge_for_other_prompts_or_explicit_pdlc(self):
        for text in ["fix the UTF-8 bug", "/pdlc CONVAI-42", "ABC-9 means nothing here"]:
            with self.subTest(text=text):
                code, out, _ = prompt(text, self.dir)
                self.assertEqual(code, 0)
                self.assertEqual(out.strip(), "")

    def test_bad_input_never_blocks(self):
        proc = subprocess.run([sys.executable, str(GUARD)], input="not json",
                              capture_output=True, text=True, cwd=self.dir)
        self.assertEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
