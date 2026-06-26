-- Add last_seen_at to users for online presence tracking
alter table users add column if not exists last_seen_at timestamptz default null;

-- Index for fast "who's online" queries
create index if not exists users_last_seen_at_idx on users (last_seen_at desc nulls last);
