'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Link2,
  Store,
  ImageIcon,
  ListChecks,
  ImagePlus,
  Download,
  Check,
  X,
  Loader2,
  Search,
  PartyPopper,
  ClipboardCopy,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { useDrafts } from '@/lib/useDrafts';
import { useRestaurant } from '@/lib/useRestaurant';
import { useLang } from '@/lib/useLang';
import { AdminShell } from '@/components/ui/AdminShell';
import { SectionLabel } from '@/components/ui/dataviz';
import { buildGptImagePrompt } from '@/lib/heroPrompts';
import type { CocktailConfig, Category } from '@/data/cocktail';
import type { ParsedItem, ParsedMenu } from '@/lib/restaurant-scraper';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-garamond, serif)';
const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white text-[15px] outline-none transition-colors duration-300 placeholder:text-white/25 focus:border-amber-200/50 focus:bg-black/40';

type ItemStatus = 'pending' | 'in_progress' | 'done' | 'error';

interface SelectedItem extends ParsedItem {
  uid: string;
  /** The restaurant's OWN category name (preserved from the scrape). */
  sourceCategory: string;
  /** App theming category (one of the 5) — guessed, editable. */
  category: Category;
  selected: boolean;
  status?: ItemStatus;
  errorMessage?: string;
}

const CATEGORY_OPTIONS: Array<{ id: Category; label: string; labelHe: string }> = [
  { id: 'citrus', label: 'Citrus', labelHe: 'הדרים' },
  { id: 'smoky', label: 'Smoky', labelHe: 'מעושן' },
  { id: 'bitter', label: 'Bitter', labelHe: 'מריר' },
  { id: 'sweet', label: 'Sweet', labelHe: 'מתוק' },
  { id: 'mocktail', label: 'Alcohol-free', labelHe: 'ללא אלכוהול' },
];

type StepState = 'upcoming' | 'active' | 'done';
type ImportStepId = 'source' | 'scan' | 'select' | 'generate' | 'done';

interface StepDef {
  id: ImportStepId;
  icon: LucideIcon;
  label: string;
  labelHe: string;
}

const IMPORT_STEPS: readonly StepDef[] = [
  { id: 'source', icon: Link2, label: 'Source', labelHe: 'מקור' },
  { id: 'scan', icon: Search, label: 'Scan', labelHe: 'סריקה' },
  { id: 'select', icon: ListChecks, label: 'Select items', labelHe: 'בחירת פריטים' },
  { id: 'generate', icon: Download, label: 'Import', labelHe: 'ייבוא' },
  { id: 'done', icon: PartyPopper, label: 'Edit & images', labelHe: 'עריכה ותמונות' },
];

interface ImportPhase {
  hasUrl: boolean;
  scanning: boolean;
  hasMenu: boolean;
  hasItems: boolean;
  importing: boolean;
  finished: boolean;
}

function deriveStepState(step: ImportStepId, phase: ImportPhase): StepState {
  const { hasUrl, scanning, hasMenu, hasItems, importing, finished } = phase;
  switch (step) {
    case 'source':
      if (hasMenu || scanning) return 'done';
      return hasUrl ? 'active' : 'upcoming';
    case 'scan':
      if (scanning) return 'active';
      if (hasMenu) return 'done';
      return hasUrl ? 'active' : 'upcoming';
    case 'select':
      if (importing || finished) return 'done';
      if (hasItems) return 'active';
      return 'upcoming';
    case 'generate':
      if (finished) return 'done';
      if (importing) return 'active';
      return 'upcoming';
    case 'done':
      return finished ? 'done' : 'upcoming';
  }
}

