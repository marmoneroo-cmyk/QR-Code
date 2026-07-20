'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useDrafts } from '@/lib/useDrafts';
import { CocktailExperience } from '@/components/CocktailExperience';
import { useLang } from '@/lib/useLang';
import type { CocktailConfig } from '@/data/cocktail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Non-ASCII slugs (e.g. Hebrew imports) arrive URL-encoded; stored decoded. */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function DraftPage({ params }: PageProps) {
  const { slug: rawSlug } = use(params);
  const slug = decodeSlug(rawSlug);
  const { findBySlug, hydrated } = useDrafts();
  const { lang } = useLang();
  // Every other guest surface is bilingual; this screen was English-only, so a Hebrew
  // owner following a stale draft link hit an English dead end.
  const isHebrew = lang === 'he';
  const t = (en: string, he: string) => (isHebrew ? he : en);
  const [config, setConfig] = useState<CocktailConfig | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const draft = findBySlug(slug);
    setConfig(draft ?? null);
  }, [slug, hydrated, findBySlug]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/70 text-sm">
        {t('Loading draft…', 'טוען טיוטה…')}
      </div>
    );
  }

  if (!config) {
    return (
      <div
        className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-8 text-center"
        dir={isHebrew ? 'rtl' : 'ltr'}
      >
        <p
          className="text-amber-200/70 text-10 tracking-[0.4em] uppercase mb-4 font-sans"
        >
          {t('Draft not found', 'הטיוטה לא נמצאה')}
        </p>
        <h1
          className="text-3xl text-white mb-6 font-serif"
          style={{
            fontStyle: isHebrew ? 'normal' : 'italic',
          }}
        >
          {t(`We couldn't find a draft for “${slug}”`, `לא מצאנו טיוטה עבור ״${slug}״`)}
        </h1>
        <p
          className="text-white/50 mb-8 max-w-md"
          style={{
            fontFamily: isHebrew ? 'var(--font-rubik, sans-serif)' : 'var(--font-garamond, serif)',
            fontStyle: isHebrew ? 'normal' : 'italic',
          }}
        >
          {t(
            'Drafts live only in your browser. If this link came from someone else, ask them to publish the draft to the main menu.',
            'טיוטות נשמרות בדפדפן שלכם בלבד. אם הקישור הגיע ממישהו אחר, בקשו ממנו לפרסם את הטיוטה לתפריט הראשי.',
          )}
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-11 tracking-[0.3em] uppercase font-sans"
          >
            {t('Back to menu', 'חזרה לתפריט')}
          </Link>
          <Link
            href="/admin"
            className="text-amber-200/70 hover:text-amber-200 transition-colors text-11 tracking-[0.3em] uppercase font-sans"
          >
            {t('Open admin', 'פתיחת הניהול')}
          </Link>
        </div>
      </div>
    );
  }

  return <CocktailExperience config={config} />;
}
