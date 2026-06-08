/**
 * Store factory — picks the adapter at runtime and wraps it with
 * observability: correlation IDs, a stable event taxonomy, fault injection,
 * timing, and payload size.
 *
 *   NEXT_PUBLIC_SUPABASE_URL set → SupabaseAdapter, else LocalStorageAdapter
 *
 * The rest of the app imports only from here.
 */

import type { CocktailConfig } from '@/data/cocktail';
import type { CocktailStore, StoredDraft } from './interface';
import { LocalStorageAdapter } from './local';
import { SupabaseAdapter } from './supabase';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { logger, serializeError } from '@/lib/logger';
import { StoreEvents, newRequestId, type OpContext } from '@/lib/observability/events';
import { maybeInjectFault } from '@/lib/observability/faults';

/** Tenant marker for log correlation only; the adapter resolves the real UUID by slug. */
const TENANT_SLUG = 'diner';

function roughSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return -1;
  }
}

interface EventTrio {
  started: string;
  succeeded: string;
  failed: string;
}

/** Wrap a store so every method emits taxonomy events with a correlation id. */
function instrument(store: CocktailStore, provider: string): CocktailStore {
  const log = logger.child({ scope: 'store', provider });

  /**
   * Run one operation: inject fault → emit started → call inner (with ctx) →
   * emit succeeded/failed. The same requestId is threaded into the adapter so
   * its internal logs (retries) correlate with these boundary events.
   */
  async function run<T>(
    events: EventTrio,
    op: string,
    extra: Record<string, unknown>,
    call: (ctx: OpContext) => Promise<T>
  ): Promise<T> {
    const ctx: OpContext = {
      requestId: newRequestId(),
      op,
      provider,
      restaurantId: TENANT_SLUG,
      slug: typeof extra.slug === 'string' ? extra.slug : undefined,
    };
    const base = { event: events.started, requestId: ctx.requestId, ...extra };
    const start = performance.now();
    log.info(events.started, base);
    try {
      await maybeInjectFault(op);
      const result = await call(ctx);
      log.info(events.succeeded, {
        ...base,
        event: events.succeeded,
        ms: Math.round(performance.now() - start),
      });
      return result;
    } catch (err) {
      log.error(events.failed, {
        ...base,
        event: events.failed,
        ms: Math.round(performance.now() - start),
        error: serializeError(err).message,
      });
      throw err;
    }
  }

  return {
    getDrafts: () => run(StoreEvents.load, 'draft.load', {}, (ctx) => store.getDrafts(ctx)),
    saveDraft: (c: CocktailConfig) =>
      run(StoreEvents.save, 'draft.save', { slug: c.slug, bytes: roughSize(c) }, (ctx) =>
        store.saveDraft(c, ctx)
      ),
    deleteDraft: (slug: string) =>
      run(StoreEvents.remove, 'draft.delete', { slug }, (ctx) => store.deleteDraft(slug, ctx)),
    publishDraft: (slug: string) =>
      run(StoreEvents.publish, 'draft.publish', { slug }, (ctx) => store.publishDraft(slug, ctx)),
    findDraft: (slug: string) =>
      run(StoreEvents.find, 'draft.find', { slug }, (ctx) => store.findDraft(slug, ctx)),
  };
}

let _store: CocktailStore | null = null;

export function getStore(): CocktailStore {
  if (!_store) {
    // Drafts/CMS persist to localStorage by default. The live diner menu is
    // static (src/data/cocktail.ts), and Supabase draft writes/reads are
    // auth-gated by RLS (there is no diner-side login) — so the working,
    // no-auth CMS path is localStorage. Opt into the Supabase backend
    // explicitly once member auth exists: NEXT_PUBLIC_USE_SUPABASE_DRAFTS=true.
    const useSupabase = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE_DRAFTS === 'true';
    const provider = useSupabase ? 'supabase' : 'localStorage';
    const base = useSupabase ? new SupabaseAdapter() : new LocalStorageAdapter();
    logger.child({ scope: 'store' }).info(StoreEvents.init, { event: StoreEvents.init, provider });
    _store = instrument(base, provider);
  }
  return _store;
}

export type { CocktailStore, StoredDraft } from './interface';
