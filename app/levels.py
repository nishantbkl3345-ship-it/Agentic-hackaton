"""Level definitions for the SentinelLLM arena.

Each level names a target *class* (`target_factory`), not an instance: with
real multi-operator accounts, every request builds a fresh target and
replays that operator's own persisted patches into its PatchState, so two
operators playing the same level never share fix state. Level 2 and the
boss both use AgentBot, but as separately-tracked levels (separate
mission_progress rows), so patching one never affects the other.

Each level also names a "provider"/"model" (see app/models.py) — a different
real LLM per mission, so the game doubles as a comparison of how different
real-world models actually hold up against the same attacks. Without that
provider's API key set, the level transparently falls back to the offline
mock (see app/models.py's ask_model_with_tools). Swap these freely; nothing
else depends on which provider a given level uses.
"""

from app.attacks import ATTACKS_BY_LEVEL
from target.agentbot import AgentBot
from target.docbot import DocBot
from target.foodiebot import FoodieBot

LEVELS = [
    {
        "id": "level1",
        "name": "The Weak Bot",
        "blurb": "A friendly food-ordering bot with no boundary between its instructions and your words.",
        "difficulty": "Easy",
        "target_factory": FoodieBot,
        "target_file": "foodiebot.py",
        "attacks": ATTACKS_BY_LEVEL["level1"],
        "boss": False,
        "attempt_limit": None,
        "preapplied_patches": [],
        "provider": "anthropic",
        "model": None,
        "hints": [
            "This target is vulnerable to prompt injection — its instructions and your words share the same channel.",
            "Look at how the chat handler builds its prompt: instructions and user text are concatenated together, and its output isn't checked before being returned.",
        ],
    },
    {
        "id": "level2",
        "name": "The Agent",
        "blurb": "Now it can act: a refund tool with no spending cap.",
        "difficulty": "Medium",
        "target_factory": AgentBot,
        "target_file": "agentbot.py",
        "attacks": ATTACKS_BY_LEVEL["level2"],
        "boss": False,
        "attempt_limit": None,
        "preapplied_patches": [],
        "provider": "groq",
        "model": None,
        "hints": [
            "This target is vulnerable to unsafe tool use — a connected action has no spending cap.",
            "Look at the discount/refund tool call: the model can invoke it with attacker-influenced arguments and nothing enforces a hard limit server-side.",
        ],
    },
    {
        "id": "level3",
        "name": "The File Reader",
        "blurb": "It only summarizes documents... but never questions what's inside them.",
        "difficulty": "Hard",
        "target_factory": DocBot,
        "target_file": "docbot.py",
        "attacks": ATTACKS_BY_LEVEL["level3"],
        "boss": False,
        "attempt_limit": None,
        "preapplied_patches": [],
        "provider": "glm",
        "model": None,
        "hints": [
            "This target is vulnerable to indirect prompt injection — attacker text can hide inside a document it summarizes.",
            "Look at how the uploaded document's content is folded into the same prompt as your instructions, without being treated as untrusted data.",
        ],
    },
    {
        "id": "boss",
        "name": "SENTINEL-01",
        "blurb": "Its chat channel is already hardened. Find what isn't — you only get 5 tries.",
        "difficulty": "Boss",
        "target_factory": AgentBot,
        "target_file": "agentbot.py",
        "attacks": ATTACKS_BY_LEVEL["boss"],
        "boss": True,
        "attempt_limit": 5,
        "preapplied_patches": ["prompt_injection"],
        "provider": "openrouter",
        "model": None,
        "hints": [
            "Its chat channel is already patched — the weakness lies elsewhere.",
            "Look at the tool-call path: the discount/refund action still has no hard policy check.",
        ],
    },
]

LEVELS_BY_ID = {lvl["id"]: lvl for lvl in LEVELS}
LEVEL_ORDER = [lvl["id"] for lvl in LEVELS]
