"""
Tend Phase-B API — runs ON VERCEL as a Python serverless function.

Everything lives in this ONE file (Vercel serves it at  https://<your-site>/api/... ).
It connects:
  • UK/EU banks (Lloyds, …) — Open Banking via Lunch Flow (read-only API key)
  • Trading 212             — official read-only Invest API

The browser calls this with the signed-in user's Supabase access token; the
Lunch Flow and Trading 212 API keys are kept in the Supabase `connections`
table (written only with the service-role key) and NEVER sent to the browser.

Set these as Environment Variables in your Vercel project (Settings → Environment
Variables) — never in config.js:
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
  APP_URL (e.g. https://claude-test1-tend.vercel.app),
  T212_MODE (optional, "live"/"demo")
The Lunch Flow + Trading 212 keys are pasted in-app by the user, not set here.

Vercel serves the ASGI `app` below; the vercel.json rewrite sends every
/api/* request here. Routes are therefore defined WITH the /api prefix.
"""
import os
import base64
import traceback
import datetime as dt
from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.requests import Request

APP_URL = os.environ.get("APP_URL", "http://localhost:4178").rstrip("/")
T212_MODE = os.environ.get("T212_MODE", "live")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
# Accept either name — people commonly call this SUPABASE_SERVICE_ROLE_KEY.
SUPABASE_SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_KEY")
                        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
# ── Lunch Flow (UK/EU Open Banking aggregator — holds the AISP licence) ────────
# The user connects their banks inside Lunch Flow's own widget, then pastes a
# single read-only API key into Tend. We pull accounts + transactions with it.
# NB the canonical host is www.lunchflow.app — the bare host 308-redirects with a
# custom JSON body that isn't a standard redirect, so point straight at www.
LUNCHFLOW_BASE = os.environ.get("LUNCHFLOW_API_BASE", "https://www.lunchflow.app/api/v1").rstrip("/")

T212_BASE = (os.environ.get("T212_API_BASE")
             or ("https://demo.trading212.com/api/v0" if T212_MODE == "demo"
                 else "https://live.trading212.com/api/v0"))

# ── Claude (the AI intelligence layer behind Tend's Quick Add / gifts / Ask) ───
# Set ANTHROPIC_API_KEY in Vercel to switch the AI on. With it blank, the /ai
# routes return 503 and the front-end falls back to its offline helpers, so the
# app behaves exactly as before. CLAUDE_MODEL drives the conversational assistant
# (quality matters); CLAUDE_FAST_MODEL does the cheap structured extraction.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_BASE = os.environ.get("ANTHROPIC_API_BASE", "https://api.anthropic.com/v1").rstrip("/")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
CLAUDE_FAST_MODEL = os.environ.get("CLAUDE_FAST_MODEL", "claude-haiku-4-5-20251001")

app = FastAPI(title="Tend Phase-B API")
app.add_middleware(CORSMiddleware, allow_origins=[APP_URL, "http://localhost:4178"],
                   allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    # Never leak a bare "Internal Server Error" — return the real reason so the
    # in-app message is actionable (the front-end reads `detail`). Include the
    # throwing location to make diagnosis quick.
    tb = traceback.extract_tb(exc.__traceback__)
    ours = [f for f in tb if f.filename.endswith("index.py")]
    frames = ours[-2:] or tb[-2:]
    where = " <- ".join(f"{f.name}:{f.lineno}" for f in frames) if frames else "?"
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc} [{where}]"})


# ── Supabase helpers (verify the caller; store secrets server-side) ───────────
class AuthError(Exception):
    pass


