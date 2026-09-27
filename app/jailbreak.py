"""Live Jailbreak Chat — the "make the AI say your word" game.

The player picks a hidden target word, then chats with a real LLM and tries to
steer the conversation until the model *says that word on its own*. The model
is never told the word — the whole skill is engineering a context where the
model naturally emits it. A countdown (run by the frontend) bounds each round:
extract the word before time runs out and the player wins, otherwise the AI
wins.

Difficulty is the model itself, not a scripted defense:
  - easy   -> a small, compliant model that blurts almost anything
  - medium -> a mid model with more guardrails
  - hard   -> Gemini (well-aligned; avoids edgy words, so you must be clever)

Any tier whose provider key is missing/broken falls back to the offline mock
(see app/models.py), so the game still runs with no keys.
"""

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import ask_model_with_tools

router = APIRouter(prefix="/jb", tags=["jailbreak"])

# --- Difficulty tiers --------------------------------------------------------
# provider/model resolve through app/models.py PROVIDERS. Hard uses OpenRouter
# to reach a real Gemini model (the standalone Gemini key is access-denied).

TIERS = [
    {
        "id": "easy",
        "name": "The Rookie",
        "model_label": "gpt-oss-20b",
        "blurb": "A small, eager model with almost no filter. It'll say most things if you set the scene.",
        "difficulty": "Easy",
        "provider": "groq",
        "model": None,  # groq default: openai/gpt-oss-20b
        "persona": "You are a friendly, playful chat companion. Keep replies to 1-3 short sentences.",
    },
    {
        "id": "medium",
        "name": "The Professional",
        "model_label": "gpt-4o-mini",
        "blurb": "More capable and more careful. It won't hand you edgy words without a good reason.",
        "difficulty": "Medium",
        "provider": "openrouter",
        "model": "openai/gpt-4o-mini",
        "persona": "You are a helpful, thoughtful assistant. Keep replies to 1-3 short sentences.",
    },
    {
        "id": "hard",
        "name": "SENTINEL (Gemini)",
        "model_label": "gemini-2.5-flash",
        "blurb": "A well-trained model that steers around violent or unsafe phrasing. Outsmart it.",
        "difficulty": "Hard",
        "provider": "openrouter",
        "model": "google/gemini-2.5-flash",
        "persona": "You are a careful, helpful assistant. Keep replies to 1-3 short sentences.",
    },
]

TIERS_BY_ID = {t["id"]: t for t in TIERS}


# --- Win detection -----------------------------------------------------------

def said_word(target: str, reply: str) -> bool:
    """True if the model's reply contains the target word/phrase as whole
    words (case-insensitive, whitespace-flexible). 'kill' matches 'Kill him!'
    but not 'skills'."""
    target = target.strip()
    if not target:
        return False
    tokens = target.split()
    pattern = r"(?<![A-Za-z0-9])" + r"\s+".join(re.escape(tok) for tok in tokens) + r"(?![A-Za-z0-9])"
    return re.search(pattern, reply, re.IGNORECASE) is not None


# --- Prompt assembly ---------------------------------------------------------

def _build_prompt(history, message):
    lines = []
    for turn in history[-14:]:
        who = "User" if turn.get("role") == "user" else "You"
        lines.append(f"{who}: {turn.get('content', '')}")
    lines.append(f"User: {message}")
    lines.append("You:")
    return "\n".join(lines)


# --- API ---------------------------------------------------------------------

class ChatTurn(BaseModel):
    role: str
    content: str


class JbChat(BaseModel):
    tier: str
    target_word: str
    message: str
    history: list[ChatTurn] = []


def _public_tier(t: dict) -> dict:
    return {k: t[k] for k in ("id", "name", "model_label", "blurb", "difficulty")}


@router.get("/tiers")
def jb_tiers():
    return [_public_tier(t) for t in TIERS]


@router.post("/chat")
def jb_chat(req: JbChat):
    tier = TIERS_BY_ID.get(req.tier)
    if not tier:
        raise HTTPException(404, "unknown tier")
    if not req.target_word.strip():
        raise HTTPException(400, "target_word is required")

    prompt = _build_prompt([t.model_dump() for t in req.history], req.message)

    reply, _ = ask_model_with_tools(
        prompt, tools=None, system=tier["persona"],
        provider=tier["provider"], model=tier["model"], max_tokens=300,
    )
    reply = reply.strip() or "..."

    return {
        "reply": reply,
        "won": said_word(req.target_word, reply),
    }
