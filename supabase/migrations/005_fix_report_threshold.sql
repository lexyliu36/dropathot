-- Migration 005: fix report threshold to count distinct sessions
-- Prevents a single user from filing 3 reports to auto-hide a thot

create or replace function check_report_threshold()
returns trigger as $$
begin
  if (
    select count(distinct reporter_session)
    from reports
    where thot_id = NEW.thot_id
  ) >= 3 then
    update thots set hidden = true where id = NEW.thot_id;
  end if;
  return NEW;
end;
$$ language plpgsql;
