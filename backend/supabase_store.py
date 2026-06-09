"""
Thin Supabase helper for the bank backend.

- verify_user(token): validates the caller's Supabase access token and returns
  their user id (so a request can only touch its OWN bank connection).
- get/save/delete bank_connection rows using the SERVICE-ROLE key, which
  bypasses RLS. The service-role key NEVER leaves the server.

Bank tokens (session ids) live only in this table, never in the browser.
"""
import os
import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


class AuthError(Exception):
    pass


async def verify_user(access_token: str) -> str:
    """Return the Supabase user id for a valid access token, else raise."""
    if not access_token:
        raise AuthError("Missing Authorization bearer token")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {access_token}", "apikey": SUPABASE_ANON_KEY},
        )
    if r.status_code != 200:
        raise AuthError("Invalid or expired session")
    return r.json()["id"]


def _svc_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }


async def get_connection(user_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/bank_connection?user_id=eq.{user_id}&select=*",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
        )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


async def get_connection_by_state(state: str):
    """Used by the OAuth callback, which only carries the `state` we issued."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/bank_connection?state=eq.{state}&select=*",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
        )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


async def save_connection(user_id: str, fields: dict):
    body = {"user_id": user_id, **fields}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/bank_connection?on_conflict=user_id",
            headers=_svc_headers(), json=body,
        )
    r.raise_for_status()
    return r.json()


async def delete_connection(user_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(
            f"{SUPABASE_URL}/rest/v1/bank_connection?user_id=eq.{user_id}",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
        )
