'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. See supabase/README.md.'
    );
  }

  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
