'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Top-bar auth indicator: shows a Log-out control when a Supabase session exists,
 * and renders nothing otherwise — so while auth is OFF (no session) the admin bar
 * is unchanged. Safe to mount everywhere.
 */
export function AuthStatus({ lang }: { lang: 'en' | 'he' }) {
  const router = useRouter();
  const isHe = lang === 'he';
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    let active = true;
    sb.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) return null;

  const logout = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={logout}
      title={email}
      className="font-sans inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-9 tracking-[0.15em] uppercase text-white/55 transition-colors hover:text-white/90"
    >
      <LogOut size={12} strokeWidth={1.8} />
      <span className="hidden sm:inline">{isHe ? 'יציאה' : 'Log out'}</span>
    </button>
  );
}
