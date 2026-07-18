'use client';

/**
 * MediaLibrary — Figma/Lightroom-style hero image picker.
 *
 * Self-contained, presentation-only overlay. Replaces the "basic file picker"
 * feel with a searchable, tabbed library sourced from the built-in menu,
 * saved drafts, freshly uploaded files, and recently-used images.
 *
 * No new dependencies; no API/tracking changes. Purely additive — the parent
 * decides what happens with the selected URL via `onSelect`.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImageOff, Search, Upload, X } from 'lucide-react';
import { MENU } from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';

export interface MediaLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  lang: 'en' | 'he';
}

type SourceTab = 'menu' | 'drafts' | 'upload' | 'recent';

interface MediaItem {
  url: string;
  titleEn: string;
  titleHe: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB — matches the app-wide hero image limit.
const RECENT_STORAGE_KEY = 'cocktail-demo:media-recent';
const RECENT_MAX_ITEMS = 12;
// Skip caching data: URLs bigger than ~200KB in localStorage to avoid quota blowups.
const RECENT_DATA_URL_SKIP_LENGTH = 200_000;

/** Read the recent-urls list from localStorage. SSR-safe; never throws. */
function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Record a newly-selected url into the recent list (most-recent-first, deduped, capped). */
function pushRecent(url: string): string[] {
  if (typeof window === 'undefined') return [];
  if (url.startsWith('data:') && url.length > RECENT_DATA_URL_SKIP_LENGTH) {
    // Too large to persist safely — just return the existing list unchanged.
    return readRecent();
  }
  try {
    const existing = readRecent().filter((u) => u !== url);
    const next = [url, ...existing].slice(0, RECENT_MAX_ITEMS);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    // Quota / private mode — never block selection on this.
    return readRecent();
  }
}

const TAB_LABEL: Record<SourceTab, (he: boolean) => string> = {
  menu: (he) => (he ? 'תפריט' : 'Menu'),
  drafts: (he) => (he ? 'טיוטות' : 'Drafts'),
  upload: (he) => (he ? 'העלאה' : 'Upload'),
  recent: (he) => (he ? 'אחרונים' : 'Recent'),
};

const TAB_ORDER: SourceTab[] = ['menu', 'drafts', 'upload', 'recent'];

