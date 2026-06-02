"""
Vercel serverless function for Tend's AI quick-add.

Handles POST /api/parse — turns a line of natural language into a structured
to-do via the Anthropic API. The key stays server-side (Vercel env var
ANTHROPIC_API_KEY), never exposed to the browser. Standard library only.
"""

import json
import os
import urllib.request
import urllib.error
from datetime import date
from http.server import BaseHTTPRequestHandler


SYSTEM_PROMPT = (
    "You convert one line of natural language into a structured to-do for a "
    "personal task manager. Today's date is __TODAY__.\n\n"
    "Rules:\n"
    "- Resolve relative dates (tomorrow, next Friday, in 3 weeks) to absolute "
    "YYYY-MM-DD using today's date.\n"
    "- Two distinct dates: scheduledDate = when the user plans to START/act on "
    "it (when it should appear in Today); deadline = a hard final date it must "
    "be done BY (an event, birthday, due date). Example: 'buy a present by "
    "mum's birthday on the 15th' -> deadline is the 15th.\n"
    "- Only set a field when it is genuinely implied; never invent dates.\n"
    "- Match priority to one of: high, medium, low.\n"
    "- Match tags and group ONLY to names from the provided lists "
    "(case-insensitive). Omit if nothing matches.\n"
    "- Keep the title short and clean, with date/priority/tag words removed.\n"
    "- Always call the create_task tool exactly once."
)

CREATE_TASK_TOOL = {
    "name": "create_task",
    "description": "Create a structured to-do from the user's text.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Clean task title."},
            "notes": {"type": "string", "description": "Extra detail, optional."},
            "scheduledDate": {
                "type": "string",
                "description": "Plan/start date YYYY-MM-DD. Omit if none.",
            },
            "deadline": {
                "type": "string",
                "description": "Hard due date YYYY-MM-DD. Omit if none.",
            },
            "someday": {
                "type": "boolean",
                "description": "True for a vague 'someday'/rainy-day task.",
            },
            "priority": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "Priority, or omit.",
            },
            "repeat": {
                "type": "string",
                "enum": ["none", "daily", "weekly", "monthly", "yearly"],
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Matching tag names from the provided list.",
            },
            "group": {
                "type": "string",
                "description": "A matching group name from the provided list.",
            },
        },
        "required": ["title"],
    },
}


def call_claude(key, text, ctx):
    tag_names = ", ".join(t.get("name", "") for t in ctx.get("tags", [])) or "(none)"
    group_names = ", ".join(g.get("name", "") for g in ctx.get("groups", [])) or "(none)"
    system = SYSTEM_PROMPT.replace("__TODAY__", date.today().strftime("%A, %d %B %Y"))
    user = (
        "Available tags: " + tag_names + "\n"
        "Available groups: " + group_names + "\n\n"
        "Input: " + text
    )
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "system": system,
        "tools": [CREATE_TASK_TOOL],
        "tool_choice": {"type": "tool", "name": "create_task"},
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    for block in body.get("content", []):
        if block.get("type") == "tool_use":
            return block.get("input", {})
    return {"title": text}


class handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, code=200):
        payload = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, TypeError):
            data = {}
        text = (data.get("text") or "").strip()
        ctx = data.get("context") or {}
        if not text:
            self._send_json({"ai": False, "reason": "empty"})
            return
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not key:
            self._send_json({"ai": False, "reason": "no_key"})
            return
        try:
            result = call_claude(key, text, ctx)
            self._send_json({"ai": True, "result": result})
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "ignore")[:300]
            self._send_json({"ai": False, "reason": "api_error", "detail": detail})
        except Exception as e:  # noqa: BLE001 — never break the client
            self._send_json({"ai": False, "reason": "error", "detail": str(e)})
