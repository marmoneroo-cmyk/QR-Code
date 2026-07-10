// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Home, BarChart3, Users } from 'lucide-react';
import { AdminTabs, type AdminTabDef } from './AdminTabs';

// Unmount between tests (no vitest globals → no auto-cleanup registered).
afterEach(cleanup);
// AdminTabs' language comes from useLang, which hydrates from localStorage; keep it 'en'.
beforeEach(() => window.localStorage.clear());

const tabs: AdminTabDef[] = [
  { id: 'today', en: 'Today', he: 'היום', icon: Home, Panel: () => <p>Today panel</p> },
  { id: 'results', en: 'Results', he: 'תוצאות', icon: BarChart3, Panel: () => <p>Results panel</p> },
  { id: 'guests', en: 'Guests', he: 'אורחים', icon: Users, Panel: () => <p>Guests panel</p> },
];

/**
 * AdminTabs is the shared segmented tab-switcher. It reads language from useLang (which
 * defaults to 'en', no provider needed) and lazily mounts ONLY the active tab's panel.
 * Assertions target real ARIA (tablist / tab / tabpanel + aria-selected) and the lazy swap.
 */
describe('AdminTabs', () => {
  it('renders a tablist with the first tab selected and only its panel mounted', () => {
    render(<AdminTabs tabs={tabs} />);

    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons).toHaveLength(3);
    expect(tabButtons[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabButtons[1]?.getAttribute('aria-selected')).toBe('false');

    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByText('Today panel')).toBeTruthy();
    // inactive panels are NOT mounted (lazy per-tab mount)
    expect(screen.queryByText('Results panel')).toBeNull();
  });

  it('switches aria-selected and lazily mounts the panel when another tab is clicked', () => {
    render(<AdminTabs tabs={tabs} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Results' }));

    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons[0]?.getAttribute('aria-selected')).toBe('false');
    expect(tabButtons[1]?.getAttribute('aria-selected')).toBe('true');

    expect(screen.getByText('Results panel')).toBeTruthy();
    expect(screen.queryByText('Today panel')).toBeNull();
  });

  it('honours the `initial` prop for the starting tab', () => {
    render(<AdminTabs tabs={tabs} initial="guests" />);
    expect(screen.getByRole('tab', { name: 'Guests' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Guests panel')).toBeTruthy();
  });

  it('moves selection with the ArrowRight key (LTR roving tabs)', () => {
    render(<AdminTabs tabs={tabs} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Results' }).getAttribute('aria-selected')).toBe('true');
  });
});
