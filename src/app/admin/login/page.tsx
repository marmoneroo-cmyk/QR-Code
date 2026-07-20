'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLang } from '@/lib/useLang';
import { GlassSheen } from '@/components/ui/visual';

/** Supabase Auth returns raw English error messages — map the common ones to a
 *  bilingual string instead of showing English verbatim in Hebrew mode; anything
 *  unrecognized falls back to a generic translated message rather than leaking
 *  the raw text. */
function authErrorMessage(raw: string, t: (en: string, he: string) => string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) return t('Incorrect email or password.', 'אימייל או סיסמה שגויים.');
  if (msg.includes('email not confirmed')) return t('Please confirm your email first.', 'יש לאשר את כתובת האימייל תחילה.');
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return t('Too many attempts — try again shortly.', 'יותר מדי ניסיונות — נסו שוב בעוד רגע.');
  }
  return t('Sign-in failed.', 'ההתחברות נכשלה.');
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const configured = isSupabaseConfigured();

  /**
   * Send a recovery mail pointing at /admin/reset-password. The confirmation is
   * deliberately identical whether or not the address exists — otherwise this form
   * becomes an oracle for which emails have accounts.
   */
  const onForgotPassword = async () => {
    const target = email.trim();
    if (!configured) {
      setError(t('Supabase is not configured.', 'Supabase לא מוגדר.'));
      return;
    }
    if (!target) {
      setError(t('Enter your email first, then choose “Forgot password”.', 'הזינו אימייל תחילה, ואז בחרו "שכחתי סיסמה".'));
      return;
    }
    setSendingReset(true);
    setError(null);
    try {
      const sb = createClient();
      await sb.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      setResetSent(true);
    } catch {
      setError(t('Could not send the reset email.', 'לא הצלחנו לשלוח את מייל האיפוס.'));
    } finally {
      setSendingReset(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setError(t('Supabase is not configured.', 'Supabase לא מוגדר.'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sb = createClient();
      const { error: signInError } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        setError(authErrorMessage(signInError.message, t));
        setLoading(false);
        return;
      }
      const next = search.get('next') || '/admin';
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? authErrorMessage(err.message, t) : t('Sign-in failed.', 'ההתחברות נכשלה.'));
      setLoading(false);
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
            <Lock size={18} strokeWidth={1.8} />
          </span>
          <p className="font-sans text-amber-200/70 text-10 tracking-[0.45em] uppercase">
            {t('Restaurant Admin', 'ניהול מסעדה')}
          </p>
          <h1
            className="font-serif mt-3 text-3xl text-white"
            style={{ fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
          >
            {t('Sign in', 'התחברות')}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="relative flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="font-sans mb-1.5 block text-white/45 text-11 tracking-wide">
              {t('Email', 'אימייל')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              dir="ltr"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="font-sans mb-1.5 block text-white/45 text-11 tracking-wide">
              {t('Password', 'סיסמה')}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

          {resetSent && (
            <p role="status" className="font-sans text-emerald-300/90 text-13 leading-relaxed">
              {t(
                'If that email has an account, a reset link is on its way. Open it to choose a new password.',
                'אם קיים חשבון לאימייל הזה, נשלח אליו קישור לאיפוס. פתחו אותו כדי לבחור סיסמה חדשה.',
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="font-sans group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full py-3.5 text-xs font-bold tracking-[0.28em] uppercase text-black transition-shadow disabled:opacity-50"
            style={{
              background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))',
              boxShadow: '0 10px 34px rgba(232, 201, 135, 0.26)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 -start-1/2 w-1/3 -skew-x-12 opacity-0 transition-all duration-700 group-hover:start-[120%] group-hover:opacity-60"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              {loading ? <Loader2 size={15} strokeWidth={2.2} className="animate-spin" /> : null}
              {loading ? t('Signing in…', 'מתחבר…') : t('Sign in', 'התחבר')}
            </span>
          </button>
        </form>

        <div className="relative mt-6 text-center">
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={sendingReset}
            className="font-sans text-white/45 hover:text-amber-200/80 text-11 tracking-wide underline underline-offset-4 transition-colors disabled:opacity-50"
          >
            {sendingReset ? t('Sending…', 'שולח…') : t('Forgot password?', 'שכחתם סיסמה?')}
          </button>
        </div>

        <div className="relative mt-6 text-center">
          <Link href="/" className="font-sans text-white/70 hover:text-white/90 text-10 tracking-[0.3em] uppercase transition-colors">
            {t('← Back to menu', '→ חזרה לתפריט')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginForm />
    </Suspense>
  );
}
