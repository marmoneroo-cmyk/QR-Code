import { NextResponse, type NextRequest } from 'next/server';
import { listExperience, upsertExperience } from '@/lib/experience/repository';
import { logChange } from '@/lib/changes/repository';
import type {
  ExperienceConfig,
  ExperienceModule,
  BadgeConfig,
  BadgeKind,
  BadgeLabel,
  ScheduledToggle,
} from '@/lib/experience/types';
import { requireSession, unauthorized, apiError } from '@/lib/auth/guard';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Public reads are cached at the CDN edge; writes stay uncached (session-scoped).
const PUBLIC_GET_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const;

// Keep in sync with the ExperienceModule / BadgeKind unions in '@/lib/experience/types'.
const EXPERIENCE_MODULES: ExperienceModule[] = [
  'hero_video',
  'ingredient_breakdown',
  'story',
  'taste_profile',
  'perfect_pairings',
  'related_items',
  'mood_tags',
];

const BADGE_KINDS: BadgeKind[] = [
  'signature',
  'guest_favorite',
  'trending',
  'happy_hour',
  'discount',
  'seasonal',
  'limited_time',
  'new_item',
  'custom',
];

function isBadgeLabel(value: unknown): value is BadgeLabel {
  if (typeof value !== 'object' || value === null) return false;
  const label = value as Record<string, unknown>;
  return typeof label.en === 'string' && typeof label.he === 'string';
}

function isScheduledToggle(value: unknown): value is ScheduledToggle {
  if (typeof value !== 'object' || value === null) return false;
  const toggle = value as Record<string, unknown>;
  if (typeof toggle.enabled !== 'boolean') return false;
  if (toggle.schedule !== undefined && (typeof toggle.schedule !== 'object' || toggle.schedule === null)) return false;
  return true;
}

function isBadgeConfig(value: unknown): value is BadgeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const badge = value as Record<string, unknown>;
  if (!BADGE_KINDS.includes(badge.kind as BadgeKind)) return false;
  if (badge.mode !== 'manual' && badge.mode !== 'auto') return false;
  if (typeof badge.enabled !== 'boolean') return false;
  if (badge.schedule !== undefined && (typeof badge.schedule !== 'object' || badge.schedule === null)) return false;
  if (badge.label !== undefined && !isBadgeLabel(badge.label)) return false;
  return true;
}

/**
 * Whitelist-validate the persisted+publicly-re-served experience config: every
 * top-level key must be a known ExperienceConfig field with the expected shape.
 * Unknown keys or malformed entries are rejected rather than silently dropped,
 * since this payload is served as-is to anonymous diners via GET.
 */
function isValidExperienceConfig(value: unknown): value is ExperienceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (key !== 'modules' && key !== 'badges') return false;
  }
  if (config.modules !== undefined) {
    if (typeof config.modules !== 'object' || config.modules === null || Array.isArray(config.modules)) return false;
    for (const [moduleKey, moduleValue] of Object.entries(config.modules as Record<string, unknown>)) {
      if (!EXPERIENCE_MODULES.includes(moduleKey as ExperienceModule)) return false;
      if (!isScheduledToggle(moduleValue)) return false;
    }
  }
  if (config.badges !== undefined) {
    if (!Array.isArray(config.badges)) return false;
    if (!config.badges.every(isBadgeConfig)) return false;
  }
  return true;
}

// PUBLIC read: the diner menu (useMenuConfig) fetches its restaurant's experience config.
// `menu_experience` is public-read by RLS (it drives anonymous rendering), so the
// ?restaurant= param exposes only public data. The PUT handler is the boundary.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const restaurant = req.nextUrl.searchParams.get('restaurant') ?? 'diner';
    const data = await listExperience(restaurant);
    return NextResponse.json({ success: true, data }, { headers: PUBLIC_GET_HEADERS });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const db = await createServerSupabase();
    const body = (await req.json()) as { slug?: string; config?: ExperienceConfig };
    if (typeof body.slug !== 'string' || !body.slug) return err('slug is required');
    if (typeof body.config !== 'object' || body.config === null) return err('config is required');
    if (!isValidExperienceConfig(body.config)) return err('invalid config', 400);
    await upsertExperience(session.restaurantSlug, body.slug, body.config, db);
    await logChange(
      session.restaurantSlug,
      {
        changeType: 'experience_updated',
        entityType: 'cocktail',
        entityId: body.slug,
        after: body.config,
        summary: `Experience updated: ${body.slug}`,
      },
      db,
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return unauthorized(error);
  }
}
