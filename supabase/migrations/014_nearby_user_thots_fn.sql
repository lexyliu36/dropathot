-- Helper function used by admin unhide endpoint to find a user's other active
-- thots within a given radius, so we can enforce the "one active thot per area"
-- rule when restoring a hidden thot.
create or replace function get_nearby_user_thots(
  p_session_id uuid,
  p_exclude_id uuid,
  p_meters     float default 250
)
returns table(id uuid, content text, created_at timestamptz)
language sql stable as $$
  select t.id, t.content, t.created_at
  from   thots t
  where  t.session_id = p_session_id
    and  t.id        <> p_exclude_id
    and  t.hidden     = false
    and  t.expires_at > now()
    and  st_dwithin(
           t.location,
           (select location from thots where id = p_exclude_id),
           p_meters
         );
$$;
