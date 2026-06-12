/**
 * Diner-facing analytics event taxonomy.
 *
 * This is the contract between the client tracker, the /api/track route, and the
 * Supabase `events.event_name` column. It is intentionally additive — adding a
 * new event here (and to TRACK_EVENTS) is the only change needed; no DB CHECK
 * constraint to migrate.
 */

export type TrackEvent =
  // Menu-level
  | 'menu_opened'
  | 'menu_closed'
  | 'menu_shared'
  | 'language_changed'
  // Cocktail-level
  | 'cocktail_impression'
  | 'cocktail_opened'
  | 'cocktail_scrolled_to'
  | 'cocktail_fully_viewed'
  | 'cocktail_shared'
  | 'cocktail_favorited'
  | 'cocktail_dwell'
  | 'cocktail_scroll_depth'
  | 'section_attention'
  | 'ingredients_opened'
  | 'ar_opened'
  | 'cocktail_ar_dwell'
  | '360_opened'
  | 'cocktail_video_opened'
  | 'cocktail_video_progress'
  // Conversion
  | 'call_waiter_clicked'
  | 'add_to_order_clicked'
  | 'order_started'
  | 'order_completed'
  | 'reservation_clicked'
  | 'phone_clicked'
  | 'whatsapp_clicked'
  // Experiments
  | 'experiment_exposure';

/** Runtime allow-list — the server validates every incoming event against this. */
export const TRACK_EVENTS: ReadonlySet<TrackEvent> = new Set<TrackEvent>([
  'menu_opened',
  'menu_closed',
  'menu_shared',
  'language_changed',
  'cocktail_impression',
  'cocktail_opened',
  'cocktail_scrolled_to',
  'cocktail_fully_viewed',
  'cocktail_shared',
  'cocktail_favorited',
  'cocktail_dwell',
  'cocktail_scroll_depth',
  'section_attention',
  'ingredients_opened',
  'ar_opened',
  'cocktail_ar_dwell',
  '360_opened',
  'cocktail_video_opened',
  'cocktail_video_progress',
  'call_waiter_clicked',
  'add_to_order_clicked',
  'order_started',
  'order_completed',
  'reservation_clicked',
  'phone_clicked',
  'whatsapp_clicked',
  'experiment_exposure',
]);

export function isTrackEvent(value: unknown): value is TrackEvent {
  return typeof value === 'string' && TRACK_EVENTS.has(value as TrackEvent);
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/** What a caller passes to `track()`. */
export interface TrackPayload {
  event: TrackEvent;
  /** Slug of the cocktail in context, if any (menu is code-defined). */
  cocktailSlug?: string;
  /** Numeric signal: scroll %, dwell ms, score delta, etc. */
  value?: number;
  metadata?: Record<string, unknown>;
}

/** One fully-enriched event as sent to the server (a batch is TrackRecord[]). */
export interface TrackRecord extends TrackPayload {
  sessionId: string;
  visitorId: string;
  tableId: string | null;
  deviceType: DeviceType;
  language: string;
  referrer: string | null;
  /** Client clock, epoch ms. The server clamps against its own clock. */
  occurredAt: number;
}

export interface TrackBatch {
  restaurantSlug: string;
  events: TrackRecord[];
}
