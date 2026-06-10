-- Account deletion: 30-day soft delete window (Twitter model)
alter table users add column if not exists deletion_requested_at timestamptz default null;

-- Index for the daily cron job query
create index if not exists users_deletion_idx on users(deletion_requested_at)
  where deletion_requested_at is not null;

comment on column users.deletion_requested_at is
  'Set when user requests deletion. Hard delete fires 30 days later. Null = active account.';
