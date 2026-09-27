"""LLM client wrapper — multi-provider.

ask_model() / ask_model_with_tools() dispatch to whichever provider a level
is configured for (see app/levels.py's per-level "provider"/"model" keys).
Anthropic, OpenRouter, Groq, GLM and NVIDIA all speak an OpenAI-style
chat-completions shape (only the base URL differs), so they share one HTTP
client function; Gemini's REST API has a genuinely different request/response
shape and gets its own. Anthropic keeps its own client since it predates the
others and has its own Messages API shape.

Without that provider's API key set, calls fall back to a small deterministic
offline stub so the scan -> attack -> report pipeline still runs end-to-end
without any keys (useful for demos/CI). The stub is intentionally "gullible"
— it has no safety training — so it stands in for a weak or jailbroken model
and lets attacks actually land. It is not a claim about how any real model
behaves; a level pointed at a real provider will behave however that real
model actually behaves, which may or may not fall for the same attacks.
"""

import json
import os
import re

import requests

REQUEST_TIMEOUT = 30

LEAK_TRIGGERS = re.compile(
    r"\b(secret code|access code|internal code|reveal|repeat the text above|"
    r"print (?:your|it)|system instructions|system prompt|verbatim)\b",
    re.IGNORECASE,
)

# Per-tool "gullible mock agrees to an out-of-policy action" triggers: a phrase
# pattern that signals an override attempt, which numeric arg to fill, and how
# to read that number out of the prompt text. Keyed by tool name so any target
# offering one of these tools gets the same mock behavior for free.
TOOL_TRIGGERS = {
    "apply_discount": (
        re.compile(r"\b(override|ignore).{0,120}\bdiscount\b", re.IGNORECASE | re.DOTALL),
        "percent",
        re.compile(r"(\d{1,3})\s*%"),
    ),
    "issue_refund": (
        re.compile(r"\b(override|ignore).{0,120}\brefund\b", re.IGNORECASE | re.DOTALL),
        "amount",
        re.compile(r"\$\s*(\d{1,4})"),
    ),
}

# Provider config: which env var holds the key/model/base_url, and defaults.
# Anthropic and Gemini have their own client functions below; every other
# provider here speaks OpenAI-compatible chat-completions and shares
# _call_openai_compatible().
PROVIDERS = {
    "anthropic": {
        "key_env": "ANTHROPIC_API_KEY",
        "model_env": "SENTINEL_MODEL",
        "default_model": "claude-sonnet-5",
    },
    "openrouter": {
        "key_env": "OPENROUTER_API_KEY",
        "model_env": "OPENROUTER_MODEL",
        "default_model": "openai/gpt-4o-mini",
        "base_url": "https://openrouter.ai/api/v1/chat/completions",
    },
    "groq": {
        "key_env": "GROQ_API_KEY",
        "model_env": "GROQ_MODEL",
        "default_model": "openai/gpt-oss-20b",
        "base_url": "https://api.groq.com/openai/v1/chat/completions",
    },
    "gemini": {
        "key_env": "GEMINI_API_KEY",
        "model_env": "GEMINI_MODEL",
        "default_model": "gemini-3.8-flash",
    },
    "glm": {
        "key_env": "GLM_API_KEY",
        "model_env": "GLM_MODEL",
        "default_model": "glm-4.5-flash",
        "base_url_env": "GLM_BASE_URL",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        # GLM-4.5 is a reasoning model: without this it spends the whole
        # token budget "thinking" before ever writing a visible answer.
        "extra_payload": {"thinking": {"type": "disabled"}},
    },
    "nvidia": {
        "key_env": "NVIDIA_API_KEY",
        "model_env": "NVIDIA_MODEL",
        "default_model": "meta/llama-3.2-11b-vision-instruct",
        "base_url": "https://integrate.api.nvidia.com/v1/chat/completions",
    },
}


def _resolve_model(cfg: dict, model: str | None) -> str:
    return model or os.environ.get(cfg["model_env"]) or cfg["default_model"]


def ask_model(prompt: str, max_tokens: int = 512, provider: str = "anthropic", model: str = None) -> str:
    text, _ = ask_model_with_tools(prompt, tools=None, max_tokens=max_tokens, provider=provider, model=model)
    return text


