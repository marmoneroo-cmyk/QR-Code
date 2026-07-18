'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Armchair, Route } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { useLang } from '@/lib/useLang';
import { TablesPanel } from '@/app/admin/tables/page';
import { JourneysPanel } from '@/app/admin/journeys/page';

type Tab = 'tables' | 'journeys';

const TABS: ReadonlyArray<{ id: Tab; en: string; he: string; icon: LucideIcon }> = [
  { id: 'tables', en: 'Tables', he: 'שולחנות', icon: Armchair },
  { id: 'journeys', en: 'Journeys', he: 'מסעות', icon: Route },
];

const sans = 'var(--font-inter, sans-serif)';

/** Guests — the "who were the guests?" workspace (Tables + Journeys). */
export default function GuestsPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [tab, setTab] = useState<Tab>('tables');

  return (
    <AdminShell
      title="Guests"
      titleHe="אורחים"
      eyebrow="Who were the guests?"
      eyebrowHe="מי היו האורחים?"
      active="/admin/guests"
      subtitle="Per-table attribution and step-by-step visitor journeys — two angles on the same question: who came, and what did they do."
      subtitleHe="ייחוס לפי שולחן ומסעות מבקר צעד‑אחר‑צעד — שתי זוויות על אותה שאלה: מי הגיע, ומה עשה."
    >
      <div
        className="inline-flex flex-wrap items-center gap-1.5 mb-8 rounded-full border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-sm"
        role="tablist"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {TABS.map((tb) => {
          const isActive = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(tb.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-11 tracking-[0.18em] uppercase transition-all ${
                isActive
                  ? 'bg-[#e8c987]/15 text-amber-100 shadow-[0_0_20px_-6px_rgba(232,201,135,0.6)] ring-1 ring-[#e8c987]/50'
                  : 'text-white/55 hover:text-amber-100/90 hover:bg-white/[0.04]'
              }`}
              style={{ fontFamily: sans }}
            >
              <Icon size={14} strokeWidth={isActive ? 2 : 1.7} className={isActive ? 'text-amber-200' : 'text-white/40'} />
              {isHe ? tb.he : tb.en}
            </button>
          );
        })}
      </div>

      {tab === 'tables' && <TablesPanel />}
      {tab === 'journeys' && <JourneysPanel />}
    </AdminShell>
  );
}
