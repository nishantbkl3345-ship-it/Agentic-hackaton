from dotenv import load_dotenv

load_dotenv()

import io
import os
import secrets
import string
import uuid

import qrcode
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import db
from app.attacks import run_free_text
from app.jailbreak import router as jailbreak_router
from app.audit import router as audit_router
from app.crucible import router as crucible_router
from app.auth import SESSION_COOKIE, current_operator, hash_password, set_session_cookie, verify_password
from app.db import get_conn
from app.elo import update_elo
from app.levels import LEVEL_ORDER, LEVELS_BY_ID
from app.report import attack_severity, build_report, proves
from app.scanner import scan_repo

app = FastAPI(title="SentinelLLM")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jailbreak_router)
app.include_router(audit_router)
app.include_router(crucible_router)

TARGET_PATH = "target"
ALL_FINDINGS = scan_repo(TARGET_PATH)

XP_BREACH = {"high": 30, "medium": 15, "low": 5}
XP_DEFENSE = 50
XP_LEVEL_CLEAR = 100
XP_BOSS_CLEAR = 250
XP_FIRST_BLOOD = 150
HINT_PENALTY_FRACTION = 0.2

# Free-text attacks have no fixed category — it's derived from the judge's
# verdict reason after the fact, same mapping app/report.py:REASON_TO_TYPES
# implies for scan-finding types.
REASON_TO_CATEGORY = {
    "canary_leak": "prompt_injection",
    "system_prompt_leak": "prompt_injection",
    "unsafe_action": "unsafe_action",
}


def _findings_for(level: dict) -> list:
    return [f for f in ALL_FINDINGS if f["file"] == level["target_file"]]


def _latest_results(progress: dict) -> dict:
    return (progress["results"] or {}).get("latest", {})


def _discovered(progress: dict) -> list:
    return (progress["results"] or {}).get("discovered", [])


def _is_level_clear(level: dict, discovered: list, patched: set) -> bool:
    return all(c["category"] in discovered and c["category"] in patched for c in level["vuln_categories"])


def _display_results(progress: dict) -> list:
    """Score/confirmed_live should reflect *current* patch state, not just
    discovery history — a patched category is live-enforced safe the moment
    it's patched, with no separate "replay to confirm" step in free-text
    mode. Categories not yet patched keep showing their last real verdict."""
    patched = set(progress["patches"])
    out = []
    for category, result in _latest_results(progress).items():
        result = dict(result)
        if category in patched:
            result["result"] = "safe"
        out.append(result)
    return out


def _level_or_404(level_id: str) -> dict:
    if level_id not in LEVELS_BY_ID:
        raise HTTPException(404, "unknown level")
    return LEVELS_BY_ID[level_id]


def build_target(level: dict, patch_categories):
    """A fresh target instance per call: patches live in Postgres per
    operator, not on a shared singleton, so two operators playing the same
    level never share fix state."""
    target = level["target_factory"](provider=level.get("provider", "anthropic"), model=level.get("model"))
    for category in level["preapplied_patches"]:
        target.patches.apply(category)
    for category in patch_categories:
        target.patches.apply(category)
    return target


def _is_unlocked(level_id: str, cleared: set) -> bool:
    if level_id == "boss":
        return all(lid in cleared for lid in LEVEL_ORDER if lid != "boss")
    idx = LEVEL_ORDER.index(level_id)
    return idx == 0 or LEVEL_ORDER[idx - 1] in cleared


def _report_for(conn, operator_id, level_id) -> dict:
    level = _level_or_404(level_id)
    progress = db.get_mission_progress(conn, operator_id, level_id)
    findings = _findings_for(level)
    return build_report(findings, _display_results(progress))


def _operator_public(op: dict) -> dict:
    return {
        "id": str(op["id"]),
        "username": op["username"],
        "display_name": op["display_name"],
        "is_guest": op["is_guest"],
        "xp_total": op["xp_total"],
        "elo": op["elo"],
        "onboarded": op["onboarded"],
    }


