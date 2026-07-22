"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchAuditData, fetchBrandName, type AuditData } from "@/lib/data/audit";
import { writeCache, clearCache } from "@/lib/cache/localCache";
import { useLocalCacheEntry } from "@/lib/cache/useLocalCacheEntry";
import { cacheKeys } from "@/lib/cache/cacheKeys";
import { withTimeout } from "@/lib/withTimeout";
import { AuditDashboard } from "@/components/AuditDashboard";
import { RefreshDataButton } from "@/components/RefreshDataButton";

export interface AuditBundle extends AuditData {
  brandName: string | null;
}

// Real queries should resolve in well under 2s now that Postgres does the
// aggregation — this is just a safety net for a genuinely hung request.
const FETCH_TIMEOUT_MS = 30_000;

function isAllEmpty(data: AuditData): boolean {
  return (
    data.kpis.totalRevenue === 0 &&
    data.kpis.totalSpend === 0 &&
    data.kpis.totalUnits === 0 &&
    data.topAsins.length === 0 &&
    data.advertisedAsins.length === 0
  );
}

export default function AuditPage() {
  const { brandId, auditId } = useParams<{ brandId: string; auditId: string }>();
  const cacheKey = cacheKeys.audit(auditId);
  const cacheEntry = useLocalCacheEntry<AuditBundle>(cacheKey);

  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    if (fetchingRef.current) {
      console.log("[CLIENT PERF] fetchFresh already in flight, skipping duplicate call");
      return;
    }
    fetchingRef.current = true;
    setFetching(true);
    setErrorMessage(null);

    const timerLabel = `[CLIENT PERF] fetchFresh audit ${auditId}`;
    console.log(`[CLIENT PERF] starting fetch for audit ${auditId} (brand ${brandId})`);
    console.time(timerLabel);

    try {
      const supabase = createClient();

      // RLS diagnostic: an audit only comes back if `created_by` matches the
      // logged-in user's id. Logging both here makes a mismatch obvious.
      console.log("[CLIENT PERF] checking current user via supabase.auth.getUser()...");
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) console.error("[CLIENT PERF] supabase.auth.getUser() error:", userError);
      console.log("[CLIENT PERF] current user id:", user?.id ?? "(none — not authenticated!)");

      console.log("[CLIENT PERF] fetching audit data + brand name...");
      const [data, brandName] = await withTimeout(
        Promise.all([fetchAuditData(supabase, auditId), fetchBrandName(supabase, brandId)]),
        FETCH_TIMEOUT_MS,
        "Audit data fetch"
      );
      console.log("[CLIENT PERF] fetch resolved:", { hasAuditRow: !!data, brandName });

      if (!data) {
        console.error(
          "[CLIENT PERF] No audit row returned — either the audit doesn't exist, or RLS is blocking it " +
            "(audits are only visible when audits.created_by = auth.uid()).",
          { auditId, currentUserId: user?.id ?? null }
        );
        setNotFound(true);
        return;
      }

      if (user) {
        if (data.audit.created_by !== user.id) {
          console.error(
            "[CLIENT PERF] RLS MISMATCH: audit.created_by does not match the current user id — " +
              "this would normally hide the audit entirely, so seeing it here alongside a mismatch is unexpected.",
            { auditCreatedBy: data.audit.created_by, currentUserId: user.id }
          );
        } else {
          console.log("[CLIENT PERF] audit.created_by matches current user — RLS is not the issue.", {
            auditCreatedBy: data.audit.created_by,
          });
        }
      }

      if (isAllEmpty(data)) {
        console.warn(
          "[CLIENT PERF] Audit row loaded but every aggregate came back empty (0 revenue, 0 spend, 0 ASINs). " +
            "Either the uploaded files never finished parsing, or RLS is silently hiding the underlying rows.",
          { kpis: data.kpis, topAsinCount: data.topAsins.length, advertisedAsinCount: data.advertisedAsins.length }
        );
      }

      setNotFound(false);
      writeCache<AuditBundle>(cacheKey, { ...data, brandName });
      console.log("[CLIENT PERF] fetchFresh succeeded, cache written for", cacheKey);
    } catch (err) {
      console.error("[CLIENT PERF] fetchFresh failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load audit data.");
    } finally {
      fetchingRef.current = false;
      setFetching(false);
      console.timeEnd(timerLabel);
    }
  }, [auditId, brandId, cacheKey]);

  // No cache for this audit yet (first-ever visit, or it was just cleared) — fetch once.
  // Deferred via setTimeout so kicking off the fetch never runs synchronously inside the effect.
  useEffect(() => {
    if (cacheEntry) return;
    console.log("[CLIENT PERF] no cache entry for", cacheKey, "— scheduling fetch");
    const timeoutId = setTimeout(() => void fetchFresh(), 0);
    return () => clearTimeout(timeoutId);
  }, [cacheEntry, cacheKey, fetchFresh]);

  function handleRefresh() {
    clearCache(cacheKey);
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-sm text-neutral-500">Audit not found.</p>
        <p className="mt-1 text-xs text-neutral-400">
          Check the browser console for details — this can mean the audit doesn&apos;t exist, or that it
          belongs to a different user.
        </p>
        <Link
          href={`/dashboard/${brandId}`}
          className="mt-2 inline-block text-sm font-medium text-green hover:underline"
        >
          Back to audits
        </Link>
      </div>
    );
  }

  if (!cacheEntry) {
    if (errorMessage) {
      return (
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <p className="mt-1 text-xs text-red-400">See the browser console for the full error.</p>
          <button onClick={() => void fetchFresh()} className="mt-3 text-sm font-medium text-green hover:underline">
            Try again
          </button>
        </div>
      );
    }
    // Only the very first load (nothing cached yet) shows this — subsequent
    // refreshes always have a cached snapshot to keep showing underneath.
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green border-t-transparent" />
        <p className="text-sm text-neutral-500">Loading audit…</p>
      </div>
    );
  }

  const bundle = cacheEntry.data;

  return (
    <div>
      <div className="mb-1 text-xs text-neutral-400">
        <Link href="/dashboard" className="hover:text-navy">
          Brands
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/${brandId}`} className="hover:text-navy">
          {bundle.brandName ?? "Audits"}
        </Link>{" "}
        / <span className="text-navy">{bundle.audit.title}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-navy">{bundle.audit.title}</h1>
          {bundle.audit.status !== "complete" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold capitalize text-amber-700">
              {bundle.audit.status}
            </span>
          )}
        </div>
        <RefreshDataButton cachedAt={cacheEntry.cachedAt} refreshing={fetching} onRefresh={handleRefresh} />
      </div>

      {errorMessage && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage} — showing last cached data.
        </p>
      )}

      {isAllEmpty(bundle) ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-navy">No data found for this audit.</p>
          <p className="mt-1 text-sm text-neutral-500">
            The audit record exists, but its business report, campaign, and search-term tables are all
            empty. This usually means the upload finished before parsing completed. Check the browser
            console for details, or try uploading the files again.
          </p>
        </div>
      ) : (
        <AuditDashboard data={bundle} />
      )}
    </div>
  );
}
