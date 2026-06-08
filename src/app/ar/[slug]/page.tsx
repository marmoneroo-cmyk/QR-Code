'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { findCocktailBySlug } from '@/data/cocktail';
import { useLang } from '@/lib/useLang';

interface PageProps {
  params: Promise<{ slug: string }>;
}

type Status = 'starting' | 'ready' | 'denied' | 'unsupported';

export default function ArPage({ params }: PageProps) {
  const { slug } = use(params);
  const cocktail = findCocktailBySlug(slug);
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [error, setError] = useState<string | null>(null);

  // Cocktail transform state (scale + position offset from center)
  const [scale, setScale] = useState(0.7);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureStartRef = useRef<{ scale: number; pos: { x: number; y: number }; distance: number; midpoint: { x: number; y: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        setError('Camera is not supported in this browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('denied');
          setError('Camera access denied.');
        } else {
          setStatus('unsupported');
          setError(err instanceof Error ? err.message : 'Camera failed.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
    };
  }, []);

  // Pointer gesture handlers (drag + pinch)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      gestureStartRef.current = {
        scale,
        pos: { ...pos },
        distance,
        midpoint: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 },
      };
    }
  }, [pos, scale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const prev = pointersRef.current.get(e.pointerId)!;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      // single-finger drag → move cocktail
      setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (pointersRef.current.size === 2 && gestureStartRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const ratio = distance / gestureStartRef.current.distance;
      const newScale = Math.max(0.3, Math.min(2.5, gestureStartRef.current.scale * ratio));
      setScale(newScale);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      gestureStartRef.current = null;
    }
  }, []);

  const handleSnap = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cocktail) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Cover-draw the camera frame (match the on-screen object-cover video).
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    const vRatio = vw / vh;
    const sRatio = w / h;
    let dw = w;
    let dh = h;
    let dx = 0;
    let dy = 0;
    if (vRatio > sRatio) {
      dh = h;
      dw = h * vRatio;
      dx = (w - dw) / 2;
    } else {
      dw = w;
      dh = w / vRatio;
      dy = (h - dh) / 2;
    }
    ctx.drawImage(video, dx, dy, dw, dh);

    // Draw the hero matching the on-screen transform (max 80vw/80vh × scale).
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ar = img.naturalWidth / img.naturalHeight;
        let hh = h * 0.8 * scale;
        let ww = hh * ar;
        const maxW = w * 0.8 * scale;
        if (ww > maxW) {
          ww = maxW;
          hh = ww / ar;
        }
        const cx = w / 2 + pos.x;
        const cy = h / 2 + pos.y;
        ctx.drawImage(img, cx - ww / 2, cy - hh / 2, ww, hh);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = cocktail.heroImage;
    });

    // Branded watermark (cocktail name) for shareable, recognisable captures.
    ctx.font = `600 ${Math.round(w * 0.05)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(cocktail.title[lang], w / 2, h - 44);
    ctx.shadowBlur = 0;

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `${cocktail.slug}-ar.png`, { type: 'image/png' });

    // Mobile: native share sheet (save to camera roll / Instagram / WhatsApp).
    // Desktop or unsupported: download.
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: cocktail.title[lang] });
        return;
      } catch {
        // user cancelled the share sheet — fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cocktail.slug}-ar.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, [cocktail, scale, pos, lang]);

  if (!cocktail) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-8 text-center" dir={isHebrew ? 'rtl' : 'ltr'}>
        <p className="text-amber-200/70 text-[10px] tracking-[0.4em] uppercase mb-3">{t('AR not available', 'AR לא זמין')}</p>
        <h1 className="text-2xl mb-6" style={{ fontFamily: isHebrew ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)', fontStyle: isHebrew ? 'normal' : 'italic' }}>
          {t(`Cocktail “${slug}” not found`, `הקוקטייל “${slug}” לא נמצא`)}
        </h1>
        <Link
          href="/"
          className="px-5 py-2 rounded-full border border-amber-200/40 text-amber-100 text-[11px] tracking-[0.3em] uppercase"
        >
          {t('Back to menu', 'חזרה לתפריט')}
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black text-white overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />

      {/* Cocktail hero — centered + drag/pinch transform */}
      {status === 'ready' && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cocktail.heroImage}
            alt={cocktail.title.en}
            className="max-h-[80vh] max-w-[80vw] drop-shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
          />
        </div>
      )}

      <Link
        href={`/cocktails/${cocktail.slug}`}
        className="absolute top-5 right-5 z-30 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-amber-200/40 text-amber-100 hover:text-white flex items-center justify-center text-lg"
        aria-label="Exit AR"
      >
        ×
      </Link>

      <div className="absolute top-6 start-6 z-30" dir={isHebrew ? 'rtl' : 'ltr'}>
        <p
          className="text-amber-200/85 text-[10px] tracking-[0.45em] uppercase mb-1"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {t('AR · Live', 'AR · חי')}
        </p>
        <h1
          className="text-white text-2xl drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"
          style={{
            fontFamily: isHebrew ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)',
            fontStyle: isHebrew ? 'normal' : 'italic',
          }}
        >
          {cocktail.title[lang]}
        </h1>
      </div>

      <div className="absolute bottom-10 left-0 right-0 z-30 flex items-center justify-center gap-4 px-6">
        {status === 'ready' && (
          <>
            <button
              type="button"
              onClick={handleSnap}
              className="px-6 py-3 rounded-full bg-amber-200 text-black text-[11px] tracking-[0.3em] uppercase shadow-[0_10px_30px_rgba(252,211,77,0.4)]"
              style={{ fontFamily: 'var(--font-inter, sans-serif)', fontWeight: 600 }}
            >
              {t('📸 Capture', '📸 צלם')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPos({ x: 0, y: 0 });
                setScale(0.7);
              }}
              className="px-5 py-2.5 rounded-full border border-amber-200/40 bg-black/40 backdrop-blur-md text-amber-100 text-[10px] tracking-[0.3em] uppercase"
              style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
            >
              {t('Reset', 'איפוס')}
            </button>
          </>
        )}
        {status === 'starting' && (
          <p className="text-amber-200/70 text-sm">{t('Starting camera…', 'מפעיל מצלמה…')}</p>
        )}
        {status === 'denied' && (
          <div className="text-center">
            <p className="text-rose-300/90 text-sm mb-3">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-amber-200/80 text-[11px] tracking-[0.3em] uppercase underline"
            >
              {t('Retry', 'נסה שוב')}
            </button>
          </div>
        )}
        {status === 'unsupported' && (
          <p className="text-rose-300/90 text-sm text-center">{error}</p>
        )}
      </div>

      {status === 'ready' && (
        <p
          className="absolute bottom-28 left-0 right-0 z-30 text-center text-white/60 text-[10px] tracking-[0.3em] uppercase select-none"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {t('Drag to move · Pinch to scale', 'גרור להזזה · צבוט לשינוי גודל')}
        </p>
      )}
    </div>
  );
}
