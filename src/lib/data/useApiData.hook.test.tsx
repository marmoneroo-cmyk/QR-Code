// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { useApiData, apiFetcher } from './useApiData';

// Fresh SWR cache per test; focus revalidation off + no dedup so assertions are deterministic.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), revalidateOnFocus: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiFetcher', () => {
  it('unwraps a successful { success, data } envelope', async () => {
    mockFetchOnce({ success: true, data: { n: 1 } });
    await expect(apiFetcher('/x')).resolves.toEqual({ n: 1 });
  });

  it('throws the envelope error on an unsuccessful response', async () => {
    mockFetchOnce({ success: false, error: 'nope' });
    await expect(apiFetcher('/x')).rejects.toThrow('nope');
  });

  it('throws on a non-ok HTTP status', async () => {
    mockFetchOnce('err', 500);
    await expect(apiFetcher('/x')).rejects.toThrow(/500/);
  });
});

describe('useApiData', () => {
  it('starts loading, then resolves data with no error', async () => {
    mockFetchOnce({ success: true, data: [1, 2] });
    const { result } = renderHook(() => useApiData<number[]>('/api/x'), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error and leaves data null when the first load fails', async () => {
    mockFetchOnce({ success: false, error: 'boom' });
    const { result } = renderHook(() => useApiData('/api/x'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when the key is null', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useApiData(null), { wrapper });
    expect(f).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
