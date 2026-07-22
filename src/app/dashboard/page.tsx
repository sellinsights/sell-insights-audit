"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchBrandCount, fetchBrands } from "@/lib/data/brands";
import { writeCache, clearCache } from "@/lib/cache/localCache";
import { useLocalCacheEntry } from "@/lib/cache/useLocalCacheEntry";
import { cacheKeys } from "@/lib/cache/cacheKeys";
import { withTimeout } from "@/lib/withTimeout";
import { CreateBrandForm } from "@/components/CreateBrandForm";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import type { BrandRow } from "@/types/database";

const CACHE_KEY = cacheKeys.brandList();
const FETCH_TIMEOUT_MS = 10_000;

export default function DashboardPage() {
  const cacheEntry = useLocalCacheEntry<BrandRow[]>(CACHE_KEY);
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const staleCheckedRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setFetching(true);
    setErrorMessage(null);
    console.log("[CLIENT PERF] fetching brands...");
    console.time("[CLIENT PERF] fetchBrands");
    try {
      const supabase = createClient();
      const data = await withTimeout(fetchBrands(supabase), FETCH_TIMEOUT_MS, "Brand list fetch");
      writeCache(CACHE_KEY, data);
      console.log(`[CLIENT PERF] loaded ${data.length} brands`);
    } catch (err) {
      console.error("[CLIENT PERF] fetchBrands failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load brands.");
    } finally {
      fetchingRef.current = false;
      setFetching(false);
      console.timeEnd("[CLIENT PERF] fetchBrands");
    }
  }, []);

  // Deferred via setTimeout so kicking off the fetch never runs synchronously inside the effect.
  useEffect(() => {
    if (cacheEntry) return;
    const timeoutId = setTimeout(() => void fetchFresh(), 0);
    return () => clearTimeout(timeoutId);
  }, [cacheEntry, fetchFresh]);

  // Smart cache invalidation: a cache hit renders instantly from localStorage,
  // but that snapshot could predate a brand created by a teammate on another
  // device. One `head: true` count query is cheap enough to run on every load
  // without giving up the instant render — only a mismatch triggers a real
  // re-fetch. Runs once per mount (not on every cache write) via the ref guard.
  const checkStale = useCallback(async () => {
    if (!cacheEntry) return;
    try {
      const supabase = createClient();
      const liveCount = await withTimeout(fetchBrandCount(supabase), FETCH_TIMEOUT_MS, "Brand count check");
      if (liveCount !== cacheEntry.data.length) {
        console.log(
          `[CLIENT PERF] brand count changed (cached ${cacheEntry.data.length} -> live ${liveCount}) — invalidating cache`
        );
        clearCache(CACHE_KEY);
        await fetchFresh();
      } else {
        console.log(`[CLIENT PERF] brand count check: still ${liveCount}, cache is fresh`);
      }
    } catch (err) {
      console.warn("[CLIENT PERF] brand count check failed — keeping cached data:", err);
    }
  }, [cacheEntry, fetchFresh]);

  useEffect(() => {
    if (!cacheEntry || staleCheckedRef.current) return;
    staleCheckedRef.current = true;
    const timeoutId = setTimeout(() => void checkStale(), 0);
    return () => clearTimeout(timeoutId);
  }, [cacheEntry, checkStale]);

  function handleRefresh() {
    clearCache(CACHE_KEY);
  }

  async function handleBrandCreated() {
    clearCache(CACHE_KEY);
    await fetchFresh();
  }

  const brands = cacheEntry?.data ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Brands</h1>
          <p className="text-sm text-neutral-500">Select a brand to view or create audits.</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshDataButton cachedAt={cacheEntry?.cachedAt ?? null} refreshing={fetching} onRefresh={handleRefresh} />
          <CreateBrandForm onCreated={handleBrandCreated} />
        </div>
      </div>

      {brands === null ? (
        errorMessage ? (
          <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-12 text-center">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <p className="mt-1 text-xs text-red-400">See the browser console for the full error.</p>
            <button onClick={() => void fetchFresh()} className="mt-3 text-sm font-medium text-green hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
          </div>
        )
      ) : brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">No brands yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/dashboard/${brand.id}`}
              className="group rounded-xl border border-black/5 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
              <p className="mt-3 font-semibold text-navy group-hover:text-green">{brand.name}</p>
              <p className="mt-1 text-xs text-neutral-400">
                Created {new Date(brand.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
