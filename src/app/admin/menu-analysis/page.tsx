'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Grid2x2, Flame } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { useLang } from '@/lib/useLang';
import { OptimizePanel } from '@/app/admin/optimize/page';
import { MenuEngineeringPanel } from '@/app/admin/menu-engineering/page';
import { HeatmapPanel } from '@/app/admin/heatmap/page';

type Tab = 'optimize' | 'menu' | 'heatmap';

const TABS: ReadonlyArray<{ id: Tab; en: string; he: string; icon: LucideIcon }> = [
  { id: 'optimize', en: 'Optimize', he: 'אופטימיזציה', icon: Sparkles },
  { id: 'menu', en: 'Menu Engineering', he: 'הנדסת תפריט', icon: Grid2x2 },
  { id: 'heatmap', en: 'Heatmap', he: 'מפת חום', icon: Flame },
];

const sans = 'var(--font-inter, sans-serif)';

/** Menu Analysis — the "why does this drink behave this way?" workspace. */
export default function MenuAnalysisPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [tab, setTab] = useState<Tab>('optimize');

  return (
    <AdminShell
      title="Menu Analysis"
      titleHe="ניתוח תפריט"
      eyebrow="Why does this drink behave this way?"
      eyebrowHe="למה המשקה מתנהג כך?"
      active="/admin/menu-analysis"
      subtitle="Optimize, Menu Engineering and the Attention Heatmap — one workspace for the 'why' behind each cocktail."
      subtitleHe="אופטימיזציה, הנדסת תפריט ומפת תשומת הלב — מרחב אחד ל'למה' מאחורי כל קוקטייל."
    >
      <div
        className="inline-flex flex-wrap gap-1.5 mb-8 max-w-full rounded-full border border-white/10 bg-white/[0.02] p-1.5 backdrop-blur-sm"
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
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] tracking-[0.18em] uppercase transition-all duration-200 ${
                isActive
                  ? 'border border-amber-300/60 bg-amber-300/10 text-amber-100 shadow-[0_0_24px_-6px_rgba(251,191,36,0.55)]'
                  : 'border border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/80'
              }`}
              style={{ fontFamily: sans }}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-amber-200' : 'text-white/40'} />
              {isHe ? tb.he : tb.en}
            </button>
          );
        })}
      </div>

      {tab === 'optimize' && <OptimizePanel />}
      {tab === 'menu' && <MenuEngineeringPanel />}
      {tab === 'heatmap' && <HeatmapPanel />}
    </AdminShell>
  );
}
