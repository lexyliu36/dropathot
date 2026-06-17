-- Per-user notification preferences
alter table users
  add column if not exists email_dm_digest        boolean not null default true,
  add column if not exists email_activity_digest  boolean not null default true;
