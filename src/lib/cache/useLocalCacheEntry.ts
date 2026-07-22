"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { readCache, subscribeCache, type CacheEnvelope } from "./localCache";

const SERVER_SNAPSHOT = null;

/**
 * Reactive, hydration-safe read of a localStorage cache entry.
 *
 * useSyncExternalStore (not useEffect+setState) is what makes this safe: the
 * server snapshot is always null, so there's nothing to mismatch during SSR —
 * React reconciles to the real client value right after hydration on its own.
 * It also re-renders automatically whenever writeCache/clearCache touch this
 * key, so callers don't need to mirror the cache into their own state.
 */
export function useLocalCacheEntry<T>(key: string): CacheEnvelope<T> | null {
  const cacheRef = useRef<{ key: string; value: CacheEnvelope<T> | null }>({ key: "", value: null });

  const getSnapshot = useCallback(() => {
    const value = readCache<T>(key);
    const cached = cacheRef.current;
    if (cached.key === key && cached.value?.cachedAt === value?.cachedAt) {
      return cached.value;
    }
    cacheRef.current = { key, value };
    return value;
  }, [key]);

  const subscribe = useCallback((callback: () => void) => subscribeCache(key, callback), [key]);
  const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
