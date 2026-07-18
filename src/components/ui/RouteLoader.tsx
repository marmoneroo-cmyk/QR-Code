/**
 * Minimal, language-neutral route-transition loader (used by App Router `loading.tsx`
 * boundaries). Replaces the blank-white flash on navigation with an on-brand champagne
 * ring on the dark ground. Server-safe (no hooks/client deps); the spin only runs when
 * motion is allowed (`motion-safe:`), so reduced-motion users see a calm static ring.
 */
export function RouteLoader() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black">
      <span
        role="status"
        aria-label="Loading"
        className="h-9 w-9 rounded-full border-2 border-amber-200/15 border-t-amber-200/75 motion-safe:animate-spin"
      />
    </div>
  );
}
