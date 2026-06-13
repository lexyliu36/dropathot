-- ── Follows ──────────────────────────────────────────────────────────────────
create table if not exists follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, following_id),
  check(follower_id <> following_id)
);
create index follows_follower_idx  on follows(follower_id);
create index follows_following_idx on follows(following_id);

-- ── Direct Messages ───────────────────────────────────────────────────────────
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id   uuid not null references users(id) on delete cascade,
  content      text not null check (char_length(content) <= 1000),
  hype_count   int not null default 0,
  read_at      timestamptz,
  created_at   timestamptz default now(),
  check(from_user_id <> to_user_id)
);
create index messages_convo_idx on messages(
  least(from_user_id::text, to_user_id::text),
  greatest(from_user_id::text, to_user_id::text),
  created_at
);

-- ── Message hypes ─────────────────────────────────────────────────────────────
create table if not exists message_hypes (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  primary key (message_id, user_id)
);

create or replace function update_message_hype_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update messages set hype_count = hype_count + 1 where id = NEW.message_id;
  elsif TG_OP = 'DELETE' then
    update messages set hype_count = greatest(0, hype_count - 1) where id = OLD.message_id;
  end if;
  return null;
end;
$$;

create trigger message_hype_trigger
after insert or delete on message_hypes
for each row execute function update_message_hype_count();

-- ── User reports ──────────────────────────────────────────────────────────────
create table if not exists user_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  reported_id uuid not null references users(id) on delete cascade,
  reason      text,
  created_at  timestamptz default now()
);
