import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedRead, bumpDataRevision, clearReadCache, dataRevision } from '../lib/queryCache';

describe('queryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearReadCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves a repeat read from cache without calling the loader again', async () => {
    const loader = vi.fn().mockResolvedValue(['a']);
    const first = await cachedRead('k1', loader);
    const second = await cachedRead('k1', loader);
    expect(first).toEqual(['a']);
    expect(second).toEqual(['a']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    let resolveLoad;
    const loader = vi.fn(() => new Promise((resolve) => { resolveLoad = resolve; }));
    const p1 = cachedRead('k2', loader);
    const p2 = cachedRead('k2', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoad(['x']);
    expect(await p1).toEqual(['x']);
    expect(await p2).toEqual(['x']);
  });

  it('invalidates every entry when a business write bumps the revision', async () => {
    const loader = vi.fn().mockResolvedValue(1);
    await cachedRead('k3', loader);
    const before = dataRevision();
    bumpDataRevision();
    expect(dataRevision()).toBeGreaterThan(before);
    await cachedRead('k3', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('expires entries after the TTL even without a write', async () => {
    const loader = vi.fn().mockResolvedValue('v');
    await cachedRead('k4', loader);
    vi.setSystemTime(Date.now() + 31 * 1000);
    await cachedRead('k4', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    let calls = 0;
    const loader = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error('offline'));
      return Promise.resolve('ok');
    });
    await expect(cachedRead('k5', loader)).rejects.toThrow('offline');
    await expect(cachedRead('k5', loader)).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps different keys independent', async () => {
    const loaderA = vi.fn().mockResolvedValue('a');
    const loaderB = vi.fn().mockResolvedValue('b');
    expect(await cachedRead('ka', loaderA)).toBe('a');
    expect(await cachedRead('kb', loaderB)).toBe('b');
    expect(await cachedRead('ka', loaderA)).toBe('a');
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });
});
