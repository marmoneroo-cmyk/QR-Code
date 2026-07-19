import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CocktailConfig } from '@/data/cocktail';

// SupabaseAdapter reads its client from `createClient()` (see `private get client`).
// Replace that module with a hand-built, per-(table, operation) chainable mock so we can
// drive saveDraft's ordered write sequence (restaurant lookup → cocktail upsert →
// delete layers/labels → insert layers/labels → read-back) with fixtures we control —
// no network, no Supabase. Mirrors the builder style in ../analytics/queries.test.ts.
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/client';
import { SupabaseAdapter } from './supabase';

// --- Minimal chainable Supabase mock ---------------------------------------
// A builder whose chain methods return `this` and that is awaitable (thenable). The first
// mutating/reading method called on a chain fixes the "operation" (upsert wins over the
// trailing .select('id') in the cocktails-upsert chain). The terminal value is resolved
// from fixtures keyed `${table}:${operation}` — so the same table can carry distinct
// results for its upsert vs its read-back select, or its delete vs its insert.

interface TerminalResult {
  data?: unknown;
  error?: unknown;
}

type Op = 'select' | 'upsert' | 'insert' | 'delete' | 'update';

/** Fixtures keyed by `${table}:${operation}`, e.g. 'cocktail_layers:insert'. */
type Fixtures = Record<string, TerminalResult>;

function makeClient(fixtures: Fixtures) {
  const from = (table: string) => {
    const state: { op: Op | null } = { op: null };
    // First-write-wins: `.upsert().select()` stays 'upsert'; `.select().eq()` stays 'select'.
    const setOp = (op: Op) => {
      if (!state.op) state.op = op;
    };
    const run = (): Promise<TerminalResult> =>
      Promise.resolve(fixtures[`${table}:${state.op}`] ?? { data: null, error: null });

    const builder = {
      select(_columns?: string) {
        setOp('select');
        return builder;
      },
      upsert(_values?: unknown, _opts?: unknown) {
        setOp('upsert');
        return builder;
      },
      insert(_values?: unknown) {
        setOp('insert');
        return builder;
      },
      delete() {
        setOp('delete');
        return builder;
      },
      update(_values?: unknown) {
        setOp('update');
        return builder;
      },
      eq() {
        return builder;
      },
      order() {
        return builder;
      },
      single() {
        return run();
      },
      maybeSingle() {
        return run();
      },
      then<A, B = never>(
        onfulfilled?: ((value: TerminalResult) => A | PromiseLike<A>) | null,
        onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
      ) {
        return run().then(onfulfilled, onrejected);
      },
    };
    return builder;
  };
  return { from };
}

function mockClient(fixtures: Fixtures): void {
  vi.mocked(createClient).mockReturnValue(
    makeClient(fixtures) as unknown as ReturnType<typeof createClient>,
  );
}

// --- A minimal, valid CocktailConfig fixture (≥1 layer, ≥1 label) -----------

function makeCocktail(overrides: Partial<CocktailConfig> = {}): CocktailConfig {
  return {
    slug: 'test-sour',
    title: { en: 'Test Sour', he: 'טסט סאוור' },
    subtitle: { en: 'Components', he: 'מרכיבים' },
    category: 'citrus',
    heroImage: '/cocktail/test-sour-hero.png',
    flavor: { sweet: 2, bitter: 1, citrus: 5, smoky: 0, herbal: 2 },
    bartenderNote: { en: 'Bright and easy.', he: 'בהיר וקליל.' },
    dietary: { vegan: true, glutenFree: true, alcoholFree: false },
    priceILS: 58,
    layers: [
      {
        id: 'glass',
        image: '/cocktail/test-sour-glass.png',
        y: -1.4,
        z: 0,
        scale: 0.5,
        floatAmp: 0.015,
        floatSpeed: 0.4,
        parallaxFactor: 0.2,
        generationPrompt: 'a clean empty glass',
      },
    ],
    labels: [
      {
        id: 'gin',
        number: '01',
        name: { en: 'Gin', he: 'ג׳ין' },
        description: { en: 'Juniper-led London Dry.', he: 'לונדון דריי.' },
        layerId: 'glass',
      },
    ],
    ...overrides,
  };
}

