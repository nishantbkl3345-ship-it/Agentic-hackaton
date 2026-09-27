"""CRUCIBLE shared orchestration — the "one coherent system" piece (spec
sections 7/16). Owns run execution (a plain background thread + a
ThreadPoolExecutor across the enabled categories — no task-queue infra
exists in this app, so this matches its "no extra infra unless needed"
pattern) and score derivation from real recorded crucible_tests rows only.
Each category module owns its own execution shape internally (Security/
Truth/Tools are single-shot-per-test-case, Reliability is N-repetitions);
this module is what makes them one run/scoring/findings system rather than
four disconnected ones.
"""

import statistics
import threading
from concurrent.futures import ThreadPoolExecutor

from app import crucible_db as cdb
from app import crucible_reliability, crucible_security, crucible_tools, crucible_truth
from app.crucible_targets import resolve_target
from app.db import get_conn

CATEGORY_MODULES = {
    "security": crucible_security,
    "truth": crucible_truth,
    "tools": crucible_tools,
    "reliability": crucible_reliability,
}
PASS_STATUSES = {"SAFE", "BLOCKED", "CORRECT", "PASS"}


def _run_category(category, run_id, resolved, depth):
    module = CATEGORY_MODULES[category]
    with get_conn() as conn:
        try:
            module.run(conn, run_id, resolved, depth)
        except Exception as exc:
            cdb.record_test(
                conn, run_id, category=category, test_type="module_error",
                name=f"{category} module crashed", status="NOT_TESTABLE", reason=str(exc),
            )


def _truth_rollup(rows):
    def rate(subset, matches_status):
        testable = [r for r in subset if r["status"] != "NOT_TESTABLE"]
        return round(100 * sum(1 for r in testable if r["status"] == matches_status) / len(testable)) \
            if testable else None

    factual = [r for r in rows if r["test_type"] == "factual_accuracy"]
    hallucination = [r for r in rows if r["test_type"] == "hallucination"]
    contradiction = [r for r in rows if r["test_type"] == "contradiction"]
    groundedness = [r for r in rows if r["test_type"] == "groundedness"]
    return {
        "accuracy": rate(factual, "CORRECT"),
        "unsupported_claim_rate": rate(hallucination, "UNSUPPORTED"),
        "contradiction_rate": rate(contradiction, "CONTRADICTED"),
        "groundedness": rate(groundedness, "CORRECT"),
    }


def _stability_rollup(all_tests, reliability_rows):
    latencies = [t["latency_ms"] for t in all_tests if t["latency_ms"] is not None]
    with_actual = [t for t in all_tests if isinstance(t.get("actual"), dict)]
    errored = [t for t in with_actual if t["actual"].get("error")]
    timeouts = [t for t in errored if "timeout" in (t["actual"].get("error") or "").lower()]
    repeatability = [r for r in reliability_rows if r["test_type"] == "repeatability"]
    return {
        "avg_latency_ms": round(statistics.mean(latencies)) if latencies else None,
        "failure_rate": round(100 * len(errored) / len(with_actual)) if with_actual else None,
        "timeout_rate": round(100 * len(timeouts) / len(with_actual)) if with_actual else None,
        "response_consistency": round(100 * sum(1 for r in repeatability if r["status"] == "PASS") /
                                       len(repeatability)) if repeatability else None,
    }


def compute_scores(tests: list, enabled: list) -> dict:
    by_cat = {}
    for t in tests:
        by_cat.setdefault(t["category"], []).append(t)

    scores = {}
    for cat in enabled:
        rows = by_cat.get(cat, [])
        testable = [r for r in rows if r["status"] != "NOT_TESTABLE"]
        passed = [r for r in testable if r["status"] in PASS_STATUSES]
        entry = {
            "score": round(100 * len(passed) / len(testable)) if testable else None,
            "passed": len(passed), "total": len(testable), "not_testable": len(rows) - len(testable),
        }
        if cat == "truth":
            entry.update(_truth_rollup(rows))
        if cat == "reliability":
            entry.update(_stability_rollup(tests, rows))
        scores[cat] = entry

    numeric = [s["score"] for s in scores.values() if s["score"] is not None]
    return {"overall": round(sum(numeric) / len(numeric)) if numeric else None, **scores}


def execute_run(run_id, operator_id, target_input: dict, configuration: dict):
    with get_conn() as conn:
        try:
            resolved = resolve_target(conn, operator_id, target_input)
        except Exception as exc:
            cdb.complete_run(conn, run_id, {"overall": None, "error": str(exc)}, status="failed")
            return

    depth = configuration.get("depth", "standard")
    enabled = [c for c in ("security", "truth", "tools", "reliability") if configuration.get(c)]

    with ThreadPoolExecutor(max_workers=max(1, len(enabled))) as pool:
        list(pool.map(lambda c: _run_category(c, run_id, resolved, depth), enabled))

    try:
        with get_conn() as conn:
            tests = cdb.list_tests(conn, run_id)
            scores = compute_scores(tests, enabled)
            cdb.complete_run(conn, run_id, scores)
    except Exception as exc:
        # Without this, a bug here would leave the run stuck at status
        # 'running' forever — the live console would poll indefinitely with
        # no error ever surfaced, since this runs on a daemon thread with
        # nothing else watching it.
        with get_conn() as conn:
            cdb.complete_run(conn, run_id, {"overall": None, "error": str(exc)}, status="failed")


def start_run(operator_id, target_input: dict, configuration: dict) -> dict:
    from app.crucible_targets import public_target, target_key_for
    with get_conn() as conn:
        target_key = target_key_for(target_input)
        resolved_for_label = resolve_target(conn, operator_id, target_input)
        run = cdb.create_run(conn, operator_id, public_target(resolved_for_label), target_key, configuration)

    threading.Thread(
        target=execute_run, args=(run["id"], operator_id, target_input, configuration), daemon=True,
    ).start()
    return run
