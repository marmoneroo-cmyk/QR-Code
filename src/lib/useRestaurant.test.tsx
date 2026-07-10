// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useRestaurant } from './useRestaurant';

const NAME_KEY = 'cocktail-demo:restaurant-name';
const LOGO_KEY = 'cocktail-demo:restaurant-logo';

// Unmount the hook and clear the shared localStorage between tests so hydration in one
// test can't bleed into the next.
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useRestaurant', () => {
  it('defaults to name "Diner" and an empty logo', () => {
    const { result } = renderHook(() => useRestaurant());
    expect(result.current.name).toBe('Diner');
    expect(result.current.logo).toBe('');
  });

  it('hydrates name and logo from localStorage on mount', () => {
    localStorage.setItem(NAME_KEY, 'The Fat Duck');
    localStorage.setItem(LOGO_KEY, 'data:image/png;base64,abc');
    const { result } = renderHook(() => useRestaurant());
    expect(result.current.name).toBe('The Fat Duck');
    expect(result.current.logo).toBe('data:image/png;base64,abc');
  });

  it('setName updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useRestaurant());
    act(() => result.current.setName('Noma'));
    expect(result.current.name).toBe('Noma');
    expect(localStorage.getItem(NAME_KEY)).toBe('Noma');
  });

  it('setLogo updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useRestaurant());
    act(() => result.current.setLogo('data:image/png;base64,xyz'));
    expect(result.current.logo).toBe('data:image/png;base64,xyz');
    expect(localStorage.getItem(LOGO_KEY)).toBe('data:image/png;base64,xyz');
  });

  it('setLogo("") clears state and REMOVES the logo key from localStorage', () => {
    localStorage.setItem(LOGO_KEY, 'data:image/png;base64,seed');
    const { result } = renderHook(() => useRestaurant());
    expect(result.current.logo).toBe('data:image/png;base64,seed'); // hydrated first

    act(() => result.current.setLogo(''));
    expect(result.current.logo).toBe('');
    expect(localStorage.getItem(LOGO_KEY)).toBeNull(); // removed, not stored as ''
  });
});
