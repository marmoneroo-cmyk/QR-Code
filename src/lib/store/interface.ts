/**
 * CocktailStore — the abstract contract for all persistence adapters.
 *
 * The UI never imports localStorage or Supabase directly — it only calls
 * these methods. Swapping the backend is a single change in store/index.ts.
 *
 * Each method accepts an optional OpContext (correlation id + metadata).
 * The UI never passes it; the instrument() decorator in store/index.ts
 * injects it so adapter-internal logs (e.g. retries) correlate with the
 * boundary's started/succeeded/failed events.
 *
 * Contract note: saveDraft/deleteDraft/publishDraft THROW on unrecoverable
 * failure (after any retries). Callers decide how to surface it — useDrafts
 * keeps the optimistic local copy and marks the draft `sync_failed`.
 */

import type { CocktailConfig } from '@/data/cocktail';
import type { OpContext } from '@/lib/observability/events';

export interface DraftMeta {
  createdAt: number;
  updatedAt: number;
}

export interface StoredDraft extends CocktailConfig, DraftMeta {}

export interface CocktailStore {
  getDrafts(ctx?: OpContext): Promise<StoredDraft[]>;
  saveDraft(cocktail: CocktailConfig, ctx?: OpContext): Promise<StoredDraft>;
  deleteDraft(slug: string, ctx?: OpContext): Promise<void>;
  publishDraft(slug: string, ctx?: OpContext): Promise<void>;
  findDraft(slug: string, ctx?: OpContext): Promise<StoredDraft | null>;
}
