// Tend — public front-end config.
//
// These two values connect the app to your Supabase project. They are SAFE to be
// public: the anon key only allows actions permitted by Row-Level Security, so a
// user can never see anyone else's data. (The SECRET service key is never here —
// it lives only in Vercel environment variables, used by the calendar feed.)
//
// Fill these in with your project's values from:
//   Supabase dashboard → Project Settings → API
//
// If left blank, the app shows a friendly "setup needed" screen.
window.TEND_CONFIG = {
  SUPABASE_URL: "https://sapowtetcppfnlqcpjim.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhcG93dGV0Y3BwZm5scWNwamltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjUyMjYsImV4cCI6MjA5NjAwMTIyNn0.jXbl06KIcZbQlDUPROCIPE61dCVsq5cZDX_Bp0PeCys",

  // Phase B — live bank (via Lunch Flow Open Banking) + Trading 212 integrations.
  // The API runs ON THIS SAME VERCEL SITE at /api (see api/index.py + PHASE-B.md).
  // LEAVE BLANK to keep everything OFF (the app behaves exactly as today).
  // When you've added the Environment Variables in Vercel, switch this to "/api".
  // (The Lunch Flow + Trading 212 API keys are pasted in-app, not set here.)
  BACKEND_URL: "/api",
};
