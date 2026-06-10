-- Velocity spike detection log
-- Created when >15 thots appear in the same H3 tile within 10 minutes.
-- Used for admin review of potential coordinated brigading or astroturfing.

create table if not exists velocity_flags (
  id          uuid primary key default gen_random_uuid(),
  h3_tile     text not null,
  thot_count  int not null,
  window_mins int not null default 10,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz default now(),
  reviewed    boolean default false,
  notes       text
);

-- Only service_role can read/write (admin only)
alter table velocity_flags enable row level security;

create policy "service_role_only" on velocity_flags
  using (auth.role() = 'service_role');

-- Index for admin queries: newest unreviewed flags first
create index velocity_flags_unreviewed_idx on velocity_flags(created_at desc)
  where reviewed = false;
