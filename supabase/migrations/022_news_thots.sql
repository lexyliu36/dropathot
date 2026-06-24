-- Migration 022: Generic automated-pin support
-- pin_type identifies the source of auto-posted thots (e.g. 'news', 'event')
-- source_url is the canonical URL for deduplication and linking back to the source

alter table thots
  add column if not exists pin_type  text,
  add column if not exists source_url text;

-- Fast dedup lookups by source URL
create index if not exists thots_source_url_idx on thots (source_url)
  where source_url is not null;

comment on column thots.pin_type   is 'null = normal user thot; ''news'' = RSS auto-post; ''event'' = venue/event auto-post; extensible';
comment on column thots.source_url is 'canonical source URL; used for deduplication across all auto-post types';
