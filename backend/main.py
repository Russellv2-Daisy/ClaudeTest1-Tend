"""
Tend bank backend — connects a user's Lloyds account via Enable Banking and
serves normalised transactions/balances back to the static front-end.

Runs as a standalone service (e.g. Render). The static site calls it with the
signed-in user's Supabase access token; bank session tokens stay here, in the
Supabase `bank_connection` table, never in the browser.

Environment variables (set these on the host):
  ENABLE_APPLICATION_ID   Enable Banking application id (JWT `kid`)
  ENABLE_PRIVATE_KEY      Enable Banking RSA private key (PEM; \n-escaped ok)
  SUPABASE_URL            e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY       public anon key (to verify user tokens)
  SUPABASE_SERVICE_KEY    secret service-role key (server-only)
  APP_URL                 the front-end origin, e.g. https://claude-test1-tend.vercel.app
  BACKEND_URL             this service's public URL, e.g. https://tend-bank.onrender.com
  ACCESS_VALID_DAYS       optional, consent length in days (default 90)
"""
import os
import uuid
import datetime as dt

from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse

from enable_banking import EnableBanking, EnableBankingError
import supabase_store as store

APP_URL = os.environ.get("APP_URL", "http://localhost:4178").rstrip("/")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
VALID_DAYS = int(os.environ.get("ACCESS_VALID_DAYS", "90"))

app = FastAPI(title="Tend bank backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_URL, "http://localhost:4178"],
    allow_methods=["*"], allow_headers=["*"], allow_credentials=False,
)

def eb() -> EnableBanking:
    return EnableBanking(os.environ.get("ENABLE_APPLICATION_ID", ""), os.environ.get("ENABLE_PRIVATE_KEY", ""))

async def current_user(authorization: str | None) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        return await store.verify_user(token)
    except store.AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/")
def health():
    return {"ok": True, "service": "tend-bank", "app": APP_URL}


@app.post("/bank/auth")
async def bank_auth(authorization: str | None = Header(default=None)):
    """Start the Lloyds consent flow. Returns { url } for the browser to visit."""
    user_id = await current_user(authorization)
    state = uuid.uuid4().hex
    valid_until = (dt.datetime.utcnow() + dt.timedelta(days=VALID_DAYS)).replace(microsecond=0).isoformat() + "Z"
    try:
        client = eb()
        aspsp = await client.find_aspsp("Lloyds", "GB")
        res = await client.start_auth(aspsp, f"{BACKEND_URL}/bank/callback", state, valid_until)
    except EnableBankingError as e:
        raise HTTPException(status_code=502, detail=str(e))
    # Persist state -> user so the callback (which only has `state`) can resolve it.
    await store.save_connection(user_id, {
        "state": state, "authorization_id": res.get("authorization_id"),
        "aspsp": aspsp, "session_id": None, "accounts": None,
    })
    return {"url": res.get("url")}


@app.get("/bank/callback")
async def bank_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    """Enable Banking redirects here after the user consents at Lloyds."""
    if error or not code or not state:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    conn = await store.get_connection_by_state(state)
    if not conn:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    try:
        session = await eb().create_session(code)
    except EnableBankingError:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    await store.save_connection(conn["user_id"], {
        "session_id": session.get("session_id"),
        "accounts": session.get("accounts"),
        "aspsp": session.get("aspsp", conn.get("aspsp")),
        "state": None,
    })
    return RedirectResponse(f"{APP_URL}/?bank=connected")


@app.get("/bank/status")
async def bank_status(authorization: str | None = Header(default=None)):
    user_id = await current_user(authorization)
    conn = await store.get_connection(user_id)
    accounts = (conn or {}).get("accounts") or []
    return {"connected": bool(conn and conn.get("session_id")), "accounts": len(accounts),
            "bank": ((conn or {}).get("aspsp") or {}).get("name")}


def _norm_account_uid(a):
    return a if isinstance(a, str) else (a.get("uid") or a.get("account_uid") or a.get("id"))


@app.get("/bank/transactions")
async def bank_transactions(authorization: str | None = Header(default=None), days: int = 90):
    user_id = await current_user(authorization)
    conn = await store.get_connection(user_id)
    if not conn or not conn.get("session_id"):
        raise HTTPException(status_code=404, detail="No bank connected")
    date_from = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    out = []
    client = eb()
    for a in (conn.get("accounts") or []):
        uid = _norm_account_uid(a)
        if not uid:
            continue
        try:
            data = await client.transactions(uid, date_from)
        except EnableBankingError:
            continue
        for t in data.get("transactions", []):
            amt = t.get("transaction_amount", {}) or t.get("amount", {})
            value = float(amt.get("amount", 0) or 0)
            credit = (t.get("credit_debit_indicator") or "").upper() == "CRDT"
            out.append({
                "date": (t.get("booking_date") or t.get("value_date") or date_from)[:10],
                "amount": abs(value),
                "type": "income" if credit else "spend",
                "description": (t.get("creditor", {}) or {}).get("name") or (t.get("debtor", {}) or {})
                .get("name") or " ".join(t.get("remittance_information", []) or []) or "Transaction",
                "source": "bank",
            })
    return {"transactions": out}


@app.post("/bank/disconnect")
async def bank_disconnect(authorization: str | None = Header(default=None)):
    user_id = await current_user(authorization)
    await store.delete_connection(user_id)
    return {"ok": True}
