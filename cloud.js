// Tend — cloud auth + data layer (Supabase).
//
// Exposes window.TendCloud with: ready, isConfigured, auth helpers, and
// load/save of the per-user state blob. Keeps a localStorage cache so the app
// opens instantly and survives brief offline moments.

(function () {
  const cfg = window.TEND_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  // Cache is namespaced PER USER so two accounts on one browser can never see
  // each other's data. (The old global "tend_cache_v1" key is purged below.)
  const CACHE_PREFIX = "tend_cache_v2_";
  const OLD_GLOBAL_KEY = "tend_cache_v1";

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  // Make a random URL-safe token for the user's private calendar feed.
  function makeToken() {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function cacheKey(uid) { return CACHE_PREFIX + (uid || "anon"); }
  function cacheGet(uid) {
    try { return JSON.parse(localStorage.getItem(cacheKey(uid))); } catch { return null; }
  }
  function cacheSet(uid, data) {
    try { localStorage.setItem(cacheKey(uid), JSON.stringify(data)); } catch {}
  }
  // Remove every cached blob (all users + the legacy global key). Used on sign-out.
  function cacheClearAll() {
    try {
      localStorage.removeItem(OLD_GLOBAL_KEY);
      Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch {}
  }
  // One-time purge of the old shared cache that could leak between accounts.
  try { localStorage.removeItem(OLD_GLOBAL_KEY); } catch {}

  // Device-local display preferences (theme / mode / scene). Kept in their OWN key
  // — NOT under CACHE_PREFIX — so they survive sign-out (cacheClearAll) and are
  // re-applied at boot, instead of resetting to defaults on every login.
  const PREFS_KEY = "tend_prefs";
  function prefsGet() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } }
  function prefsSet(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p || {})); } catch {} }

  const TendCloud = {
    isConfigured: configured,
    client: sb,
    _user: null,

    // Subscribe to login/logout. Calls cb(user|null) immediately and on change.
    onAuth(cb) {
      if (!sb) { cb(null); return () => {}; }
      sb.auth.getSession().then(({ data }) => {
        this._user = data.session ? data.session.user : null;
        cb(this._user);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        this._user = session ? session.user : null;
        cb(this._user);
      });
      return () => sub.subscription.unsubscribe();
    },

    async signInWithGoogle() {
      if (!sb) return;
      await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    },

    async signInWithEmail(email, password) {
      return sb.auth.signInWithPassword({ email, password });
    },

    async signUpWithEmail(email, password, name) {
      return sb.auth.signUp({
        email,
        password,
        // Return to wherever the app is served from (prod or localhost dev).
        // Note: this target must also be allow-listed in Supabase →
        // Authentication → URL Configuration → Redirect URLs.
        // `data` is stored as the user's metadata so we can greet them by name.
        options: { emailRedirectTo: window.location.origin, data: name ? { full_name: name } : undefined },
      });
    },

    async signOut() {
      if (sb) await sb.auth.signOut();
      cacheClearAll();
    },

    // Load the current user's state blob. Returns { data, calendarToken } or null.
    async load() {
      if (!sb || !this._user) return null;
      const uid = this._user.id;
      const { data, error } = await sb
        .from("user_state")
        .select("data, calendar_token")
        .eq("user_id", uid)
        .maybeSingle();
      // On error, only fall back to THIS user's own cache — never another account's.
      if (error) { console.warn("load error", error); return cacheGet(uid); }

      if (!data) {
        // First login — create the user's row with a fresh calendar token.
        const token = makeToken();
        const { error: insErr } = await sb
          .from("user_state")
          .insert({ user_id: uid, data: {}, calendar_token: token });
        if (insErr) console.warn("init row error", insErr);
        const fresh = { data: {}, calendarToken: token };
        cacheSet(uid, fresh);
        return fresh;
      }
      const result = { data: data.data || {}, calendarToken: data.calendar_token };
      cacheSet(uid, result);
      return result;
    },

    // Save the state blob (debounced by the caller).
    async save(stateData) {
      if (!sb || !this._user) return;
      const uid = this._user.id;
      cacheSet(uid, { data: stateData, calendarToken: (cacheGet(uid) || {}).calendarToken });
      const { error } = await sb
        .from("user_state")
        .update({ data: stateData, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
      if (error) console.warn("save error", error);
    },

    // Phase B: the signed-in user's Supabase access token, sent to the backend
    // so it can act on this user's behalf (and the client is never trusted).
    async getAccessToken() {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.access_token) || null;
    },

    cacheGet,
    prefsGet,
    prefsSet,

    // ── Document storage (Supabase Storage, "documents" bucket) ──
    // Files live at <uid>/<id>_<filename> so RLS can scope each user to their own
    // folder. Needs the bucket + policies set up once (see DOCUMENTS-SETUP.md).
    async uploadDoc(file, id) {
      if (!sb || !this._user) throw new Error("Not signed in");
      const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_");
      const path = this._user.id + "/" + id + "_" + safe;
      const { error } = await sb.storage.from("documents").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      return path;
    },
    async docUrl(path) {
      if (!sb) throw new Error("Storage unavailable");
      const { data, error } = await sb.storage.from("documents").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    async deleteDoc(path) {
      if (!sb || !path) return;
      try { await sb.storage.from("documents").remove([path]); } catch (e) { console.warn("deleteDoc", e); }
    },
  };

  window.TendCloud = TendCloud;

  // ── Phase B: live bank + investment backend client ──────────────────────────
  // Calls the Python API that runs on this same Vercel site at /api (set
  // config.js → BACKEND_URL = "/api" to switch on). Blank ⇒ disabled, app
  // behaves exactly as today.
  const BACKEND_URL = (cfg.BACKEND_URL || "").replace(/\/+$/, "");
  async function backendFetch(path, opts) {
    opts = opts || {};
    if (!BACKEND_URL) throw new Error("Backend not configured");
    const token = await TendCloud.getAccessToken();
    if (!token) throw new Error("Not signed in");
    const res = await fetch(BACKEND_URL + path, {
      method: opts.method || "GET",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail || ""; } catch (e) {}
      throw new Error(detail || `Backend ${path} → ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }
  const TendBank = {
    enabled: !!BACKEND_URL,
    base: BACKEND_URL,
    listConnections() { return backendFetch("/connections"); },

    // ── Open Banking via Lunch Flow ──
    // The user links their banks inside Lunch Flow, then pastes its read-only API
    // key here (same pattern as Trading 212). No redirect, no widget in Tend.
    connectBank(apiKey) { return backendFetch("/bank/connect", { method: "POST", body: { api_key: apiKey } }); },
    syncTransactions(days) { return backendFetch("/bank/transactions?days=" + (days || 90)); },
    getAccounts() { return backendFetch("/bank/accounts"); },
    disconnectBank() { return backendFetch("/bank/disconnect", { method: "POST" }); },

    // ── Trading 212 ──
    connectT212(apiKey, apiSecret) { return backendFetch("/t212/connect", { method: "POST", body: { api_key: apiKey, api_secret: apiSecret } }); },
    getPortfolio() { return backendFetch("/t212/portfolio"); },
    disconnectT212() { return backendFetch("/t212/disconnect", { method: "POST" }); },
  };
  window.TendBank = TendBank;
})();
