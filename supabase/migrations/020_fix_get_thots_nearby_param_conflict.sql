-- CRITICAL BUG FIX: migration 015 introduced a parameter/return-column name conflict.
-- get_thots_nearby had both parameters named `lat`/`lng` AND return columns named `lat`/`lng`.
-- In LANGUAGE SQL with RETURNS TABLE, PostgreSQL resolves the ambiguity by using the row's
-- own column values in st_makepoint, making distance always 0 for every row — the geo filter
-- did nothing. The function was returning the 30 most recent thots globally instead of thots
-- near the requested center.
--
-- Fix: rename parameters to p_lat/p_lng to remove the ambiguity.

drop function if exists get_thots_nearby(float, float, float, int);
drop function if exists get_thots_nearby(float, float, float);

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
  is_seed       boolean
) language sql stable as $$
  select
    t.id, t.content, t.pen_name, t.user_id,
    t.lat, t.lng,
    t.hype_count, t.comment_count,
    t.created_at, t.expires_at,
    t.hidden, t.user_deleted,
    t.is_seed
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
