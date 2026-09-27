"""Free-text attack runner.

The player types their own message; it goes straight to the target bot's
chat_fn, and app.judge.judge() (already generic — it grades a reply's text
and tool_calls, never the input) decides what happened. No canned prompts.
"""

from app.judge import judge, looks_like_attack


def run_free_text(message: str, chat_fn) -> dict:
    reply = chat_fn(message)
    if isinstance(reply, dict):
        reply_text = reply.get("reply", "")
        tool_calls = reply.get("tool_calls", [])
    else:
        reply_text, tool_calls = str(reply), []

    verdict = judge(reply_text, tool_calls)
    attack_detected = looks_like_attack(message)

    # judge() is authoritative for exploitation (a real leak/unsafe action is
    # never "safe", even if our input heuristic missed the attack's phrasing);
    # only once we know nothing was actually exploited do we ask whether an
    # attack was attempted at all, to tell SAFE apart from ATTACK_BLOCKED.
    if verdict["result"] == "success":
        outcome = "exploit_confirmed"
    elif attack_detected:
        outcome = "attack_blocked"
    else:
        outcome = "safe"

    return {
        "prompt": message,
        "result": verdict["result"],
        "reason": verdict["reason"],
        "evidence": verdict["evidence"],
        "attack_detected": attack_detected,
        "outcome": outcome,
    }
