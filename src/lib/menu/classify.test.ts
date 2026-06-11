import { describe, it, expect } from 'vitest';
import { inferKind } from './classify';

describe('inferKind', () => {
  it('classifies food by its menu section', () => {
    expect(inferKind('המבורגר כמהין', 'המבורגרים')).toBe('food');
    expect(inferKind('לחם מחמצת', 'ראשונות')).toBe('food');
    expect(inferKind('Spaghetti', 'Pasta')).toBe('food');
    expect(inferKind('תיבת קינוחים', 'קינוחים')).toBe('food');
  });

  it('classifies drinks by section or name', () => {
    expect(inferKind('Aperol Spritz', 'קוקטיילים')).toBe('drink');
    expect(inferKind('קורונה', 'בירות')).toBe('drink');
    expect(inferKind('Margarita', null)).toBe('drink');
    expect(inferKind('Negroni', undefined)).toBe('drink');
  });

  it('lets a strong food signal win over an incidental drink word', () => {
    // a "beer-battered fish" is food, not a drink
    expect(inferKind('Beer-battered fish', 'Mains')).toBe('food');
  });

  it('defaults unknown items to food (imported menus are mostly food)', () => {
    expect(inferKind('Something', null)).toBe('food');
  });
});
