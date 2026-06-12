-- Tend — Phase B connections table (live Lloyds + Chase via Open Banking,
-- plus the Trading 212 API key). Run once in Supabase: SQL Editor → paste → Run.
--
-- One row PER (user, provider). Bank session ids and the Trading 212 API key
-- live ONLY here and are written exclusively by the backend using the
-- service-role key. RLS is ON with NO policies, so the public anon key (the
-- browser) can read/write nothing — these rows are server-only.

create table if not exists public.connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider         text not null,            -- 'lloyds' | 'chase' | 't212'
  display_name     text,
  -- Open Banking (Lloyds / Chase)
  session_id       text,
  accounts         jsonb,
  aspsp            jsonb,
  state            text,
  authorization_id text,
  -- Trading 212
  api_key          text,
  -- misc
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists connections_state_idx on public.connections (state);

alter table public.connections enable row level security;
-- Intentionally NO policies: only the backend's service-role key may touch this
-- table. The browser's anon key is fully denied.