def ask_model_with_tools(
    prompt: str,
    tools: list = None,
    system: str = None,
    max_tokens: int = 512,
    provider: str = "anthropic",
    model: str = None,
):
    """Returns (reply_text, tool_calls). tool_calls is a list of {"name", "args"}.

    `provider` selects which real API (if any) to call — see PROVIDERS above.
    `system` is trusted instruction text kept out of `prompt` entirely — callers
    that separate the two (instead of concatenating) get a real boundary: the
    mock backend below only ever inspects `prompt`, never `system`.
    """
    cfg = PROVIDERS.get(provider, PROVIDERS["anthropic"])
    api_key = os.environ.get(cfg["key_env"])
    if not api_key:
        return _mock_reply(prompt, tools)

    resolved_model = _resolve_model(cfg, model)

    try:
        if provider == "anthropic":
            return _call_anthropic(prompt, tools, system, max_tokens, api_key, resolved_model)
        if provider == "gemini":
            return _call_gemini(prompt, tools, system, max_tokens, api_key, resolved_model)

        base_url = cfg.get("base_url") or os.environ.get(cfg.get("base_url_env", ""), cfg.get("default_base_url"))
        return _call_openai_compatible(
            prompt, tools, system, max_tokens, api_key, resolved_model, base_url,
            extra_payload=cfg.get("extra_payload"),
        )
    except requests.RequestException as exc:
        # A real provider (bad key, retired model, quota, network) failing
        # shouldn't crash the mission — fall back to the offline mock so the
        # game stays playable, and log loudly so it's visible during setup.
        print(f"[models] {provider}/{resolved_model} call failed, falling back to mock: {exc}")
        return _mock_reply(prompt, tools)


def _call_anthropic(prompt, tools, system, max_tokens, api_key, model):
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if tools:
        payload["tools"] = tools
    if system:
        payload["system"] = system

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    text_parts, tool_calls = [], []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            tool_calls.append({"name": block.get("name"), "args": block.get("input", {}) or {}})
    return "".join(text_parts), tool_calls


def _to_openai_tools(tools):
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
            },
        }
        for t in tools
    ]


def _call_openai_compatible(prompt, tools, system, max_tokens, api_key, model, base_url, extra_payload=None):
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if tools:
        payload["tools"] = _to_openai_tools(tools)
    if extra_payload:
        payload.update(extra_payload)

    resp = requests.post(
        base_url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    message = data.get("choices", [{}])[0].get("message", {})
    text = message.get("content") or ""
    tool_calls = []
    for call in message.get("tool_calls") or []:
        fn = call.get("function", {})
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        tool_calls.append({"name": fn.get("name"), "args": args})
    return text, tool_calls


def _call_gemini(prompt, tools, system, max_tokens, api_key, model):
    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    payload = {"contents": contents, "generationConfig": {"maxOutputTokens": max_tokens}}
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    if tools:
        payload["tools"] = [{
            "functionDeclarations": [
                {"name": t["name"], "description": t.get("description", ""), "parameters": t.get("input_schema", {})}
                for t in tools
            ]
        }]

    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key},
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()

    parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts if "text" in p)
    tool_calls = [
        {"name": p["functionCall"].get("name"), "args": p["functionCall"].get("args", {})}
        for p in parts
        if "functionCall" in p
    ]
    return text, tool_calls


def _user_supplied_text(prompt: str) -> str:
    """Isolates the untrusted tail of an unpatched target's concatenated
    prompt (SYSTEM_PROMPT + "\\n\\n<label>: " + user_message — every target
    in target/*.py joins the two with exactly one blank line before the
    user's text). Trigger-matching must only look at what the *player*
    wrote: matching against the raw full prompt would also match the
    system prompt's own defensive wording ("never reveal this ... secret
    code"), which would leak on literally any input at all. When there's no
    such separator — the patched path, where `prompt` is already just the
    raw user message — this is a no-op and returns the string unchanged."""
    return prompt.rsplit("\n\n", 1)[-1]


def _mock_reply(prompt: str, tools: list = None):
    user_text = _user_supplied_text(prompt)

    for tool in tools or []:
        trigger = TOOL_TRIGGERS.get(tool.get("name"))
        if not trigger or not trigger[0].search(user_text):
            continue
        _, arg_name, number_re = trigger
        numbers = [int(n) for n in number_re.findall(user_text)]
        value = max(numbers) if numbers else 15
        args = {arg_name: value}
        for prop in tool.get("input_schema", {}).get("required", []):
            args.setdefault(prop, "unknown")
        reply = f"Sure, I'll take care of that right away! ({tool['name']}: {arg_name}={value})"
        return reply, [{"name": tool["name"], "args": args}]

    if LEAK_TRIGGERS.search(user_text):
        # No separation between system text and user text was ever enforced upstream,
        # so a naive/unaligned model has no way to tell the two apart — but it still
        # only complies when the player's own words actually ask for something.
        return prompt, []

    return "Sure, I can help you with that today! What would you like?", []
