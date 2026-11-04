#!/usr/bin/env python3
"""Live evaluation of the wealth agent against local Ollama.

Usage (from agent/, with the venv active):
    PYTHONPATH=src python evals/run_eval.py [--threshold 0.8] [--cases evals/cases.jsonl]

Each case runs in a fresh agent (no shared history). The run records the tools the agent
called, their arguments and the final answer to evals/runs/<timestamp>.jsonl, then scores:
tool selection, expected arguments, and answer must/must-not phrases.
Exit code is non-zero if any critical case fails or the pass rate is below --threshold.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def normalise(text: str) -> str:
    return text.lower().replace(",", "").replace("’", "'")


def _value_matches(want, got) -> bool:
    try:
        return math.isclose(float(want), float(got), abs_tol=1e-6)
    except (TypeError, ValueError):
        return str(want).strip().lower() == str(got).strip().lower()


def extract_tool_calls(messages: list[dict]) -> list[dict]:
    calls = []
    for message in messages:
        for block in message.get("content", []) or []:
            use = block.get("toolUse") if isinstance(block, dict) else None
            if use:
                calls.append({"name": use.get("name"), "input": use.get("input") or {}})
    return calls


def score_case(case: dict, calls: list[dict], answer: str) -> tuple[bool, str]:
    names = [c["name"] for c in calls]
    allowed = set(case.get("allowed_tools", []))

    disallowed = [n for n in names if n not in allowed]
    if disallowed:
        return False, f"unexpected tool(s): {disallowed}"
    if case.get("require_tool") and not names:
        return False, f"expected one of {sorted(allowed)}, no tool called"

    for tool_name, expected in case.get("expected_args", {}).items():
        matching = [c["input"] for c in calls if c["name"] == tool_name]
        if not any(
            all(k in got and _value_matches(v, got[k]) for k, v in expected.items())
            for got in matching
        ):
            return False, f"args for {tool_name}: expected {expected}, got {matching}"

    text = normalise(answer)
    must = case.get("must_contain_any", [])
    if must and not any(normalise(m) in text for m in must):
        return False, f"answer missing any of {must}"
    bad = [m for m in case.get("must_not_contain", []) if normalise(m) in text]
    if bad:
        return False, f"answer contains forbidden phrase(s): {bad}"
    return True, "ok"


def run_case(case: dict) -> dict:
    from wealth_agent.agent import ask, build_agent
    from wealth_agent.model import build_model

    agent = build_agent(build_model(), quiet=True)
    started = time.monotonic()
    try:
        answer = ask(agent, case["query"])
        error = None
    except Exception as exc:  # noqa: BLE001 - a crash is a failed case, not a crashed eval
        answer, error = "", f"{type(exc).__name__}: {exc}"
    return {
        "id": case["id"],
        "tool_calls": extract_tool_calls(agent.messages),
        "answer": answer,
        "error": error,
        "seconds": round(time.monotonic() - started, 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=Path, default=HERE / "cases.jsonl")
    parser.add_argument("--threshold", type=float, default=0.8)
    args = parser.parse_args()

    from wealth_agent.model import build_model
    from wealth_agent.prompts import PROMPT_VERSION

    model_id = build_model().get_config().get("model_id")
    cases = load_jsonl(args.cases)
    runs_dir = HERE / "runs"
    runs_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = runs_dir / f"{stamp}.jsonl"

    passed = 0
    critical_failures = []
    with out_path.open("w", encoding="utf-8") as out:
        for case in cases:
            record = run_case(case)
            ok, reason = (
                (False, record["error"])
                if record["error"]
                else score_case(case, record["tool_calls"], record["answer"])
            )
            record.update(
                passed=ok,
                reason=reason,
                critical=case.get("critical", False),
                model_id=model_id,
                prompt_version=PROMPT_VERSION,
            )
            out.write(json.dumps(record) + "\n")
            passed += ok
            if not ok and case.get("critical"):
                critical_failures.append(case["id"])
            flag = "PASS" if ok else ("FAIL*" if case.get("critical") else "FAIL")
            tools = [c["name"] for c in record["tool_calls"]]
            print(f"{flag:5} {case['id']:30} tools={tools} {record['seconds']}s  {reason}")

    rate = passed / len(cases) if cases else 0.0
    print(f"\nmodel={model_id} prompt={PROMPT_VERSION}")
    print(f"pass rate {passed}/{len(cases)} = {rate:.0%} (threshold {args.threshold:.0%})")
    print(f"critical failures: {critical_failures or 'none'}")
    print(f"recorded run: {out_path}")
    return 0 if rate >= args.threshold and not critical_failures else 1


if __name__ == "__main__":
    sys.exit(main())
