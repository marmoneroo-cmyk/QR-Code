'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CocktailForm } from '@/components/admin/CocktailForm';
import { AdminShell } from '@/components/ui/AdminShell';
import { useDrafts } from '@/lib/useDrafts';
import { useLang } from '@/lib/useLang';
import { findCocktailBySlug, type CocktailConfig } from '@/data/cocktail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Non-ASCII slugs (e.g. Hebrew item names from import) arrive URL-encoded in the
 * route param but are stored decoded. Decode defensively — idempotent for plain
 * ASCII slugs, and a no-op fallback if the value is malformed.
 */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type EditSource = 'draft' | 'published';

interface Resolved {
  config: CocktailConfig;
  source: EditSource;
}

export default function EditDraftPage({ params }: PageProps) {
  const { slug: rawSlug } = use(params);
  const slug = decodeSlug(rawSlug);
  const router = useRouter();
  const { findBySlug, hydrated } = useDrafts();
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    // Prefer an existing draft; otherwise fall back to the published MENU
    // cocktail so a manager can edit a published item. Saving still upserts a
    // draft (CocktailForm uses the same slug), so the save flow is unchanged.
    const draft = findBySlug(slug);
    if (draft) {
      setResolved({ config: draft, source: 'draft' });
      return;
    }
    const published = findCocktailBySlug(slug);
    setResolved(published ? { config: published, source: 'published' } : null);
  }, [hydrated, slug, findBySlug]);

  if (!hydrated) {
    return (
      <div
        className="relative min-h-screen bg-black text-white flex items-center justify-center"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="relative z-10 flex items-center gap-3 text-white/45 text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
          <span className="h-2 w-2 rounded-full bg-amber-200/70 animate-pulse" />
          {isHe ? 'טוען טיוטה…' : 'Loading draft…'}
        </div>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div
        className="relative min-h-screen bg-black flex flex-col items-center justify-center text-white px-8 text-center"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="relative z-10 flex flex-col items-center">
          <p
            className="text-amber-200/70 text-[10px] tracking-[0.4em] uppercase mb-4"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            {isHe ? 'הקוקטייל לא נמצא' : 'Cocktail not found'}
          </p>
          <h1
            className="text-3xl text-white mb-4 leading-tight"
            style={{
              fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)',
              fontStyle: isHe ? 'normal' : 'italic',
            }}
          >
            {isHe ? 'לא הצלחנו למצוא קוקטייל עבור' : "We couldn't find a cocktail for"} &ldquo;{slug}&rdquo;
          </h1>
          <div className="flex items-center gap-3 mb-7">
            <div className="w-12 h-px bg-amber-200/30" />
            <div className="w-1.5 h-1.5 border border-amber-200/50 rotate-45" />
            <div className="w-12 h-px bg-amber-200/30" />
          </div>
          <Link
            href="/admin"
            className="px-6 py-2.5 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            {isHe ? 'חזרה לניהול' : 'Back to admin'}
          </Link>
        </div>
      </div>
    );
  }

  const { config, source } = resolved;
  const isPublished = source === 'published';

  return (
    <AdminShell
      title={config.title.en || 'Untitled'}
      eyebrow={isPublished ? 'Editing Menu Item' : 'Editing Draft'}
      eyebrowHe={isPublished ? 'עריכת פריט תפריט' : 'עריכת טיוטה'}
      active="/admin"
      subtitle={
        isPublished
          ? 'Editing a published menu item. Your changes save as a draft in this browser; the live menu is untouched until you publish.'
          : 'Update any field; everything saves to your browser. Use the preview link in the admin to verify.'
      }
      subtitleHe={
        isPublished
          ? 'עריכת פריט תפריט שפורסם. השינויים נשמרים כטיוטה בדפדפן זה; התפריט החי לא משתנה עד לפרסום.'
          : 'עדכן כל שדה; הכל נשמר בדפדפן שלך. השתמש בקישור התצוגה המקדימה כדי לאמת.'
      }
    >
      <div className="max-w-3xl mx-auto">
        <CocktailForm mode="edit" initial={config} initialLayers={config.layers} onSaved={() => router.push('/admin')} />
      </div>
    </AdminShell>
  );
}
