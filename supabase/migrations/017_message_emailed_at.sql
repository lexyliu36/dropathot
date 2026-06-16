-- Track which unread DMs have already been included in a digest email,
-- so we never double-email the same message.
alter table messages add column if not exists emailed_at timestamptz;

-- Index for the digest query: unread + un-emailed messages
create index if not exists messages_digest_idx
  on messages(to_user_id, emailed_at, read_at)
  where read_at is null and emailed_at is null;
