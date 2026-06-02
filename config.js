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
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
