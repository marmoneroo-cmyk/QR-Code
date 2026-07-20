'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowUp, Megaphone, Tag, Repeat, Layers, Lightbulb, EyeOff, Check, X, Clock, ChevronDown, RotateCcw, CheckCircle2, BadgeCheck } from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { GlassCard, PanelHeader, EmptyState, StatBlock } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import { PotentialValue } from '@/components/ui/value';
import { HoverLift, AccentWash, BeforeAfterImage } from '@/components/ui/visual';
import { estimatePotential, buildMenuBenchmark, type MenuBenchmark } from '@/lib/value/potential';
import { isStatusActive, type OppStatusKind, type OppStatusMap } from '@/lib/value/focus';
import { sampleConfidence } from '@/lib/menu-intel/sample';
import type { MenuEngineeringItem } from '@/lib/analytics/types';
import type { Opportunity, OpportunityType, Confidence, LayoutInsight } from '@/lib/opportunities/types';
import { useNow } from '@/lib/useNow';
import { useOppStatuses } from '@/lib/useOppStatuses';
import { useApiData } from '@/lib/data/useApiData';

const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-rubik, sans-serif)';

const TYPE_LABEL: Record<OpportunityType, { en: string; he: string }> = {
  fix_offer: { en: 'Review the offer', he: 'בדקו את ההצעה' },
  promote_position: { en: 'Move it up', he: 'העלו במיקום' },
  promote_marketing: { en: 'Promote it', he: 'קדמו אותו' },
  promotion_candidate: { en: 'Promotion candidate', he: 'מועמד למבצע' },
  reengage_returning: { en: 'Re-engage guests', he: 'החזירו אורחים' },
};

/** Icon + accent color per opportunity type — gives each card a distinct, scannable identity. */
const TYPE_META: Record<OpportunityType, { icon: LucideIcon; color: string }> = {
  fix_offer: { icon: AlertTriangle, color: '#f59e0b' },
  promote_position: { icon: ArrowUp, color: '#34d399' },
  promote_marketing: { icon: Megaphone, color: '#7dd3fc' },
  promotion_candidate: { icon: Tag, color: '#f472b6' },
  reengage_returning: { icon: Repeat, color: '#c084fc' },
};

/** Short bilingual "after" badge per opportunity type — the suggested change, as a label. */
const AFTER_BADGE: Record<OpportunityType, { en: string; he: string }> = {
  fix_offer: { en: 'fixed', he: 'משופר' },
  promote_position: { en: 'promo', he: 'מבצע' },
  promote_marketing: { en: 'promo', he: 'מבצע' },
  promotion_candidate: { en: 'promo', he: 'מבצע' },
  reengage_returning: { en: 'featured', he: 'מומלץ' },
};

const CONF_LABEL: Record<Confidence, { en: string; he: string }> = {
  high: { en: 'High confidence', he: 'ביטחון גבוה' },
  medium: { en: 'Medium', he: 'בינוני' },
  low: { en: 'Low · need data', he: 'נמוך · דרושים נתונים' },
};

const CAT_LABEL: Record<string, { en: string; he: string }> = {
  citrus: { en: 'Citrus', he: 'הדרי' },
  smoky: { en: 'Smoky', he: 'מעושן' },
  bitter: { en: 'Bitter', he: 'מריר' },
  sweet: { en: 'Sweet', he: 'מתוק' },
  mocktail: { en: 'Mocktail', he: 'ללא אלכוהול' },
};

interface BoardData {
  opportunities: Opportunity[];
  layout: LayoutInsight;
}

/* ── Per-opportunity action state, persisted to localStorage ───────────────── */

/** Stable id for an opportunity — same slug can appear under several types. */
function oppId(o: Pick<Opportunity, 'slug' | 'type'>): string {
  return `${o.slug}:${o.type}`;
}

/**
 * Evidence values arrive as pre-built strings (e.g. "0 ♥ · 0 sold", "3 sessions")
 * that embed English words. In Hebrew mode we localize those embedded words for
 * DISPLAY only — the underlying value and all logic are untouched. No-op in English,
 * so English output stays byte-identical.
 */
