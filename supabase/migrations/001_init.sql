-- Enable PostGIS
create extension if not exists postgis;

-- Thots table
create table thots (
  id          uuid primary key default gen_random_uuid(),
  content     text not null check (char_length(content) <= 280),
  pen_name    text,
  session_id  uuid not null,
  ip_hash     text not null,
  location    geography(Point, 4326) not null,
  lat         float8 generated always as (ST_Y(location::geometry)) stored,
  lng         float8 generated always as (ST_X(location::geometry)) stored,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '24 hours',
  hidden      boolean default false
);

create index thots_location_idx on thots using gist(location);
create index thots_expires_idx on thots(expires_at);
create index thots_session_idx on thots(session_id);

-- Users table (only for signed-up users)
create table users (
  id          uuid primary key references auth.users,
  pen_name    text unique not null,
  birth_year  int not null,
  created_at  timestamptz default now(),
  is_banned   boolean default false
);

-- Reports table
create table reports (
  id                uuid primary key default gen_random_uuid(),
  thot_id           uuid references thots(id),
  reporter_session  uuid,
  reason            text,
  created_at        timestamptz default now()
);

-- Auto-hide thot when 3+ reports
create or replace function check_report_threshold()
returns trigger as $$
begin
  if (select count(*) from reports where thot_id = NEW.thot_id) >= 3 then
    update thots set hidden = true where id = NEW.thot_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger report_threshold after insert on reports
  for each row execute function check_report_threshold();

-- Nearby thots query function
create or replace function get_thots_nearby(lat float, lng float, radius_m float)
returns setof thots as $$
  select * from thots
  where hidden = false
    and expires_at > now()
    and ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_m
    )
  order by created_at desc
  limit 100;
$$ language sql stable;

-- Row-level security
alter table thots enable row level security;
alter table users enable row level security;
alter table reports enable row level security;

create policy "read_visible" on thots
  for select using (hidden = false and expires_at > now());

create policy "anon_insert" on thots
  for insert with check (true);

create policy "users_read_own" on users
  for select using (auth.uid() = id);

create policy "users_insert_own" on users
  for insert with check (auth.uid() = id);

create policy "reports_insert" on reports
  for insert with check (true);

-- Grant table privileges (service_role bypasses RLS but still needs GRANT)
grant all on public.thots to service_role;
grant all on public.users to service_role;
grant all on public.reports to service_role;
grant execute on function get_thots_nearby(float, float, float) to service_role;

-- Allow anon/authenticated roles to call the nearby function
grant execute on function get_thots_nearby(float, float, float) to anon, authenticated;

-- Hypes table (one per user per thot)
create table hypes (
  id          uuid primary key default gen_random_uuid(),
  thot_id     uuid not null references thots(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(thot_id, user_id)
);

-- Add hype_count to thots
alter table thots add column if not exists hype_count int not null default 0;

-- Trigger to keep hype_count in sync
create or replace function update_hype_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update thots set hype_count = hype_count + 1 where id = NEW.thot_id;
  elsif TG_OP = 'DELETE' then
    update thots set hype_count = greatest(0, hype_count - 1) where id = OLD.thot_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger hype_count_sync
after insert or delete on hypes
for each row execute function update_hype_count();

-- RLS
alter table hypes enable row level security;
create policy "Users can manage their own hypes"
  on hypes for all using (auth.uid() = user_id);
