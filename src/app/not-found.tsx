import { ErrorScreen } from '@/components/ErrorScreen';

/** Branded 404 — a graceful, on-brand fallback with a route back to the menu. */
export default function NotFound() {
  return <ErrorScreen kind="notFound" />;
}
