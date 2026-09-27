"""MindGrid AI Duel — LLM players for the block escape puzzle.

The puzzle engine lives in the frontend (frontend/src/mindgrid/engine.js) and
is the single source of truth for the rules: it renders the board as text,
lists every legal slide, and validates whatever move a model picks. This
module only turns that text into a prompt, asks the model for one move, and
parses the answer. After the race, /reflect asks each model to explain its
own approach so the player can compare how the two reasoned.
"""

import json
import re
import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.audit import DEMO_MODELS, ModelRef, _ask, _resolve

router = APIRouter(prefix="/mindgrid", tags=["mindgrid"])

SYSTEM = """You are an expert puzzle solver playing MindGrid, a sliding-block escape puzzle.

RULES
- The board is a grid. Each letter is one cell of a block; '.' is empty.
- A block slides in a straight line: up, down, left or right. No diagonals, no rotation.
- A block can never overlap another block or pass through it.
- Each block has a color and may ONLY leave through the exit of its own color.
- To leave, the block slides toward that exit's edge; every row (for left/right exits)
  or column (for top/bottom exits) of the block must be inside the exit opening,
  and the path to the edge must be clear.
- Goal: get every block off the board in as few moves as possible.

STRATEGY TIPS
- Exit any block that can exit right now.
- Otherwise, find the block closest to escaping and clear what blocks it.
- Avoid moving a block back to where it just was.

REPLY FORMAT — reply with ONLY one JSON object, nothing else:
{"block": "A", "dir": "left", "dist": 2, "why": "one short sentence"}
Use "dist": "exit" to slide a block out through its exit.
Only choose moves from the LEGAL MOVES list."""


class MoveReq(BaseModel):
    model: ModelRef | str
    board: str
    exits: str
    blocks: str
    legal: str
    history: list[str] = []
    turn: int = 1
    seconds_left: int | None = None


class ReflectReq(BaseModel):
    model: ModelRef | str
    level_name: str
    outcome: str
    stats: str
    move_log: list[str] = []


@router.get("/models")
def mindgrid_models():
    return {"models": DEMO_MODELS}


def _parse_move(text: str):
    """Pull {block, dir, dist, why} out of a model reply. Tolerant of prose,
    code fences and minor format drift; returns None if nothing usable."""
    if not text:
        return None, ""
    for m in re.finditer(r"\{[^{}]*\}", text, re.DOTALL):
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            continue
        if "block" in obj and "dir" in obj:
            dist = obj.get("dist", 1)
            if isinstance(dist, str) and dist.strip().lower() != "exit":
                dist = int(re.sub(r"\D", "", dist) or 1)
            elif isinstance(dist, str):
                dist = "exit"
            return {
                "block": str(obj["block"]).strip().upper(),
                "dir": str(obj["dir"]).strip().lower(),
                "dist": dist,
            }, str(obj.get("why", "")).strip()
    # Fallback: "move A left 2" / "A exit left"
    m = re.search(r"\b([A-Z]{1,2})\b\W+(up|down|left|right)\W+(exit|\d+)", text, re.IGNORECASE)
    if m:
        dist = m.group(3).lower()
        return {
            "block": m.group(1).upper(),
            "dir": m.group(2).lower(),
            "dist": "exit" if dist == "exit" else int(dist),
        }, ""
    return None, ""


@router.post("/move")
def mindgrid_move(req: MoveReq):
    model = _resolve(req.model)
    recent = "\n".join(req.history[-8:]) or "(none yet)"
    clock = f"{req.seconds_left}s left on the clock. " if req.seconds_left is not None else ""
    prompt = (
        f"TURN {req.turn}. {clock}\n\n"
        f"BOARD\n{req.board}\n\n"
        f"EXITS\n{req.exits}\n\n"
        f"BLOCKS\n{req.blocks}\n\n"
        f"LEGAL MOVES (max distance per direction)\n{req.legal}\n\n"
        f"YOUR RECENT MOVES\n{recent}\n\n"
        "Choose your next move. Reply with ONLY the JSON object."
    )
    t0 = time.time()
    try:
        raw = _ask(model, prompt, SYSTEM, max_tokens=600)
        error = None
    except Exception as e:  # provider/network failure: surface, don't crash the duel
        raw, error = "", str(e)[:200]
    move, why = _parse_move(raw)
    return {
        "move": move,
        "why": why,
        "raw": (raw or "")[:400],
        "ms": int((time.time() - t0) * 1000),
        "error": error,
    }


@router.post("/reflect")
def mindgrid_reflect(req: ReflectReq):
    model = _resolve(req.model)
    log = "\n".join(req.move_log[-40:]) or "(no moves)"
    prompt = (
        f"You just played the MindGrid puzzle '{req.level_name}' against another AI.\n"
        f"Outcome: {req.outcome}\n"
        f"Stats: {req.stats}\n\n"
        f"Your move log (with the reason you gave each time):\n{log}\n\n"
        "Explain your approach to the user in 4-6 plain sentences: the overall strategy "
        "you followed, the key moments, any mistakes or loops, and what you would do "
        "differently next time. No JSON, no bullet points."
    )
    try:
        text = _ask(model, prompt, "You are a thoughtful AI reflecting honestly on how you played a puzzle.", max_tokens=700)
    except Exception as e:
        text = f"(could not get a reflection: {str(e)[:120]})"
    return {"label": model["label"], "reasoning": (text or "").strip() or "(no reflection returned)"}
