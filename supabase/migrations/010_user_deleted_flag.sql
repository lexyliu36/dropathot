-- Distinguish manually deleted thots from auto-hidden ones.
-- hidden=true + user_deleted=true → deleted by the user, never show anywhere
-- hidden=true + user_deleted=false → auto-hidden because a newer thot replaced it (still visible in profile history)

alter table thots add column if not exists user_deleted boolean default false;
create index if not exists thots_user_deleted_idx on thots(user_deleted) where user_deleted = true;

-- Backfill: all thots hidden before this column existed are treated as user-deleted
-- so they don't resurface in profile history. Going forward the server sets this correctly.
update thots set user_deleted = true where hidden = true;
