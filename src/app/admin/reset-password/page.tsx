'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLang } from '@/lib/useLang';
import { GlassSheen } from '@/components/ui/visual';

/** Minimum we accept. Supabase's own floor is 6; a real operator account deserves more. */
const MIN_PASSWORD_LEN = 8;

/**
 * Where a recovery link lands. Supabase redirects here with a recovery session, the
 * browser client picks it up (detectSessionInUrl), and the owner sets their OWN password.
 *
 * Without this screen the recovery flow dead-ends: the link redirects to the site with a
 * session but nowhere to type a new password, so the operator is told to "reset" and then
 * shown nothing — which is exactly how an owner ends up locked out for good.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);

  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setChecking(false);
      return;
    }
    const sb = createClient();
    let cancelled = false;

    // The recovery session may land either already-parsed (getSession) or via the
    // PASSWORD_RECOVERY event as the client finishes reading the URL — handle both.
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
        setChecking(false);
      }
    });

    void sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setHasRecoverySession(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LEN) {
      setError(
        t(
          `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
          `הסיסמה חייבת להיות באורך ${MIN_PASSWORD_LEN} תווים לפחות.`,
        ),
      );
      return;
    }
    if (password !== confirm) {
      setError(t('The two passwords do not match.', 'שתי הסיסמאות אינן תואמות.'));
      return;
    }

    setSaving(true);
    try {
      const sb = createClient();
      const { error: updateError } = await sb.auth.updateUser({ password });
      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes('same')
            ? t('Choose a password different from the current one.', 'בחרו סיסמה שונה מהנוכחית.')
            : t('Could not update the password — the link may have expired.', 'לא הצלחנו לעדכן את הסיסמה — ייתכן שהקישור פג.'),
        );
        setSaving(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push('/admin');
        router.refresh();
      }, 1200);
    } catch {
      setError(t('Could not update the password.', 'לא הצלחנו לעדכן את הסיסמה.'));
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-white text-15 outline-none transition-colors duration-300 placeholder:text-white/30 focus:border-amber-200/50 focus:bg-white/[0.06]';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-6 text-white" dir={isHe ? 'rtl' : 'ltr'} lang={lang}>
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(80% 50% at 50% 20%, rgba(251,191,36,0.10), transparent 70%), linear-gradient(to bottom, #000, #0a0a0a)' }} />

      <div className="glass-panel relative z-10 w-full max-w-sm overflow-hidden rounded-3xl p-8">
        <GlassSheen />
        <div className="relative mb-8 text-center">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-amber-200/30 bg-amber-200/10 text-amber-200">
            {done ? <CheckCircle2 size={18} strokeWidth={1.8} /> : <KeyRound size={18} strokeWidth={1.8} />}
          </span>
          <p className="font-sans text-amber-200/70 text-10 tracking-[0.45em] uppercase">
            {t('Restaurant Admin', 'ניהול מסעדה')}
          </p>
          <h1 className="font-serif mt-3 text-3xl text-white" style={{ fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
            {done ? t('Password updated', 'הסיסמה עודכנה') : t('Choose a new password', 'בחרו סיסמה חדשה')}
          </h1>
        </div>

        {!configured ? (
          <p role="alert" className="font-sans relative text-center text-rose-300/90 text-13">
            {t('Supabase is not configured.', 'Supabase לא מוגדר.')}
          </p>
        ) : checking ? (
          <p className="font-sans relative flex items-center justify-center gap-2 text-white/50 text-13">
            <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
            {t('Checking your link…', 'בודקים את הקישור…')}
          </p>
        ) : done ? (
          <p className="font-sans relative text-center text-emerald-300/90 text-13">
            {t('Signing you in…', 'מתחברים…')}
          </p>
        ) : !hasRecoverySession ? (
          <div className="relative text-center">
            <p className="font-sans text-white/60 text-13 leading-relaxed">
              {t(
                'This reset link is invalid or has expired. Request a new one from the sign-in screen.',
                'קישור האיפוס אינו תקף או שפג תוקפו. בקשו חדש ממסך ההתחברות.',
              )}
            </p>
            <Link
              href="/admin/login"
              className="font-sans mt-6 inline-block text-amber-200/80 hover:text-amber-100 text-10 tracking-[0.3em] uppercase transition-colors"
            >
              {t('Back to sign in', 'חזרה להתחברות')}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="relative flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="font-sans mb-1.5 block text-white/45 text-11 tracking-wide">
                {t('New password', 'סיסמה חדשה')}
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                dir="ltr"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="font-sans mb-1.5 block text-white/45 text-11 tracking-wide">
                {t('Confirm password', 'אימות סיסמה')}
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                dir="ltr"
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="font-sans text-rose-300/90 text-13">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="font-sans group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full py-3.5 text-xs font-bold tracking-[0.28em] uppercase text-black transition-shadow disabled:opacity-50"
              style={{
                background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))',
                boxShadow: '0 10px 34px rgba(232, 201, 135, 0.26)',
              }}
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                {saving ? <Loader2 size={15} strokeWidth={2.2} className="animate-spin" /> : null}
                {saving ? t('Saving…', 'שומר…') : t('Save password', 'שמור סיסמה')}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