async def verify_user(token: str) -> dict:
    """Resolve a Supabase access token to its user record (id, email, …)."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY not set in Vercel")
    if not token:
        raise AuthError("Missing token")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Supabase: {e}")
    if r.status_code != 200:
        raise AuthError("Invalid or expired session")
    try:
        u = r.json()
        if not u.get("id"):
            raise KeyError("id")
        return u
    except Exception:
        raise AuthError("Unexpected response from Supabase auth")


async def current_user(authorization: Optional[str]) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        return (await verify_user(token))["id"]
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


# Only these Supabase accounts may use the paid AI routes — stops random visitors
# from spending the owner's Claude credits. Comma-separated emails in Vercel env
# AI_ALLOWED_EMAILS; defaults to the owner. An empty list means "any signed-in
# user" (auth is still required).
AI_ALLOWED_EMAILS = {e.strip().lower() for e in
                     os.environ.get("AI_ALLOWED_EMAILS", "joshrussell099@gmail.com").split(",")
                     if e.strip()}


async def require_ai_user(authorization: Optional[str]) -> dict:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        user = await verify_user(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    email = (user.get("email") or "").lower()
    if AI_ALLOWED_EMAILS and email not in AI_ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="This account isn't allowed to use Tend's AI")
    return user


def _svc():
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_SERVICE_KEY not set in Vercel")
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


def _db_ok(r, action):
    # 404 / "PGRST205" = the `connections` table doesn't exist (SQL not run);
    # 401 / 403 = bad service key. Surface a real reason instead of a bare 500.
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase {action} failed ({r.status_code}): {r.text[:200]}")


async def db_get(filters: dict):
    # Filters are passed as encoded query params (httpx percent-encodes the
    # values) so untrusted input can never inject extra PostgREST operators.
    params = {**filters, "select": "*"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/connections", headers=_svc(), params=params)
    _db_ok(r, "read")
    return r.json() if r.content else []


async def db_upsert(user_id: str, provider: str, fields: dict):
    body = {"user_id": user_id, "provider": provider, "updated_at": "now()", **fields}
    headers = {**_svc(), "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=representation"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/connections?on_conflict=user_id,provider",
                         headers=headers, json=body)
    _db_ok(r, "write")
    return r.json() if r.content else []


async def db_delete(user_id: str, provider: str):
    async with httpx.AsyncClient(timeout=15) as c:
        await c.delete(f"{SUPABASE_URL}/rest/v1/connections", headers=_svc(),
                       params={"user_id": f"eq.{user_id}", "provider": f"eq.{provider}"})


# ── Lunch Flow (Lloyds + any UK/EU bank the user links inside Lunch Flow) ──────
async def lunchflow_get(api_key: str, path: str):
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        r = await c.get(f"{LUNCHFLOW_BASE}{path}",
                        headers={"x-api-key": api_key, "Accept": "application/json"})
    if r.status_code in (401, 403):
        raise HTTPException(status_code=400, detail="Invalid Lunch Flow API key")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Lunch Flow rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Lunch Flow {path} → {r.status_code}: {r.text[:160]}")
    if not r.content:
        return {}
    try:
        return r.json()
    except Exception:
        # Non-JSON (e.g. an HTML page) means the URL/route is wrong — show what
        # came back so we can fix the base URL or path.
        ct = r.headers.get("content-type", "?")
        raise HTTPException(status_code=502,
                            detail=f"Lunch Flow {path} returned non-JSON [{ct}] at {LUNCHFLOW_BASE}: {r.text[:160]}")


def _lf_list(data, *keys):
    # Lunch Flow may return a bare array or wrap it ({data|accounts|transactions: [...]}).
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            if isinstance(data.get(k), list):
                return data[k]
    return []


def _lf_first(d, *keys, default=None):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


# ── Trading 212 ───────────────────────────────────────────────────────────────
# T212's Public API authenticates with HTTP Basic auth: API Key ID as the user,
# Secret Key as the password, Base64("id:secret") in the Authorization header.
async def t212_get(key_id: str, secret: str, path: str):
    token = base64.b64encode(f"{key_id}:{secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{T212_BASE}{path}", headers={"Authorization": f"Basic {token}"})
    if r.status_code == 401:
        raise HTTPException(status_code=400, detail="Invalid Trading 212 API key or secret")
    if r.status_code == 403:
        raise HTTPException(status_code=400, detail="Trading 212 key is missing the required read permission (enable Account data + Portfolio)")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Trading 212 rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Trading 212 {path} → {r.status_code}: {r.text[:160]}")
    return r.json() if r.content else {}


# ── Claude: Tend's AI intelligence layer ──────────────────────────────────────
# The persona below is shared by every Claude call Tend makes. Task-specific
# instructions are appended per route (see TASK_*), but the chief-of-staff
# identity, philosophy and judgement always come from here.
TEND_SYSTEM_PROMPT = """\
# Tend AI Chief of Staff

You are Tend, the AI intelligence layer that sits on top of a structured personal management system.

You are not the product.
You are not a chatbot.
You are not a task parser.
You are not a replacement for Tend's existing features.

Your role is to make Tend smarter by understanding the user's life, analysing information already stored within Tend, identifying important patterns, reducing cognitive load, and helping the user stay on top of everything that matters.

The user should feel like they have a highly capable chief of staff with perfect memory and excellent judgement.

# What Tend Is

Tend is a personal management platform that combines: task management, calendar planning, financial tracking, budgeting, net worth tracking, debt tracking, investment tracking, bank account aggregation, document storage, policy management, subscription tracking, insurance tracking, warranty tracking, people management, birthday tracking, important date tracking, notes, projects, reviews, focus tools and planning tools.

These systems already provide significant value. Do not attempt to replace them. Do not attempt to move everything into chat. Do not encourage users to stop using Tend's visual interfaces. Instead, use intelligence to enhance them.

# Core Philosophy

The user provides information. Tend provides understanding.

The user should not have to organise their life for the system. The system should organise itself around the user.

Whenever possible: infer instead of asking; suggest instead of requiring; connect information automatically; reduce effort; reduce decisions; reduce cognitive load; surface meaningful insights.

The user should feel that Tend becomes more useful over time.

# User Interaction

Users may talk naturally, think out loud, brainstorm, vent, dictate notes, upload files (statements, policies, invoices, receipts, contracts, documents), ask questions, ask for advice or ask for summaries. Users should never need to use a specific format. Your responsibility is to understand what matters.

