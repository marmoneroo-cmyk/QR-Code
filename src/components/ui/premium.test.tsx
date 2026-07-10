// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmptyState, ErrorState } from './premium';

// Unmount between tests so queries don't see a previous test's DOM (no vitest globals set,
// so Testing Library's automatic afterEach-cleanup isn't registered — do it explicitly).
afterEach(cleanup);

/**
 * First UI-layer test — establishes React component testing (jsdom + Testing Library) on
 * top of the existing node-env suite. Covers the shared ErrorState primitive that 11 admin
 * screens rely on to distinguish a failure from an empty state.
 */
describe('ErrorState', () => {
  it('renders as an alert with the title + hint', () => {
    render(<ErrorState title="Couldn’t load" hint="Check your connection" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Couldn’t load')).toBeTruthy();
    expect(screen.getByText('Check your connection')).toBeTruthy();
  });

  it('shows a retry button only when onRetry is provided, and fires it on click', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Failed" onRetry={onRetry} retryLabel="Try again" />);
    const btn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders no retry button when onRetry is omitted', () => {
    render(<ErrorState title="Failed" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders the title (and is NOT an alert — distinct from ErrorState)', () => {
    render(<EmptyState title="No data yet" hint="It appears once guests arrive" />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
