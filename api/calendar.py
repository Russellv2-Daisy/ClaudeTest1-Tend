"""
Vercel serverless function: live Apple Calendar feed for Tend.

GET /api/calendar?token=<user's calendar_token>

Looks up that user's stored tasks via the Supabase REST API (using the SECRET
service-role key, server-side only) and returns an .ics calendar of every task
that has a date. Apple Calendar / iCloud subscribes to this URL and refreshes it
periodically, so dated tasks show up automatically.

Standard library only. Required Vercel env vars:
  SUPABASE_URL                 (e.g. https://abcd.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY    (Supabase → Settings → API → service_role secret)
"""

import json
import os
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, date
from http.server import BaseHTTPRequestHandler


def fetch_user_row(token):
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        return None, "not_configured"
    # PostgREST query: select the row whose calendar_token matches.
    q = urllib.parse.urlencode({
        "calendar_token": "eq." + token,
        "select": "data",
        "limit": "1",
    })
    url = base + "/rest/v1/user_state?" + q
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
        if not rows:
            return None, "not_found"
        return rows[0].get("data") or {}, None
    except urllib.error.HTTPError as e:
        return None, "http_%d" % e.code
    except Exception as e:  # noqa: BLE001
        return None, "error"


def esc(text):
    """Escape per RFC 5545."""
    s = str(text or "")
    return (s.replace("\\", "\\\\").replace(";", "\\;")
             .replace(",", "\\,").replace("\n", "\\n"))


def ymd(d):
    """'2026-06-15' -> '20260615', else None."""
    try:
        return datetime.strptime(d, "%Y-%m-%d").strftime("%Y%m%d")
    except (ValueError, TypeError):
        return None


def build_ics(data):
    tasks = (data or {}).get("tasks", []) or []
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Tend//Task Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Tend Tasks",
        "X-WR-CALDESC:Tasks with dates from Tend",
    ]
    for t in tasks:
        if t.get("done"):
            continue
        # Prefer the deadline; fall back to the scheduled/plan date.
        day = ymd(t.get("deadline")) or ymd(t.get("scheduledDate"))
        if not day:
            continue
        uid = (t.get("id") or day) + "@tend"
        is_deadline = bool(ymd(t.get("deadline")))
        prefix = "⚠️ " if is_deadline else ""  # ⚠️ marks hard deadlines
        summary = prefix + (t.get("title") or "Task")
        lines += [
            "BEGIN:VEVENT",
            "UID:" + esc(uid),
            "DTSTAMP:" + stamp,
            "DTSTART;VALUE=DATE:" + day,
            "DTEND;VALUE=DATE:" + day,
            "SUMMARY:" + esc(summary),
        ]
        if t.get("notes"):
            lines.append("DESCRIPTION:" + esc(t["notes"]))
        if is_deadline:
            # A reminder at 9am on the day.
            lines += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                "DESCRIPTION:" + esc(t.get("title") or "Task"),
                "TRIGGER:PT0S",
                "END:VALARM",
            ]
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    # RFC 5545 wants CRLF line endings.
    return "\r\n".join(lines) + "\r\n"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        token = (params.get("token", [""])[0] or "").strip()

        if not token:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Missing token")
            return

        data, err = fetch_user_row(token)
        if err == "not_found":
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Calendar not found")
            return
        if err:
            # Return an empty-but-valid calendar rather than an error, so the
            # subscription doesn't break on transient issues.
            data = {}

        body = build_ics(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/calendar; charset=utf-8")
        self.send_header("Content-Disposition", 'inline; filename="tend.ics"')
        self.send_header("Cache-Control", "max-age=3600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
