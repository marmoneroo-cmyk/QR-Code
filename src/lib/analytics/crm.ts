import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { CrmSignals } from './crm-types';

const TENANT_SLUG = 'diner';
const EVENT_LIMIT = 50000;
const HOURS_PER_DAY = 24;

/** Per-session accumulator: first language/device seen + ordering flag. */
interface SessionState {
  language: string | null;
  device: string | null;
  ordered: boolean;
}

function emptySignals(): CrmSignals {
  return {
    totalSessions: 0,
    avgEventsPerSession: 0,
    languageSplit: { en: 0, he: 0 },
    deviceSplit: { mobile: 0, tablet: 0, desktop: 0 },
    hourHistogram: new Array(HOURS_PER_DAY).fill(0),
    orderingSessions: 0,
    hasData: false,
  };
}

/**
 * Compute anonymous, session-level CRM signals for one restaurant from the
 * `events` table. Server-only (uses the service-role client). Returns an empty
 * shape if Supabase isn't configured or the tenant is missing — analytics
 * never breaks the page.
 *
 * NOTE: `events` has no persistent visitor id (only `session_id`), so all
 * signals are per-session. Cross-visit returning-visitor tracking requires a
 * future visitor-id migration.
 */
export async function getCrmSignals(
  restaurantSlug: string = TENANT_SLUG,
): Promise<CrmSignals> {
  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return emptySignals();

    const { data: events, error } = await supabase
      .from('events')
      .select('event_name, language, device_type, session_id, occurred_at, created_at')
      .eq('restaurant_id', restaurant.id)
      .limit(EVENT_LIMIT);
    if (error || !events) return emptySignals();

    const sessions = new Map<string, SessionState>();
    const hourSessionSets: Array<Set<string>> = Array.from(
      { length: HOURS_PER_DAY },
      () => new Set<string>(),
    );
    let totalEvents = 0;

    for (const event of events) {
      const sessionId = event.session_id;
      if (!sessionId) continue;
      totalEvents += 1;

      let state = sessions.get(sessionId);
      if (!state) {
        state = { language: null, device: null, ordered: false };
        sessions.set(sessionId, state);
      }
      // First non-null language/device seen wins (events arrive newest-first).
      if (state.language === null && event.language) state.language = event.language;
      if (state.device === null && event.device_type) state.device = event.device_type;
      if (event.event_name === 'order_completed') state.ordered = true;

      const when = new Date(event.occurred_at ?? event.created_at);
      const hour = when.getUTCHours();
      if (Number.isFinite(hour) && hour >= 0 && hour < HOURS_PER_DAY) {
        hourSessionSets[hour].add(sessionId);
      }
    }

    const totalSessions = sessions.size;
    if (totalSessions === 0) return emptySignals();

    const languageSplit = { en: 0, he: 0 };
    const deviceSplit = { mobile: 0, tablet: 0, desktop: 0 };
    let orderingSessions = 0;

    for (const state of sessions.values()) {
      if (state.language === 'en') languageSplit.en += 1;
      else if (state.language === 'he') languageSplit.he += 1;

      if (state.device === 'mobile') deviceSplit.mobile += 1;
      else if (state.device === 'tablet') deviceSplit.tablet += 1;
      else if (state.device === 'desktop') deviceSplit.desktop += 1;

      if (state.ordered) orderingSessions += 1;
    }

    const hourCounts = hourSessionSets.map((set) => set.size);
    const hourMax = Math.max(1, ...hourCounts);
    const hourHistogram = hourCounts.map((count) => count / hourMax);

    return {
      totalSessions,
      avgEventsPerSession: totalEvents / totalSessions,
      languageSplit,
      deviceSplit,
      hourHistogram,
      orderingSessions,
      hasData: totalSessions > 0,
    };
  } catch {
    return emptySignals();
  }
}
