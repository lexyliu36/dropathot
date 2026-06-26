-- Migration 026: Add is_incognito to thots
-- Incognito mode lets users post without their pen_name being visible.
-- The real user_id and pen_name are stored in the DB for legal/moderation;
-- the API masks them as 'Anonymous'/null before returning to clients.

alter table thots add column if not exists is_incognito boolean not null default false;

-- Rebuild get_thots_nearby to include is_incognito
drop function if exists get_thots_nearby(float, float, float, int);

create or replace function get_thots_nearby(
  p_lat       float,
  p_lng       float,
  radius_m    float,
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
  user_deleted  boolean,
  is_seed       boolean,
  pin_type      text,
  source_url    text,
  is_incognito  boolean
) language sql stable as $$
  select
    t.id, t.content, t.pen_name, t.user_id,
    t.lat, t.lng,
    t.hype_count, t.comment_count,
    t.created_at, t.expires_at,
    t.hidden, t.user_deleted,
    t.is_seed,
    t.pin_type, t.source_url,
    t.is_incognito
  from thots t
  where t.hidden = false
    and t.expires_at > now()
    and st_dwithin(
      t.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      radius_m
    )
  order by
    st_distance(t.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) asc,
    t.is_seed asc,
    t.hype_count desc,
    t.created_at desc
  limit max_results;
$$;

grant execute on function get_thots_nearby(float, float, float, int) to anon, authenticated, service_role;
