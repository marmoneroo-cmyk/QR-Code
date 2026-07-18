'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CocktailConfig, LayerConfig } from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';
import { useLang } from '@/lib/useLang';

function hasCustomLayers(cocktail: CocktailConfig): boolean {
  return cocktail.layers.some((layer) => layer.image.startsWith('/cocktail/drafts/'));
}

type ItemStatus = 'pending' | 'in_progress' | 'done' | 'error';

interface ItemProgress {
  slug: string;
  title: string;
  status: ItemStatus;
  message?: string;
}

export function BulkBreakdownButton() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const { drafts, upsert } = useDrafts();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ItemProgress[]>([]);

  const candidates = drafts.filter((d) => !hasCustomLayers(d));
  const candidateCount = candidates.length;

  const handleRun = async () => {
    if (candidateCount === 0) return;
    if (
      !confirm(
        t(
          `Generate full breakdown for ${candidateCount} draft${candidateCount === 1 ? '' : 's'}? ` +
            `Each takes ~60-90s. Total estimate: ~${Math.ceil((candidateCount * 75) / 60)} minutes.`,
          `ליצור פירוק מלא עבור ${candidateCount} ${candidateCount === 1 ? 'טיוטה' : 'טיוטות'}? ` +
            `כל אחד אורך כ-60-90 שניות. הערכה כוללת: כ-${Math.ceil((candidateCount * 75) / 60)} דקות.`
        )
      )
    ) {
      return;
    }

    setRunning(true);
    setProgress(
      candidates.map((c) => ({ slug: c.slug, title: c.title[lang], status: 'pending' as ItemStatus }))
    );

    for (let i = 0; i < candidates.length; i++) {
      const draft = candidates[i]!;
      setProgress((prev) =>
        prev.map((p) => (p.slug === draft.slug ? { ...p, status: 'in_progress' } : p))
      );

      try {
        const res = await fetch('/api/generate-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: draft.slug,
            name: draft.title.en,
            tagline: draft.tagline?.en,
            category: draft.category,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(res.body ? (await res.text()).slice(0, 120) : 'No response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalLayers: LayerConfig[] | null = null;

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.event === 'complete' && evt.layers) {
                finalLayers = evt.layers;
              }
            } catch {
              // skip malformed
            }
          }
        }

        if (finalLayers) {
          await upsert({ ...draft, layers: finalLayers });
        }
        setProgress((prev) =>
          prev.map((p) => (p.slug === draft.slug ? { ...p, status: 'done' } : p))
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setProgress((prev) =>
          prev.map((p) =>
            p.slug === draft.slug ? { ...p, status: 'error', message } : p
          )
        );
      }
    }

    setRunning(false);
  };

  if (candidateCount === 0 && !running) {
    return (
      <p className="text-white/70 text-11 tracking-wider italic">
        {t(
          'All drafts have custom layers — nothing to bulk-generate.',
          'לכל הטיוטות יש שכבות מותאמות אישית — אין מה לייצר בכמות.'
        )}
      </p>
    );
  }

  return (
    <div>
      <motion.button
        type="button"
        onClick={handleRun}
        disabled={running}
        whileTap={{ scale: 0.97 }}
        className="px-5 py-2 rounded-full border border-amber-200/40 text-amber-100/85 hover:bg-amber-200/10 hover:border-amber-200/70 transition-colors text-10 tracking-[0.3em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
      >
        {running
          ? t(`Generating breakdowns…`, `מייצר פירוקים…`)
          : t(
              `Generate breakdown for ${candidateCount} draft${candidateCount === 1 ? '' : 's'}`,
              `ליצור פירוק עבור ${candidateCount} ${candidateCount === 1 ? 'טיוטה' : 'טיוטות'}`
            )}
      </motion.button>

      {progress.length > 0 && (
        <ul className="mt-5 space-y-1.5 max-w-md">
          {progress.map((p) => {
            const color =
              p.status === 'done'
                ? 'text-emerald-300/90'
                : p.status === 'in_progress'
                  ? 'text-amber-100 animate-pulse'
                  : p.status === 'error'
                    ? 'text-rose-300/90'
                    : 'text-white/40';
            const icon =
              p.status === 'done'
                ? '✓'
                : p.status === 'in_progress'
                  ? '…'
                  : p.status === 'error'
                    ? '×'
                    : '·';
            return (
              <li
                key={p.slug}
                className={`text-11 tracking-wider flex items-center gap-3 ${color}`}
                style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
              >
                <span className="font-mono w-3">{icon}</span>
                <span>{p.title}</span>
                {p.message && <span className="text-rose-300/70 text-10">— {p.message.slice(0, 50)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
