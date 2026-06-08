'use client';

/**
 * useDrafts — React hook for draft cocktail management.
 *
 * Delegates persistence to the store adapter (localStorage today, Supabase
 * when configured). Public API is backward compatible; adds:
 *   - optimistic updates (the draft appears instantly, before the write lands)
 *   - per-draft sync status (saved / saving / dirty / sync_failed / retrying)
 *     so the UI can show state instead of silently diverging.
 */

import { useCallback, useEffect, useState } from 'react';
import { CITRUS_LIME_SOUR, type CocktailConfig } from '@/data/cocktail';
import { getStore } from '@/lib/store';
import type { StoredDraft } from '@/lib/store';

// ─── Public types (backward-compatible) ───────────────────────────────────────

export interface DraftCocktail extends CocktailConfig {
  draftCreatedAt: number;
  draftUpdatedAt: number;
}

/** Lifecycle of a draft's persistence relative to the backend. */
export type SyncStatus = 'saved' | 'saving' | 'dirty' | 'sync_failed' | 'retrying';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toDraftCocktail(s: StoredDraft): DraftCocktail {
  return { ...s, draftCreatedAt: s.createdAt, draftUpdatedAt: s.updatedAt };
}

function toStoredDraft(d: DraftCocktail): StoredDraft {
  const { draftCreatedAt, draftUpdatedAt, ...rest } = d;
  return { ...rest, createdAt: draftCreatedAt, updatedAt: draftUpdatedAt };
}

/**
 * localStorage key/format mirrors the LocalStorageAdapter (store/local.ts):
 * a raw `StoredDraft[]` JSON array under `cocktail-demo:drafts`, where array
 * order IS the persisted order. Reordering only rewrites that array in a new
 * order — the schema is unchanged. We persist directly here (rather than
 * through the store) because reorder is a localStorage-only, order-only
 * concern with no Supabase column to back it.
 */
const DRAFTS_STORAGE_KEY = 'cocktail-demo:drafts';

/** Persist the given draft order to localStorage. SSR-safe (no-op on server). */
function persistOrder(drafts: readonly DraftCocktail[]): void {
  if (typeof window === 'undefined') return;
  try {
    const stored: StoredDraft[] = drafts.map(toStoredDraft);
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Quota / private mode: keep the in-memory order; reload will fall back to
    // the last successfully written order. Never throw from a UI reorder.
  }
}

/** Move an item within an array, returning a new array (immutable). */
function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return next;
  next.splice(toIndex, 0, moved);
  return next;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrafts() {
  const [drafts, setDrafts] = useState<DraftCocktail[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({});

  const setStatus = useCallback((slug: string, status: SyncStatus) => {
    setSyncStatus((prev) => ({ ...prev, [slug]: status }));
  }, []);

  // Load on mount; everything that loads is, by definition, already synced.
  useEffect(() => {
    let cancelled = false;
    getStore()
      .getDrafts()
      .then((stored) => {
        if (cancelled) return;
        const mapped = stored.map(toDraftCocktail);
        setDrafts(mapped);
        setSyncStatus(Object.fromEntries(mapped.map((d) => [d.slug, 'saved' as SyncStatus])));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Create or update a draft. Optimistic: the draft is reflected in state
   * immediately and marked 'saving'. On success → 'saved'; on failure the
   * optimistic copy is kept and marked 'sync_failed' (never lost), and the
   * call still resolves so the caller doesn't crash.
   */
  const upsert = useCallback(
    async (cocktail: CocktailConfig): Promise<DraftCocktail> => {
      const now = Date.now();
      // Always initialized (no timing dependency on React's updater); the
      // updater below refines createdAt from the freshest state.
      let optimistic: DraftCocktail = { ...cocktail, draftCreatedAt: now, draftUpdatedAt: now };
      setDrafts((prev) => {
        const existing = prev.find((d) => d.slug === cocktail.slug);
        optimistic = {
          ...cocktail,
          draftCreatedAt: existing?.draftCreatedAt ?? now,
          draftUpdatedAt: now,
        };
        return existing
          ? prev.map((d) => (d.slug === cocktail.slug ? optimistic : d))
          : [...prev, optimistic];
      });
      setStatus(cocktail.slug, 'saving');

      try {
        const stored = await getStore().saveDraft(cocktail);
        const draft = toDraftCocktail(stored);
        setDrafts((prev) => prev.map((d) => (d.slug === cocktail.slug ? draft : d)));
        setStatus(cocktail.slug, 'saved');
        return draft;
      } catch {
        // The instrument boundary already logged draft.save.failed.
        // Keep the optimistic copy; surface the failure as state.
        setStatus(cocktail.slug, 'sync_failed');
        return optimistic;
      }
    },
    [setStatus]
  );

  /** Delete a draft by slug. */
  const remove = useCallback(async (slug: string): Promise<void> => {
    try {
      await getStore().deleteDraft(slug);
      setDrafts((prev) => prev.filter((d) => d.slug !== slug));
      setSyncStatus((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    } catch {
      setStatus(slug, 'sync_failed');
    }
  }, [setStatus]);

  /**
   * Reorder a draft within the list by moving the item at `fromIndex` to
   * `toIndex`, then persist the new order to the same localStorage key/format
   * the hook already uses (order survives reload). No-op when indices are
   * equal or out of range. Sync status is unaffected — order is metadata that
   * lives only in the array sequence.
   */
  const reorderDrafts = useCallback((fromIndex: number, toIndex: number) => {
    setDrafts((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = moveItem(prev, fromIndex, toIndex);
      persistOrder(next);
      return next;
    });
  }, []);

  /** Mark a draft as having unsaved local edits (form-level). */
  const markDirty = useCallback((slug: string) => setStatus(slug, 'dirty'), [setStatus]);

  /** Find one draft by slug (in-memory, fast). */
  const findBySlug = useCallback(
    (slug: string): DraftCocktail | undefined => drafts.find((d) => d.slug === slug),
    [drafts]
  );

  const syncStatusFor = useCallback(
    (slug: string): SyncStatus => syncStatus[slug] ?? 'saved',
    [syncStatus]
  );

  return { drafts, hydrated, upsert, remove, reorderDrafts, findBySlug, syncStatus, syncStatusFor, markDirty };
}

// ─── Template ─────────────────────────────────────────────────────────────────

export function blankCocktailTemplate(slug: string): CocktailConfig {
  return {
    ...CITRUS_LIME_SOUR,
    slug,
    title: { en: '', he: '' },
    subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
    tagline: { en: '', he: '' },
    heroImage: '',
    bartenderNote: { en: '', he: '' },
    bartenderName: '',
    flavor: { sweet: 2, bitter: 2, citrus: 2, smoky: 2, herbal: 2 },
    category: 'citrus',
    dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  };
}
