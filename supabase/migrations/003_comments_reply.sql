-- Create comments table (if not already run from 001_init.sql)
create table if not exists comments (
  id                uuid primary key default gen_random_uuid(),
  thot_id           uuid not null references thots(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  pen_name          text not null,
  content           text not null check (char_length(content) <= 280),
  reply_to_pen_name text,
  hype_count        int not null default 0,
  created_at        timestamptz default now()
);

-- reply_to_pen_name column (safe to run even if table already existed)
alter table comments add column if not exists reply_to_pen_name text;

-- Create comment_hypes table
create table if not exists comment_hypes (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(comment_id, user_id)
);

-- Keep comment hype_count in sync
create or replace function update_comment_hype_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update comments set hype_count = hype_count + 1 where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' then
    update comments set hype_count = greatest(0, hype_count - 1) where id = OLD.comment_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists comment_hype_count_sync on comment_hypes;
create trigger comment_hype_count_sync
after insert or delete on comment_hypes
for each row execute function update_comment_hype_count();

-- Add comment_count to thots
alter table thots add column if not exists comment_count int not null default 0;

-- Backfill existing counts
update thots t set comment_count = (
  select count(*) from comments c where c.thot_id = t.id
);

-- Keep thots.comment_count in sync
create or replace function update_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update thots set comment_count = comment_count + 1 where id = NEW.thot_id;
  elsif TG_OP = 'DELETE' then
    update thots set comment_count = greatest(0, comment_count - 1) where id = OLD.thot_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists comment_count_sync on comments;
create trigger comment_count_sync
after insert or delete on comments
for each row execute function update_comment_count();

-- RLS
alter table comments enable row level security;
alter table comment_hypes enable row level security;

drop policy if exists "read_comments" on comments;
create policy "read_comments" on comments for select using (true);

drop policy if exists "insert_comments" on comments;
create policy "insert_comments" on comments for insert with check (auth.uid() = user_id);

drop policy if exists "read_comment_hypes" on comment_hypes;
create policy "read_comment_hypes" on comment_hypes for select using (true);

drop policy if exists "manage_comment_hypes" on comment_hypes;
create policy "manage_comment_hypes" on comment_hypes for all using (auth.uid() = user_id);

-- Grants
grant all on public.comments to service_role;
grant all on public.comment_hypes to service_role;
grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;
grant select on public.comment_hypes to anon, authenticated;
grant insert, delete on public.comment_hypes to authenticated;
