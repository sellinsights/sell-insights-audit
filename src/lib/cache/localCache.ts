export interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

const listeners = new Map<string, Set<() => void>>();

function emit(key: string): void {
  listeners.get(key)?.forEach((callback) => callback());
}

/** Used by useLocalCacheEntry to re-render when a write/clear happens anywhere
 * (this tab's fetch, the manual refresh button, etc.) — same-tab localStorage
 * writes don't fire the native `storage` event, so we notify manually. */
export function subscribeCache(key: string, callback: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
    if (set!.size === 0) listeners.delete(key);
  };
}

/** All caching here is best-effort: a full/disabled localStorage should degrade
 * to "always fetch", never crash the page. */
export function readCache<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch (err) {
    console.warn(`[CLIENT PERF] readCache failed for "${key}" — treating as a cache miss:`, err);
    return null;
  }
}

export function writeCache<T>(key: string, data: T): number {
  const cachedAt = Date.now();
  if (typeof window === "undefined") return cachedAt;
  try {
    const envelope: CacheEnvelope<T> = { data, cachedAt };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    // Quota exceeded or storage disabled — caching is an optimization, not a requirement.
    console.warn(`[CLIENT PERF] writeCache failed for "${key}" (quota exceeded or storage disabled):`, err);
  }
  emit(key);
  return cachedAt;
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[CLIENT PERF] clearCache failed for "${key}":`, err);
  }
  emit(key);
}

export function clearCacheByPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => {
      window.localStorage.removeItem(key);
      emit(key);
    });
  } catch {
    // ignore
  }
}