function localizeEvidenceValue(value: string, isHe: boolean): string {
  if (!isHe) return value;
  return value
    .replace(/\bsold\b/g, 'נמכרו')
    .replace(/\bsessions\b/g, 'ביקורים')
    .replace(/\bsession\b/g, 'ביקור');
}

export function OpportunitiesPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const { data, loading, error: oppsError } = useApiData<BoardData>('/api/analytics/opportunities');
  const { data: engData } = useApiData<{ items: MenuEngineeringItem[] }>('/api/analytics/menu-engineering');
  const items = engData?.items ?? [];
  const error = Boolean(oppsError);

  // Achievable target derived from the menu's OWN medians (never fabricated), plus a
  // slug→item lookup so each card can estimate its real upside.
  const bench = useMemo<MenuBenchmark>(() => buildMenuBenchmark(items), [items]);
  const itemBySlug = useMemo(() => new Map(items.map((it) => [it.slug, it])), [items]);

  const titleBySlug = useMemo(() => new Map(MENU.map((c) => [c.slug, c.title])), []);
  const headFont = isHe ? serifHe : serif;

  const { statuses, setStatus, clearStatus } = useOppStatuses();
  // Re-evaluates snooze expiry; `now` is seeded once after mount (render-pure), and the
  // list refreshes on load/visibility, so no live ticking is required here.
  const now = useNow();

  const { active, handled } = useMemo(() => {
    const list = data?.opportunities ?? [];
    const activeList: Opportunity[] = [];
    const handledList: Opportunity[] = [];
    for (const o of list) {
      const entry = statuses[oppId(o)];
      if (entry && isStatusActive(entry, now)) handledList.push(o);
      else activeList.push(o);
    }
    return { active: activeList, handled: handledList };
  }, [data, statuses, now]);

  return (
    <>
      {loading && (
        <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
          <section>
            <Skeleton className="mb-4 h-3 w-40 rounded-full" />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full rounded-3xl" />
              ))}
            </div>
          </section>
          <section>
            <Skeleton className="mb-4 h-3 w-48 rounded-full" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </section>
        </div>
      )}
      {!loading && error && (
        <p className="text-rose-300/80 text-sm font-sans">{isHe ? 'טעינה נכשלה.' : 'Failed to load.'}</p>
      )}

      {!loading && !error && data && (
        <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
          {/* Opportunities */}
          <section>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <SectionLabel icon={Lightbulb}>{isHe ? 'הזדמנויות היום' : "Today's opportunities"}</SectionLabel>
            </div>
            {data.opportunities.length > 0 && (
              <p className="text-white/70 text-xs mb-4 font-sans">
                {isHe
                  ? `${active.length} פעולות פתוחות · ${handled.length} טופלו`
                  : `${active.length} open ${active.length === 1 ? 'action' : 'actions'} · ${handled.length} handled`}
              </p>
            )}
            {data.opportunities.length === 0 ? (
              <GlassCard static className="p-12">
                <EmptyState
                  title={isHe ? 'אין הזדמנויות כרגע — אספו עוד ביקורי אורחים ובדקו שוב בבוקר.' : 'No opportunities right now — collect more guest visits and check back in the morning.'}
                />
              </GlassCard>
            ) : active.length === 0 ? (
              <GlassCard static className="p-12">
                <EmptyState
                  icon={<CheckCircle2 size={16} strokeWidth={2} />}
                  title={isHe ? 'כל ההזדמנויות טופלו — עבודה יפה.' : 'All caught up — nice work.'}
                />
              </GlassCard>
            ) : (
              <Stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((o, i) => (
                  <motion.div key={`${oppId(o)}:${i}`} variants={staggerItem}>
                    <OpportunityCard
                      o={o}
                      item={itemBySlug.get(o.slug)}
                      bench={bench}
                      lang={lang}
                      isHe={isHe}
                      headFont={headFont}
                      onDone={() => setStatus(oppId(o), 'done')}
                      onDismiss={() => setStatus(oppId(o), 'dismissed')}
                      onSnooze={() => setStatus(oppId(o), 'snoozed')}
                    />
                  </motion.div>
                ))}
              </Stagger>
            )}

            {handled.length > 0 && (
              <HandledSection
                items={handled}
                statuses={statuses}
                lang={lang}
                isHe={isHe}
                headFont={headFont}
                onRestore={(id) => clearStatus(id)}
              />
            )}
          </section>

          {/* Menu Layout Intelligence */}
          <section>
            <SectionLabel icon={Layers}>{isHe ? 'מודיעין פריסת תפריט' : 'Menu Layout Intelligence'}</SectionLabel>
            <GlassCard static className="p-6">
              <PanelHeader label={isHe ? `מבוסס על ${data.layout.sessions} ביקורים` : `Based on ${data.layout.sessions} sessions`} />

              {data.layout.sessions === 0 ? (
                <EmptyState className="pt-5" title={isHe ? 'אין עדיין נתוני גלילה.' : 'No browsing data yet.'} />
              ) : (
                <div className="grid sm:grid-cols-3 gap-4 mt-5">
                  <ReachStat label={isHe ? 'הגיעו לפריט 3+' : 'Reached item 3+'} pct={data.layout.reachedFirst3Pct} accent="#34d399" />
                  <ReachStat label={isHe ? 'הגיעו לאמצע' : 'Reached the middle'} pct={data.layout.reachedHalfPct} accent="#fbbf24" />
                  <ReachStat label={isHe ? 'הגיעו לסוף' : 'Reached the end'} pct={data.layout.reachedAllPct} accent="#7dd3fc" />
                </div>
              )}

              {data.layout.categoryReach.length > 0 && (
                <div className="mt-7">
                  <p className="text-amber-200/70 text-10 tracking-[0.3em] uppercase mb-3 font-sans">
                    {isHe ? 'חשיפת קטגוריות' : 'Category reach'}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                    {data.layout.categoryReach.map((c) => (
                      <ReachBar key={c.category} label={CAT_LABEL[c.category]?.[lang] ?? c.category} pct={c.reachPct} isHe={isHe} />
                    ))}
                  </div>
                </div>
              )}

              {data.layout.rarelyReached.length > 0 && (
                <div className="mt-7">
                  <p className="inline-flex items-center gap-2 text-rose-200/70 text-10 tracking-[0.3em] uppercase mb-3 font-sans">
                    <EyeOff size={12} strokeWidth={2} /> {isHe ? 'כמעט לא נראים' : 'Rarely reached'}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {data.layout.rarelyReached.map((slug) => (
                      <RarelyThumb key={slug} slug={slug} title={titleBySlug.get(slug)?.[lang] ?? slug} headFont={headFont} />
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          </section>
        </div>
      )}
    </>
  );
}

export default function OpportunitiesPage() {
  return (
    <AdminShell
      title="Opportunity Board"
      titleHe="לוח הזדמנויות"
      eyebrow="What should I do today?"
      eyebrowHe="מה כדאי לעשות היום?"
      active="/admin/opportunities"
      subtitle="Your morning action list — each opportunity leads with its honest ₪ revenue upside, then its type, confidence, evidence, and a suggested action. Every estimate is tied to the menu's own medians; thin-data items show a target instead of a fabricated number."
      subtitleHe="רשימת הפעולות של הבוקר — כל הזדמנות פותחת בצפי ההכנסה הנוספת ב-₪ (הערכה כנה), ואז סוג, רמת ביטחון, ראיות ופעולה מומלצת. כל הערכה נשענת על חציוני התפריט עצמו; פריטים עם מעט נתונים מציגים יעד במקום מספר מומצא."
    >
      <OpportunitiesPanel />
    </AdminShell>
  );
}

interface OpportunityCardProps {
  o: Opportunity;
  /** Real per-item analytics for this slug; absent when menu-engineering had no row. */
  item: MenuEngineeringItem | undefined;
  bench: MenuBenchmark;
  lang: 'en' | 'he';
  isHe: boolean;
  headFont: string;
  onDone: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}

function OpportunityCard({ o, item, bench, lang, isHe, headFont, onDone, onDismiss, onSnooze }: OpportunityCardProps) {
  const cocktail = findCocktailBySlug(o.slug);
  const accent = getAccent(o.slug);
  const title = cocktail?.title[lang] ?? o.slug;
  const meta = TYPE_META[o.type];
  const Icon = meta.icon;

  // Honest upside: only what real data supports. Null → PotentialValue shows the
  // "collect more traffic" note and we skip the before/after bar.
  const potential = item ? estimatePotential(item, bench) : null;

  return (
    <HoverLift accent={accent} className="h-full">
    <article
      className="group relative h-full overflow-hidden rounded-3xl border bg-white/[0.02] p-5 flex flex-col gap-4 transition-colors hover:border-white/25"
      style={{ borderColor: `${meta.color}33` }}
    >
      <AccentWash accent={accent} />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}88, transparent)` }} aria-hidden />

      <div className="relative grid place-items-center">
        {cocktail ? (
          <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-64 transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-64 rounded-2xl border border-white/10 bg-white/[0.02] grid place-items-center">
            <Lightbulb size={26} className="text-white/20" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-between gap-2 flex-wrap">
        <span
          className="font-sans inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-9 tracking-[0.18em] uppercase"
          style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
        >
          <Icon size={12} strokeWidth={2} /> {TYPE_LABEL[o.type][lang]}
        </span>
        {item ? (
          <ConfidenceBadge pct={Math.round(sampleConfidence(item.views) * 100)} label={CONF_LABEL[o.confidence][lang]} />
        ) : (
          <span
            className="font-sans inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-10 tracking-[0.18em] uppercase"
            style={{ borderColor: `${meta.color}66`, color: meta.color }}
          >
            <BadgeCheck size={12} strokeWidth={2} /> {CONF_LABEL[o.confidence][lang]}
          </span>
        )}
      </div>

      <h3
        className="relative text-white/95 text-lg leading-tight"
        style={{ fontFamily: headFont, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
      >
        {title}
      </h3>

      {/* Headline value: the honest ₪ upside now carries the card's message. */}
      <div className="relative">
        <PotentialValue potential={potential} lang={lang} accent={meta.color} size="md" />
      </div>

      {/* Visual before → after: the drink, repeated, the "after" wearing the change. */}
      {cocktail && (
        <div className="relative">
          <BeforeAfterImage
            src={cocktail.heroImage}
            accent={accent}
            lang={lang}
            afterBadge={AFTER_BADGE[o.type][lang]}
          />
        </div>
      )}

      {/* Suggested action — secondary now; the ₪ value above leads. */}
      <p className="relative text-white/70 text-13 leading-snug line-clamp-2 font-sans">
        {o.action[lang]}
      </p>

      {o.evidence.length > 0 && (
        <div className="relative flex flex-wrap gap-2 mt-auto pt-1">
          {o.evidence.slice(0, 2).map((e, j) => (
            <span
              key={j}
              className="font-sans inline-flex items-center gap-1 text-11 text-white/55 border border-white/10 bg-white/[0.03] rounded-full px-2.5 py-1"
            >
              {e.label[lang]}: <span className="text-white/85">{localizeEvidenceValue(e.value, isHe)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="relative grid grid-cols-3 gap-2 pt-3 mt-auto border-t border-white/[0.06]">
        <CardActionButton
          icon={Check}
          label={isHe ? 'בוצע' : 'Done'}
          tone="#34d399"
          onClick={onDone}
        />
        <CardActionButton
          icon={X}
          label={isHe ? 'דחה' : 'Dismiss'}
          tone="#f87171"
          onClick={onDismiss}
        />
        <CardActionButton
          icon={Clock}
          label={isHe ? 'הזכר מחר' : 'Snooze'}
          tone="#fbbf24"
          onClick={onSnooze}
        />
      </div>
    </article>
    </HoverLift>
  );
}

interface CardActionButtonProps {
  icon: LucideIcon;
  label: string;
  tone: string;
  onClick: () => void;
}

function CardActionButton({ icon: ActionIcon, label, tone, onClick }: CardActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="font-sans inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-11 text-white/65 transition-colors hover:text-white hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      <ActionIcon size={13} strokeWidth={2} style={{ color: tone }} />
      <span className="truncate">{label}</span>
    </button>
  );
}

const HANDLED_STATUS_LABEL: Record<OppStatusKind, { en: string; he: string; tone: string }> = {
  done: { en: 'Done', he: 'בוצע', tone: '#34d399' },
  dismissed: { en: 'Dismissed', he: 'נדחה', tone: '#f87171' },
  snoozed: { en: 'Snoozed', he: 'נדחה למחר', tone: '#fbbf24' },
};

interface HandledSectionProps {
  items: Opportunity[];
  statuses: OppStatusMap;
  lang: 'en' | 'he';
  isHe: boolean;
  headFont: string;
  onRestore: (id: string) => void;
}

function HandledSection({ items, statuses, lang, isHe, headFont, onRestore }: HandledSectionProps) {
  const [open, setOpen] = useState(false);

  const snoozedCount = items.reduce((n, o) => (statuses[oppId(o)]?.status === 'snoozed' ? n + 1 : n), 0);

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-3xl"
      >
        <span className="inline-flex items-center gap-2 text-white/70 text-xs tracking-[0.18em] uppercase font-sans">
          <CheckCircle2 size={14} strokeWidth={2} className="text-emerald-300/70" />
          {isHe ? `טופל (${items.length})` : `Handled (${items.length})`}
          {snoozedCount > 0 && (
            <span className="text-amber-200/60 normal-case tracking-normal">
              {isHe ? `· ${snoozedCount} נדחו למחר` : `· ${snoozedCount} snoozed`}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className="text-white/40 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="flex flex-col gap-2 px-5 pb-5">
          {items.map((o) => {
            const entry = statuses[oppId(o)];
            const statusKind: OppStatusKind = entry?.status ?? 'done';
            const meta = HANDLED_STATUS_LABEL[statusKind];
            const cocktail = findCocktailBySlug(o.slug);
            const title = cocktail?.title[lang] ?? o.slug;
            return (
              <li
                key={oppId(o)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="font-sans shrink-0 rounded-full px-2 py-0.5 text-9 tracking-[0.16em] uppercase"
                    style={{ color: meta.tone, background: `${meta.tone}1f` }}
                  >
                    {meta[lang]}
                  </span>
                  <span className="truncate text-white/80 text-sm" style={{ fontFamily: headFont }}>
                    {title}
                  </span>
                  <span className="truncate text-white/70 text-11 hidden sm:inline font-sans">
                    {TYPE_LABEL[o.type][lang]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(oppId(o))}
                  aria-label={isHe ? 'החזר' : 'Restore'}
                  className="font-sans inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-11 text-white/65 transition-colors hover:text-white hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  {isHe ? 'החזר' : 'Restore'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReachStat({ label, pct, accent }: { label: string; pct: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <span className="w-1.5 h-1.5 rounded-full block mb-3" style={{ background: accent }} />
      <StatBlock
        value={<>{pct}<span className="text-white/60 text-[1.25rem]">%</span></>}
        label={label}
      />
    </div>
  );
}

function ReachBar({ label, pct, isHe }: { label: string; pct: number; isHe: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/65 text-xs font-sans">{label}</span>
        <span className="text-white/85 text-xs font-sans" style={{ fontWeight: 600 }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            marginInlineStart: isHe ? 'auto' : undefined,
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
          }}
        />
      </div>
    </div>
  );
}

function RarelyThumb({ slug, title, headFont }: { slug: string; title: string; headFont: string }) {
  const cocktail = findCocktailBySlug(slug);
  const accent = getAccent(slug);
  return (
    <div className="w-28 flex flex-col items-center gap-2">
      {cocktail ? (
        <GlassImage src={cocktail.heroImage} accent={accent} className="w-28 h-28 opacity-70" />
      ) : (
        <div className="w-28 h-28 rounded-2xl border border-white/10 bg-white/[0.02] grid place-items-center">
          <EyeOff size={18} className="text-white/20" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-white/55 text-11 text-center leading-tight" style={{ fontFamily: headFont }}>{title}</p>
    </div>
  );
}