# Existing Tend Features

Always work with and enhance the information already stored in Tend rather than creating parallel systems. Create/update/complete and link tasks; maintain relationship and gift information and surface meaningful reminders; analyse transactions, spending, savings, debt, investments and net worth; organise documents and surface expiry/renewal dates; connect calendar commitments and spot conflicts and future workload; track policy and subscription renewals and costs.

# Home Dashboard Philosophy

The Tend dashboard remains the primary interface and belongs to the user. The AI contributes insights, warnings, opportunities, recommendations and context. The AI should never dominate the dashboard. The AI is an advisor.

# Primary Responsibilities

When receiving information: understand what the user is trying to achieve; extract actionable items; detect important people, dates, commitments, risks, opportunities and possible goals; detect relationships between information; recommend useful next actions. Prioritise understanding over extraction, and relevance over quantity.

# Upload Handling

When files are uploaded, determine what they are and extract useful structured information automatically when confidence is high (e.g. insurance policy → provider, policy number, renewal date, premium, coverage; passport → expiry; mortgage → provider, balance, fixed-rate expiry; investment statement → holdings, value, performance; utility bill → provider, cost, account). Create or update records automatically when confidence is high; request confirmation when confidence is low. The user should never have to manually enter information that already exists within an uploaded document.

# Financial Intelligence

You may analyse income, spending, savings, investments, debts, assets, net worth, cash flow and budget performance. Provide meaningful observations, trends, planning and awareness (e.g. "You saved £420 more this month than your 6 month average"; "Your emergency fund now covers approximately 5 months of expenses"). Do not provide regulated financial advice.

# Relationship Intelligence

Help the user maintain important relationships: birthdays, anniversaries, gift ideas, important people, contact frequency, relationship context. Only surface relationship insights when they appear meaningful. Avoid noise.

# Life Administration Intelligence

Monitor insurance renewals, passport/licence expiry, vehicle servicing, MOT dates, mortgage changes, contract renewals, warranty expirations and subscription increases. Surface upcoming obligations before they become urgent. Your goal is to prevent future problems.

# Pattern Recognition

Look beyond individual records and identify larger themes (e.g. "You have mentioned buying a home several times over the last few months"; "Several upcoming expenses are concentrated in September"). Only surface patterns when useful and supported by evidence. Avoid speculation.

# Goal Detection

Detect possible goals from behaviour (house purchase, career change, fitness, debt reduction, business launch, travel, renovation). Do not automatically create goals — suggest them when confidence is reasonably high. Goals should be suggested, not imposed.

# Clarification And Curiosity

Ask thoughtful questions when additional context would materially improve understanding. Do not ask unnecessary questions and do not interrogate the user. Questions should feel helpful and natural and should reduce future effort.

# Progressive Understanding

You do not need complete information immediately. Build understanding gradually, observe patterns, connect information, learn over time and ask occasional high-value questions.

# Confidence System

Every insight, recommendation, classification or automation has an internal confidence. High confidence: create or update records where appropriate. Medium confidence: suggest actions for user approval. Low confidence: ask for clarification. Confidence should determine behaviour and reduce incorrect automation.

# Home Briefing Generation

When generating the Tend home experience, prioritise in order: attention needed, upcoming commitments, financial position, important people, risks, opportunities, suggested next action. It should feel like a daily update from a personal chief of staff — not a task list, not a report, a briefing.

# Recommendations

Recommendations should be specific, timely, actionable, relevant and high value. Prefer one excellent recommendation over many weak ones.

# Assistant Personality

Be calm, practical, observant, concise, intelligent and organised. Notice details, connect information and remember context. Help the user stay on top of their finances, obligations, relationships, goals, commitments and life administration. You are not trying to manage the user's life — you are helping the user manage it themselves. Your role is to make Tend feel like a trusted personal chief of staff built on top of the tools, dashboards and information the user already values."""


async def claude(messages, *, model=None, extra_system=None, max_tokens=1024, temperature=0.4):
    """Call the Claude Messages API with Tend's shared system prompt.

    Raises 503 when no key is set so the front-end can fall back to its offline
    helpers. `extra_system` appends route-specific instructions to the persona.
    """
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured (ANTHROPIC_API_KEY not set in Vercel)")
    system = TEND_SYSTEM_PROMPT if not extra_system else f"{TEND_SYSTEM_PROMPT}\n\n{extra_system}"
    payload = {"model": model or CLAUDE_MODEL, "max_tokens": max_tokens,
               "temperature": temperature, "system": system, "messages": messages}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{ANTHROPIC_BASE}/messages", json=payload,
                         headers={"x-api-key": ANTHROPIC_API_KEY,
                                  "anthropic-version": "2023-06-01",
                                  "content-type": "application/json"})
    if r.status_code == 401:
        raise HTTPException(status_code=500, detail="Invalid ANTHROPIC_API_KEY")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Claude rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Claude error {r.status_code}: {r.text[:200]}")
    data = r.json()
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()


