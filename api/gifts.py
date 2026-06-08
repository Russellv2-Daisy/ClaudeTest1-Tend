"""
Vercel serverless function for Tend's AI gift ideas (People / Personas feature).

Handles POST /api/gifts — given a person's profile + occasion + budget, returns a
short list of tailored gift ideas via the Anthropic API. The key stays server-side
(Vercel env var ANTHROPIC_API_KEY), never exposed to the browser. Standard library
only. If no key is set the client falls back to its own offline generator.
"""

import json
import os
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler


SYSTEM_PROMPT = (
    "You suggest thoughtful, specific gift ideas for ONE person based on their "
    "profile. Return 4-6 ideas.\n\n"
    "Rules:\n"
    "- Use their hobbies, favourite brands, foods, experiences, and especially their "
    "wishlist (wishlist items are the strongest signal).\n"
    "- AVOID anything similar to gifts already in their gift history (no repeats).\n"
    "- AVOID anything in their dislikes/allergies.\n"
    "- Keep each idea's price realistic and at or under the stated budget (GBP).\n"
    "- 'search_query' must be concise shopping search terms a UK retailer would match.\n"
    "- Make ideas concrete (a thing or experience), not vague categories.\n"
    "- Always call the suggest_gifts tool exactly once."
)

SUGGEST_TOOL = {
    "name": "suggest_gifts",
    "description": "Return a list of tailored gift ideas for the person.",
    "input_schema": {
        "type": "object",
        "properties": {
            "ideas": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Short gift name."},
                        "description": {"type": "string", "description": "One sentence: why it suits them."},
                        "price": {"type": "number", "description": "Estimated price in GBP, within budget."},
                        "search_query": {"type": "string", "description": "Concise shopping search terms."},
                    },
                    "required": ["title", "description", "price", "search_query"],
                },
            }
        },
        "required": ["ideas"],
    },
}


def call_claude(key, person, occasion, budget):
    user = (
        "Occasion: " + str(occasion or "a gift") + "\n"
        "Budget (GBP): " + str(budget or "flexible") + "\n"
        "Person profile (JSON):\n" + json.dumps(person, ensure_ascii=False)
    )
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "tools": [SUGGEST_TOOL],
        "tool_choice": {"type": "tool", "name": "suggest_gifts"},
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
    return {"ideas": []}


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
        person = data.get("person") or {}
        occasion = data.get("occasion") or ""
        budget = data.get("budget")
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not key:
            self._send_json({"ai": False, "reason": "no_key"})
            return
        try:
            result = call_claude(key, person, occasion, budget)
            self._send_json({"ai": True, "result": result})
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "ignore")[:300]
            self._send_json({"ai": False, "reason": "api_error", "detail": detail})
        except Exception as e:  # noqa: BLE001 — never break the client
            self._send_json({"ai": False, "reason": "error", "detail": str(e)})
