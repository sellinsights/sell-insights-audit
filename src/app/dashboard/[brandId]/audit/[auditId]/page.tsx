"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchAuditData, fetchAuditUpdatedAt, fetchBrandName, normalizeAuditData, type AuditData } from "@/lib/data/audit";
import { writeCache, clearCache } from "@/lib/cache/localCache";
import { useLocalCacheEntry } from "@/lib/cache/useLocalCacheEntry";
import { cacheKeys } from "@/lib/cache/cacheKeys";
import { withTimeout } from "@/lib/withTimeout";
import { AuditDashboard } from "@/components/AuditDashboard";
import { RefreshDataButton } from "@/components/RefreshDataButton";
import { DeleteConfirmButton } from "@/components/DeleteConfirmButton";
import { useRole } from "@/components/RoleContext";
import { deleteAudit } from "@/app/dashboard/actions";
import { NotesProvider } from "@/components/NotesContext";

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
  const { isAdmin } = useRole();
  const router = useRouter();
  const { brandId, auditId } = useParams<{ brandId: string; auditId: string }>();
  const cacheKey = cacheKeys.audit(auditId);
  const cacheEntry = useLocalCacheEntry<AuditBundle>(cacheKey);

  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const staleCheckedRef = useRef(false);

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

      console.log("[CLIENT PERF] fetching audit data + brand name...");
      const [data, brandName] = await withTimeout(
        Promise.all([fetchAuditData(supabase, auditId), fetchBrandName(supabase, brandId)]),
        FETCH_TIMEOUT_MS,
        "Audit data fetch"
      );
      console.log("[CLIENT PERF] fetch resolved:", { hasAuditRow: !!data, brandName });

      if (!data) {
        // RLS grants every authenticated user access to every audit, so a
        // missing row here means it was deleted or the id is wrong — not an
        // ownership mismatch.
        console.error("[CLIENT PERF] No audit row returned — either the audit doesn't exist, or the id is wrong.", {
          auditId,
        });
        setNotFound(true);
        return;
      }

      if (isAllEmpty(data)) {
        console.warn(
          "[CLIENT PERF] Audit row loaded but every aggregate came back empty (0 revenue, 0 spend, 0 ASINs) — " +
            "the uploaded files most likely never finished parsing.",
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

  // Smart cache invalidation: unlike the brand/audit list pages, this bundle
  // doesn't change once an audit finishes processing — so instead of a count
  // query, one query for just `updated_at` is enough to catch the rare case
  // where it *does* change (re-processed from another device, a future edit
  // feature, etc.) without re-fetching the whole dashboard on every load.
  const checkStale = useCallback(async () => {
    if (!cacheEntry) return;
    try {
      const supabase = createClient();
      const liveUpdatedAt = await withTimeout(
        fetchAuditUpdatedAt(supabase, auditId),
        FETCH_TIMEOUT_MS,
        "Audit updated_at check"
      );
      const cachedUpdatedAt = cacheEntry.data.audit.updated_at;
      const isNewer =
        !!liveUpdatedAt && (!cachedUpdatedAt || new Date(liveUpdatedAt).getTime() > new Date(cachedUpdatedAt).getTime());
      if (isNewer) {
        console.log(
          `[CLIENT PERF] audit updated_at changed (cached ${cachedUpdatedAt} -> live ${liveUpdatedAt}) — invalidating cache`
        );
        clearCache(cacheKey);
        await fetchFresh();
      } else {
        console.log("[CLIENT PERF] audit updated_at check: cache is fresh", { liveUpdatedAt, cachedUpdatedAt });
      }
    } catch (err) {
      console.warn("[CLIENT PERF] audit updated_at check failed — keeping cached data:", err);
    }
  }, [cacheEntry, auditId, cacheKey, fetchFresh]);

  useEffect(() => {
    if (!cacheEntry || staleCheckedRef.current) return;
    staleCheckedRef.current = true;
    const timeoutId = setTimeout(() => void checkStale(), 0);
    return () => clearTimeout(timeoutId);
  }, [cacheEntry, checkStale]);

  function handleRefresh() {
    clearCache(cacheKey);
  }

  async function handleDeleteAudit() {
    const result = await deleteAudit(auditId, brandId);
    if (result.error) throw new Error(result.error);
    clearCache(cacheKey);
    clearCache(cacheKeys.auditList(brandId));
    router.push(`/dashboard/${brandId}`);
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-sm text-neutral-500">Audit not found.</p>
        <p className="mt-1 text-xs text-neutral-400">
          Check the browser console for details — this usually means the audit doesn&apos;t exist or was
          deleted.
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

  // Normalize before render — a bundle cached before a field like sdCostType
  // or notes existed won't have it, and cache hits render straight from
  // localStorage with no fetch at all, so this is the only place that can
  // catch it (fixing fetchAuditData alone only protects future fresh fetches).
  const bundle = normalizeAuditData(cacheEntry.data);

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
        <div className="flex items-center gap-3">
          <RefreshDataButton cachedAt={cacheEntry.cachedAt} refreshing={fetching} onRefresh={handleRefresh} />
          {isAdmin && (
            <DeleteConfirmButton itemName={bundle.audit.title} itemLabel="audit" onConfirm={handleDeleteAudit} />
          )}
        </div>
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
        <NotesProvider
          auditId={auditId}
          initialNotes={bundle.notes}
          onNotesChange={(notes) => writeCache<AuditBundle>(cacheKey, { ...bundle, notes })}
        >
          <AuditDashboard data={bundle} />
        </NotesProvider>
      )}
    </div>
  );
}
