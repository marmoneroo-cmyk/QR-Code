'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Type,
  Tags,
  SlidersHorizontal,
  Quote,
  ImageIcon,
  Layers,
  Lightbulb,
  Upload,
  Check,
  ClipboardCopy,
  LibraryBig,
} from 'lucide-react';
import {
  CATEGORY_LABEL,
  FLAVOR_LABEL,
  SHARED_LAYERS,
  getAccent,
  type Category,
  type CocktailConfig,
  type FlavorProfile,
  type LayerConfig,
} from '@/data/cocktail';
import { GlassImage, SectionLabel } from '@/components/ui/dataviz';
import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { useDrafts } from '@/lib/useDrafts';
import { useLang } from '@/lib/useLang';
import { buildHeroPrompt, buildPollinationsUrl, buildGptImagePrompt, slugify } from '@/lib/heroPrompts';
import type { ItemKind } from '@/lib/menu/classify';

const CATEGORY_OPTIONS: Category[] = ['citrus', 'smoky', 'bitter', 'sweet', 'mocktail'];
const FLAVOR_AXES: Array<keyof FlavorProfile> = ['sweet', 'bitter', 'citrus', 'smoky', 'herbal'];

interface CocktailFormProps {
  mode: 'new' | 'edit';
  initial?: CocktailConfig;
  initialLayers?: LayerConfig[];
  initialHeroPrompt?: string;
  onSaved: () => void;
}