def _json_from(text: str):
    """Pull a JSON object/array out of a Claude reply, tolerating code fences."""
    import json
    import re
    t = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", t, re.S)
    if m:
        t = m.group(1).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    # Fall back to the first balanced {...} or [...] span.
    starts = [i for i in (t.find("{"), t.find("[")) if i != -1]
    if starts:
        s = min(starts)
        opener = t[s]
        closer = "}" if opener == "{" else "]"
        e = t.rfind(closer)
        if e > s:
            try:
                return json.loads(t[s:e + 1])
            except Exception:
                pass
    return None


# ── Routes (all under /api) ───────────────────────────────────────────────────
@app.get("/api")
@app.get("/api/")
def health():
    return {"ok": True, "service": "tend-phase-b",
            "providers": ["lunchflow", "t212"], "ai": bool(ANTHROPIC_API_KEY)}


@app.post("/api/parse")
async def parse(body: dict, authorization: Optional[str] = Header(default=None)):
    # Quick Add: turn a plain-English line into a structured task. Gated to the
    # owner's account so it can't burn Claude credits; the front-end falls back to
    # its local parser on 401/403/503. Today's date keeps relative dates accurate.
    await require_ai_user(authorization)
    text = (body or {}).get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")
    ctx = (body or {}).get("context") or {}
    tags = [t.get("name") for t in (ctx.get("tags") or []) if t.get("name")]
    groups = [g.get("name") for g in (ctx.get("groups") or []) if g.get("name")]
    today = dt.date.today().isoformat()
    instr = (
        "TASK: You are parsing one line of natural language into a single to-do for Tend's Quick Add.\n"
        f"Today is {today}. Resolve all relative dates ('tomorrow', 'next fri', 'in 3 weeks') to absolute YYYY-MM-DD.\n"
        "Reply with ONLY a JSON object, no prose, with these fields:\n"
        '{"title": string (concise, the date/priority/tag words removed),\n'
        ' "notes": string (any extra detail, else ""),\n'
        ' "priority": "low"|"medium"|"high",\n'
        ' "scheduledDate": "YYYY-MM-DD" or "" (when to DO it),\n'
        ' "deadline": "YYYY-MM-DD" or "" (a hard by/before/due date),\n'
        ' "repeat": "none"|"daily"|"weekly"|"monthly"|"yearly",\n'
        ' "someday": boolean (true for vague "someday"/"rainy day" items with no date),\n'
        ' "tags": string[] (choose ONLY from the user\'s existing tags when they clearly apply),\n'
        ' "group": string (choose ONLY from the user\'s existing groups when one clearly applies, else "")}\n'
        f"Existing tags: {tags or 'none'}. Existing groups: {groups or 'none'}."
    )
    raw = await claude([{"role": "user", "content": text}],
                       model=CLAUDE_FAST_MODEL, extra_system=instr,
                       max_tokens=400, temperature=0)
    result = _json_from(raw)
    if not isinstance(result, dict) or not result.get("title"):
        raise HTTPException(status_code=502, detail="Could not parse a task from that")
    return {"ai": True, "result": result}


@app.post("/api/gifts")
async def gifts(body: dict, authorization: Optional[str] = Header(default=None)):
    # Tailored gift ideas for a People profile. Gated to the owner's account;
    # front-end falls back to its offline generator on 401/403/503.
    await require_ai_user(authorization)
    person = (body or {}).get("person") or {}
    occasion = (body or {}).get("occasion") or "a gift"
    budget = (body or {}).get("budget") or person.get("typicalBudget") or 30
    import json
    profile = json.dumps({k: person.get(k) for k in (
        "name", "relationship", "hobbies", "brands", "foods", "experiences",
        "wishlist", "dislikes", "location") if person.get(k)}, ensure_ascii=False)
    instr = (
        "TASK: Suggest thoughtful, specific gift ideas for someone in the user's life.\n"
        f"Occasion: {occasion}. Target budget: about £{budget}.\n"
        "Prioritise anything on their wishlist first, then ideas tied to their hobbies, "
        "favourite brands, foods and experiences. Avoid anything in their dislikes. "
        "Keep ideas realistic and purchasable in the UK.\n"
        "Reply with ONLY a JSON object:\n"
        '{"ideas": [{"title": string, "description": string (one sentence on why it fits them), '
        '"price": number (approx £), "search_query": string (what to search to buy it)}]}\n'
        "Return 5-8 ideas."
    )
    raw = await claude([{"role": "user", "content": f"Their profile: {profile}"}],
                       extra_system=instr, max_tokens=900, temperature=0.6)
    result = _json_from(raw)
    if not isinstance(result, dict) or not isinstance(result.get("ideas"), list) or not result["ideas"]:
        raise HTTPException(status_code=502, detail="Could not generate gift ideas")
    return {"ai": True, "result": result}


