/**
 * LocalStorageAdapter — stores drafts in the browser's localStorage.
 *
 * Default adapter when Supabase is not configured. Synchronous under the hood
 * but Promise-wrapped to match the async interface. The optional OpContext is
 * accepted for interface symmetry (the boundary injects it) and currently
 * unused here.
 *
 * Contract: saveDraft/deleteDraft THROW on write failure (quota / private
 * mode) so the caller can mark the draft `sync_failed` instead of believing
 * the write succeeded.
 */

import type { CocktailConfig } from '@/data/cocktail';
import type { CocktailStore, StoredDraft } from './interface';
import { logger, serializeError } from '@/lib/logger';

const STORAGE_KEY = 'cocktail-demo:drafts';
const log = logger.child({ scope: 'localStorage-adapter' });

function load(): StoredDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize legacy records (draftCreatedAt/draftUpdatedAt) → new shape,
    // so drafts saved before the store refactor are not silently lost.
    return parsed.map(migrate).filter(isDraft);
  } catch {
    return [];
  }
}

/** Upgrade a possibly-legacy draft record to the current StoredDraft shape. */
function migrate(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const d = v as Record<string, unknown>;
  if (typeof d.createdAt === 'number') return v; // already current
  if (typeof d.draftCreatedAt === 'number') {
    const { draftCreatedAt, draftUpdatedAt, ...rest } = d;
    return {
      ...rest,
      createdAt: draftCreatedAt,
      updatedAt: typeof draftUpdatedAt === 'number' ? draftUpdatedAt : draftCreatedAt,
    };
  }
  return v;
}

/** Write to localStorage; throws on failure so callers can react. */
function save(drafts: StoredDraft[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    log.error('localStorage write failed (quota or private mode?)', {
      count: drafts.length,
      error: serializeError(err).message,
    });
    throw err instanceof Error ? err : new Error('localStorage write failed');
  }
}

function isDraft(v: unknown): v is StoredDraft {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.slug === 'string' && typeof d.createdAt === 'number';
}

export class LocalStorageAdapter implements CocktailStore {
  async getDrafts(): Promise<StoredDraft[]> {
    return load();
  }

  async saveDraft(cocktail: CocktailConfig): Promise<StoredDraft> {
    const now = Date.now();
    const drafts = load();
    const existing = drafts.find((d) => d.slug === cocktail.slug);
    const draft: StoredDraft = {
      ...cocktail,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing
      ? drafts.map((d) => (d.slug === cocktail.slug ? draft : d))
      : [...drafts, draft];
    save(next); // throws on failure
    return draft;
  }

  async deleteDraft(slug: string): Promise<void> {
    save(load().filter((d) => d.slug !== slug));
  }

  async publishDraft(_slug: string): Promise<void> {
    // localStorage has no published state — no-op.
    // With Supabase this moves the row to status='published'.
  }

  async findDraft(slug: string): Promise<StoredDraft | null> {
    return load().find((d) => d.slug === slug) ?? null;
  }
}
