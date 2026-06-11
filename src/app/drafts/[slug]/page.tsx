'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useDrafts } from '@/lib/useDrafts';
import { CocktailExperience } from '@/components/CocktailExperience';
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
  const [config, setConfig] = useState<CocktailConfig | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const draft = findBySlug(slug);
    setConfig(draft ?? null);
  }, [slug, hydrated, findBySlug]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">
        Loading draft…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-8 text-center">
        <p
          className="text-amber-200/70 text-[10px] tracking-[0.4em] uppercase mb-4"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          Draft not found
        </p>
        <h1
          className="text-3xl text-white mb-6"
          style={{
            fontFamily: 'var(--font-playfair, serif)',
            fontStyle: 'italic',
          }}
        >
          We couldn&apos;t find a draft for &ldquo;{slug}&rdquo;
        </h1>
        <p
          className="text-white/50 mb-8 max-w-md italic"
          style={{ fontFamily: 'var(--font-garamond, serif)' }}
        >
          Drafts live only in your browser. If this link came from someone else, ask them to publish the draft to the main menu.
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            Back to menu
          </Link>
          <Link
            href="/admin"
            className="text-amber-200/70 hover:text-amber-200 transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            Open admin
          </Link>
        </div>
      </div>
    );
  }

  return <CocktailExperience config={config} />;
}
