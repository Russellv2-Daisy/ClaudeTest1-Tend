-- Tend — Supabase schema
-- Run this once in your Supabase project: SQL Editor → paste → Run.
--
-- Design: each user's entire app state (tasks, groups, important dates, tags,
-- settings) is stored as one JSON blob in their own row. Row-Level Security
-- guarantees a user can only ever read/write their own row, so you and your
-- friend get fully separate private lists.

create table if not exists public.user_state (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  data           jsonb       not null default '{}'::jsonb,
  calendar_token text        unique not null,
  updated_at     timestamptz not null default now()
);

-- Turn on Row-Level Security.
alter table public.user_state enable row level security;

-- Policy: a logged-in user may do anything to ONLY their own row.
drop policy if exists "own row" on public.user_state;
create policy "own row" on public.user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for the calendar feed lookup (by token).
create index if not exists user_state_calendar_token_idx
  on public.user_state (calendar_token);
