// Tend — cloud auth + data layer (Supabase).
//
// Exposes window.TendCloud with: ready, isConfigured, auth helpers, and
// load/save of the per-user state blob. Keeps a localStorage cache so the app
// opens instantly and survives brief offline moments.

(function () {
  const cfg = window.TEND_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const CACHE_KEY = "tend_cache_v1";

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

  function cacheGet() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
  }
  function cacheSet(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  }

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

    async signUpWithEmail(email, password) {
      return sb.auth.signUp({ email, password });
    },

    async signOut() {
      if (sb) await sb.auth.signOut();
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    },

    // Load the current user's state blob. Returns { data, calendarToken } or null.
    async load() {
      if (!sb || !this._user) return null;
      const { data, error } = await sb
        .from("user_state")
        .select("data, calendar_token")
        .eq("user_id", this._user.id)
        .maybeSingle();
      if (error) { console.warn("load error", error); return cacheGet(); }

      if (!data) {
        // First login — create the user's row with a fresh calendar token.
        const token = makeToken();
        const { error: insErr } = await sb
          .from("user_state")
          .insert({ user_id: this._user.id, data: {}, calendar_token: token });
        if (insErr) console.warn("init row error", insErr);
        const fresh = { data: {}, calendarToken: token };
        cacheSet(fresh);
        return fresh;
      }
      const result = { data: data.data || {}, calendarToken: data.calendar_token };
      cacheSet(result);
      return result;
    },

    // Save the state blob (debounced by the caller).
    async save(stateData) {
      cacheSet({ data: stateData, calendarToken: (cacheGet() || {}).calendarToken });
      if (!sb || !this._user) return;
      const { error } = await sb
        .from("user_state")
        .update({ data: stateData, updated_at: new Date().toISOString() })
        .eq("user_id", this._user.id);
      if (error) console.warn("save error", error);
    },

    cacheGet,
  };

  window.TendCloud = TendCloud;
})();
