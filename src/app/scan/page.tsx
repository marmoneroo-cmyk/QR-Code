'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';

interface ScanResult {
  data: string;
}

export default function ScanPage() {
  const router = useRouter();
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop(): void; destroy(): void } | null>(null);
  // Use a ref (not state) for the navigating guard so handleScan stays stable —
  // otherwise it changes identity on every status change, and the camera effect
  // tears down + recreates the scanner the instant it starts (camera "exits").
  const navigatingRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'unsupported' | 'navigating'>('starting');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(
    (raw: string) => {
      if (navigatingRef.current) return;
      setLastResult(raw);
      try {
        const url = new URL(raw, window.location.origin);
        const path = `${url.pathname}${url.search}`;
        // Accept either same-origin URLs or app-relative paths
        const isSameOrigin = url.origin === window.location.origin || raw.startsWith('/');
        if (isSameOrigin && (path.startsWith('/cocktails/') || path.startsWith('/drafts/') || path.startsWith('/ar/'))) {
          navigatingRef.current = true;
          setStatus('navigating');
          scannerRef.current?.stop();
          router.push(path);
        }
      } catch {
        // Not a URL — ignore and keep scanning
      }
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        setError(t('Camera is not supported in this browser.', 'המצלמה אינה נתמכת בדפדפן זה.'));
        return;
      }

      try {
        const mod = await import('qr-scanner');
        const QrScanner = (mod.default ?? (mod as unknown as typeof mod.default)) as typeof import('qr-scanner').default;

        if (cancelled || !videoRef.current) return;

        const scanner = new QrScanner(
          videoRef.current,
          (result: ScanResult) => handleScan(result.data),
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment',
          }
        );

        await scanner.start();
        scannerRef.current = scanner;
        setStatus('scanning');
      } catch (err: unknown) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('denied');
          setError(t('Camera permission was denied. Allow camera access and reload.', 'הגישה למצלמה נדחתה. אשרו גישה למצלמה וטענו מחדש.'));
        } else {
          setStatus('unsupported');
          setError(err instanceof Error ? err.message : t('Camera failed to start.', 'המצלמה נכשלה בהפעלה.'));
        }
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [handleScan]);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

      <Link
        href="/"
        className="absolute top-5 end-5 z-30 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-amber-200/40 text-amber-100 hover:text-white flex items-center justify-center text-lg"
        aria-label={t('Cancel scan', 'ביטול סריקה')}
      >
        ×
      </Link>

      <div className="absolute top-6 start-6 z-30" dir={isHebrew ? 'rtl' : 'ltr'}>
        <p
          className="text-amber-200/85 text-10 tracking-[0.45em] uppercase mb-1 font-sans"
        >
          {t('Scan', 'סריקה')}
        </p>
        <h1
          className="text-white text-2xl font-serif"
          style={{
            fontStyle: isHebrew ? 'normal' : 'italic',
          }}
        >
          {t('Point at a QR', 'כוונו לקוד QR')}
        </h1>
      </div>

      <div className="absolute bottom-10 left-0 right-0 z-30 text-center px-6" aria-live="polite" dir={isHebrew ? 'rtl' : 'ltr'}>
        {status === 'starting' && (
          <p className="text-amber-200/70 text-sm">{t('Starting camera…', 'מפעיל מצלמה…')}</p>
        )}
        {status === 'scanning' && (
          <p
            className="text-white/70 text-11 tracking-[0.3em] uppercase font-sans"
          >
            {t('Looking for a code…', 'מחפש קוד…')}
          </p>
        )}
        {status === 'navigating' && (
          <p className="text-emerald-300/90 text-sm italic">{t('✓ Found — opening…', '✓ נמצא — פותח…')}</p>
        )}
        {status === 'denied' && (
          <div className="space-y-2">
            <p className="text-rose-300/90 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-amber-200/80 text-11 tracking-[0.3em] uppercase underline"
            >
              {t('Retry', 'נסה שוב')}
            </button>
          </div>
        )}
        {status === 'unsupported' && (
          <p className="text-rose-300/90 text-sm">{error ?? t('Camera unavailable.', 'המצלמה אינה זמינה.')}</p>
        )}
        {lastResult && status === 'scanning' && (
          <p className="mt-3 text-white/60 text-xs italic break-all">
            {t('Last seen: ', 'נצפה לאחרונה: ')}{lastResult.slice(0, 80)}
            {lastResult.length > 80 ? '…' : ''}
            {' '}{t('— not a menu link', '— לא קישור לתפריט')}
          </p>
        )}
      </div>
    </div>
  );
}