export function MediaLibrary({ open, onClose, onSelect, lang }: MediaLibraryProps) {
  const isHebrew = lang === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const { drafts } = useDrafts();
  const [tab, setTab] = useState<SourceTab>('menu');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Refresh recent list + reset transient state whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setQuery('');
    setUploadError(null);
    setIsDragActive(false);
  }, [open]);

  // Escape closes the modal while open.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus management: move focus into the dialog on open, restore it on close.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
    } else {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  // Trap Tab focus within the dialog while open.
  useEffect(() => {
    if (!open) return;
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleTabTrap);
    return () => window.removeEventListener('keydown', handleTabTrap);
  }, [open]);

  const menuItems: MediaItem[] = useMemo(
    () =>
      MENU.map((item) => ({
        url: item.heroImage,
        titleEn: item.title.en,
        titleHe: item.title.he,
      })).filter((item) => item.url),
    []
  );

  const draftItems: MediaItem[] = useMemo(
    () =>
      drafts
        .map((d) => ({ url: d.heroImage, titleEn: d.title.en, titleHe: d.title.he }))
        .filter((item) => item.url),
    [drafts]
  );

  const recentItems: MediaItem[] = useMemo(
    () =>
      recent.map((url) => {
        const fromMenu = menuItems.find((m) => m.url === url);
        const fromDrafts = draftItems.find((m) => m.url === url);
        const match = fromMenu ?? fromDrafts;
        return {
          url,
          titleEn: match?.titleEn ?? t('Recent upload', 'העלאה אחרונה'),
          titleHe: match?.titleHe ?? 'העלאה אחרונה',
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recent, menuItems, draftItems]
  );

  const activeItems: MediaItem[] =
    tab === 'menu' ? menuItems : tab === 'drafts' ? draftItems : tab === 'recent' ? recentItems : [];

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter(
      (item) => item.titleEn.toLowerCase().includes(q) || item.titleHe.includes(q)
    );
  }, [activeItems, query]);

  const commitSelection = (url: string) => {
    if (!url) return;
    setRecent(pushRecent(url));
    onSelect(url);
    onClose();
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError(t('Please choose an image file.', 'יש לבחור קובץ תמונה.'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t('Image must be under 4MB.', 'התמונה חייבת להיות קטנה מ-4MB.'));
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        commitSelection(reader.result);
      }
    };
    reader.onerror = () => setUploadError(t('Failed to read file.', 'קריאת הקובץ נכשלה.'));
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="media-library-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          style={{ background: 'rgba(3,3,4,0.92)', backdropFilter: 'blur(20px)' }}
          dir={dir}
          onClick={onClose}
        >
          <motion.div
            key="media-library-panel"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('Media Library', 'ספריית מדיה')}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.36, ease: EASE }}
            className="relative w-full max-w-5xl h-full max-h-[88vh] rounded-3xl border border-white/10 bg-[#08080a] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="shrink-0 border-b border-white/[0.08] bg-[#08080a]/95 backdrop-blur px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <h2
                  className="text-xl sm:text-2xl text-amber-50/95"
                  style={{
                    fontFamily: isHebrew
                      ? 'var(--font-frank-ruhl, serif)'
                      : 'var(--font-playfair, serif)',
                  }}
                >
                  {t('Media Library', 'ספריית מדיה')}
                </h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label={t('Close', 'סגירה')}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/12 text-white/60 hover:text-white hover:border-amber-200/40 transition-colors"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Filter chips */}
                <div
                  className="inline-flex flex-wrap gap-2"
                  role="tablist"
                  aria-label={t('Media source', 'מקור מדיה')}
                >
                  {TAB_ORDER.map((tabKey) => (
                    <button
                      key={tabKey}
                      type="button"
                      role="tab"
                      id={`media-tab-${tabKey}`}
                      aria-selected={tab === tabKey}
                      aria-controls="media-library-panel"
                      onClick={() => setTab(tabKey)}
                      className={`px-4 py-1.5 rounded-full text-11 tracking-[0.2em] uppercase border transition-colors ${
                        tab === tabKey
                          ? 'bg-amber-200 text-black border-amber-200'
                          : 'text-white/55 border-white/12 hover:text-amber-100 hover:border-amber-200/40'
                      }`}
                      style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
                    >
                      {TAB_LABEL[tabKey](isHebrew)}
                    </button>
                  ))}
                </div>

                {/* Search */}
                {tab !== 'upload' && (
                  <div className="relative flex-1 sm:max-w-xs sm:ms-auto">
                    <Search
                      size={14}
                      strokeWidth={2}
                      className="absolute top-1/2 -translate-y-1/2 start-3 text-white/35 pointer-events-none"
                    />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('Search…', 'חיפוש…')}
                      aria-label={t('Search…', 'חיפוש…')}
                      dir={dir}
                      className="w-full rounded-full bg-black/40 border border-white/12 outline-none text-white text-sm py-2 ps-9 pe-3.5 transition-colors duration-300 placeholder:text-white/25 focus:border-amber-200/40 focus:bg-black/55"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div
              id="media-library-panel"
              role="tabpanel"
              aria-labelledby={`media-tab-${tab}`}
              className="flex-1 overflow-y-auto px-6 py-6 sm:px-8"
            >
              {tab === 'upload' ? (
                <UploadPane
                  isDragActive={isDragActive}
                  uploadError={uploadError}
                  t={t}
                  fileInputRef={fileInputRef}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={handleDrop}
                  onInputChange={handleInputChange}
                />
              ) : filteredItems.length === 0 ? (
                <EmptyState t={t} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredItems.map((item, idx) => (
                    <MediaThumb
                      key={`${item.url}-${idx}`}
                      item={item}
                      isHebrew={isHebrew}
                      onClick={() => commitSelection(item.url)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MediaThumb({
  item,
  isHebrew,
  onClick,
}: {
  item: MediaItem;
  isHebrew: boolean;
  onClick: () => void;
}) {
  const displayName = isHebrew ? item.titleHe || item.titleEn : item.titleEn || item.titleHe;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square rounded-2xl border border-white/10 overflow-hidden bg-black/40 transition-all duration-300 hover:border-amber-200/40 hover:scale-[1.02]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={displayName}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className="absolute inset-x-0 bottom-0 px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <p
          className="text-white text-xs truncate"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {displayName}
        </p>
      </div>
    </button>
  );
}

function EmptyState({ t }: { t: (en: string, he: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="w-12 h-12 rounded-full border border-white/12 flex items-center justify-center text-white/30">
        <ImageOff size={20} strokeWidth={1.5} />
      </div>
      <p className="text-white/45 text-sm" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
        {t('No images found', 'לא נמצאו תמונות')}
      </p>
    </div>
  );
}

function UploadPane({
  isDragActive,
  uploadError,
  t,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onInputChange,
}: {
  isDragActive: boolean;
  uploadError: string | null;
  t: (en: string, he: string) => string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px]">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`w-full max-w-md rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-300 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center ${
          isDragActive
            ? 'border-amber-200/60 bg-amber-200/[0.06]'
            : 'border-white/15 bg-white/[0.02] hover:border-amber-200/30'
        }`}
      >
        <div className="w-12 h-12 rounded-full border border-amber-200/30 flex items-center justify-center text-amber-100/80">
          <Upload size={18} strokeWidth={2} />
        </div>
        <div>
          <p className="text-white/85 text-sm" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
            {t('Drag & drop an image here', 'גררו תמונה לכאן')}
          </p>
          <p className="text-white/70 text-xs mt-1" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
            {t('or click to browse · up to 4MB', 'או לחצו לבחירה · עד 4MB')}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={onInputChange}
        />
      </div>
      {uploadError && (
        <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-900/15 px-4 py-2.5 text-rose-200/90 text-sm">
          {uploadError}
        </p>
      )}
    </div>
  );
}
