-- ============================================================
-- Migration 015: Security hardening
-- ============================================================
-- 1. Replace get_thots_nearby to never return ip_hash / session_id
-- 2. Tighten RLS on thots/reports — remove open anon insert
-- 3. Replace GRANT ALL on social tables with scoped grants
-- ============================================================

-- ── 1. get_thots_nearby: return only safe columns ───────────────────────────
-- Drop old setof-thots signature (which exposes all columns incl. ip_hash)
drop function if exists get_thots_nearby(float, float, float, int);
drop function if exists get_thots_nearby(float, float, float);

create or replace function get_thots_nearby(
  lat        float,
  lng        float,
  radius_m   float,
  max_results int default 30
)
returns table (
  id            uuid,
  content       text,
  pen_name      text,
  user_id       uuid,
  lat           float8,
  lng           float8,
  hype_count    int,
  comment_count int,
  created_at    timestamptz,
  expires_at    timestamptz,
  hidden        boolean,
  user_deleted  boolean
) language sql stable as $$
  select
    t.id, t.content, t.pen_name, t.user_id,
    t.lat, t.lng,
    t.hype_count, t.comment_count,
    t.created_at, t.expires_at,
    t.hidden, t.user_deleted
  from thots t
  where t.hidden = false
    and t.expires_at > now()
    and st_dwithin(
      t.location,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography,
      radius_m
    )
  order by
    st_distance(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) asc,
    t.created_at desc
  limit max_results;
$$;

grant execute on function get_thots_nearby(float, float, float, int) to anon, authenticated, service_role;

-- ── 2. RLS on thots — remove open anon insert ────────────────────────────────
-- The server uses the service_role key which bypasses RLS.
-- The open anon_insert policy allowed anyone with the anon key to bypass
-- the server entirely (skipping rate limits, moderation, IP hashing).
drop policy if exists "anon_insert" on thots;

-- Only allow authenticated users (server uses service_role, which bypasses RLS
-- entirely, so this policy only applies to direct Supabase client calls).
-- The server is the only intended write path.
create policy "server_only_insert" on thots
  for insert with check (false);  -- deny all direct-client inserts; server uses service_role

-- ── 3. RLS on reports — same fix ─────────────────────────────────────────────
drop policy if exists "anon_insert" on reports;

create policy "server_only_insert_reports" on reports
  for insert with check (false);

-- ── 4. Tighten grants on social tables ───────────────────────────────────────
-- Replace GRANT ALL with scoped minimal grants

-- follows: authenticated users can select (to check if following); server handles writes
revoke all on public.follows from anon;
revoke all on public.follows from authenticated;
grant select on public.follows to authenticated;
-- service_role retains all access via RLS bypass

-- messages: only authenticated can select their own (RLS enforces row-level);
-- server handles inserts/updates
revoke all on public.messages from anon;
revoke all on public.messages from authenticated;
grant select, insert on public.messages to authenticated;

-- message_hypes: only authenticated
revoke all on public.message_hypes from anon;
revoke all on public.message_hypes from authenticated;
grant select, insert, delete on public.message_hypes to authenticated;

-- user_reports: authenticated can insert (to report); no select (reporter privacy)
revoke all on public.user_reports from anon;
revoke all on public.user_reports from authenticated;
grant insert on public.user_reports to authenticated;

-- ── 5. Restrict ip_hash from being selectable by client roles ────────────────
-- Row-level security already scopes what rows are visible, but we can go further
-- by revoking column-level access to ip_hash and session_id on thots
-- from anon and authenticated roles (service_role retains all column access)
revoke select (ip_hash, session_id) on public.thots from anon;
revoke select (ip_hash, session_id) on public.thots from authenticated;

