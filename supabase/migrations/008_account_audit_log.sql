-- Account audit log
-- Stores every security-sensitive account change for law-enforcement / support use.
-- Never stored in plaintext: emails are SHA-256 hashed, IPs already hashed upstream.

create table if not exists account_audit_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,           -- references auth.users but no FK (user may be deleted)
  event_type       text not null,           -- 'email_change' | 'password_change' | 'email_change_requested'
  old_value_hash   text,                    -- SHA-256 of old email (null for password events)
  new_value_hash   text,                    -- SHA-256 of new email (null for password events)
  ip_hash          text,                    -- SHA-256 of request IP
  user_agent_hash  text,                    -- SHA-256 of User-Agent header
  metadata         jsonb default '{}',      -- extra context (e.g. pen_name, partial email domain)
  created_at       timestamptz default now()
);

-- Fast lookups per user for support queries
create index if not exists audit_log_user_idx on account_audit_log(user_id, created_at desc);
create index if not exists audit_log_event_idx on account_audit_log(event_type, created_at desc);

-- Service role only — regular users never read or write this table
alter table account_audit_log enable row level security;
create policy "service role only" on account_audit_log
  using (auth.role() = 'service_role');
