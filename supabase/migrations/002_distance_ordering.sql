-- Drop old signatures first (can't change return type of existing function)
drop function if exists get_thots_nearby(float, float, float);
drop function if exists get_thots_nearby(float, float, float, int);

-- Update get_thots_nearby to order by distance from map center first,
-- then by most recent. This ensures thots closest to where the user
-- is looking always appear before distant ones.

create or replace function get_thots_nearby(lat float, lng float, radius_m float, max_results int default 30)
returns setof thots as $$
  select * from thots
  where hidden = false
    and expires_at > now()
    and ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_m
    )
  order by
    ST_Distance(location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) asc,
    created_at desc
  limit max_results;
$$ language sql stable;

grant execute on function get_thots_nearby(float, float, float, int) to anon, authenticated, service_role;
