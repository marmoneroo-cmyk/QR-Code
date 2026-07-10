// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useReadiness, __resetReadinessCache, type Readiness } from './useReadiness';

const READINESS: Readiness = {
  ready: true,
  consecutiveReadyDays: 3,
  requiredDays: 3,
  blockedBy: [],
};

/** Stub global fetch with a `{ success, data: { readiness } }` envelope and return the spy. */
function stubFetchOk(readiness: Readiness | null) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: { readiness } }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// The module-level cache + in-flight promise persist across tests, so reset them before
// every test (the hook exports __resetReadinessCache for exactly this). Afterwards, remove
// the fetch stub so no test leaks a global fetch — keeping the suite order-independent.
beforeEach(() => {
  __resetReadinessCache();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetReadinessCache();
});

describe('useReadiness', () => {
  it('fetches /api/signals/verify on mount and returns the readiness slice', async () => {
    const fetchMock = stubFetchOk(READINESS);
    const { result } = renderHook(() => useReadiness());

    await waitFor(() => expect(result.current).toEqual(READINESS));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/signals/verify', { cache: 'no-store' });
  });

  it('shares one fetch across instances: a second mount within the TTL does NOT refetch', async () => {
    const fetchMock = stubFetchOk(READINESS);

    const first = renderHook(() => useReadiness());
    await waitFor(() => expect(first.result.current).toEqual(READINESS));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second consumer mounts while the cache is fresh → served from cache, no new scan.
    const second = renderHook(() => useReadiness());
    await waitFor(() => expect(second.result.current).toEqual(READINESS));
    expect(fetchMock).toHaveBeenCalledTimes(1); // still one — deduped by the module cache
  });

  it('coalesces concurrent mounts onto a single in-flight request', async () => {
    const fetchMock = stubFetchOk(READINESS);

    // Both mount before the first request resolves; the second sees inflight != null and
    // rides the same promise instead of starting its own fetch.
    const a = renderHook(() => useReadiness());
    const b = renderHook(() => useReadiness());

    await waitFor(() => expect(a.result.current).toEqual(READINESS));
    await waitFor(() => expect(b.result.current).toEqual(READINESS));
    expect(fetchMock).toHaveBeenCalledTimes(1); // in-flight dedup
  });
});
