"""
Enable Banking API client (https://enablebanking.com).

Covers any UK Open Banking bank — Tend uses it for **Lloyds** and **Chase UK**;
the only difference between banks is the ASPSP name we match in step 1.

Auth model: every request carries a short-lived JWT signed with your
application's RSA private key (RS256). The JWT's `kid` header is your
Application ID. There is no separate token exchange — the signed JWT *is*
the bearer token.

Flow for connecting an account:
  1. GET  /aspsps?country=GB        -> find the bank's ASPSP entry (e.g. Lloyds, Chase)
  2. POST /auth                     -> get a consent URL; user logs into their bank
  3. (user is redirected back with ?code=...)
  4. POST /sessions {code}          -> session_id + list of account uids
  5. GET  /accounts/{uid}/balances
  6. GET  /accounts/{uid}/transactions?date_from=...

Endpoint/field names follow Enable Banking's public API; if EB changes them,
adjust here in one place.
"""
import os
import time
import jwt  # PyJWT
import httpx

API_BASE = os.environ.get("ENABLE_API_BASE", "https://api.enablebanking.com").rstrip("/")


class EnableBankingError(Exception):
    pass


class EnableBanking:
    def __init__(self, application_id: str, private_key_pem: str):
        if not application_id or not private_key_pem:
            raise EnableBankingError("Missing ENABLE_APPLICATION_ID / ENABLE_PRIVATE_KEY")
        self.application_id = application_id
        # Hosts store multiline secrets with literal \n sometimes — normalise.
        self.private_key = private_key_pem.replace("\\n", "\n")

    def _jwt(self) -> str:
        now = int(time.time())
        payload = {"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 3600}
        headers = {"typ": "JWT", "alg": "RS256", "kid": self.application_id}
        return jwt.encode(payload, self.private_key, algorithm="RS256", headers=headers)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._jwt()}", "Content-Type": "application/json"}

    async def _request(self, method: str, path: str, **kw):
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.request(method, f"{API_BASE}{path}", headers=self._headers(), **kw)
        if r.status_code >= 400:
            raise EnableBankingError(f"EB {method} {path} -> {r.status_code}: {r.text}")
        return r.json() if r.content else {}

    async def list_aspsps(self, country="GB") -> list:
        data = await self._request("GET", f"/aspsps?country={country}")
        return data.get("aspsps", data if isinstance(data, list) else [])

    async def find_aspsp(self, name_contains="Lloyds", country="GB") -> dict:
        for a in await self.list_aspsps(country):
            if name_contains.lower() in (a.get("name", "").lower()):
                return a
        raise EnableBankingError(f"No ASPSP matching '{name_contains}' in {country}")

    async def start_auth(self, aspsp: dict, redirect_url: str, state: str, valid_until_iso: str) -> dict:
        body = {
            "access": {"valid_until": valid_until_iso},
            "aspsp": {"name": aspsp["name"], "country": aspsp.get("country", "GB")},
            "state": state,
            "redirect_url": redirect_url,
            "psu_type": "personal",
        }
        return await self._request("POST", "/auth", json=body)

    async def create_session(self, code: str) -> dict:
        return await self._request("POST", "/sessions", json={"code": code})

    async def get_session(self, session_id: str) -> dict:
        return await self._request("GET", f"/sessions/{session_id}")

    async def balances(self, account_uid: str) -> dict:
        return await self._request("GET", f"/accounts/{account_uid}/balances")

    async def transactions(self, account_uid: str, date_from: str) -> dict:
        return await self._request("GET", f"/accounts/{account_uid}/transactions?date_from={date_from}")
