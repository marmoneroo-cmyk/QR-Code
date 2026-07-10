// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReadinessNote } from './value';
import type { Readiness } from '@/lib/useReadiness';

// Unmount between tests (no vitest globals → no auto-cleanup registered).
afterEach(cleanup);

const notReady = (over: Partial<Readiness> = {}): Readiness => ({
  ready: false,
  consecutiveReadyDays: 3,
  requiredDays: 7,
  blockedBy: [],
  ...over,
});

/**
 * ReadinessNote is the shared "honesty caveat": when the dataset isn't ready it says the
 * findings are still preliminary (owner voice vs. expert voice), and it self-hides when the
 * data is ready or unknown. It renders a framer-motion div, which is a plain div in jsdom.
 */
describe('ReadinessNote', () => {
  it('owner tone: shows the still-learning caveat with the day progress', () => {
    render(<ReadinessNote readiness={notReady({ consecutiveReadyDays: 3, requiredDays: 7 })} lang="en" />);
    const note = screen.getByText(/still learning your guests/i);
    expect(note.textContent).toContain('day 3 of 7');
  });

  it('expert tone: shows the provisional-signal caveat with the ready-days ratio', () => {
    render(
      <ReadinessNote
        readiness={notReady({ consecutiveReadyDays: 2, requiredDays: 5 })}
        lang="en"
        tone="expert"
      />,
    );
    const note = screen.getByText(/engine findings are still provisional/i);
    expect(note.textContent).toContain('2/5 ready days');
  });

  it('renders the Hebrew owner copy when lang="he"', () => {
    render(<ReadinessNote readiness={notReady()} lang="he" />);
    expect(screen.getByText(/עדיין לומדים את האורחים שלכם/)).toBeTruthy();
  });

  it('renders nothing when the readiness is ready', () => {
    const { container } = render(<ReadinessNote readiness={notReady({ ready: true })} lang="en" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when readiness is null', () => {
    const { container } = render(<ReadinessNote readiness={null} lang="en" />);
    expect(container.firstChild).toBeNull();
  });
});
