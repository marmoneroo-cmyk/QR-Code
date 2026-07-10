'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ErrorScreen';

/**
 * Admin-segment error boundary. A crash in one admin screen shows this graceful fallback
 * (with retry) rather than white-screening the operator mid-shift. Logged for triage.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin-error]', error);
  }, [error]);
  return <ErrorScreen reset={reset} digest={error.digest} />;
}
