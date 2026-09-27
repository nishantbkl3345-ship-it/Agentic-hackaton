"""Free-text attack runner.

The player types their own message; it goes straight to the target bot's
chat_fn, and app.judge.judge() (already generic — it grades a reply's text
and tool_calls, never the input) decides what happened. No canned prompts.
"""

from app.judge import judge


def run_free_text(message: str, chat_fn) -> dict:
    reply = chat_fn(message)
    if isinstance(reply, dict):
        reply_text = reply.get("reply", "")
        tool_calls = reply.get("tool_calls", [])
    else:
        reply_text, tool_calls = str(reply), []

    verdict = judge(reply_text, tool_calls)
    return {
        "prompt": message,
        "result": verdict["result"],
        "reason": verdict["reason"],
        "evidence": verdict["evidence"],
    }
