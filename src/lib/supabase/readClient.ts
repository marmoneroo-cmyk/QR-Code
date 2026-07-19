import 'server-only';
import { createAdminSupabase, createServerSupabase, type SupabaseServerClient } from './server';

/**
 * Client for tenant-scoped READS. Flag-gated: when RLS_ENFORCED_READS==='true' it uses the
 * cookie-scoped client so RLS policies enforce per-user; otherwise the service-role client
 * (current behavior). Flip the env flag AFTER the RLS read policies (migration 0013) are
 * applied and verified against the DB. WRITES keep passing their own scoped `db`.
 */
export async function readClient(): Promise<SupabaseServerClient> {
  return process.env.RLS_ENFORCED_READS === 'true'
    ? await createServerSupabase()
    : createAdminSupabase();
}
