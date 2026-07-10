'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ErrorScreen';

/**
 * Route-level error boundary. Catches uncaught render/runtime errors in any page under
 * the root layout (public menu + admin) and shows a graceful, retryable fallback instead
 * of a white screen. The error is logged (Vercel captures it; Next records the digest).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route-error]', error);
  }, [error]);
  return <ErrorScreen reset={reset} digest={error.digest} />;
}