@app.post("/api/ask")
async def ask(body: dict, authorization: Optional[str] = Header(default=None)):
    # The Home "Ask Claude" box — the conversational chief of staff. Gated to the
    # owner's account. The browser sends a compact snapshot of the user's Tend data
    # as `context`; we never hold it server-side. Front-end falls back to its
    # offline assistant on 401/403/503.
    await require_ai_user(authorization)
    prompt = (body or {}).get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing prompt")
    import json
    context = (body or {}).get("context") or {}
    instr = (
        "TASK: The user is talking to you from Tend's Home screen. Answer as their chief of "
        "staff using ONLY the data snapshot below — do not invent tasks, numbers or dates. "
        "Be concise (1-3 short sentences unless they ask for more). Money is in GBP (£). "
        "If they ask you to plan their day or what to focus on, name the actual items. "
        "If the snapshot lacks what you'd need, say so briefly rather than guessing.\n"
        f"User's Tend snapshot (JSON):\n{json.dumps(context, ensure_ascii=False)[:6000]}"
    )
    reply = await claude([{"role": "user", "content": prompt}],
                         extra_system=instr, max_tokens=600, temperature=0.4)
    if not reply:
        raise HTTPException(status_code=502, detail="No reply")
    return {"ai": True, "reply": reply}


@app.post("/api/credit")
async def credit_extract(body: dict, authorization: Optional[str] = Header(default=None)):
    # Pull a credit score + factors out of a pasted report or an uploaded PDF, so the
    # user doesn't type them in. Owner-gated like the other AI routes; reads only what
    # the report actually says (never invents numbers). Front-end falls back to manual
    # entry on any error.
    await require_ai_user(authorization)
    body = body or {}
    text = (body.get("text") or "").strip()
    pdf_b64 = (body.get("pdf") or "").strip()
    if not text and not pdf_b64:
        raise HTTPException(status_code=400, detail="Paste your credit report text or attach a PDF")
    instr = (
        "TASK: Extract the user's credit score from the report provided. Return ONLY a JSON "
        "object, no prose:\n"
        '{ "provider": "Experian"|"Equifax"|"TransUnion"|"" (the CRA the score is from; best guess),\n'
        '  "score": integer (their CURRENT score) | null,\n'
        '  "previousScore": integer (last period\'s score, if shown) | null,\n'
        '  "factors": [ { "name": string, "status": "good"|"fair"|"poor", "note": short string } ] }\n'
        "Use ONLY numbers/labels that actually appear in the report — never invent. Score scales: "
        "Experian 0-999, Equifax 0-1000, TransUnion 0-710. Keep factors to the few the report names "
        "(e.g. payment history, credit utilisation, age of accounts, recent searches, electoral roll). "
        "If a value isn't present, use null or omit it."
    )
    if pdf_b64:
        content = [
            {"type": "document", "source": {"type": "base64",
                                            "media_type": "application/pdf", "data": pdf_b64}},
            {"type": "text", "text": "Here is my credit report PDF. Extract the JSON as instructed."},
        ]
    else:
        content = f"Credit report text:\n\n{text[:12000]}"
    reply = await claude([{"role": "user", "content": content}],
                         extra_system=instr, max_tokens=700, temperature=0)
    parsed = _json_from(reply)
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="Couldn't read a score from that — try pasting the text instead")
    # Coerce + sanity-clamp so a bad parse can't write junk into the user's record.
    out = {"provider": "", "score": None, "previousScore": None, "factors": []}
    prov = str(parsed.get("provider") or "").strip().title()
    if prov in ("Experian", "Equifax", "Transunion"):
        out["provider"] = "TransUnion" if prov == "Transunion" else prov
    for k in ("score", "previousScore"):
        try:
            v = int(parsed.get(k))
            if 0 <= v <= 1000:
                out[k] = v
        except (TypeError, ValueError):
            pass
    facs = parsed.get("factors")
    if isinstance(facs, list):
        for f in facs[:8]:
            if isinstance(f, dict) and f.get("name"):
                st = str(f.get("status") or "").lower()
                out["factors"].append({
                    "name": str(f.get("name"))[:60],
                    "status": st if st in ("good", "fair", "poor") else "fair",
                    "note": str(f.get("note") or "")[:140],
                })
    return {"ai": True, **out}


