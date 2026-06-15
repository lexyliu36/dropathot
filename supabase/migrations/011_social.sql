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

-- RLS for follows
alter table follows enable row level security;
create policy "anyone can read follows" on follows for select using (true);
create policy "auth users can insert follows" on follows for insert with check (auth.uid() = follower_id);
create policy "auth users can delete own follows" on follows for delete using (auth.uid() = follower_id);

-- RLS for messages
alter table messages enable row level security;
create policy "participants can read messages" on messages for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "auth users can send messages" on messages for insert with check (auth.uid() = from_user_id);
create policy "participants can update messages" on messages for update using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- RLS for message_hypes
alter table message_hypes enable row level security;
create policy "anyone can read message hypes" on message_hypes for select using (true);
create policy "auth users can hype messages" on message_hypes for insert with check (auth.uid() = user_id);
create policy "auth users can unhype messages" on message_hypes for delete using (auth.uid() = user_id);

-- RLS for user_reports
alter table user_reports enable row level security;
create policy "auth users can insert reports" on user_reports for insert with check (auth.uid() = reporter_id);
create policy "auth users can read own reports" on user_reports for select using (auth.uid() = reporter_id);

-- Grant privileges (needed when tables are created via raw SQL, not Supabase dashboard)
grant all on public.follows to service_role, authenticated, anon;
grant all on public.messages to service_role, authenticated, anon;
grant all on public.message_hypes to service_role, authenticated, anon;
grant all on public.user_reports to service_role, authenticated, anon;
