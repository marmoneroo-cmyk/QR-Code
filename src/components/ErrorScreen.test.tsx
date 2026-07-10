// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorScreen } from '@/components/ErrorScreen';

// Unmount between tests (no vitest globals → no auto-cleanup registered).
afterEach(cleanup);
// ErrorScreen reads `document.documentElement.lang`; reset it so tests stay isolated.
afterEach(() => {
  document.documentElement.lang = '';
});

/**
 * ErrorScreen is the on-brand fallback for the App Router error boundaries + 404. It is
 * self-contained (language comes from <html lang>, no context) and uses next/link for the
 * "Back to menu" action — which renders a plain <a> in tests, so we assert on that anchor
 * (href="/") and never click it, avoiding any router dependency.
 */
describe('ErrorScreen', () => {
  it('default (error) renders the heading, a working retry button, and a back-to-menu link', () => {
    const reset = vi.fn();
    render(<ErrorScreen reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByText(/we hit an unexpected error/i)).toBeTruthy();

    const retry = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);

    const back = screen.getByRole('link', { name: /back to menu/i });
    expect(back.getAttribute('href')).toBe('/');
  });

  it('renders no retry button when reset is omitted (but keeps the back-to-menu link)', () => {
    render(<ErrorScreen />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: /back to menu/i })).toBeTruthy();
  });

  it('kind="notFound" renders the not-found copy and no retry button', () => {
    render(<ErrorScreen kind="notFound" />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByText(/the link may have changed/i)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads document.documentElement.lang and renders Hebrew copy when lang="he"', () => {
    document.documentElement.lang = 'he';
    render(<ErrorScreen />);
    expect(screen.getByRole('heading', { name: 'משהו השתבש' })).toBeTruthy();
  });

  it('shows a digest reference line when a digest is provided', () => {
    render(<ErrorScreen reset={() => {}} digest="abc123" />);
    expect(screen.getByText(/abc123/)).toBeTruthy();
  });
});