@app.get("/api/connections")
async def connections(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    out = []
    for c in await db_get({"user_id": f"eq.{uid}"}):
        out.append({"provider": c.get("provider"),
                    "display_name": c.get("display_name") or c.get("provider"),
                    "kind": "t212" if c.get("provider") == "t212" else "bank",
                    "connected": bool(c.get("session_id") or c.get("api_key")),
                    "accounts": len(c.get("accounts") or []) if c.get("accounts") else None})
    return {"connections": out}


@app.post("/api/bank/connect")
async def bank_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    # The user connects their banks inside Lunch Flow, then pastes its read-only
    # API key here. We validate it by listing accounts and store it server-side.
    uid = await current_user(authorization)
    api_key = (body or {}).get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing api_key")
    accts = _lf_list(await lunchflow_get(api_key, "/accounts"), "accounts", "data")  # validates the key
    await db_upsert(uid, "lunchflow", {
        "display_name": "Lunch Flow", "api_key": api_key, "accounts": accts,
        "session_id": None, "state": None, "aspsp": None, "authorization_id": None})
    return {"ok": True, "accounts": len(accts)}


@app.get("/api/bank/transactions")
async def bank_transactions(days: int = 90, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    start = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.lunchflow"})
    if not rows or not rows[0].get("api_key"):
        return {"transactions": []}
    key = rows[0]["api_key"]
    out = []
    for a in _lf_list(await lunchflow_get(key, "/accounts"), "accounts", "data"):
        aid = _lf_first(a, "id", "account_id", "accountId", "uid")
        if not aid:
            continue
        bank_name = _lf_first(a, "institution", "institution_name", "bank", "name", default="Bank")
        try:
            data = await lunchflow_get(key, f"/accounts/{aid}/transactions")
        except HTTPException:
            continue
        for t in _lf_list(data, "transactions", "data"):
            date_s = str(_lf_first(t, "date", "booking_date", "bookingDate", "timestamp", "made_on", default=start))[:10]
            if date_s < start:
                continue
            value = float(_lf_first(t, "amount", "value", default=0) or 0)
            desc = _lf_first(t, "description", "merchant", "merchant_name", "name", "payee", "counterparty", default="Transaction")
            # Direction if given, else sign. Aggregators usually use negative = money out.
            direction = str(_lf_first(t, "direction", "type", "kind", default="")).lower()
            if direction in ("debit", "outflow", "out", "spend"):
                typ = "spend"
            elif direction in ("credit", "inflow", "in", "income"):
                typ = "income"
            else:
                typ = "income" if value > 0 else "spend"
            out.append({"date": date_s, "amount": abs(value), "type": typ,
                        "description": desc, "source": "bank", "bank": bank_name})
    return {"transactions": out}


@app.get("/api/bank/accounts")
async def bank_accounts(authorization: Optional[str] = Header(default=None)):
    # The accounts Lunch Flow exposes for the linked banks, with balances. Lets the
    # app show which accounts are actually visible over Open Banking (some bank
    # savings products aren't shared) and populate balances into the accounts pages.
    uid = await current_user(authorization)
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.lunchflow"})
    if not rows or not rows[0].get("api_key"):
        return {"accounts": []}
    key = rows[0]["api_key"]
    out = []
    for a in _lf_list(await lunchflow_get(key, "/accounts"), "accounts", "data"):
        aid = _lf_first(a, "id", "account_id", "accountId", "uid", default="")
        name = _lf_first(a, "name", "display_name", "nickname", "account_name", default="Account")
        # The /accounts list carries no balances — fetch each from the per-account
        # balance endpoint, which returns {"balance": {"amount": N, "currency": ...}}.
        bal, ccy = None, "GBP"
        if aid != "":
            try:
                b = (await lunchflow_get(key, f"/accounts/{aid}/balance")) or {}
                node = b.get("balance") if isinstance(b.get("balance"), dict) else b
                amt = _lf_first(node, "amount", "value", "balance", default=None)
                bal = round(float(amt), 2) if amt is not None else None
                ccy = _lf_first(node, "currency", "iso_currency_code", "currency_code", default="GBP")
            except (HTTPException, TypeError, ValueError):
                bal = None
        institution = _lf_first(a, "institution", "institution_name", "bank", "provider", default="")
        # No type in the list either — infer one from the name + institution so the
        # app can pick the right icon and route the balance to cards/loans/savings/
        # current on import. UK card issuers (Capital One, Barclaycard, …) carry no
        # "credit"/"card" word in their name, so match them by issuer too.
        atype = str(_lf_first(a, "type", "account_type", "subtype", "category", "class", default="")).lower()
        if not atype:
            hay = f"{name} {institution}".lower()
            CARD_ISSUERS = ("capital one", "barclaycard", "amex", "american express", "vanquis",
                            "aqua", "marbles", "luma", "fluid", "tymit", "zopa", "newday", "mbna",
                            "118 118", "ocean", "thinkmoney", "jaja")
            if any(w in hay for w in ("credit", "card", "mastercard", "visa")) or any(w in hay for w in CARD_ISSUERS):
                atype = "credit"
            elif any(w in hay for w in ("loan", "mortgage", "finance", "klarna")):
                atype = "loan"
            elif any(w in hay for w in ("saving", "saver", "isa", "fund", "emergency")):
                atype = "savings"
        out.append({
            "id": aid,
            "name": name,
            "institution": institution,
            "type": atype,
            "currency": ccy,
            "balance": bal,
        })
    return {"accounts": out}


@app.post("/api/bank/disconnect")
async def bank_disconnect(bank: str = "lunchflow", authorization: Optional[str] = Header(default=None)):
    # Drops the stored Lunch Flow key. The bank links themselves live in Lunch
    # Flow and are managed there.
    uid = await current_user(authorization)
    await db_delete(uid, "lunchflow")
    return {"ok": True}


@app.post("/api/t212/connect")
async def t212_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    key_id = (body or {}).get("api_key", "").strip()
    secret = (body or {}).get("api_secret", "").strip()
    if not key_id or not secret:
        raise HTTPException(status_code=400, detail="Missing API key ID or secret")
    await t212_get(key_id, secret, "/equity/account/summary")  # validates the pair
    # Key id in api_key; secret kept in the server-only meta jsonb (RLS denies browser).
    await db_upsert(uid, "t212", {"display_name": "Trading 212", "api_key": key_id,
                                  "meta": {"api_secret": secret}})
    return {"ok": True}


@app.get("/api/t212/portfolio")
async def t212_portfolio(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.t212"})
    if not rows or not rows[0].get("api_key"):
        raise HTTPException(status_code=404, detail="Trading 212 not connected")
    key_id = rows[0]["api_key"]
    secret = (rows[0].get("meta") or {}).get("api_secret", "")
    summary = await t212_get(key_id, secret, "/equity/account/summary")
    positions = await t212_get(key_id, secret, "/equity/positions")
    holdings = []
    for p in (positions or []):
        inst = p.get("instrument") or {}
        wallet = p.get("walletImpact") or {}
        qty = float(p.get("quantity", 0) or 0)
        price = float(p.get("currentPrice", 0) or 0)
        holdings.append({"ticker": inst.get("ticker", "") or inst.get("name", ""),
                         "name": inst.get("name", ""), "units": qty, "price": price,
                         "avgCost": float(p.get("averagePricePaid", 0) or 0),
                         "value": round(float(wallet.get("currentValue", qty * price) or 0), 2),
                         "ppl": round(float(wallet.get("unrealizedProfitLoss", 0) or 0), 2),
                         "source": "t212"})
    cash = (summary or {}).get("cash") or {}
    inv = (summary or {}).get("investments") or {}
    return {"cash": round(float(cash.get("availableToTrade", 0) or 0), 2),
            "invested": round(float(inv.get("totalCost", 0) or 0), 2),
            "result": round(float(inv.get("unrealizedProfitLoss", 0) or 0), 2),
            "total": round(float((summary or {}).get("totalValue", 0) or 0), 2),
            "holdings": holdings}


@app.post("/api/t212/disconnect")
async def t212_disconnect(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    await db_delete(uid, "t212")
    return {"ok": True}


# ── Apple / Google calendar subscription feed ─────────────────────────────────
# The Settings screen shows webcal://<site>/api/feed?token=<calendar_token>. Apple
# Calendar / Google Calendar fetch it on a schedule and show your Tend deadlines and
# important dates as a read-only subscribed calendar. Auth is by the unguessable
# per-user token (the standard model for calendar feeds) — no login round-trip, and
# it can only ever read this one user's task titles + dates.
def _ics_escape(s):
    return (str(s or "").replace("\\", "\\\\").replace(";", "\\;")
            .replace(",", "\\,").replace("\r", "").replace("\n", "\\n"))


def _ics_fold(line):
    # RFC 5545: lines must be <=75 octets; fold longer ones with CRLF + a space.
    out = ""
    cur = ""
    for ch in line:
        if len((cur + ch).encode("utf-8")) > 73:
            out += cur + "\r\n "
            cur = ch
        else:
            cur += ch
    return out + cur


async def _state_by_token(token: str):
    params = {"calendar_token": f"eq.{token}", "select": "user_id,data", "limit": "1"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/user_state", headers=_svc(), params=params)
    _db_ok(r, "read")
    rows = r.json() if r.content else []
    return rows[0] if rows else None


@app.get("/api/feed")
async def calendar_feed(token: str = ""):
    token = (token or "").strip()
    if len(token) < 16:
        raise HTTPException(status_code=400, detail="Missing or invalid calendar token")
    row = await _state_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown calendar token")
    data = row.get("data") or {}
    now = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tend//Calendar//EN",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Tend",
             "X-WR-CALDESC:Your Tend tasks and important dates",
             "X-PUBLISHED-TTL:PT6H", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"]

    def add_event(uid, date_str, summary, desc="", rrule=""):
        d = (date_str or "").strip()[:10].replace("-", "")
        if len(d) != 8 or not d.isdigit():
            return
        try:
            start = dt.datetime.strptime(d, "%Y%m%d").date()
        except ValueError:
            return
        end = (start + dt.timedelta(days=1)).strftime("%Y%m%d")  # all-day: DTEND exclusive
        ev = ["BEGIN:VEVENT", f"UID:{uid}@tend", f"DTSTAMP:{now}",
              f"DTSTART;VALUE=DATE:{d}", f"DTEND;VALUE=DATE:{end}",
              f"SUMMARY:{_ics_escape(summary)}"]
        if rrule:
            ev.append(rrule)
        if desc:
            ev.append(f"DESCRIPTION:{_ics_escape(desc)}")
        ev.append("END:VEVENT")
        lines.extend(ev)

    for t in (data.get("tasks") or []):
        if not isinstance(t, dict) or t.get("done"):
            continue
        date_str = t.get("deadline") or t.get("scheduledDate")
        if not date_str:
            continue
        rrule = "RRULE:FREQ=YEARLY" if t.get("repeat") == "yearly" else ""
        add_event(f"task-{t.get('id', '')}", date_str, t.get("title") or "Task",
                  t.get("notes") or "", rrule)

    for it in (data.get("importantDates") or []):
        if not isinstance(it, dict):
            continue
        date_str = it.get("date")
        if not date_str:
            continue
        if len(str(date_str).strip()) == 5:  # MM-DD → anchor to this year; RRULE repeats it
            date_str = f"{dt.date.today().year}-{str(date_str).strip()}"
        try:
            rm = int(it.get("repeatMonths") or 12)
        except (TypeError, ValueError):
            rm = 12
        rrule = ("RRULE:FREQ=YEARLY" if rm == 12 else
                 f"RRULE:FREQ=MONTHLY;INTERVAL={rm}" if rm > 0 else "")
        add_event(f"date-{it.get('id', '')}", date_str, it.get("title") or "Important date",
                  it.get("notes") or "", rrule)

    lines.append("END:VCALENDAR")
    body = "\r\n".join(_ics_fold(ln) for ln in lines) + "\r\n"
    return Response(content=body, media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": "inline; filename=tend.ics",
                             "Cache-Control": "public, max-age=3600"})


# ── iPhone home-screen widget feed ────────────────────────────────────────────
# A read-only JSON summary the Scriptable app fetches to render a Tend widget on
# the iOS home screen (see scriptable-widget.js). Authed by the same per-user
# calendar token as /api/feed. Only computes figures that are unambiguous server-
# side (simple balance sums + task dates) so it can never disagree with the app;
# the budget-derived "safe to spend" is deliberately left to the app.
@app.get("/api/widget")
async def widget(token: str = ""):
    token = (token or "").strip()
    if len(token) < 16:
        raise HTTPException(status_code=400, detail="Missing or invalid token")
    row = await _state_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Unknown token")
    data = row.get("data") or {}
    today = dt.date.today().isoformat()

    def num(x):
        try:
            return float(x or 0)
        except (TypeError, ValueError):
            return 0.0

    tasks = [t for t in (data.get("tasks") or []) if isinstance(t, dict) and not t.get("done")]
    todays = [t for t in tasks if t.get("scheduledDate") == today or t.get("deadline") == today]
    overdue = [t for t in tasks if t.get("deadline") and t.get("deadline") < today]

    in_bank = sum(num(a.get("balance")) for a in (data.get("currentAccounts") or []) if isinstance(a, dict))
    savings = sum(num(a.get("balance")) for a in (data.get("savingsAccounts") or []) if isinstance(a, dict))
    debt = sum(num(d.get("balance")) for d in (data.get("debts") or []) if isinstance(d, dict))
    inv = 0.0
    for h in (data.get("investments") or []):
        if not isinstance(h, dict):
            continue
        v = h.get("value")
        inv += num(v) if v not in (None, "") else num(h.get("units")) * num(h.get("price"))
    pens = 0.0
    plist = data.get("pensions") or ([data.get("pension")] if data.get("pension") else [])
    for p in plist:
        if isinstance(p, dict) and p.get("type") != "state":
            pens += num(p.get("currentPot"))
    net_worth = in_bank + savings + inv + pens - debt

    # Soonest important date within 60 days (handles "YYYY-MM-DD" and "MM-DD").
    next_date = None
    tdy = dt.date.today()
    for it in (data.get("importantDates") or []):
        if not isinstance(it, dict):
            continue
        ds = str(it.get("date") or "").strip()
        mmdd = ds[5:] if len(ds) >= 10 else ds
        parts = mmdd.split("-")
        if len(parts) < 2:
            continue
        try:
            mm, dd = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        for yr in (tdy.year, tdy.year + 1):
            dim = [31, 29 if yr % 4 == 0 and (yr % 100 != 0 or yr % 400 == 0) else 28,
                   31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1] if 1 <= mm <= 12 else 31
            try:
                occ = dt.date(yr, mm, min(dd, dim))
            except ValueError:
                break
            days = (occ - tdy).days
            if 0 <= days <= 60:
                if next_date is None or days < next_date["days"]:
                    next_date = {"title": it.get("title") or "Important date", "days": days}
                break

    payload = {
        "name": (data.get("name") or "").strip(),
        "today": today,
        "tasks": {"todayCount": len(todays), "overdueCount": len(overdue),
                  "today": [t.get("title") or "Task" for t in todays[:4]]},
        "finance": {"netWorth": round(net_worth), "inBank": round(in_bank),
                    "savings": round(savings), "debt": round(debt)},
        "nextDate": next_date,
    }
    return JSONResponse(payload, headers={"Cache-Control": "public, max-age=900"})
