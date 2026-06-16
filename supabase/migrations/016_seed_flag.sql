-- Add is_seed flag to thots
alter table thots add column if not exists is_seed boolean not null default false;

-- Mark all existing seed rows (session_ids follow a0000000-* or b0000000-* pattern)
update thots
set is_seed = true, hidden = true
where session_id::text ~ '^[ab]0000000-0000-0000-0000-[0-9]{12}$';

-- Index for fast seed toggle queries
create index if not exists thots_is_seed_idx on thots(is_seed) where is_seed = true;
