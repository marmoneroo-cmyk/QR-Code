/**
 * Shared bilingual display labels for the event taxonomy.
 *
 * SINGLE SOURCE OF TRUTH for turning a raw `event_name` (e.g. `cocktail_dwell`)
 * into a human-readable label, in English or Hebrew. Used by the admin Journeys
 * (step chips) and Events (feed + per-type pills) screens so neither surfaces a
 * raw snake_case key in either language.
 *
 * This is a DISPLAY concern only — it never affects tracking, validation, or the
 * data contract. `taxonomy.ts` remains the source of truth for the key set; the
 * dev-only assertion below keeps this map in lock-step with `TrackEvent`.
 */

import type { TrackEvent } from './taxonomy';
import { TRACK_EVENTS } from './taxonomy';

export type Lang = 'en' | 'he';

interface Label {
  en: string;
  he: string;
}

/**
 * Noun-style "what kind of event" labels — reads well as a feed row or a
 * per-type count pill ("Video opened · 12" / "וידאו נפתח · 12").
 */
const EVENT_TYPE_LABELS: Record<TrackEvent, Label> = {
  // Menu-level
  menu_opened: { en: 'Menu opened', he: 'תפריט נפתח' },
  menu_closed: { en: 'Menu closed', he: 'תפריט נסגר' },
  menu_shared: { en: 'Menu shared', he: 'תפריט שותף' },
  language_changed: { en: 'Language changed', he: 'שפה הוחלפה' },
  // Cocktail-level
  cocktail_impression: { en: 'Card seen', he: 'כרטיס נראה' },
  cocktail_opened: { en: 'Cocktail opened', he: 'קוקטייל נפתח' },
  cocktail_scrolled_to: { en: 'Scrolled to', he: 'גלילה אל' },
  cocktail_fully_viewed: { en: 'Fully viewed', he: 'נצפה במלואו' },
  cocktail_shared: { en: 'Cocktail shared', he: 'קוקטייל שותף' },
  cocktail_favorited: { en: 'Favorited', he: 'סומן מועדף' },
  cocktail_video_progress: { en: 'Video progress', he: 'התקדמות וידאו' },
  cocktail_ar_dwell: { en: 'AR time', he: 'זמן ב‑AR' },
  cocktail_ar_completed: { en: 'AR completed', he: 'AR הושלם' },
  cocktail_revisited: { en: 'Revisited', he: 'חזר לפריט' },
  cocktail_dwell: { en: 'Dwell time', he: 'זמן שהייה' },
  cocktail_scroll_depth: { en: 'Scroll depth', he: 'עומק גלילה' },
  section_attention: { en: 'Section attention', he: 'תשומת לב לאזור' },
  ingredients_opened: { en: 'Ingredients opened', he: 'מרכיבים נפתחו' },
  ar_opened: { en: 'AR opened', he: 'AR נפתח' },
  '360_opened': { en: '360° opened', he: '360° נפתח' },
  cocktail_video_opened: { en: 'Video opened', he: 'וידאו נפתח' },
  // Conversion
  call_waiter_clicked: { en: 'Called waiter', he: 'קריאה למלצר' },
  add_to_order_clicked: { en: 'Added to order', he: 'הוסף להזמנה' },
  order_started: { en: 'Order started', he: 'הזמנה החלה' },
  order_completed: { en: 'Order placed', he: 'הזמנה בוצעה' },
  reservation_clicked: { en: 'Reservation', he: 'הזמנת מקום' },
  phone_clicked: { en: 'Phone call', he: 'שיחת טלפון' },
  whatsapp_clicked: { en: 'WhatsApp', he: 'וואטסאפ' },
  // Experiments
  experiment_exposure: { en: 'Experiment exposure', he: 'חשיפה לניסוי' },
};

// Dev-only guard: fail loud if taxonomy gains a key this map doesn't cover.
if (process.env.NODE_ENV !== 'production') {
  for (const key of TRACK_EVENTS) {
    if (!(key in EVENT_TYPE_LABELS)) {
       
      console.warn(`[eventLabels] Missing label for event type: ${key}`);
    }
  }
}

/**
 * Friendly, localized label for an event type. Falls back to the raw key when an
 * unknown / non-canonical type appears, so nothing is ever silently hidden.
 */
export function eventTypeLabel(type: string, lang: Lang): string {
  const label = EVENT_TYPE_LABELS[type as TrackEvent];
  if (!label) return type;
  return lang === 'he' ? label.he : label.en;
}

const DEVICE_LABELS: Record<string, Label> = {
  desktop: { en: 'desktop', he: 'מחשב' },
  tablet: { en: 'tablet', he: 'טאבלט' },
  mobile: { en: 'mobile', he: 'נייד' },
};

/**
 * Localized device label. English is kept identical to the raw value; Hebrew
 * maps desktop/tablet/mobile → מחשב/טאבלט/נייד. Unknown values pass through.
 */
export function deviceLabel(device: string | null | undefined, lang: Lang): string | null {
  if (!device) return null;
  const label = DEVICE_LABELS[device.toLowerCase()];
  if (!label) return device;
  return lang === 'he' ? label.he : label.en;
}