function ImportStepper({ phase, isHebrew }: { phase: ImportPhase; isHebrew: boolean }) {
  return (
    <ol className="mb-10 flex flex-wrap items-stretch gap-y-4" aria-label={isHebrew ? 'התקדמות הייבוא' : 'Import progress'}>
      {IMPORT_STEPS.map((step, i) => {
        const state = deriveStepState(step.id, phase);
        const isActive = state === 'active';
        const isDone = state === 'done';
        const Icon = isDone ? Check : step.icon;
        const showSpinner = isActive && (phase.scanning || phase.importing) && (step.id === 'scan' || step.id === 'generate');
        const DotIcon = showSpinner ? Loader2 : Icon;

        const ringClass = isDone
          ? 'border-emerald-300/60 bg-emerald-300/10 text-emerald-300'
          : isActive
            ? 'border-amber-200/70 bg-amber-200/12 text-amber-200'
            : 'border-white/12 bg-white/[0.02] text-white/30';
        const labelClass = isDone ? 'text-emerald-200/85' : isActive ? 'text-amber-100' : 'text-white/35';
        const connectorDone = deriveStepState(IMPORT_STEPS[i - 1]?.id ?? step.id, phase) === 'done';

        return (
          <li key={step.id} className="flex min-w-0 flex-1 basis-[120px] items-center">
            {i > 0 && (
              <span aria-hidden className={`mx-1 h-px flex-1 transition-colors duration-500 ${connectorDone ? 'bg-emerald-300/40' : 'bg-white/10'}`} />
            )}
            <div className="flex min-w-0 flex-col items-center gap-2 px-1 text-center">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-500 ${ringClass} ${isActive ? 'shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]' : ''}`}>
                <DotIcon size={16} strokeWidth={isDone ? 2.4 : 2} className={showSpinner ? 'animate-spin' : ''} />
              </span>
              <span aria-current={isActive ? 'step' : undefined} className={`text-[10px] tracking-[0.2em] uppercase leading-tight transition-colors duration-500 ${labelClass}`} style={{ fontFamily: sans }}>
                {isHebrew ? step.labelHe : step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function guessCategory(name: string, desc: string | null | undefined): Category {
  const haystack = `${name} ${desc ?? ''}`.toLowerCase();
  if (/ויסקי|בורבון|מעוש|smoky|whisk|bourbon|mezcal|smoked/.test(haystack)) return 'smoky';
  if (/קמפרי|אמרו|נגרוני|negro|campari|amaro|aperol/.test(haystack)) return 'bitter';
  if (/ליים|לימון|תפוז|הדר|citrus|lime|lemon|sour/.test(haystack)) return 'citrus';
  if (/ללא אלכוהול|מוקטייל|virgin|mocktail|non-alcohol/.test(haystack)) return 'mocktail';
  if (/פטל|תות|אגס|raspberr|strawberr|sweet|pinky/.test(haystack)) return 'sweet';
  return 'citrus';
}

export default function ImportRestaurantPage() {
  const { upsert } = useDrafts();
  const { logo, setLogo } = useRestaurant();
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const [url, setUrl] = useState('https://www.dinerrest.co.il/menus');
  const [restaurantName, setRestaurantName] = useState('Diner');
  const [scanning, setScanning] = useState(false);
  const [menu, setMenu] = useState<ParsedMenu | null>(null);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  /** Set once the import stream finishes — switches the page to the results view. */
  const [imported, setImported] = useState<CocktailConfig[] | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const restaurantSlug = useMemo(
    () => restaurantName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 40) || 'restaurant',
    [restaurantName]
  );

  const selectedCount = items.filter((i) => i.selected).length;
  const importFinished = imported !== null;
  const importPhase: ImportPhase = {
    hasUrl: url.trim().length > 0,
    scanning,
    hasMenu: menu !== null,
    hasItems: items.length > 0,
    importing,
    finished: importFinished,
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setError(t('Logo is too large (max ~1.5MB). Pick a smaller image.', 'הלוגו גדול מדי (עד כ-1.5MB). בחר תמונה קטנה יותר.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    setError(null);
    setItems([]);
    setMenu(null);
    setImported(null);
    setScanning(true);
    try {
      const res = await fetch('/api/scrape-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as ParsedMenu | { error: string };
      if (!res.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : t('Unknown scrape error', 'שגיאת סריקה לא ידועה'));
      }
      setMenu(data);
      // Flatten EVERY category into one selectable list — keep each item's own
      // restaurant category so the picker is grouped exactly as the menu is.
      const all: SelectedItem[] = data.categories.flatMap((cat, ci) =>
        cat.items.map((it, i) => ({
          ...it,
          uid: `${cat.id || ci}-${i}`,
          sourceCategory: cat.name,
          category: guessCategory(it.name, it.desc),
          selected: true,
        }))
      );
      setItems(all);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Unknown error', 'שגיאה לא ידועה'));
    } finally {
      setScanning(false);
    }
  };

  const toggleItem = (uid: string) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, selected: !it.selected } : it)));

  const toggleGroup = (sourceCategory: string, value: boolean) =>
    setItems((prev) => prev.map((it) => (it.sourceCategory === sourceCategory ? { ...it, selected: value } : it)));

  const updateItemCategory = (uid: string, category: Category) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, category } : it)));

  const handleImport = async () => {
    const chosen = items.filter((i) => i.selected);
    if (chosen.length === 0) {
      setError(t('Select at least one item to import.', 'בחר לפחות פריט אחד לייבוא.'));
      return;
    }
    setError(null);
    setImporting(true);
    setProgress({ done: 0, total: chosen.length });
    setItems((prev) => prev.map((it) => (it.selected ? { ...it, status: 'pending' as ItemStatus } : it)));

    try {
      const res = await fetch('/api/import-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug,
          restaurantName,
          // Keep the description (-> tagline) AND the price (-> priceILS) on the menu.
          items: chosen.map((c) => ({ name: c.name, desc: c.desc, price: c.price, category: c.category })),
        }),
      });

      if (!res.ok || !res.body) {
        const text = res.body ? await res.text() : t('No response body', 'אין תוכן בתגובה');
        throw new Error(text.slice(0, 200));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = 0;
      const saved: CocktailConfig[] = [];

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
            if (evt.event === 'item-start' && typeof evt.name === 'string') {
              setItems((prev) => prev.map((it) => (it.name === evt.name ? { ...it, status: 'in_progress' } : it)));
            } else if (evt.event === 'item-done' && typeof evt.name === 'string') {
              done++;
              setProgress({ done, total: chosen.length });
              setItems((prev) => prev.map((it) => (it.name === evt.name ? { ...it, status: 'done' } : it)));
              if (evt.draft) {
                await upsert(evt.draft as CocktailConfig);
                saved.push(evt.draft as CocktailConfig);
              }
            } else if (evt.event === 'item-error' && typeof evt.name === 'string') {
              setItems((prev) => prev.map((it) => (it.name === evt.name ? { ...it, status: 'error', errorMessage: evt.message } : it)));
            }
          } catch {
            /* skip malformed line */
          }
        }
      }

      // Stay on the page and show the results, so the owner can copy each item's
      // ChatGPT prompt and jump straight into editing it.
      setImported(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Unknown error', 'שגיאה לא ידועה'));
    } finally {
      setImporting(false);
    }
  };

  const copyPrompt = async (slug: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((s) => (s === slug ? null : s)), 1800);
    } catch {
      /* clipboard blocked — the textarea is selectable as a fallback */
    }
  };

  const resetForMore = () => {
    setImported(null);
    setItems([]);
    setMenu(null);
    setProgress({ done: 0, total: 0 });
  };

  return (
    <AdminShell
      title="One-click menu import"
      titleHe="ייבוא תפריט בקליק"
      eyebrow="Import Restaurant"
      eyebrowHe="ייבוא מסעדה"
      active="/admin/import"
      subtitle="Paste a restaurant URL. We scan the menu (with descriptions), you pick what to import by category, then edit each item and add its image — with a ready ChatGPT prompt per item."
      subtitleHe="הדבק כתובת אתר של מסעדה. אנו סורקים את התפריט (עם התיאורים), אתה בוחר מה לייבא לפי קטגוריה, ואז עורך כל פריט ומוסיף תמונה — עם פרומפט מוכן ל-ChatGPT לכל פריט."
    >
      <div className="max-w-3xl mx-auto" dir={isHebrew ? 'rtl' : 'ltr'}>
        <ImportStepper phase={importPhase} isHebrew={isHebrew} />

        {/* ── Source ─────────────────────────────────────────────────────── */}
        <section className="mb-12 rounded-[1.75rem] border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <SectionLabel icon={Link2}>{t('Source', 'מקור')}</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-white/45 text-[11px] tracking-wide mb-2" style={{ fontFamily: sans }}>
                {t('Restaurant URL', 'כתובת אתר המסעדה')}
              </label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.restaurant.co.il/menus" dir="ltr" className={inputClass} />
            </div>
            <div>
              <label className="block text-white/45 text-[11px] tracking-wide mb-2" style={{ fontFamily: sans }}>
                {t('Restaurant name', 'שם המסעדה')}
              </label>
              <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder={t('e.g. Diner', 'לדוגמה: Diner')} className={inputClass} />
              <p className="text-white/35 text-[10px] tracking-wider mt-2" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
                {t('slug', 'מזהה')}: <code className="text-amber-100/80" dir="ltr">{restaurantSlug}</code>
              </p>
            </div>
          </div>

          {/* Business logo */}
          <div className="mt-7 pt-6 border-t border-white/8">
            <SectionLabel icon={ImageIcon}>{t('Brand', 'מותג')}</SectionLabel>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl border border-white/10 bg-black/30 overflow-hidden shrink-0">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={t('Business logo', 'לוגו העסק')} className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={20} className="text-white/25" strokeWidth={1.6} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-1.5 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-[10px] tracking-[0.3em] uppercase cursor-pointer">
                    {logo ? t('Replace', 'החלפה') : t('Upload', 'העלאה')}
                    <input type="file" accept="image/*" onChange={onLogoFile} className="hidden" />
                  </label>
                  {logo && (
                    <button type="button" onClick={() => setLogo('')} className="text-white/40 hover:text-rose-300 text-[10px] tracking-[0.3em] uppercase">
                      {t('Remove', 'הסרה')}
                    </button>
                  )}
                </div>
                <p className="text-white/35 text-[10px] mt-2" style={{ fontFamily: sans }}>{t('Shown on the menu header. Stored on this device.', 'מוצג בכותרת התפריט. נשמר במכשיר זה.')}</p>
              </div>
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-white/8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <motion.button type="button" onClick={handleScan} disabled={scanning || importing} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-amber-200 text-black hover:bg-amber-100 transition-colors text-[11px] tracking-[0.3em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: sans, fontWeight: 600 }}>
              {scanning ? <Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> : <Search size={14} strokeWidth={2.2} />}
              {scanning ? t('Scanning…', 'סורק…') : menu ? t('Re-scan', 'סריקה מחדש') : t('Scan menu', 'סריקת תפריט')}
            </motion.button>
            <span className="text-white/35 text-xs italic" style={{ fontFamily: serif }}>
              {t('Supports: getmood.io · Wix Restaurants · Tabit (best-effort) · generic HTML', 'נתמך: getmood.io · Wix Restaurants · Tabit (מאמץ מיטבי) · HTML גנרי')}
            </span>
          </div>
        </section>

        {/* ── Menu found + grouped selection ─────────────────────────────── */}
        {menu && !imported && (
          <section className="mb-10">
            <SectionLabel icon={Store}>{t('Menu found', 'התפריט נמצא')}</SectionLabel>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px]" style={{ fontFamily: sans }}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-200/90">
                <Check size={12} strokeWidth={2.4} /> {menu.platform}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-white/70">
                {t(`${menu.totalItems} items`, `${menu.totalItems} פריטים`)}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-white/70">
                {t(`${menu.categories.length} categories`, `${menu.categories.length} קטגוריות`)}
              </span>
            </div>

            {items.length > 0 && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SectionLabel icon={ListChecks}>{t('Select items by category', 'בחרו פריטים לפי קטגוריה')}</SectionLabel>
                  <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase" style={{ fontFamily: sans }}>
                    <button type="button" onClick={() => setItems((p) => p.map((it) => ({ ...it, selected: true })))} disabled={importing} className="text-amber-200/70 hover:text-amber-100 disabled:opacity-40">
                      {t('All', 'הכל')}
                    </button>
                    <span className="text-white/20">·</span>
                    <button type="button" onClick={() => setItems((p) => p.map((it) => ({ ...it, selected: false })))} disabled={importing} className="text-white/40 hover:text-white/70 disabled:opacity-40">
                      {t('None', 'כלום')}
                    </button>
                  </div>
                </div>

                {menu.categories.map((cat) => {
                  const groupItems = items.filter((it) => it.sourceCategory === cat.name);
                  if (groupItems.length === 0) return null;
                  const allSelected = groupItems.every((it) => it.selected);
                  return (
                    <div key={cat.id} className="mb-7">
                      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/8 pb-2">
                        <h4 className="text-amber-200/85 text-[12px] tracking-[0.28em] uppercase" style={{ fontFamily: sans }}>
                          {cat.name} <span className="text-white/35">({groupItems.length})</span>
                        </h4>
                        <button type="button" onClick={() => toggleGroup(cat.name, !allSelected)} disabled={importing}
                          className="text-[10px] tracking-[0.2em] uppercase text-white/45 hover:text-amber-100 transition-colors disabled:opacity-40" style={{ fontFamily: sans }}>
                          {allSelected ? t('Clear', 'נקה') : t('Select all', 'בחר הכל')}
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {groupItems.map((it) => (
                          <div key={it.uid} className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${it.selected ? 'border-amber-200/25 bg-white/[0.03]' : 'border-white/8 bg-transparent opacity-60'}`}>
                            <input type="checkbox" checked={it.selected} onChange={() => toggleItem(it.uid)} disabled={importing} className="h-4 w-4 shrink-0 accent-amber-300" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-white/90 text-[15px]">{it.name}</div>
                              {it.desc && <div className="mt-0.5 truncate text-white/40 text-xs italic" style={{ fontFamily: serif }}>{it.desc}</div>}
                            </div>
                            {it.price && (
                              <span className="shrink-0 text-amber-100/90 text-sm tabular-nums" style={{ fontFamily: sans }} dir="ltr">₪{it.price}</span>
                            )}
                            <select value={it.category} disabled={!it.selected || importing} onChange={(e) => updateItemCategory(it.uid, e.target.value as Category)}
                              className="shrink-0 rounded-lg border border-white/12 bg-black/40 px-2.5 py-1.5 text-amber-100/90 text-[11px] outline-none focus:border-amber-200/40 disabled:opacity-40" style={{ fontFamily: sans }}>
                              {CATEGORY_OPTIONS.map((c) => (<option key={c.id} value={c.id} className="bg-black">{t(c.label, c.labelHe)}</option>))}
                            </select>
                            <div className="w-20 shrink-0 text-end text-[11px] tracking-wider uppercase" style={{ fontFamily: sans }}>
                              {it.status === 'in_progress' && <span className="inline-flex items-center gap-1 text-amber-200"><Loader2 size={12} strokeWidth={2.2} className="animate-spin" /> {t('working', 'עובד')}</span>}
                              {it.status === 'done' && <span className="inline-flex items-center gap-1 text-emerald-300"><Check size={12} strokeWidth={2.4} /> {t('done', 'הושלם')}</span>}
                              {it.status === 'error' && <span className="inline-flex items-center gap-1 text-rose-300" title={it.errorMessage}><X size={12} strokeWidth={2.4} /> {t('failed', 'נכשל')}</span>}
                              {it.status === 'pending' && it.selected && <span className="text-white/40">{t('queued', 'בתור')}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </section>
        )}

        {/* ── Import action ──────────────────────────────────────────────── */}
        {items.length > 0 && !imported && (
          <section className="flex flex-wrap items-center justify-between gap-4 pt-5 mt-2 border-t border-white/10">
            <div className="text-white/55 text-sm" style={{ fontFamily: sans }}>
              {t(`${selectedCount} of ${items.length} selected`, `${selectedCount} מתוך ${items.length} נבחרו`)}
              {importing && progress.total > 0 && (
                <span className="ms-3 text-amber-200/80">{t(`· ${progress.done}/${progress.total} done`, `· ${progress.done}/${progress.total} הושלמו`)}</span>
              )}
            </div>
            <motion.button type="button" onClick={handleImport} disabled={importing || selectedCount === 0} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-amber-200 text-black text-[12px] tracking-[0.3em] uppercase hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: sans, fontWeight: 600 }}>
              {importing ? <Loader2 size={14} strokeWidth={2.4} className="animate-spin" /> : <Download size={14} strokeWidth={2.4} />}
              {importing
                ? t(`Importing ${progress.done}/${progress.total}…`, `מייבא ${progress.done}/${progress.total}…`)
                : t(`Import ${selectedCount} item${selectedCount === 1 ? '' : 's'}`, selectedCount === 1 ? 'ייבוא פריט אחד' : `ייבוא ${selectedCount} פריטים`)}
            </motion.button>
          </section>
        )}

        {/* ── Results: edit each item + its ready ChatGPT prompt ─────────── */}
        {imported && (
          <section className="mb-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <SectionLabel icon={PartyPopper}>
                {t(`${imported.length} item${imported.length === 1 ? '' : 's'} imported`, `${imported.length} פריטים יובאו`)}
              </SectionLabel>
              <div className="flex items-center gap-3">
                <button type="button" onClick={resetForMore} className="text-white/45 hover:text-white/80 text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
                  {t('Import more', 'ייבוא נוסף')}
                </button>
                <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 px-5 py-2 text-amber-100 hover:bg-amber-200/10 transition-colors text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
                  {t('Open composer', 'פתח את העורך')}
                </Link>
              </div>
            </div>

            <p className="mb-6 text-white/45 text-[13px] italic" style={{ fontFamily: serif }}>
              {t('Each item is saved with its description. Add a photo: copy its ChatGPT prompt, generate the image, then Edit the item to upload it.', 'כל פריט נשמר עם התיאור שלו. להוספת תמונה: העתיקו את פרומפט ה-ChatGPT, צרו את התמונה, ואז ערכו את הפריט כדי להעלות אותה.')}
            </p>

            <div className="space-y-4">
              {imported.map((draft) => {
                const gpt = buildGptImagePrompt({ name: draft.title.en || draft.title.he, description: draft.tagline?.[lang] ?? draft.tagline?.en ?? null });
                const needsImage = !draft.heroImage || draft.heroImage.startsWith('data:image/svg') || draft.heroImage.endsWith('/glass.png');
                return (
                  <div key={draft.slug} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white/90 text-[15px]">{draft.title[lang] || draft.title.en}</div>
                        {draft.tagline && <div className="mt-0.5 text-white/40 text-xs italic" style={{ fontFamily: serif }}>{draft.tagline[lang] || draft.tagline.en}</div>}
                        {draft.priceILS !== undefined && <div className="mt-1 text-amber-100/90 text-[13px] tabular-nums" style={{ fontFamily: sans }} dir="ltr">₪{draft.priceILS}</div>}
                        {needsImage && (
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-amber-200/10 px-2.5 py-0.5 text-[10px] tracking-wide text-amber-200/85" style={{ fontFamily: sans }}>
                            <ImagePlus size={11} strokeWidth={2} /> {t('needs a photo', 'צריך תמונה')}
                          </span>
                        )}
                      </div>
                      <Link href={`/admin/${draft.slug}/edit`} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-200 px-5 py-2 text-black hover:bg-amber-100 transition-colors text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans, fontWeight: 600 }}>
                        <Pencil size={12} strokeWidth={2.2} /> {t('Edit · add image', 'ערוך · הוסף תמונה')}
                      </Link>
                    </div>

                    <div className="mt-3">
                      <label className="block text-white/40 text-[10px] tracking-[0.2em] uppercase mb-1.5" style={{ fontFamily: sans }}>
                        {t('ChatGPT image prompt', 'פרומפט תמונה ל-ChatGPT')}
                      </label>
                      <textarea readOnly value={gpt} rows={2} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} resize-y text-white/65 text-[13px]`} />
                      <button type="button" onClick={() => copyPrompt(draft.slug, gpt)}
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200/40 px-4 py-1.5 text-amber-100 hover:bg-amber-200/10 transition-colors text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
                        {copiedSlug === draft.slug ? <Check size={12} strokeWidth={2.4} /> : <ClipboardCopy size={12} strokeWidth={2} />}
                        {copiedSlug === draft.slug ? t('Copied', 'הועתק') : t('Copy prompt', 'העתק פרומפט')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {error && (
          <p className="mt-6 flex items-center gap-2 text-rose-300/90 text-sm" style={{ fontFamily: sans }}>
            <X size={14} strokeWidth={2.2} className="shrink-0" /> {error}
          </p>
        )}

        {importing && (
          <p className="mt-6 text-amber-200/60 text-sm italic" style={{ fontFamily: serif }}>
            {t('Importing items with their descriptions. Keep this tab open — image generation may be unavailable, and any item without a photo can get one in the editor.', 'מייבא פריטים עם התיאורים. השאר את הכרטיסייה פתוחה — ייתכן שיצירת תמונות אינה זמינה, וכל פריט בלי תמונה יכול לקבל אותה בעורך.')}
          </p>
        )}
      </div>
    </AdminShell>
  );
}
