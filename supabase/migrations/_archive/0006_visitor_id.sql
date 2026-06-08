-- ============================================================================
-- 0006 · Visitor identity (Engagement Intelligence prerequisite)
-- Adds a first-class visitor_id column — the backbone for return visits, QR
-- rescans, cohorts, loyalty and visitor journeys. NOT metadata.
-- Safe/additive. Run after 0004 (0005 was never required).
-- ============================================================================

alter table events add column if not exists visitor_id text;

-- Backfill from any visitor id already stamped into metadata.
update events
  set visitor_id = metadata->>'visitorId'
  where visitor_id is null
    and metadata ? 'visitorId';

create index if not exists idx_events_visitor
  on events (restaurant_id, visitor_id);
create index if not exists idx_events_visitor_created
  on events (visitor_id, created_at desc);
