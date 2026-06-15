-- Queued notifications for hourly digest emails
create table notification_queue (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id) on delete cascade not null,
  type         text not null check (type in ('like', 'comment', 'follow')),
  actor_pen_name text,                        -- who triggered it
  thot_preview text,                          -- first 80 chars of the thot (null for follows)
  thot_id      uuid references thots(id) on delete set null,
  created_at   timestamptz default now(),
  emailed_at   timestamptz                    -- null = pending
);

-- Fast lookup: all pending items grouped by user
create index notification_queue_pending_idx
  on notification_queue(user_id, created_at)
  where emailed_at is null;
