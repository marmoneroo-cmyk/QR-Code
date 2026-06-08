/**
 * SupabaseAdapter — persists drafts across the normalized schema:
 *   cocktails (1) ──< cocktail_layers (N)
 *               └────< cocktail_labels (N)
 *
 * Active only when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are set. The store/index.ts factory chooses the adapter at runtime, so the
 * UI never knows which backend is live.
 *
 * Schema source of truth: supabase/migrations/0001_initial_schema.sql + 0003.
 */

import type {
  CocktailConfig,
  DietaryFlags,
  FlavorProfile,
  IngredientLabel,
  LayerConfig,
  Localized,
} from '@/data/cocktail';
import type { CocktailStore, StoredDraft } from './interface';
import { createClient } from '@/lib/supabase/client';
import type { Database, Json } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';
import { StoreEvents, type OpContext } from '@/lib/observability/events';

/** Seed restaurant ID inserted by the migration's seed block. */
/** Stable slug of the seed restaurant. The UUID is per-database, so we
 *  resolve it from this slug at runtime rather than hardcoding it. */
const DINER_SLUG = 'diner';

const log = logger.child({ scope: 'supabase-adapter' });

/**
 * A PostgREST error carries a `code` (constraint/RLS/logical). Transport
 * failures (network, 5xx) don't — those are the only ones worth retrying.
 */
function isTransient(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code) {
    return false; // logical / constraint / RLS error — do not retry
  }
  return true; // network / unknown — retry
}

type CocktailRow = Database['public']['Tables']['cocktails']['Row'];
type LayerRow = Database['public']['Tables']['cocktail_layers']['Row'];
type LabelRow = Database['public']['Tables']['cocktail_labels']['Row'];
type CocktailInsert = Database['public']['Tables']['cocktails']['Insert'];

/** A cocktail row with its child rows attached (shape of a nested select). */
type RowWithChildren = CocktailRow & {
  cocktail_layers: LayerRow[] | null;
  cocktail_labels: LabelRow[] | null;
};

const NESTED_SELECT = '*, cocktail_layers(*), cocktail_labels(*)';

// ─── Mappers: DB rows → app types ─────────────────────────────────────────────

function loc(en: string | null, he: string | null): Localized {
  return { en: en ?? '', he: he ?? en ?? '' };
}

function optLoc(en: string | null, he: string | null): Localized | undefined {
  if (!en && !he) return undefined;
  return { en: en ?? '', he: he ?? en ?? '' };
}

function layerRowToConfig(r: LayerRow): LayerConfig {
  return {
    id: r.layer_id,
    image: r.image,
    y: r.y,
    z: r.z,
    scale: r.scale,
    floatAmp: r.float_amp,
    floatSpeed: r.float_speed,
    parallaxFactor: r.parallax_factor,
    generationPrompt: r.generation_prompt ?? '',
  };
}

function labelRowToConfig(r: LabelRow): IngredientLabel {
  return {
    id: r.label_id,
    number: r.number,
    name: loc(r.name_en, r.name_he),
    description: loc(r.description_en, r.description_he),
    origin: optLoc(r.origin_en, r.origin_he),
    layerId: r.layer_id,
  };
}