export function CocktailForm({
  mode,
  initial,
  initialLayers,
  initialHeroPrompt,
  onSaved,
}: CocktailFormProps) {
  const { upsert, drafts, hydrated } = useDrafts();
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const [name, setName] = useState({
    en: initial?.title.en ?? '',
    he: initial?.title.he ?? '',
  });
  const [tagline, setTagline] = useState({
    en: initial?.tagline?.en ?? '',
    he: initial?.tagline?.he ?? '',
  });
  const [bartenderNote, setBartenderNote] = useState({
    en: initial?.bartenderNote.en ?? '',
    he: initial?.bartenderNote.he ?? '',
  });
  const [bartenderName, setBartenderName] = useState(initial?.bartenderName ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'citrus');
  const [flavor, setFlavor] = useState<FlavorProfile>(
    initial?.flavor ?? { sweet: 2, bitter: 2, citrus: 2, smoky: 2, herbal: 2 }
  );
  const [dietary, setDietary] = useState(
    initial?.dietary ?? { vegan: true, glutenFree: true, alcoholFree: false }
  );
  const [heroPrompt, setHeroPrompt] = useState(initialHeroPrompt ?? initial?.heroPrompt ?? '');
  const [heroUrl, setHeroUrl] = useState(initial?.heroImage ?? '');
  const [gptCopied, setGptCopied] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [priceText, setPriceText] = useState(initial?.priceILS != null ? String(initial.priceILS) : '');
  // 'drink' (cocktail) vs 'food' — chooses which fields show. Trusts the stored
  // kind (code cocktails have none ⇒ 'drink'; imports set it); the owner can flip.
  const [kind, setKind] = useState<ItemKind>(initial?.kind ?? 'drink');
  const [course, setCourse] = useState({
    en: initial?.course?.en ?? '',
    he: initial?.course?.he ?? '',
  });
  const [generating, setGenerating] = useState(false);
  const [breakdownLayers, setBreakdownLayers] = useState<LayerConfig[] | null>(
    initialLayers ?? (initial && initial.layers !== SHARED_LAYERS ? initial.layers : null)
  );
  const [generatingBreakdown, setGeneratingBreakdown] = useState(false);
  const [layerProgress, setLayerProgress] = useState<
    Record<string, 'pending' | 'in_progress' | 'done' | 'error'>
  >({});
  const [error, setError] = useState<string | null>(null);

  const slug = useMemo(
    () => (mode === 'edit' && initial ? initial.slug : slugify(name.en || name.he || 'untitled')),
    [mode, initial, name]
  );
  const slugTaken = useMemo(
    () => mode === 'new' && hydrated && drafts.some((d) => d.slug === slug),
    [mode, hydrated, drafts, slug]
  );

  useEffect(() => {
    if (mode === 'new' && !heroPrompt && (name.en || tagline.en)) {
      setHeroPrompt(
        buildHeroPrompt({ name: name.en, tagline: tagline.en, description: tagline.en })
      );
    }
  }, [mode, name.en, tagline.en, heroPrompt]);

  const handleGenerate = async () => {
    if (!heroPrompt.trim()) {
      setError(t('Add a description first.', 'יש להוסיף תיאור תחילה.'));
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const url = buildPollinationsUrl(heroPrompt);
      const res = await fetch(url);
      if (!res.ok) {
        const friendly =
          res.status === 403
            ? t(
                'AI image generation is unavailable right now — please upload an image instead.',
                'יצירת תמונה ב-AI אינה זמינה כרגע — אנא העלו תמונה ידנית במקום.',
              )
            : res.status === 429
              ? t(
                  'AI image service is rate-limited — wait a moment and try again, or upload an image.',
                  'שירות יצירת התמונה מוגבל כרגע — המתינו רגע ונסו שוב, או העלו תמונה.',
                )
              : t(`Generation failed (${res.status})`, `יצירת התמונה נכשלה (${res.status})`);
        throw new Error(friendly);
      }
      setHeroUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('Unknown error', 'שגיאה לא ידועה');
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBreakdown = async () => {
    if (!name.en.trim()) {
      setError(
        t(
          'Enter a name first — the breakdown adapts to it.',
          'יש להזין שם תחילה — הפירוט מותאם אליו.'
        )
      );
      return;
    }
    setError(null);
    setGeneratingBreakdown(true);
    setLayerProgress(
      Object.fromEntries(SHARED_LAYERS.map((l) => [l.id, 'pending'] as const))
    );
    try {
      const res = await fetch('/api/generate-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name: name.en, tagline: tagline.en, category }),
      });
      if (!res.ok || !res.body) {
        const text = res.body ? await res.text() : t('No response body', 'אין גוף תגובה');
        throw new Error(t(`Server error: ${text.slice(0, 160)}`, `שגיאת שרת: ${text.slice(0, 160)}`));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const errors: string[] = [];
      let finalLayers: LayerConfig[] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const evt = JSON.parse(trimmed) as {
              event: string;
              id?: string;
              message?: string;
              layers?: LayerConfig[];
            };
            if (evt.event === 'layer-start' && evt.id) {
              setLayerProgress((p) => ({ ...p, [evt.id!]: 'in_progress' }));
            } else if (evt.event === 'layer-done' && evt.id) {
              setLayerProgress((p) => ({ ...p, [evt.id!]: 'done' }));
            } else if (evt.event === 'layer-error' && evt.id) {
              setLayerProgress((p) => ({ ...p, [evt.id!]: 'error' }));
              errors.push(`${evt.id}: ${evt.message ?? 'unknown'}`);
            } else if (evt.event === 'complete' && evt.layers) {
              finalLayers = evt.layers;
            }
          } catch {
            // skip malformed line
          }
        }
      }

      if (finalLayers) setBreakdownLayers(finalLayers);
      if (errors.length > 0) {
        setError(
          t(
            `Some layers failed: ${errors.join('; ')}. Defaults used as fallback.`,
            `חלק מהשכבות נכשלו: ${errors.join('; ')}. נעשה שימוש בברירות המחדל כגיבוי.`
          )
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('Unknown error', 'שגיאה לא ידועה');
      setError(msg);
    } finally {
      setGeneratingBreakdown(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.en.trim()) {
      setError(t('Name (English) is required.', 'שם (באנגלית) הוא שדה חובה.'));
      return;
    }
    if (!heroUrl) {
      setError(t('Generate or paste a hero image first.', 'יש ליצור או להדביק תמונה ראשית תחילה.'));
      return;
    }
    const cocktail: CocktailConfig = {
      slug,
      title: { en: name.en.trim(), he: name.he.trim() || name.en.trim() },
      subtitle: initial?.subtitle ?? { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
      tagline:
        tagline.en.trim() || tagline.he.trim()
          ? { en: tagline.en.trim(), he: tagline.he.trim() || tagline.en.trim() }
          : undefined,
      category,
      kind,
      course:
        kind === 'food' && (course.en.trim() || course.he.trim())
          ? { en: course.en.trim() || course.he.trim(), he: course.he.trim() || course.en.trim() }
          : undefined,
      priceILS: priceText.trim() ? Number(priceText.replace(/[^\d.]/g, '')) || undefined : undefined,
      heroImage: heroUrl,
      heroPrompt,
      flavor,
      bartenderNote: {
        en: bartenderNote.en.trim(),
        he: bartenderNote.he.trim() || bartenderNote.en.trim(),
      },
      bartenderName: bartenderName.trim() || undefined,
      dietary,
      layers: breakdownLayers ?? SHARED_LAYERS,
      labels: initial?.labels ?? SHARED_LAYERS.length
        ? (initial?.labels ?? [])
        : [],
    };
    await upsert(cocktail);
    onSaved();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Drink vs food — flips the cocktail-only fields (category, flavor radar) off for food. */}
      <div className="flex items-center gap-3">
        <span className="text-white/45 text-[11px] tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
          {t('Type', 'סוג')}
        </span>
        <div className="inline-flex rounded-full border border-white/12 bg-black/30 p-1">
          {(['drink', 'food'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`px-5 py-1.5 rounded-full text-[11px] tracking-[0.2em] uppercase transition-colors ${
                kind === k ? 'bg-amber-200 text-black' : 'text-white/55 hover:text-white'
              }`}
              style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
            >
              {k === 'drink' ? t('Drink', 'משקה') : t('Food', 'מנה')}
            </button>
          ))}
        </div>
      </div>

      <Section title={t('Name & tagline', 'שם וסלוגן')} icon={Type}>
        <Field label={t('Name (English) *', 'שם (באנגלית) *')}>
          <input
            value={name.en}
            onChange={(e) => setName({ ...name, en: e.target.value })}
            placeholder={t('e.g. Lavender Sour', 'לדוגמה: Lavender Sour')}
            dir="ltr"
            className={inputClass}
          />
        </Field>
        <Field label={t('Name (Hebrew)', 'שם (בעברית)')}>
          <input
            value={name.he}
            onChange={(e) => setName({ ...name, he: e.target.value })}
            placeholder="לדוגמה: סאוור לבנדר"
            dir="rtl"
            className={inputClass}
          />
        </Field>
        <Field label={t('Tagline (English)', 'סלוגן (באנגלית)')}>
          <input
            value={tagline.en}
            onChange={(e) => setTagline({ ...tagline, en: e.target.value })}
            placeholder="Gin · Lavender · Lemon · Egg white"
            dir="ltr"
            className={inputClass}
          />
        </Field>
        <Field label={t('Tagline (Hebrew)', 'סלוגן (בעברית)')}>
          <input
            value={tagline.he}
            onChange={(e) => setTagline({ ...tagline, he: e.target.value })}
            placeholder="ג׳ין · לבנדר · לימון · חלבון ביצה"
            dir="rtl"
            className={inputClass}
          />
        </Field>
        <Field label={t('Price (₪)', 'מחיר (₪)')}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder={t('e.g. 54', 'לדוגמה: 54')}
            dir="ltr"
            className={inputClass}
          />
        </Field>
        <p className="text-amber-200/60 text-[11px] tracking-wider">
          slug: <code className="text-amber-100/80" dir="ltr">{slug}</code>
          {slugTaken && (
            <span className="text-rose-300/80 mx-2">
              {t('(will overwrite existing draft)', '(ידרוס טיוטה קיימת)')}
            </span>
          )}
          {mode === 'edit' && (
            <span className="text-amber-100/60 mx-2">
              {t('(immutable in edit mode)', '(לא ניתן לעריכה במצב עריכה)')}
            </span>
          )}
        </p>
      </Section>

      <Section title={t('Category & dietary', 'קטגוריה ותזונה')} icon={Tags}>
        {kind === 'drink' ? (
          <Field label={t('Category', 'קטגוריה')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-black">
                  {CATEGORY_LABEL[c][lang]}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label={t('Menu section / course (English)', 'קטגוריה בתפריט (באנגלית)')}>
              <input
                value={course.en}
                onChange={(e) => setCourse({ ...course, en: e.target.value })}
                placeholder={t('e.g. Starters, Mains, Desserts', 'e.g. Starters, Mains, Desserts')}
                dir="ltr"
                className={inputClass}
              />
            </Field>
            <Field label={t('Menu section / course (Hebrew)', 'קטגוריה בתפריט (בעברית)')}>
              <input
                value={course.he}
                onChange={(e) => setCourse({ ...course, he: e.target.value })}
                placeholder={t('e.g. ראשונות, עיקריות, קינוחים', 'לדוגמה: ראשונות, עיקריות, קינוחים')}
                dir="rtl"
                className={inputClass}
              />
            </Field>
          </>
        )}
        {/* Not using <Field> here: it wraps THREE checkboxes (each already has its
            own correctly-associated <label>), and Field is now a <label> itself —
            nesting labels is unreliable (can make the browser toggle the wrong
            checkbox). Each checkbox keeps its own valid implicit label below;
            this group heading intentionally stays an unassociated <span>, same
            as before. */}
        <div>
          <span
            className="block text-white/55 text-[10px] tracking-[0.35em] uppercase mb-2"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            {t('Dietary flags', 'סימוני תזונה')}
          </span>
          <div className="flex flex-wrap gap-4 text-sm">
            {(['vegan', 'glutenFree', 'alcoholFree'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dietary[k]}
                  onChange={(e) => setDietary({ ...dietary, [k]: e.target.checked })}
                  className="accent-amber-300"
                />
                <span className="text-white/80 capitalize">{DIETARY_LABEL[k](t)}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      {kind === 'drink' && (<Section title={t('Flavor profile (0-5)', 'פרופיל טעם (0-5)')} icon={SlidersHorizontal}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {FLAVOR_AXES.map((axis) => (
            <Field key={axis} label={FLAVOR_LABEL[axis][lang]}>
              <input
                type="number"
                min={0}
                max={5}
                step={1}
                value={flavor[axis]}
                onChange={(e) =>
                  setFlavor({
                    ...flavor,
                    [axis]: Math.max(0, Math.min(5, Number(e.target.value))),
                  })
                }
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </Section>)}

      <Section title={kind === 'food' ? t('Chef note', 'הערת השף') : t('Bartender note', 'הערת הבארמן')} icon={Quote}>
        <Field label={t('Note (English)', 'הערה (באנגלית)')}>
          <textarea
            value={bartenderNote.en}
            onChange={(e) => setBartenderNote({ ...bartenderNote, en: e.target.value })}
            placeholder={t(
              "A single elegant line in the bartender's voice.",
              'משפט אחד אלגנטי בקול הבארמן.'
            )}
            rows={2}
            dir="ltr"
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label={t('Note (Hebrew)', 'הערה (בעברית)')}>
          <textarea
            value={bartenderNote.he}
            onChange={(e) => setBartenderNote({ ...bartenderNote, he: e.target.value })}
            placeholder="משפט אחד אלגנטי בקול הבארמן."
            rows={2}
            dir="rtl"
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label={t('Bartender name', 'שם הבארמן')}>
          <input
            value={bartenderName}
            onChange={(e) => setBartenderName(e.target.value)}
            placeholder={t('Daniel Cohen', 'דניאל כהן')}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title={t('Hero image · AI generate or upload', 'תמונה ראשית · יצירה ב-AI או העלאה')} icon={ImageIcon}>
        <Field label={t('Image prompt (for AI generation)', 'פרומפט לתמונה (ליצירה ב-AI)')}>
          <textarea
            value={heroPrompt}
            onChange={(e) => setHeroPrompt(e.target.value)}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </Field>

        {/* Ready-to-paste ChatGPT prompt — generate the photo in ChatGPT (DALL·E),
            then "Upload photo" below. Useful when the in-app generator is unavailable. */}
        <Field label={t('Make the image in ChatGPT', 'יצירת התמונה ב-ChatGPT')}>
          <textarea
            readOnly
            value={buildGptImagePrompt({ name: name.en || name.he, description: tagline.en || tagline.he })}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClass} resize-y text-white/70`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    buildGptImagePrompt({ name: name.en || name.he, description: tagline.en || tagline.he })
                  );
                  setGptCopied(true);
                  window.setTimeout(() => setGptCopied(false), 1800);
                } catch {
                  /* clipboard blocked — the field above is selectable as a fallback */
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-[11px] tracking-[0.3em] uppercase"
              style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
            >
              {gptCopied ? <Check size={13} strokeWidth={2.4} /> : <ClipboardCopy size={13} strokeWidth={2} />}
              {gptCopied ? t('Copied', 'הועתק') : t('Copy ChatGPT prompt', 'העתק פרומפט ל-ChatGPT')}
            </button>
            <span className="text-white/35 text-[11px] italic" style={{ fontFamily: 'var(--font-garamond, serif)' }}>
              {t('Paste in ChatGPT → download the PNG → Upload photo below.', 'הדביקו ב-ChatGPT → הורידו את ה-PNG → העלו למטה.')}
            </span>
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <motion.button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-200/60 text-amber-100 hover:bg-amber-200/10 transition-colors text-[11px] tracking-[0.3em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            <Lightbulb size={13} strokeWidth={2} />
            {generating
              ? t('Generating…', 'מייצר…')
              : heroUrl
                ? t('Regenerate hero', 'יצירה מחדש של התמונה')
                : t('Generate with AI', 'יצירה באמצעות AI')}
          </motion.button>
          <span className="text-white/40 text-xs">
            {t('Powered by Pollinations · ~10s · free', 'מופעל על ידי Pollinations · ~10 שניות · חינם')}
          </span>
          <span className="text-white/30 text-xs italic">{t('— or —', '— או —')}</span>
          <label
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-200/30 text-amber-100/80 hover:text-amber-100 hover:border-amber-200/60 cursor-pointer transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            <Upload size={13} strokeWidth={2} />
            {t('Upload photo', 'העלאת תמונה')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 4 * 1024 * 1024) {
                  setError(t('Image must be under 4MB.', 'התמונה חייבת להיות קטנה מ-4MB.'));
                  return;
                }
                setError(null);
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') {
                    setHeroUrl(reader.result);
                  }
                };
                reader.onerror = () => setError(t('Failed to read file.', 'קריאת הקובץ נכשלה.'));
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <span className="text-white/30 text-xs italic">{t('— or —', '— או —')}</span>
          <motion.button
            type="button"
            onClick={() => setMediaLibraryOpen(true)}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-200/30 text-amber-100/80 hover:text-amber-100 hover:border-amber-200/60 transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            <LibraryBig size={13} strokeWidth={2} />
            {t('Library', 'ספרייה')}
          </motion.button>
        </div>
        {heroUrl && (
          <div className="mt-6 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-full sm:w-56 shrink-0 rounded-2xl border border-amber-200/20 bg-black/40 p-3">
              <GlassImage src={heroUrl} accent={getAccent(slug)} className="w-full h-44" />
            </div>
            <div className="flex-1 text-sm text-white/55 italic" style={{ fontFamily: 'var(--font-garamond, serif)' }}>
              {mode === 'edit'
                ? t('Saved hero. ', 'תמונה שמורה. ')
                : t('Looks good? ', 'נראה טוב? ')}
              {t("Don't like it? Click ", 'לא אהבת? לחצו ')}
              <em>{t('Regenerate', 'יצירה מחדש')}</em>
              {t(' for a new variation.', ' לקבלת וריאציה חדשה.')}
            </div>
          </div>
        )}
      </Section>

      <Section title={t('3D Breakdown · 6-layer AI (optional)', 'פירוט תלת-ממד · 6 שכבות AI (אופציונלי)')} icon={Layers}>
        <p
          className="text-white/55 text-sm italic"
          style={{ fontFamily: 'var(--font-garamond, serif)' }}
        >
          {t(
            'Generates 6 unique layers (glass, splashes, ice, garnish) custom-tuned to this cocktail. Each layer goes through background removal so they composite cleanly in 3D.',
            'יוצר 6 שכבות ייחודיות (כוס, התזות, קרח, קישוט) המותאמות אישית לקוקטייל הזה. כל שכבה עוברת הסרת רקע כדי שיתמזגו בצורה נקייה בתלת-ממד.'
          )}{' '}
          <span className="text-amber-200/70">{t('~60-90 seconds total.', 'סך הכול ~60-90 שניות.')}</span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <motion.button
            type="button"
            onClick={handleGenerateBreakdown}
            disabled={generatingBreakdown}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-200/60 text-amber-100 hover:bg-amber-200/10 transition-colors text-[11px] tracking-[0.3em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
          >
            <Layers size={13} strokeWidth={2} />
            {generatingBreakdown
              ? t('Generating layers… please wait', 'מייצר שכבות… נא להמתין')
              : breakdownLayers
                ? t('Regenerate breakdown', 'יצירה מחדש של הפירוט')
                : t('Generate full breakdown', 'יצירת פירוט מלא')}
          </motion.button>
          {breakdownLayers && !generatingBreakdown && (
            <span className="text-emerald-300/80 text-[11px] tracking-wider uppercase">
              {t(
                `✓ ${breakdownLayers.length} layers ready`,
                `✓ ${breakdownLayers.length} שכבות מוכנות`
              )}
            </span>
          )}
        </div>
        {generatingBreakdown && (
          <div className="space-y-2">
            <div className="text-amber-200/60 text-sm italic">
              {t('Streaming progress · keep this tab open', 'התקדמות בזמן אמת · יש להשאיר את הכרטיסייה פתוחה')}
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {SHARED_LAYERS.map((l) => {
                const status = layerProgress[l.id] ?? 'pending';
                const color =
                  status === 'done'
                    ? 'text-emerald-300 border-emerald-400/40 bg-emerald-900/20'
                    : status === 'in_progress'
                      ? 'text-amber-100 border-amber-200/60 bg-amber-900/20 animate-pulse'
                      : status === 'error'
                        ? 'text-rose-300 border-rose-400/40 bg-rose-900/20'
                        : 'text-white/40 border-white/15';
                const icon =
                  status === 'done' ? '✓' : status === 'error' ? '×' : status === 'in_progress' ? '…' : '·';
                return (
                  <li
                    key={l.id}
                    className={`text-[10px] tracking-wider uppercase border rounded-md py-2 px-3 flex items-center gap-2 ${color}`}
                    style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
                  >
                    <span className="font-mono">{icon}</span>
                    <span>{l.id.replace(/_/g, ' ')}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {breakdownLayers && !generatingBreakdown && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
            {breakdownLayers.map((layer) => (
              <div
                key={layer.id}
                className="aspect-square rounded-lg border border-amber-200/15 bg-zinc-900/40 p-2 flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={layer.image}
                  alt={layer.id}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-900/15 px-4 py-3 text-rose-200/90 text-sm">
          {error}
        </p>
      )}

      <div className="pt-2 flex items-center gap-5">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-amber-200 text-black text-[12px] tracking-[0.3em] uppercase hover:bg-amber-100 hover:scale-[1.03] transition-all shadow-[0_18px_50px_-22px_rgba(251,191,36,0.9)]"
          style={{ fontFamily: 'var(--font-inter, sans-serif)', fontWeight: 600 }}
        >
          <Check size={14} strokeWidth={2.4} />
          {mode === 'edit' ? t('Save changes', 'שמירת שינויים') : t('Save cocktail', 'שמירת הקוקטייל')}
        </button>
        <Link
          href="/admin"
          className="text-white/50 hover:text-white/80 transition-colors text-[12px] tracking-[0.3em] uppercase"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {t('Cancel', 'ביטול')}
        </Link>
      </div>

      <MediaLibrary
        open={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={(url) => setHeroUrl(url)}
        lang={lang}
      />
    </form>
  );
}

const inputClass =
  'w-full rounded-xl bg-black/40 border border-white/12 outline-none text-white text-base py-2.5 px-3.5 transition-colors duration-300 placeholder:text-white/25 focus:border-amber-200/40 focus:bg-black/55';

type Translate = (en: string, he: string) => string;

const DIETARY_LABEL: Record<'vegan' | 'glutenFree' | 'alcoholFree', (t: Translate) => string> = {
  vegan: (t) => t('vegan', 'טבעוני'),
  glutenFree: (t) => t('gluten free', 'ללא גלוטן'),
  alcoholFree: (t) => t('alcohol free', 'ללא אלכוהול'),
};

function Section({ title, icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-7">
      <SectionLabel icon={icon}>{title}</SectionLabel>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-white/55 text-[10px] tracking-[0.35em] uppercase mb-2"
        style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
