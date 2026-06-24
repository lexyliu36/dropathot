-- Add categories column to moderation_logs to store specific OpenAI violation types
-- e.g. ["hate", "violence"] instead of just the source name
alter table moderation_logs
  add column if not exists categories text[] default null;
