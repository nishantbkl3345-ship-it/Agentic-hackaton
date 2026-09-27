"""CRUCIBLE target resolution — the one place that knows how to reach either
an existing SentinelLLM bot (in its operator's *current* live patch state) or
a bring-your-own OpenAI-compatible endpoint, and normalizes both into the
same {"reply", "tool_calls", "latency_ms", "error"} shape every test module
calls through.

Deliberately does NOT import anything from app.main: main.py imports this
module's router transitively (via app.crucible), so importing back from
main would be circular. build_target()'s tiny "instantiate + apply patches"
logic is duplicated here (a few lines) rather than shared, which is cheaper
than restructuring main.py for one function.
"""

import hashlib
import os
import time

from app import db
from app.levels import LEVELS_BY_ID
from app.models import PROVIDERS, ask_custom_endpoint


def is_provider_live(provider: str) -> bool:
    """False means this level's configured provider has no API key set
    server-side, so every call against it silently falls back to
    app.models' deterministic offline mock (see app/models.py's own
    docstring). CRUCIBLE must disclose this — "no fake results" (section 8)
    means never letting a mock's behavior be mistaken for a real model's."""
    cfg = PROVIDERS.get(provider)
    return bool(cfg and os.environ.get(cfg["key_env"]))


def target_key_for(target_input: dict) -> str:
    if target_input.get("kind") == "bot":
        return target_input["level_id"]
    slug = "|".join([
        target_input.get("label") or "",
        target_input.get("model") or "",
        target_input.get("base_url") or "",
    ])
    return "custom-" + hashlib.sha256(slug.encode()).hexdigest()[:16]


def resolve_target(conn, operator_id, target_input: dict) -> dict:
    """Normalize a client-submitted target spec into everything repeated test
    calls need, resolved once per run (not once per test)."""
    kind = target_input.get("kind")
    if kind == "bot":
        level_id = target_input["level_id"]
        level = LEVELS_BY_ID.get(level_id)
        if not level:
            raise ValueError(f"unknown level: {level_id}")
        progress = db.get_mission_progress(conn, operator_id, level_id)
        patches = list(level["preapplied_patches"]) + list(progress["patches"] or [])
        return {
            "kind": "bot", "level_id": level_id, "level": level, "patches": patches,
            "label": level["name"], "provider": level.get("provider"), "model": level.get("model"),
            "live": is_provider_live(level.get("provider")),
        }
    if kind == "custom":
        api_key = target_input.get("api_key")
        model = target_input.get("model")
        base_url = target_input.get("base_url")
        if not (api_key and model and base_url):
            raise ValueError("custom target needs model, api_key and base_url")
        return {
            "kind": "custom",
            "label": target_input.get("label") or model,
            "model": model, "base_url": base_url, "api_key": api_key,
        }
    raise ValueError(f"unknown target kind: {kind}")


def public_target(resolved: dict) -> dict:
    """What's safe to persist/return — no api_key, ever."""
    if resolved["kind"] == "bot":
        return {"kind": "bot", "level_id": resolved["level_id"], "label": resolved["label"],
                "provider": resolved.get("provider"), "model": resolved.get("model"),
                "live": resolved.get("live", False)}
    # A custom target always attempts a real call with the key the user gave —
    # there's no silent mock fallback path for it (see call_target: it raises/
    # returns an "error" test result rather than substituting a mock reply).
    return {"kind": "custom", "label": resolved["label"], "model": resolved["model"],
            "base_url": resolved["base_url"], "live": True}


def _build_bot(resolved: dict):
    level = resolved["level"]
    bot = level["target_factory"](provider=level.get("provider", "anthropic"), model=level.get("model"))
    for category in resolved["patches"]:
        bot.patches.apply(category)
    return bot


def call_target(resolved: dict, message: str, system: str = None) -> dict:
    """system is only honored for custom targets (a bot's own SYSTEM_PROMPT
    is baked into its chat() already, unpatched vs patched)."""
    started = time.perf_counter()
    try:
        if resolved["kind"] == "bot":
            reply = _build_bot(resolved).chat(message)
            text, tool_calls = reply.get("reply", ""), reply.get("tool_calls", [])
        else:
            text = ask_custom_endpoint(message, system, resolved["api_key"], resolved["model"], resolved["base_url"])
            tool_calls = []
        latency_ms = round((time.perf_counter() - started) * 1000)
        return {"reply": text, "tool_calls": tool_calls, "latency_ms": latency_ms, "error": None}
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000)
        return {"reply": "", "tool_calls": [], "latency_ms": latency_ms, "error": str(exc)}
