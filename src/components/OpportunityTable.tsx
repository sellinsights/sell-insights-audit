"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SectionCard } from "@/components/SectionCard";
import { DataTable, type Column } from "@/components/DataTable";
import { searchTermColumn } from "@/components/amazonLinkColumns";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/withTimeout";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import type { Database } from "@/types/database";
import type { OpportunityAdType, OpportunityRow, OpportunityTermType } from "@/lib/data/rpc";

const FETCH_TIMEOUT_MS = 30_000;
const RESULT_LIMIT = 100;
// ~10 data rows visible before scrolling, matching the pattern used by
// BleedersBoard / BrandedVsNonBrandedSection's expanded search term tables.
const TABLE_MAX_HEIGHT_PX = 420;

const TERM_TYPE_OPTIONS: { value: OpportunityTermType; label: string }[] = [
  { value: "keyword", label: "Keywords only" },
  { value: "asin", label: "ASINs only" },
  { value: "both", label: "Both" },
];

const AD_TYPE_OPTIONS: { value: OpportunityAdType; label: string }[] = [
  { value: "sp", label: "SP only" },
  { value: "sb", label: "SB only" },
  { value: "both", label: "Both" },
];

type FetchFn = (
  supabase: SupabaseClient<Database>,
  auditId: string,
  adType: OpportunityAdType,
  termType: OpportunityTermType,
  limit?: number,
  offset?: number
) => Promise<{ rows: OpportunityRow[]; totalCount: number }>;

/** Shared UI for the three opportunity tabs (ACOS Improvement, Scale
 * Opportunities, Cost Reduction) — same two toggles, same columns, same
 * caching behavior, differing only in which RPC function backs the data and
 * the section copy. Results are cached per toggle combination in React
 * state (not localStorage — toggles change often within a session, and this
 * data doesn't need to survive a reload the way the rest of the dashboard
 * bundle does). */
export function OpportunityTable({
  auditId,
  marketplace,
  fetchFn,
  title,
  description,
  sectionKey,
}: {
  auditId: string;
  marketplace: string | null;
  fetchFn: FetchFn;
  title: string;
  description: string;
  sectionKey: string;
}) {
  const [termType, setTermType] = useState<OpportunityTermType>("both");
  const [adType, setAdType] = useState<OpportunityAdType>("both");
  const [cache, setCache] = useState<Record<string, { rows: OpportunityRow[]; totalCount: number }>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cacheKey = `${adType}|${termType}`;
  const data = cache[cacheKey];

  const load = useCallback(
    async (nextAdType: OpportunityAdType, nextTermType: OpportunityTermType) => {
      const key = `${nextAdType}|${nextTermType}`;
      setLoading(true);
      setErrorMessage(null);
      console.log(`[CLIENT PERF] fetching ${sectionKey} (ad=${nextAdType}, term=${nextTermType})...`);
      console.time(`[CLIENT PERF] ${sectionKey} ${key}`);
      try {
        const supabase = createClient();
        const result = await withTimeout(
          fetchFn(supabase, auditId, nextAdType, nextTermType, RESULT_LIMIT, 0),
          FETCH_TIMEOUT_MS,
          `${title} fetch`
        );
        setCache((prev) => ({ ...prev, [key]: result }));
      } catch (err) {
        console.error(`[CLIENT PERF] ${sectionKey} fetch failed:`, err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        setLoading(false);
        console.timeEnd(`[CLIENT PERF] ${sectionKey} ${key}`);
      }
    },
    [auditId, fetchFn, sectionKey, title]
  );

  // Re-queries the database whenever a toggle changes (the filter is applied
  // server-side), but only if this exact combination hasn't been fetched yet
  // this session. Deferred via setTimeout so kicking off the fetch never runs
  // synchronously inside the effect.
  useEffect(() => {
    if (cache[cacheKey]) return;
    const timeoutId = setTimeout(() => void load(adType, termType), 0);
    return () => clearTimeout(timeoutId);
  }, [adType, termType, cache, cacheKey, load]);

  const columns = useMemo<Column<OpportunityRow>[]>(
    () => [
      searchTermColumn({ getTerm: (r) => r.customerSearchTerm, marketplace }),
      {
        key: "impressions",
        header: "Impressions",
        align: "right",
        render: (r) => formatNumber(r.impressions),
        sortValue: (r) => r.impressions,
      },
      { key: "clicks", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks), sortValue: (r) => r.clicks },
      { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
      { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend), sortValue: (r) => r.spend },
      { key: "sales", header: "Sales", align: "right", render: (r) => formatCurrency(r.sales), sortValue: (r) => r.sales },
      { key: "cpc", header: "CPC", align: "right", render: (r) => formatCurrency(r.cpc), sortValue: (r) => r.cpc },
      { key: "acos", header: "ACOS", align: "right", render: (r) => formatPercent(r.acos), sortValue: (r) => r.acos },
      { key: "roas", header: "ROAS", align: "right", render: (r) => formatDecimal(r.roas), sortValue: (r) => r.roas },
      { key: "cvr", header: "PPC CVR%", align: "right", render: (r) => formatPercent(r.cvr), sortValue: (r) => r.cvr },
    ],
    [marketplace]
  );

  return (
    <SectionCard
      title={title}
      description={description}
      sectionKey={sectionKey}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
            {TERM_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setTermType(o.value)}
                disabled={loading}
                className={`px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  termType === o.value ? "bg-navy text-white" : "bg-white text-navy hover:bg-neutral-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
            {AD_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setAdType(o.value)}
                disabled={loading}
                className={`px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  adType === o.value ? "bg-navy text-white" : "bg-white text-navy hover:bg-neutral-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {errorMessage && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}{" "}
          <button onClick={() => void load(adType, termType)} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {!data && loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          {data && (
            <p className="mb-2 text-xs text-neutral-400">
              {formatNumber(data.totalCount)} matching search term{data.totalCount === 1 ? "" : "s"}
              {data.totalCount > data.rows.length ? ` — showing top ${data.rows.length} by spend.` : ""}
            </p>
          )}
          <DataTable
            columns={columns}
            rows={data?.rows ?? []}
            keyFn={(r, i) => `${r.customerSearchTerm}-${i}`}
            maxHeightPx={TABLE_MAX_HEIGHT_PX}
            emptyMessage="No search terms match this filter combination."
          />
        </div>
      )}
    </SectionCard>
  );
}
