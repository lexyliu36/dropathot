-- Prevent duplicate reports from the same session for the same thot
-- Deduplication is also enforced server-side and in the client store,
-- but this is the authoritative DB-level guard.
ALTER TABLE reports
  ADD CONSTRAINT reports_unique_session_thot
  UNIQUE (thot_id, reporter_session);
