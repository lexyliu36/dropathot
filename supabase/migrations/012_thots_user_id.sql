-- Add user_id to thots so we can link named users to their posts for follow/DM
alter table thots add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists thots_user_id_idx on thots(user_id);
