-- Tend — bank connection table (Phase B: live Lloyds via Enable Banking).
-- Run once in Supabase: SQL Editor → paste → Run.
--
-- Holds one bank session per user. Bank tokens live ONLY here and are written
-- exclusively by the backend using the service-role key. RLS has NO policies,
-- so the public anon key can read/write nothing — the row is server-only.

create table if not exists public.bank_connection (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  session_id       text,
  accounts         jsonb,
  aspsp            jsonb,
  state            text,
  authorization_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Look up by the OAuth `state` we issue (used by the consent callback).
create index if not exists bank_connection_state_idx on public.bank_connection (state);

-- RLS on, no policies → anon/auth users get nothing; only service-role (backend) bypasses.
alter table public.bank_connection enable row level security;
