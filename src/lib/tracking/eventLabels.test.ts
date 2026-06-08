import { describe, it, expect } from 'vitest';
import { eventTypeLabel, deviceLabel } from './eventLabels';
import { TRACK_EVENTS } from './taxonomy';

describe('eventTypeLabel', () => {
  it('returns the English label for a known event', () => {
    expect(eventTypeLabel('cocktail_dwell', 'en')).toBe('Dwell time');
    expect(eventTypeLabel('order_completed', 'en')).toBe('Order placed');
  });

  it('returns the Hebrew label for a known event', () => {
    expect(eventTypeLabel('cocktail_dwell', 'he')).toBe('זמן שהייה');
    expect(eventTypeLabel('order_completed', 'he')).toBe('הזמנה בוצעה');
  });

  it('falls back to the raw key for an unknown event (both languages)', () => {
    expect(eventTypeLabel('totally_made_up', 'en')).toBe('totally_made_up');
    expect(eventTypeLabel('totally_made_up', 'he')).toBe('totally_made_up');
  });

  it('covers every taxonomy event with a real (non-raw) label in both languages', () => {
    for (const key of TRACK_EVENTS) {
      expect(eventTypeLabel(key, 'en'), `missing EN label for ${key}`).not.toBe(key);
      expect(eventTypeLabel(key, 'he'), `missing HE label for ${key}`).not.toBe(key);
    }
  });
});

describe('deviceLabel', () => {
  it('passes English through unchanged', () => {
    expect(deviceLabel('desktop', 'en')).toBe('desktop');
    expect(deviceLabel('mobile', 'en')).toBe('mobile');
  });

  it('maps known devices to Hebrew', () => {
    expect(deviceLabel('desktop', 'he')).toBe('מחשב');
    expect(deviceLabel('tablet', 'he')).toBe('טאבלט');
    expect(deviceLabel('mobile', 'he')).toBe('נייד');
  });

  it('is case-insensitive', () => {
    expect(deviceLabel('DESKTOP', 'he')).toBe('מחשב');
  });

  it('returns null for null / undefined / empty', () => {
    expect(deviceLabel(null, 'he')).toBeNull();
    expect(deviceLabel(undefined, 'en')).toBeNull();
    expect(deviceLabel('', 'he')).toBeNull();
  });

  it('passes unknown devices through', () => {
    expect(deviceLabel('watch', 'he')).toBe('watch');
  });
});
