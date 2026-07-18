'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';
const sans = 'var(--font-inter, sans-serif)';

/**
 * Full-page, on-brand fallback for the App Router error boundaries + 404. Kept
 * self-contained (reads language from `<html lang>`, no context needed) so it renders
 * even when the surrounding tree has failed. Never a white screen — the premium-SaaS bar.
 */
export function ErrorScreen({
  kind = 'error',
  reset,
  digest,
}: {
  kind?: 'error' | 'notFound';
  reset?: () => void;
  digest?: string;
}) {
  const isHe = typeof document !== 'undefined' && document.documentElement.lang === 'he';
  const copy =
    kind === 'notFound'
      ? {
          title: isHe ? 'הדף לא נמצא' : 'Page not found',
          message: isHe
            ? 'הקישור אולי השתנה או שהדף כבר לא קיים.'
            : 'The link may have changed, or the page no longer exists.',
        }
      : {
          title: isHe ? 'משהו השתבש' : 'Something went wrong',
          message: isHe
            ? 'נתקלנו בתקלה בלתי־צפויה. אפשר לנסות שוב — הנתונים שלכם בטוחים.'
            : 'We hit an unexpected error. You can try again — your data is safe.',
        };

  return (
    <div
      dir={isHe ? 'rtl' : 'ltr'}
      className="grid min-h-screen place-items-center bg-[#030304] px-6 text-center"
    >
      <div className="flex max-w-md flex-col items-center gap-5">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-amber-200/20 text-amber-200/70">
          <AlertTriangle size={22} strokeWidth={1.5} />
        </span>
        <h1 className="text-26 text-amber-50" style={{ fontFamily: isHe ? serifHe : serif }}>
          {copy.title}
        </h1>
        <p className="max-w-[34ch] text-13 leading-relaxed text-white/50" style={{ fontFamily: sans }}>
          {copy.message}
        </p>
        <div className="mt-1 flex items-center gap-3">
          {reset && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-6 py-3 text-13 font-semibold text-black transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
              style={{ fontFamily: sans }}
            >
              <RotateCw size={14} strokeWidth={2} /> {isHe ? 'נסו שוב' : 'Try again'}
            </button>
          )}
          <Link
            href="/"
            className="rounded-full border border-white/15 px-6 py-3 text-13 text-white/70 transition-colors hover:border-white/30 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{ fontFamily: sans }}
          >
            {isHe ? 'חזרה לתפריט' : 'Back to menu'}
          </Link>
        </div>
        {digest && (
          <p className="mt-2 font-mono text-10 text-white/25" style={{ fontFamily: sans }}>
            ref: {digest}
          </p>
        )}
      </div>
    </div>
  );
}
