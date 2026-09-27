"""CRUCIBLE API — connect an AI, configure and launch a real test run, poll
live progress, inspect evidence-backed findings, retest one, and compare
before/after runs. See app/crucible_engine.py for execution/scoring and
app/crucible_targets.py for target resolution.
"""

import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import crucible_db as cdb
from app import crucible_engine
from app.auth import current_operator
from app.crucible_targets import is_provider_live
from app.db import get_conn
from app.levels import LEVELS

router = APIRouter(prefix="/crucible", tags=["crucible"])


class TargetSpec(BaseModel):
    kind: str  # "bot" | "custom"
    level_id: str | None = None
    label: str | None = None
    provider: str | None = None
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None


class ConfigurationSpec(BaseModel):
    security: bool = True
    truth: bool = True
    tools: bool = True
    reliability: bool = True
    depth: str = "standard"


class RunCreateRequest(BaseModel):
    target: TargetSpec
    configuration: ConfigurationSpec


class RetestRequest(BaseModel):
    api_key: str | None = None


def _run_or_404(conn, run_id: str, operator_id) -> dict:
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(404, "unknown run")
    run = cdb.get_run(conn, rid)
    if not run or run["operator_id"] != operator_id:
        raise HTTPException(404, "unknown run")
    return run


def _run_public(run: dict) -> dict:
    return {
        "id": str(run["id"]), "target": run["target"], "target_key": run["target_key"],
        "configuration": run["configuration"], "status": run["status"], "scores": run["scores"],
        "started_at": run["started_at"].isoformat() if run["started_at"] else None,
        "completed_at": run["completed_at"].isoformat() if run["completed_at"] else None,
    }


def _test_public(t: dict) -> dict:
    return {
        "id": str(t["id"]), "category": t["category"], "test_type": t["test_type"], "name": t["name"],
        "status": t["status"], "severity": t["severity"], "evidence": t["evidence"], "reason": t["reason"],
        "latency_ms": t["latency_ms"], "created_at": t["created_at"].isoformat(),
    }


def _finding_public(f: dict) -> dict:
    return {
        "id": str(f["id"]), "run_id": str(f["run_id"]), "category": f["category"], "severity": f["severity"],
        "title": f["title"], "description": f["description"], "evidence": f["evidence"],
        "remediation": f["remediation"], "status": f["status"], "created_at": f["created_at"].isoformat(),
    }


@router.get("/targets")
def crucible_targets():
    return {
        "bots": [
            {
                "id": lvl["id"], "name": lvl["name"], "provider": lvl.get("provider"), "model": lvl.get("model"),
                "live": is_provider_live(lvl.get("provider")),
            }
            for lvl in LEVELS
        ],
    }


@router.post("/runs")
def create_run(req: RunCreateRequest, operator: dict = Depends(current_operator)):
    target = req.target.model_dump(exclude_none=True)
    configuration = req.configuration.model_dump()
    if not any(configuration[c] for c in ("security", "truth", "tools", "reliability")):
        raise HTTPException(400, "select at least one test category")
    if configuration["depth"] not in ("quick", "standard", "deep"):
        raise HTTPException(400, "depth must be quick, standard or deep")
    try:
        run = crucible_engine.start_run(operator["id"], target, configuration)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"run_id": str(run["id"])}


@router.get("/runs")
def list_runs(target_key: str, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        runs = cdb.list_runs(conn, operator["id"], target_key)
    return [_run_public(r) for r in runs]


@router.get("/runs/compare")
def compare_runs(before: str, after: str, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        before_run = _run_or_404(conn, before, operator["id"])
        after_run = _run_or_404(conn, after, operator["id"])
        before_findings = cdb.list_findings(conn, before_run["id"])
        after_findings = cdb.list_findings(conn, after_run["id"])

    before_scores = before_run["scores"] or {}
    after_scores = after_run["scores"] or {}
    categories = set(before_scores) | set(after_scores)
    deltas = {}
    for cat in categories:
        b, a = before_scores.get(cat), after_scores.get(cat)
        b_score = b["score"] if isinstance(b, dict) else b
        a_score = a["score"] if isinstance(a, dict) else a
        if b_score is None or a_score is None:
            continue
        deltas[cat] = {"before": b_score, "after": a_score, "delta": a_score - b_score}

    def key(f):
        return (f["category"], f["title"])

    before_keys = {key(f) for f in before_findings}
    after_keys = {key(f) for f in after_findings}
    return {
        "before": _run_public(before_run), "after": _run_public(after_run), "deltas": deltas,
        "findings": {
            "new": [_finding_public(f) for f in after_findings if key(f) not in before_keys],
            "resolved": [_finding_public(f) for f in before_findings if key(f) not in after_keys],
            "persisting": [_finding_public(f) for f in after_findings if key(f) in before_keys],
        },
    }


@router.get("/runs/{run_id}")
def get_run(run_id: str, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        run = _run_or_404(conn, run_id, operator["id"])
        counts = cdb.test_counts(conn, run["id"])
    out = _run_public(run)
    out["counts"] = counts
    return out


@router.get("/runs/{run_id}/tests")
def get_run_tests(run_id: str, since_id: str | None = None, category: str | None = None,
                   operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        run = _run_or_404(conn, run_id, operator["id"])
        since_uuid = uuid.UUID(since_id) if since_id else None
        tests = cdb.list_tests(conn, run["id"], since_id=since_uuid, category=category)
    return [_test_public(t) for t in tests]


@router.get("/runs/{run_id}/findings")
def get_run_findings(run_id: str, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        run = _run_or_404(conn, run_id, operator["id"])
        findings = cdb.list_findings(conn, run["id"])
    return [_finding_public(f) for f in findings]


@router.post("/findings/{finding_id}/retest")
def retest_finding(finding_id: str, req: RetestRequest, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        try:
            fid = uuid.UUID(finding_id)
        except ValueError:
            raise HTTPException(404, "unknown finding")
        finding = cdb.get_finding(conn, fid)
        if not finding:
            raise HTTPException(404, "unknown finding")
        run = _run_or_404(conn, str(finding["run_id"]), operator["id"])

    target = dict(run["target"])
    if target.get("kind") == "custom":
        if not req.api_key:
            raise HTTPException(400, "this finding is on a bring-your-own target — api_key is required to retest")
        target["api_key"] = req.api_key

    # Retest always runs at "quick" depth for responsiveness (this is a
    # single-finding recheck, not a re-derivation of run statistics) and only
    # re-executes the one category the finding belongs to.
    mini_config = {"security": False, "truth": False, "tools": False, "reliability": False, "depth": "quick"}
    mini_config[finding["category"]] = True

    try:
        mini_run = crucible_engine.start_run(operator["id"], target, mini_config)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    for _ in range(60):
        with get_conn() as conn:
            check = cdb.get_run(conn, mini_run["id"])
        if check["status"] != "running":
            break
        time.sleep(1)

    with get_conn() as conn:
        new_findings = cdb.list_findings(conn, mini_run["id"])
        still_fails = any(f["title"] == finding["title"] for f in new_findings)
        new_status = "retested_fail" if still_fails else "retested_pass"
        cdb.set_finding_status(conn, fid, new_status)

    return {"status": new_status, "retest_run_id": str(mini_run["id"])}
