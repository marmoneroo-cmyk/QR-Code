import type { PromotionInput } from './repository';

export const DISCOUNT_TYPES = ['percentage', 'fixed'];
export const SCOPES = ['item', 'category', 'all'];
// Keep in sync with the BadgeKind union in '@/lib/experience/types'.
export const BADGE_KINDS = [
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

// Length/size caps — a promotion is persisted and re-served to anonymous diners,
// so bound these fields to guard against stored oversized payloads.
export const MAX_NAME_LEN = 120;
export const MAX_TARGET_SLUGS = 200;
export const MAX_SLUG_LEN = 120;

// Per-field checks shared by POST's validateInput (all required) and PATCH
// (only the fields actually present in the body are checked).
export function checkName(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return 'name is required';
  if (value.length > MAX_NAME_LEN) return `name must be at most ${MAX_NAME_LEN} characters`;
  return undefined;
}
export function checkType(value: unknown): string | undefined {
  if (!DISCOUNT_TYPES.includes(value as string)) return 'type must be percentage|fixed';
  return undefined;
}
export function checkValue(value: unknown): string | undefined {
  // Number.isFinite rejects NaN and ±Infinity — `NaN < 0` is false, so without this a
  // NaN discount (e.g. client `Number('')`) would slip through into the DB.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 'value must be a positive number';
  }
  return undefined;
}
export function checkScope(value: unknown): string | undefined {
  if (!SCOPES.includes(value as string)) return 'scope must be item|category|all';
  return undefined;
}
export function checkActive(value: unknown): string | undefined {
  if (typeof value !== 'boolean') return 'active must be a boolean';
  return undefined;
}
export function checkTargetSlugs(value: unknown): string | undefined {
  if (!Array.isArray(value) || !value.every((s) => typeof s === 'string')) {
    return 'targetSlugs must be an array of strings';
  }
  if (value.length > MAX_TARGET_SLUGS) return `targetSlugs must have at most ${MAX_TARGET_SLUGS} entries`;
  if ((value as string[]).some((s) => s.length > MAX_SLUG_LEN)) {
    return `each targetSlug must be at most ${MAX_SLUG_LEN} characters`;
  }
  return undefined;
}
export function checkBadgeKind(value: unknown): string | undefined {
  if (!BADGE_KINDS.includes(value as string)) return 'badgeKind is invalid';
  return undefined;
}

export function validateInput(body: Record<string, unknown>): PromotionInput | string {
  const nameErr = checkName(body.name);
  if (nameErr) return nameErr;
  const typeErr = checkType(body.type);
  if (typeErr) return typeErr;
  const valueErr = checkValue(body.value);
  if (valueErr) return valueErr;
  const scopeErr = checkScope(body.scope);
  if (scopeErr) return scopeErr;
  if (body.active !== undefined) {
    const activeErr = checkActive(body.active);
    if (activeErr) return activeErr;
  }
  if (body.targetSlugs !== undefined) {
    const targetSlugsErr = checkTargetSlugs(body.targetSlugs);
    if (targetSlugsErr) return targetSlugsErr;
  }
  if (body.badgeKind !== undefined) {
    const badgeKindErr = checkBadgeKind(body.badgeKind);
    if (badgeKindErr) return badgeKindErr;
  }
  return {
    name: (body.name as string).trim(),
    type: body.type as PromotionInput['type'],
    value: body.value as number,
    scope: body.scope as PromotionInput['scope'],
    targetSlugs: Array.isArray(body.targetSlugs) ? (body.targetSlugs as string[]) : undefined,
    targetCategories: Array.isArray(body.targetCategories) ? (body.targetCategories as string[]) : undefined,
    schedule: (body.schedule as PromotionInput['schedule']) ?? undefined,
    badgeKind: (body.badgeKind as PromotionInput['badgeKind']) ?? undefined,
    badgeLabel: (body.badgeLabel as PromotionInput['badgeLabel']) ?? undefined,
    active: typeof body.active === 'boolean' ? body.active : undefined,
  };
}
