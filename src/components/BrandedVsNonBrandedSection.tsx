"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";
import { DataTable, type Column } from "./DataTable";
import { metricsColumns } from "./metricsTableColumns";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBrandedSearchTerms,
  fetchBrandedSplit,
  type BrandedScope,
  type BrandedSearchTermRow,
  type BrandedSplitRow,
} from "@/lib/data/rpc";
import { withTimeout } from "@/lib/withTimeout";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

const FETCH_TIMEOUT_MS = 30_000;

const SCOPES: { value: BrandedScope; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "sp", label: "SP only" },
  { value: "sb", label: "SB only" },
];

const termColumns: Column<BrandedSearchTermRow>[] = [
  {
    key: "term",
    header: "Search Term",
    render: (r) => r.customerSearchTerm ?? "—",
    sortValue: (r) => r.customerSearchTerm,
  },
  { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend), sortValue: (r) => r.spend },
  { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
  { key: "clicks", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks), sortValue: (r) => r.clicks },
  { key: "acos", header: "ACOS", align: "right", render: (r) => formatPercent(r.acos), sortValue: (r) => r.acos },
  { key: "roas", header: "ROAS", align: "right", render: (r) => formatDecimal(r.roas), sortValue: (r) => r.roas },
];

interface BrandedSplitTrio {
  branded: BrandedSplitRow;
  nonBranded: BrandedSplitRow;
  grandTotal: BrandedSplitRow;
}

export function BrandedVsNonBrandedSection({
  auditId,
  initialData,
}: {
  auditId: string;
  initialData: BrandedSplitTrio;
}) {
  const [scope, setScope] = useState<BrandedScope>("both");
  const [fetchedData, setFetchedData] = useState<BrandedSplitTrio | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<"branded" | "non-branded" | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<BrandedSearchTermRow[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // "both" is what the dashboard already preloaded — only sp/sb scopes need
  // a fresh query, so `data` falls back to initialData without an effect.
  const data = scope === "both" ? initialData : (fetchedData ?? initialData);

  const loadSplit = useCallback(
    async (nextScope: BrandedScope) => {
      setLoading(true);
      setErrorMessage(null);
      console.log(`[CLIENT PERF] fetching branded split (scope=${nextScope})...`);
      console.time(`[CLIENT PERF] branded split ${nextScope}`);
      try {
        const supabase = createClient();
        const result = await withTimeout(
          fetchBrandedSplit(supabase, auditId, nextScope),
          FETCH_TIMEOUT_MS,
          "Branded split fetch"
        );
        setFetchedData(result);
      } catch (err) {
        console.error("[CLIENT PERF] branded split fetch failed:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load branded split.");
      } finally {
        setLoading(false);
        console.timeEnd(`[CLIENT PERF] branded split ${nextScope}`);
      }
    },
    [auditId]
  );

  // Deferred via setTimeout so kicking off the fetch never runs synchronously inside the effect.
  useEffect(() => {
    if (scope === "both") return;
    const timeoutId = setTimeout(() => void loadSplit(scope), 0);
    return () => clearTimeout(timeoutId);
  }, [scope, loadSplit]);

  async function handleToggleExpand(which: "branded" | "non-branded") {
    if (expanded === which) {
      setExpanded(null);
      return;
    }
    setExpanded(which);
    setExpandedLoading(true);
    setExpandedTerms([]);
    console.time(`[CLIENT PERF] branded search terms ${which}`);
    try {
      const supabase = createClient();
      const rows = await withTimeout(
        fetchBrandedSearchTerms(supabase, auditId, scope, which === "branded", 100, 0),
        FETCH_TIMEOUT_MS,
        "Branded search terms fetch"
      );
      setExpandedTerms(rows);
    } catch (err) {
      console.error("[CLIENT PERF] branded search terms fetch failed:", err);
    } finally {
      setExpandedLoading(false);
      console.timeEnd(`[CLIENT PERF] branded search terms ${which}`);
    }
  }

  const verdict = !data.branded.hasBrandKeywords
    ? "No brand keywords uploaded — all search terms shown as non-branded"
    : data.branded.pctOfSpend >= 50
      ? `${data.branded.pctOfSpend.toFixed(1)}% of spend is branded — strong reliance on brand defense`
      : `${data.branded.pctOfSpend.toFixed(1)}% of spend is branded — majority is prospecting non-branded traffic`;

  const columns = metricsColumns("Classification");

  return (
    <SectionCard
      title="Branded vs Non-Branded"
      description={loading ? "Loading…" : verdict}
      actions={
        <div className="flex overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setScope(s.value);
                setExpanded(null);
              }}
              disabled={loading}
              className={`px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                scope === s.value ? "bg-navy text-white" : "bg-white text-navy hover:bg-neutral-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      {errorMessage && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
      )}

      <div className={loading ? "opacity-60 transition-opacity" : ""}>
        <DataTable columns={columns} rows={[data.branded, data.nonBranded]} footer={data.grandTotal} />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => void handleToggleExpand("branded")}
          className="text-xs font-semibold text-green hover:underline"
        >
          {expanded === "branded" ? "Hide" : "Show"} branded search terms ({formatNumber(data.branded.searchTermCount)})
        </button>
        <span className="text-neutral-300">|</span>
        <button
          onClick={() => void handleToggleExpand("non-branded")}
          className="text-xs font-semibold text-green hover:underline"
        >
          {expanded === "non-branded" ? "Hide" : "Show"} non-branded search terms (
          {formatNumber(data.nonBranded.searchTermCount)})
        </button>
      </div>

      {expanded && (
        <div className="mt-3">
          {(expanded === "branded" ? data.branded.searchTermCount : data.nonBranded.searchTermCount) > 100 && (
            <p className="mb-2 text-xs text-neutral-400">Showing top 100 by spend.</p>
          )}
          {expandedLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-green border-t-transparent" />
            </div>
          ) : (
            <DataTable
              columns={termColumns}
              rows={expandedTerms}
              keyFn={(r, i) => `${r.customerSearchTerm}-${i}`}
              maxHeightPx={400}
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}