ACHIEVEMENT_DEFS = [
    ("first_blood", "FIRST BLOOD"),
    ("canary_hunter", "CANARY HUNTER"),
    ("tool_breaker", "TOOL BREAKER"),
    ("patch_master", "PATCH MASTER"),
    ("fortress_breaker", "FORTRESS BREAKER"),
]


def _join_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class PatchRequest(BaseModel):
    category: str


class AttackRequest(BaseModel):
    message: str


class SignupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class EventCreateRequest(BaseModel):
    name: str


class EventJoinRequest(BaseModel):
    display_name: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def me(operator: dict = Depends(current_operator)):
    return _operator_public(operator)


@app.post("/auth/signup")
def signup(req: SignupRequest, operator: dict = Depends(current_operator)):
    username = req.username.strip()
    if len(username) < 3 or len(req.password) < 6:
        raise HTTPException(400, "username must be 3+ chars, password 6+ chars")
    if not operator["is_guest"]:
        raise HTTPException(409, "already signed in as a named operator")
    with get_conn() as conn:
        if db.get_operator_by_username(conn, username):
            raise HTTPException(409, "username taken")
        updated = db.convert_guest_to_account(conn, operator["id"], username, hash_password(req.password))
    return _operator_public(updated)


@app.post("/auth/login")
def login(req: LoginRequest, response: Response):
    with get_conn() as conn:
        found = db.get_operator_by_username(conn, req.username.strip())
        if not found or not found["password_hash"] or not verify_password(req.password, found["password_hash"]):
            raise HTTPException(401, "invalid username or password")
        token = db.create_session(conn, found["id"])
    set_session_cookie(response, token)
    return _operator_public(found)


@app.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with get_conn() as conn:
            db.delete_session(conn, token)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.post("/onboarding/seen")
