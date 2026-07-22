"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchBrand, fetchBrandAudits } from "@/lib/data/brands";
import { writeCache, clearCache } from "@/lib/cache/localCache";
import { useLocalCacheEntry } from "@/lib/cache/useLocalCacheEntry";
import { cacheKeys } from "@/lib/cache/cacheKeys";
import { withTimeout } from "@/lib/withTimeout";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import type { AuditRow, BrandRow } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  processing: "bg-amber-100 text-amber-700",
  complete: "bg-green-light text-green-dark",
};

const FETCH_TIMEOUT_MS = 10_000;

interface BrandAuditsBundle {
  brand: BrandRow;
  audits: AuditRow[];
}

export default function BrandAuditsPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const cacheKey = cacheKeys.auditList(brandId);
  const cacheEntry = useLocalCacheEntry<BrandAuditsBundle>(cacheKey);

  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setFetching(true);
    setErrorMessage(null);
    console.log(`[CLIENT PERF] fetching audits for brand ${brandId}...`);
    console.time(`[CLIENT PERF] fetchBrandAudits ${brandId}`);
    try {
      const supabase = createClient();
      const [brand, audits] = await withTimeout(
        Promise.all([fetchBrand(supabase, brandId), fetchBrandAudits(supabase, brandId)]),
        FETCH_TIMEOUT_MS,
        "Brand + audits fetch"
      );
      if (!brand) {
        console.error("[CLIENT PERF] No brand row returned — either it doesn't exist or RLS is blocking it.", {
          brandId,
        });
        setNotFound(true);
        return;
      }
      setNotFound(false);
      writeCache<BrandAuditsBundle>(cacheKey, { brand, audits });
      console.log(`[CLIENT PERF] loaded brand "${brand.name}" with ${audits.length} audits`);
    } catch (err) {
      console.error("[CLIENT PERF] fetchFresh failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load audits.");
    } finally {
      fetchingRef.current = false;
      setFetching(false);
      console.timeEnd(`[CLIENT PERF] fetchBrandAudits ${brandId}`);
    }
  }, [brandId, cacheKey]);

  // Deferred via setTimeout so kicking off the fetch never runs synchronously inside the effect.
  useEffect(() => {
    if (cacheEntry) return;
    const timeoutId = setTimeout(() => void fetchFresh(), 0);
    return () => clearTimeout(timeoutId);
  }, [cacheEntry, fetchFresh]);

  function handleRefresh() {
    clearCache(cacheKey);
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-sm text-neutral-500">Brand not found.</p>
        <Link href="/dashboard" className="mt-2 inline-block text-sm font-medium text-green hover:underline">
          Back to brands
        </Link>
      </div>
    );
  }

  if (!cacheEntry) {
    if (errorMessage) {
      return (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <button onClick={() => void fetchFresh()} className="mt-3 text-sm font-medium text-green hover:underline">
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
      </div>
    );
  }

  const { brand, audits } = cacheEntry.data;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-1 text-xs text-neutral-400">
        <Link href="/dashboard" className="hover:text-navy">
          Brands
        </Link>{" "}
        / <span className="text-navy">{brand.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy">{brand.name} — Audits</h1>
        <div className="flex items-center gap-3">
          <RefreshDataButton cachedAt={cacheEntry.cachedAt} refreshing={fetching} onRefresh={handleRefresh} />
          <Link
            href={`/dashboard/${brandId}/audit/new`}
            className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-dark"
          >
            + New Audit
          </Link>
        </div>
      </div>

      {audits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">No audits yet for this brand.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-xs font-semibold uppercase tracking-wide text-white">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-t border-black/5 hover:bg-green-light/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/${brandId}/audit/${audit.id}`}
                      className="font-medium text-navy hover:text-green"
                    >
                      {audit.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[audit.status] ?? ""}`}
                    >
                      {audit.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(audit.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