function rowToDraft(row: RowWithChildren): StoredDraft {
  const layers = (row.cocktail_layers ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(layerRowToConfig);

  const labels = (row.cocktail_labels ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(labelRowToConfig);

  const config: CocktailConfig = {
    slug: row.slug,
    title: loc(row.title_en, row.title_he),
    subtitle: loc(row.subtitle_en, row.subtitle_he),
    tagline: optLoc(row.tagline_en, row.tagline_he),
    category: row.category,
    heroImage: row.hero_image,
    heroPrompt: row.hero_prompt ?? undefined,
    flavor: (row.flavor as unknown as FlavorProfile) ?? {
      sweet: 2, bitter: 2, citrus: 2, smoky: 2, herbal: 2,
    },
    bartenderNote: loc(row.bartender_note_en, row.bartender_note_he),
    bartenderName: row.bartender_name ?? undefined,
    dietary: (row.dietary as unknown as DietaryFlags) ?? {
      vegan: false, glutenFree: false, alcoholFree: false,
    },
    pairings: (row.pairings as unknown as Localized[] | null) ?? undefined,
    priceILS: row.price_ils ?? undefined,
    availableHours: (row.available_hours as unknown as [number, number] | null) ?? undefined,
    layers,
    labels,
  };

  return {
    ...config,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Mappers: app types → DB insert payloads ──────────────────────────────────

function configToCocktailInsert(c: CocktailConfig, restaurantId: string): CocktailInsert {
  const heVal = (l?: Localized) => (l?.he ? l.he : null);
  return {
    restaurant_id: restaurantId,
    slug: c.slug,
    status: 'draft',
    title_en: c.title.en,
    title_he: heVal(c.title),
    subtitle_en: c.subtitle.en,
    subtitle_he: c.subtitle.he,
    tagline_en: c.tagline?.en ?? null,
    tagline_he: c.tagline?.he ?? null,
    category: c.category,
    hero_image: c.heroImage,
    hero_prompt: c.heroPrompt ?? null,
    flavor: c.flavor as unknown as Json,
    bartender_note_en: c.bartenderNote.en || null,
    bartender_note_he: heVal(c.bartenderNote),
    bartender_name: c.bartenderName ?? null,
    dietary: c.dietary as unknown as Json,
    price_ils: c.priceILS ?? null,
    pairings: (c.pairings as unknown as Json) ?? null,
    available_hours: (c.availableHours as unknown as Json) ?? null,
  };
}

function layerInserts(cocktailId: string, layers: LayerConfig[]) {
  return layers.map((l, i) => ({
    cocktail_id: cocktailId,
    layer_id: l.id,
    image: l.image,
    y: l.y,
    z: l.z,
    scale: l.scale,
    float_amp: l.floatAmp,
    float_speed: l.floatSpeed,
    parallax_factor: l.parallaxFactor,
    generation_prompt: l.generationPrompt ?? null,
    position: i,
  }));
}

function labelInserts(cocktailId: string, labels: IngredientLabel[]) {
  const he = (l: Localized | undefined) => (l?.he ? l.he : null);
  return labels.map((lab, i) => ({
    cocktail_id: cocktailId,
    label_id: lab.id,
    number: lab.number,
    name_en: lab.name.en,
    name_he: he(lab.name),
    description_en: lab.description.en,
    description_he: he(lab.description),
    origin_en: lab.origin?.en ?? null,
    origin_he: lab.origin?.he ?? null,
    layer_id: lab.layerId,
    position: i,
  }));
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class SupabaseAdapter implements CocktailStore {
  private restaurantSlug: string;
  private resolvedId: string | null = null;

  constructor(restaurantSlug: string = DINER_SLUG) {
    this.restaurantSlug = restaurantSlug;
  }

  private get client() {
    return createClient();
  }

  /**
   * Resolve the restaurant UUID from its stable slug, cached after the first
   * lookup. The slug is stable across databases; the UUID is per-database
   * (the migration seed uses gen_random_uuid()).
   */
  private async getRestaurantId(): Promise<string> {
    if (this.resolvedId) return this.resolvedId;
    const { data, error } = await this.client
      .from('restaurants')
      .select('id')
      .eq('slug', this.restaurantSlug)
      .single();
    if (error || !data) {
      throw new Error(
        `restaurant '${this.restaurantSlug}' not found: ${error?.message ?? 'no row'}`
      );
    }
    this.resolvedId = (data as { id: string }).id;
    return this.resolvedId;
  }

  async getDrafts(_ctx?: OpContext): Promise<StoredDraft[]> {
    const restaurantId = await this.getRestaurantId();
    const { data, error } = await this.client
      .from('cocktails')
      .select(NESTED_SELECT)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error) {
      log.error('getDrafts query failed', { error: error.message });
      return [];
    }
    return ((data ?? []) as unknown as RowWithChildren[]).map(rowToDraft);
  }

  async saveDraft(cocktail: CocktailConfig, ctx?: OpContext): Promise<StoredDraft> {
    const restaurantId = await this.getRestaurantId();
    // 1. Upsert the parent cocktail row, returning its id. Retried on
    //    transient (network/5xx) failures; logical errors (RLS, constraint)
    //    throw immediately. On unrecoverable failure we THROW so the caller
    //    can mark the draft sync_failed (instead of silently divergent).
    const cocktailId = await withRetry(
      async () => {
        const { data, error } = await this.client
          .from('cocktails')
          .upsert(configToCocktailInsert(cocktail, restaurantId), { onConflict: 'restaurant_id,slug' })
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error('upsert returned no row');
        return (data as { id: string }).id;
      },
      {
        label: StoreEvents.save.retry,
        shouldRetry: isTransient,
        context: { requestId: ctx?.requestId, slug: cocktail.slug },
      }
    );

    // 2. Replace child rows (delete-then-insert keeps it simple & consistent).
    await this.client.from('cocktail_layers').delete().eq('cocktail_id', cocktailId);
    await this.client.from('cocktail_labels').delete().eq('cocktail_id', cocktailId);

    if (cocktail.layers.length) {
      const { error } = await this.client
        .from('cocktail_layers')
        .insert(layerInserts(cocktailId, cocktail.layers));
      if (error) log.error('saveDraft layers insert failed', { slug: cocktail.slug, error: error.message });
    }
    if (cocktail.labels.length) {
      const { error } = await this.client
        .from('cocktail_labels')
        .insert(labelInserts(cocktailId, cocktail.labels));
      if (error) log.error('saveDraft labels insert failed', { slug: cocktail.slug, error: error.message });
    }

    // 3. Read back the full reconstructed draft.
    const fresh = await this.findDraft(cocktail.slug);
    return fresh ?? this.transient(cocktail);
  }

  async deleteDraft(slug: string, _ctx?: OpContext): Promise<void> {
    const restaurantId = await this.getRestaurantId();
    // Resolve id so we can clear children even if FK cascade isn't set.
    const { data } = await this.client
      .from('cocktails')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('slug', slug)
      .maybeSingle();

    const id = (data as { id: string } | null)?.id;
    if (id) {
      await this.client.from('cocktail_layers').delete().eq('cocktail_id', id);
      await this.client.from('cocktail_labels').delete().eq('cocktail_id', id);
    }
    const { error } = await this.client
      .from('cocktails')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('slug', slug)
      .eq('status', 'draft');
    if (error) log.error('deleteDraft failed', { slug, error: error.message });
  }

  async publishDraft(slug: string, _ctx?: OpContext): Promise<void> {
    const restaurantId = await this.getRestaurantId();
    const { error } = await this.client
      .from('cocktails')
      .update({ status: 'published' })
      .eq('restaurant_id', restaurantId)
      .eq('slug', slug);
    if (error) log.error('publishDraft failed', { slug, error: error.message });
  }

  async findDraft(slug: string, _ctx?: OpContext): Promise<StoredDraft | null> {
    const restaurantId = await this.getRestaurantId();
    const { data, error } = await this.client
      .from('cocktails')
      .select(NESTED_SELECT)
      .eq('restaurant_id', restaurantId)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;
    return rowToDraft(data as unknown as RowWithChildren);
  }

  /** Fallback when a write fails — returns a transient draft so the UI survives. */
  private transient(cocktail: CocktailConfig): StoredDraft {
    const now = Date.now();
    return { ...cocktail, createdAt: now, updatedAt: now };
  }
}
