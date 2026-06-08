/**
 * Anonymous, session-level CRM signals derived from the `events` table.
 *
 * NOTE: there is NO persistent visitor_id column on `events` (only
 * `session_id`), so every metric here is scoped to a single session. True
 * cross-visit "returning visitor" profiling needs a future visitor-id
 * migration — see `getCrmSignals` and the /admin/crm page note.
 */
export interface CrmSignals {
  /** Distinct sessions observed. */
  totalSessions: number;
  /** totalEvents / totalSessions (0 when there are no sessions). */
  avgEventsPerSession: number;
  /** Distinct-session counts by the first language seen in each session. */
  languageSplit: { en: number; he: number };
  /** Distinct-session counts by the first device seen in each session. */
  deviceSplit: { mobile: number; tablet: number; desktop: number };
  /** Length 24: distinct sessions active per UTC hour, normalized to 0..1. */
  hourHistogram: number[];
  /** Distinct sessions that completed at least one order. */
  orderingSessions: number;
  /** True when at least one session was observed. */
  hasData: boolean;
}
