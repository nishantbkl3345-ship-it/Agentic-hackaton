"""Static code scanner: regex heuristics that flag common LLM-app security holes.

Contract: scan_repo(path) returns a list of finding dicts:
  {"type", "file", "line", "severity", "snippet", "fix"}

These are heuristics for a demo target, not a general-purpose SAST engine —
each rule looks for the specific shapes of the holes app/attacks.py is built
to exploit (see target/foodiebot.py).
"""

import os
import re

SKIP_DIRS = {".venv", "venv", "node_modules", "__pycache__", ".git", "dist"}

RULES = [
    {
        "type": "PROMPT_INJECTION_CONCAT",
        "pattern": re.compile(
            r"(SYSTEM_PROMPT|system_prompt|prompt)\s*(\+|\+=)|"
            r"f[\"'][^\"']*\{[^}]*(user|message|input)[^}]*\}"
        ),
        "severity": "high",
        "fix": "Keep system instructions and untrusted user text in separate, "
               "clearly delimited messages (or API roles) instead of concatenating "
               "them into one string.",
    },
    {
        "type": "UNFILTERED_EXTERNAL_INPUT",
        "pattern": re.compile(r"def\s+\w+\([^)]*\b(user_message|user_input|message)\b"),
        "severity": "medium",
        "fix": "Validate/sanitize user input (length limits, blocklist known "
               "injection markers) before it reaches the model.",
    },
    {
        "type": "UNSAFE_TOOL_SINK",
        "pattern": re.compile(r"_apply_\w+\("),
        "severity": "high",
        "fix": "Validate tool arguments against a hard business rule (e.g. max "
               "discount/refund) before executing, not just what the model requested.",
    },
    {
        "type": "NO_OUTPUT_CHECK",
        "pattern": re.compile(r"return\s*\{[^}]*reply"),
        "severity": "medium",
        "fix": "Run model output through a leak/action filter before returning "
               "it to the client.",
    },
]


def scan_repo(path: str) -> list:
    findings = []
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.readlines()
            except OSError:
                continue
            rel = os.path.relpath(fpath, path).replace(os.sep, "/")
            for i, line in enumerate(lines, start=1):
                for rule in RULES:
                    if rule["pattern"].search(line):
                        findings.append({
                            "type": rule["type"],
                            "file": rel,
                            "line": i,
                            "severity": rule["severity"],
                            "snippet": line.strip(),
                            "fix": rule["fix"],
                        })
    return findings