/** A fully-populated cocktails read-back row that rowToDraft can reconstruct. */
function makeReadbackRow(slug: string) {
  return {
    slug,
    title_en: 'Test Sour',
    title_he: 'טסט סאוור',
    subtitle_en: 'Components',
    subtitle_he: 'מרכיבים',
    tagline_en: null,
    tagline_he: null,
    category: 'citrus',
    hero_image: '/cocktail/test-sour-hero.png',
    hero_prompt: null,
    flavor: { sweet: 2, bitter: 1, citrus: 5, smoky: 0, herbal: 2 },
    bartender_note_en: 'Bright and easy.',
    bartender_note_he: 'בהיר וקליל.',
    bartender_name: null,
    dietary: { vegan: true, glutenFree: true, alcoholFree: false },
    pairings: null,
    price_ils: 58,
    available_hours: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    cocktail_layers: [
      {
        layer_id: 'glass',
        image: '/cocktail/test-sour-glass.png',
        y: -1.4,
        z: 0,
        scale: 0.5,
        float_amp: 0.015,
        float_speed: 0.4,
        parallax_factor: 0.2,
        generation_prompt: 'a clean empty glass',
        position: 0,
      },
    ],
    cocktail_labels: [
      {
        label_id: 'gin',
        number: '01',
        name_en: 'Gin',
        name_he: 'ג׳ין',
        description_en: 'Juniper-led London Dry.',
        description_he: 'לונדון דריי.',
        origin_en: null,
        origin_he: null,
        layer_id: 'glass',
        position: 0,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe('SupabaseAdapter.saveDraft', () => {
  it('throws when a child layers INSERT fails (atomicity — no silent data loss)', async () => {
    // Arrange: restaurant + parent upsert + both deletes succeed, but replacing the
    // layer rows fails on INSERT. The old layers are already deleted, so swallowing this
    // would silently lose data — the fix REQUIRES it surface as a rejection.
    mockClient({
      'restaurants:select': { data: { id: 'r1' }, error: null },
      'cocktails:upsert': { data: { id: 'c1' }, error: null },
      'cocktail_layers:delete': { error: null },
      'cocktail_labels:delete': { error: null },
      'cocktail_layers:insert': { error: { message: 'insert failed' } },
    });
    const adapter = new SupabaseAdapter();

    // Act + Assert
    await expect(adapter.saveDraft(makeCocktail())).rejects.toMatchObject({
      message: 'insert failed',
    });
  });

  it('throws when a child labels INSERT fails (atomicity — no silent data loss)', async () => {
    // Arrange: layers insert succeeds but the labels insert fails.
    mockClient({
      'restaurants:select': { data: { id: 'r1' }, error: null },
      'cocktails:upsert': { data: { id: 'c1' }, error: null },
      'cocktail_layers:delete': { error: null },
      'cocktail_labels:delete': { error: null },
      'cocktail_layers:insert': { error: null },
      'cocktail_labels:insert': { error: { message: 'labels insert failed' } },
    });
    const adapter = new SupabaseAdapter();

    // Act + Assert
    await expect(adapter.saveDraft(makeCocktail())).rejects.toMatchObject({
      message: 'labels insert failed',
    });
  });

  it('throws when the layers DELETE fails', async () => {
    // Arrange: restaurant + parent upsert succeed, but clearing the old layer rows errors.
    mockClient({
      'restaurants:select': { data: { id: 'r1' }, error: null },
      'cocktails:upsert': { data: { id: 'c1' }, error: null },
      'cocktail_layers:delete': { error: { message: 'delete failed' } },
    });
    const adapter = new SupabaseAdapter();

    // Act + Assert
    await expect(adapter.saveDraft(makeCocktail())).rejects.toMatchObject({
      message: 'delete failed',
    });
  });

  it('throws when the restaurant slug cannot be resolved', async () => {
    // Arrange: the restaurants lookup returns no row.
    mockClient({
      'restaurants:select': { data: null, error: { message: 'no row' } },
    });
    const adapter = new SupabaseAdapter();

    // Act + Assert
    await expect(adapter.saveDraft(makeCocktail())).rejects.toThrow(
      /restaurant 'diner' not found/,
    );
  });

  it('resolves to the reconstructed draft when every write and the read-back succeed', async () => {
    // Arrange: full happy path. getRestaurantId caches the id after the first lookup, so
    // findDraft's read reuses it and only hits cocktails:select (not restaurants) again.
    mockClient({
      'restaurants:select': { data: { id: 'r1' }, error: null },
      'cocktails:upsert': { data: { id: 'c1' }, error: null },
      'cocktail_layers:delete': { error: null },
      'cocktail_labels:delete': { error: null },
      'cocktail_layers:insert': { error: null },
      'cocktail_labels:insert': { error: null },
      'cocktails:select': { data: makeReadbackRow('test-sour'), error: null },
    });
    const adapter = new SupabaseAdapter();

    // Act
    const draft = await adapter.saveDraft(makeCocktail());

    // Assert
    expect(draft.slug).toBe('test-sour');
    expect(draft.title.en).toBe('Test Sour');
    expect(draft.layers).toHaveLength(1);
    expect(draft.labels).toHaveLength(1);
    expect(draft.labels[0]?.name.en).toBe('Gin');
    expect(draft.createdAt).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
  });
});
