-- Migration 004: moderation_logs table
-- Stores blocked post attempts for law enforcement compliance (Privacy Policy §5)

create table if not exists moderation_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid,
  ip_hash      text,
  content      text,            -- first 280 chars of blocked content
  reason       text not null,   -- 'perspective' | 'openai' | 'both'
  context      text default 'thot', -- 'thot' | 'comment'
  created_at   timestamptz default now()
);

-- Retained for 3 years per Privacy Policy
create index if not exists moderation_logs_created_idx on moderation_logs(created_at);
create index if not exists moderation_logs_session_idx on moderation_logs(session_id);

-- Only service_role can read/write; no anon/authenticated access
alter table moderation_logs enable row level security;

-- No policies = no access for anon/authenticated roles (service_role bypasses RLS)
grant all on public.moderation_logs to service_role;