def onboarding_seen(operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        db.set_onboarded(conn, operator["id"])
    return {"ok": True}


@app.get("/levels")
def list_levels(operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        cleared = db.cleared_level_ids(conn, operator["id"])
        claims = db.first_blood_claims(conn)
        out = []
        for level_id in LEVEL_ORDER:
            level = LEVELS_BY_ID[level_id]
            progress = db.get_mission_progress(conn, operator["id"], level_id)
            report = build_report(_findings_for(level), _display_results(progress))
            out.append({
                "id": level_id,
                "name": level["name"],
                "blurb": level["blurb"],
                "difficulty": level["difficulty"],
                "boss": level["boss"],
                "unlocked": _is_unlocked(level_id, cleared),
                "cleared": level_id in cleared,
                "first_blood_claimed": level_id in claims,
                "security_score": report["score"],
                "attempt_limit": level["attempt_limit"],
                "attempts_used": progress["attempts_used"],
                "hints_used": progress["hints_used"],
                "hints_available": len(level.get("hints", [])),
                "reward_xp": XP_BOSS_CLEAR if level["boss"] else XP_LEVEL_CLEAR,
                "attack_count": len(level["vuln_categories"]),
            })
    return out


@app.get("/operator/stats")
def operator_stats(operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        cleared = db.cleared_level_ids(conn, operator["id"])
        claims = db.first_blood_claims(conn)
        rows = db.all_mission_progress(conn, operator["id"])

    exploits = 0
    patches_applied = 0
    has_canary = False
    has_tool_breach = False
    for row in rows:
        patches_applied += len(row["patches"] or [])
        for r in (row["results"] or {}).get("latest", {}).values():
            if r.get("result") == "success":
                exploits += 1
                if r.get("reason") == "canary_leak":
                    has_canary = True
                if r.get("category") == "unsafe_action":
                    has_tool_breach = True

    my_first_bloods = sum(1 for c in claims.values() if c["operator_id"] == operator["id"])

    unlocked = set()
    if my_first_bloods > 0:
        unlocked.add("first_blood")
    if has_canary:
        unlocked.add("canary_hunter")
    if has_tool_breach:
        unlocked.add("tool_breaker")
    if patches_applied >= 3:
        unlocked.add("patch_master")
    if "boss" in cleared:
        unlocked.add("fortress_breaker")

    return {
        "missions_cleared": len(cleared),
        "missions_total": len(LEVEL_ORDER),
        "exploits": exploits,
        "patches": patches_applied,
        "achievements": [
            {"id": key, "label": label, "unlocked": key in unlocked}
            for key, label in ACHIEVEMENT_DEFS
        ],
    }


@app.get("/levels/{level_id}/report")
def level_report(level_id: str, operator: dict = Depends(current_operator)):
    _level_or_404(level_id)
    with get_conn() as conn:
        return _report_for(conn, operator["id"], level_id)


@app.get("/levels/{level_id}/attacks")
def level_attacks(level_id: str):
    level = _level_or_404(level_id)
    return {
        "categories": level["vuln_categories"],
        "input_label": level["input_label"],
        "input_placeholder": level["input_placeholder"],
    }


@app.get("/levels/{level_id}/patches")
def level_patches(level_id: str, operator: dict = Depends(current_operator)):
    _level_or_404(level_id)
    with get_conn() as conn:
        progress = db.get_mission_progress(conn, operator["id"], level_id)
    return sorted(progress["patches"])


@app.post("/levels/{level_id}/patch")
def patch_level(
    level_id: str,
    req: PatchRequest,
    event_id: str | None = Query(default=None),
    operator: dict = Depends(current_operator),
):
    level = _level_or_404(level_id)
    event_uuid = uuid.UUID(event_id) if event_id else None
    with get_conn() as conn:
        progress = db.get_mission_progress(conn, operator["id"], level_id)
        already_patched = req.category in progress["patches"]
        patches = sorted(set(progress["patches"]) | {req.category})
        discovered = _discovered(progress)
        was_cleared = progress["cleared"]
        level_cleared_now = not was_cleared and _is_level_clear(level, discovered, set(patches))

        xp_gained = 0
        if not already_patched and req.category in discovered:
            xp_gained += XP_DEFENSE
            db.record_activity(conn, operator["id"], "patch", level_id, req.category, event_uuid)

        elo_delta = 0
        if level_cleared_now:
            bonus = XP_BOSS_CLEAR if level["boss"] else XP_LEVEL_CLEAR
            bonus = int(bonus * max(0.0, 1 - HINT_PENALTY_FRACTION * progress["hints_used"]))
            xp_gained += bonus
            db.record_activity(conn, operator["id"], "level_clear", level_id, str(bonus), event_uuid)
            new_elo = update_elo(operator["elo"], level["difficulty"], won=True)
            elo_delta = new_elo - operator["elo"]
            db.set_elo(conn, operator["id"], new_elo)

        db.save_mission_progress(
            conn, operator["id"], level_id,
            patches=patches, results=progress["results"] or {},
            attempts_used=progress["attempts_used"], hints_used=progress["hints_used"],
            cleared=was_cleared or level_cleared_now,
        )
        if xp_gained:
            db.add_xp(conn, operator["id"], xp_gained)

        next_level_id = None
        if level_cleared_now:
            cleared = db.cleared_level_ids(conn, operator["id"])
            idx = LEVEL_ORDER.index(level_id)
            if idx + 1 < len(LEVEL_ORDER) - 1:
                next_level_id = LEVEL_ORDER[idx + 1]
            elif _is_unlocked("boss", cleared) and "boss" not in cleared:
                next_level_id = "boss"

    return {
        "patched": patches,
        "xp_gained": xp_gained,
        "elo_delta": elo_delta,
        "level_cleared": level_cleared_now,
        "next_level_id": next_level_id,
    }


@app.post("/levels/{level_id}/reset")
def reset_level(level_id: str, operator: dict = Depends(current_operator)):
    _level_or_404(level_id)
    with get_conn() as conn:
        db.reset_mission_progress(conn, operator["id"], level_id)
        return _report_for(conn, operator["id"], level_id)


@app.post("/reset-progress")
def reset_progress(operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        db.reset_all_progress(conn, operator["id"])
    return {"ok": True}


@app.get("/progress")
def progress(operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        cleared = db.cleared_level_ids(conn, operator["id"])
    return {
        "xp_total": operator["xp_total"],
        "elo": operator["elo"],
        "cleared_level_ids": sorted(cleared),
    }


@app.post("/levels/{level_id}/hint")
def take_hint(level_id: str, operator: dict = Depends(current_operator)):
    level = _level_or_404(level_id)
    hints = level.get("hints", [])
    with get_conn() as conn:
        progress = db.get_mission_progress(conn, operator["id"], level_id)
        used = progress["hints_used"]
        if used >= len(hints):
            raise HTTPException(409, "no more hints for this mission")
        text = hints[used]
        db.save_mission_progress(
            conn, operator["id"], level_id,
            patches=progress["patches"], results=progress["results"] or {},
            attempts_used=progress["attempts_used"], hints_used=used + 1,
            cleared=progress["cleared"],
        )
    return {"hint": text, "hints_used": used + 1, "hints_available": len(hints)}


@app.post("/levels/{level_id}/attack")
def attack_one(
    level_id: str,
    req: AttackRequest,
    event_id: str | None = Query(default=None),
    operator: dict = Depends(current_operator),
):
    level = _level_or_404(level_id)
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "message required")

    event_uuid = uuid.UUID(event_id) if event_id else None

    with get_conn() as conn:
        cleared = db.cleared_level_ids(conn, operator["id"])
        if not _is_unlocked(level_id, cleared):
            raise HTTPException(403, "level locked")

        progress = db.get_mission_progress(conn, operator["id"], level_id)
        if level["attempt_limit"] is not None and progress["attempts_used"] >= level["attempt_limit"]:
            raise HTTPException(409, "no attempts remaining")

        latest = dict(_latest_results(progress))
        discovered = list(_discovered(progress))
        was_cleared = progress["cleared"]

        target = build_target(level, progress["patches"])
        result = run_free_text(message, target.chat)
        attempts_used = progress["attempts_used"] + 1

        findings = _findings_for(level)
        findings_hit = []
        xp_gained = 0
        first_blood_awarded = False
        category = REASON_TO_CATEGORY.get(result["reason"])

        if result["result"] == "success" and category:
            result["category"] = category
            findings_hit = [f for f in findings if f["type"] in proves(result)]
            latest[category] = result
            if category not in discovered:
                severity = attack_severity(result, findings_hit)
                xp_gained += XP_BREACH.get(severity, 15)
                discovered.append(category)
                if db.claim_first_blood_if_free(conn, level_id, event_uuid, operator["id"], category):
                    first_blood_awarded = True
                    xp_gained += XP_FIRST_BLOOD
                    db.record_activity(conn, operator["id"], "first_blood", level_id, category, event_uuid)
                db.record_activity(conn, operator["id"], "breach", level_id, category, event_uuid)

        claims = db.first_blood_claims(conn, event_uuid)
        result["first_blood"] = bool(category) and claims.get(level_id, {}).get("attack_id") == category

        patched = set(progress["patches"])
        report = build_report(findings, [
            {**r, "result": "safe"} if cat in patched else r for cat, r in latest.items()
        ])
        level_cleared_now = not was_cleared and _is_level_clear(level, discovered, patched)

        elo_delta = 0
        if level_cleared_now:
            bonus = XP_BOSS_CLEAR if level["boss"] else XP_LEVEL_CLEAR
            bonus = int(bonus * max(0.0, 1 - HINT_PENALTY_FRACTION * progress["hints_used"]))
            xp_gained += bonus
            db.record_activity(conn, operator["id"], "level_clear", level_id, str(bonus), event_uuid)
            new_elo = update_elo(operator["elo"], level["difficulty"], won=True)
            elo_delta = new_elo - operator["elo"]
            db.set_elo(conn, operator["id"], new_elo)

        attempts_remaining = None
        boss_lost = False
        if level["attempt_limit"] is not None:
            attempts_remaining = max(0, level["attempt_limit"] - attempts_used)
            if not level_cleared_now and attempts_remaining == 0:
                boss_lost = True
                new_elo = update_elo(operator["elo"], level["difficulty"], won=False)
                elo_delta = new_elo - operator["elo"]
                db.set_elo(conn, operator["id"], new_elo)

        db.save_mission_progress(
            conn, operator["id"], level_id,
            patches=progress["patches"], results={"latest": latest, "discovered": discovered},
            attempts_used=attempts_used, hints_used=progress["hints_used"],
            cleared=was_cleared or level_cleared_now,
        )
        if xp_gained:
            db.add_xp(conn, operator["id"], xp_gained)

        next_level_id = None
        if level_cleared_now:
            idx = LEVEL_ORDER.index(level_id)
            new_cleared = cleared | {level_id}
            if idx + 1 < len(LEVEL_ORDER) - 1:
                next_level_id = LEVEL_ORDER[idx + 1]
            elif _is_unlocked("boss", new_cleared) and "boss" not in new_cleared:
                next_level_id = "boss"

    return {
        "attack": result,
        "findings_hit": findings_hit,
        "score": report["score"],
        "confirmed_live": report["confirmed_live"],
        "xp_gained": xp_gained,
        "xp_total": operator["xp_total"] + xp_gained,
        "elo_delta": elo_delta,
        "first_blood": first_blood_awarded,
        "level_cleared": level_cleared_now,
        "boss_lost": boss_lost,
        "next_level_id": next_level_id,
        "attempts_remaining": attempts_remaining,
    }


@app.get("/leaderboard")
def leaderboard(sort: str = "xp", event_id: str | None = None, operator: dict = Depends(current_operator)):
    event_uuid = uuid.UUID(event_id) if event_id else None
    with get_conn() as conn:
        rows = db.top_leaderboard(conn, sort=sort, event_id=event_uuid)
        rank = db.operator_rank(conn, operator["id"], sort=sort) if not operator["is_guest"] else None
    return {
        "rows": [
            {
                "id": str(r["id"]), "display_name": r["display_name"],
                "xp_total": r["xp_total"], "elo": r["elo"], "rank": r["rank"],
            }
            for r in rows
        ],
        "you": {
            "id": str(operator["id"]),
            "display_name": operator["display_name"],
            "xp_total": operator["xp_total"],
            "elo": operator["elo"],
            "rank": rank,
            "is_guest": operator["is_guest"],
        },
    }


@app.get("/activity/recent")
def activity_recent(event_id: str | None = None):
    event_uuid = uuid.UUID(event_id) if event_id else None
    with get_conn() as conn:
        rows = db.recent_activity(conn, event_id=event_uuid)
        active = db.active_operator_count(conn)
    return {
        "items": [
            {
                "ts": r["ts"].isoformat(), "kind": r["kind"], "level_id": r["level_id"],
                "detail": r["detail"], "display_name": r["display_name"],
            }
            for r in rows
        ],
        "active_operators": active,
    }


@app.post("/events")
def create_event(req: EventCreateRequest, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        code = _join_code()
        event = db.create_event(conn, operator["id"], req.name.strip() or "SENTINELLLM EVENT", code)
        db.join_event(conn, event["id"], operator["id"], operator["display_name"])
    return {"id": str(event["id"]), "name": event["name"], "join_code": event["join_code"]}


@app.get("/events/{code}")
def get_event(code: str):
    with get_conn() as conn:
        event = db.get_event_by_code(conn, code.upper())
        if not event:
            raise HTTPException(404, "unknown event code")
        count = db.event_participant_count(conn, event["id"])
    return {"id": str(event["id"]), "name": event["name"], "join_code": event["join_code"], "participant_count": count}


@app.post("/events/{code}/join")
def join_event(code: str, req: EventJoinRequest, operator: dict = Depends(current_operator)):
    with get_conn() as conn:
        event = db.get_event_by_code(conn, code.upper())
        if not event:
            raise HTTPException(404, "unknown event code")
        db.join_event(conn, event["id"], operator["id"], req.display_name.strip() or operator["display_name"])
        db.record_activity(conn, operator["id"], "join", None, req.display_name, event["id"])
    return {"id": str(event["id"]), "name": event["name"], "join_code": event["join_code"]}


@app.get("/events/{code}/qr.png")
def event_qr(code: str):
    with get_conn() as conn:
        event = db.get_event_by_code(conn, code.upper())
        if not event:
            raise HTTPException(404, "unknown event code")

    base_url = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")
    img = qrcode.make(f"{base_url}/j/{event['join_code']}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
