"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "./SectionCard";
import { DataTable, type Column } from "./DataTable";
import { searchTermColumn } from "./amazonLinkColumns";
import { createClient } from "@/lib/supabase/client";
import { fetchBleeders, type BleederRow } from "@/lib/data/rpc";
import { withTimeout } from "@/lib/withTimeout";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatCount } from "@/lib/formatCount";

type BleederTermFilter = "both" | "keyword" | "asin";

const FETCH_TIMEOUT_MS = 30_000;

const FILTERS: { value: BleederTermFilter; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "keyword", label: "Keywords only" },
  { value: "asin", label: "ASINs only" },
];

function buildColumns(marketplace: string | null): Column<BleederRow>[] {
  return [
    searchTermColumn({ getTerm: (r) => r.customerSearchTerm, marketplace }),
    { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend), sortValue: (r) => r.spend },
    { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
    { key: "clicks", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks), sortValue: (r) => r.clicks },
    {
      key: "avgCpc",
      header: "Avg CPC",
      align: "right",
      render: (r) => formatCurrency(r.avgCpc),
      sortValue: (r) => r.avgCpc,
    },
    {
      key: "highestCpc",
      header: "Highest CPC",
      align: "right",
      render: (r) => formatCurrency(r.highestCpc),
      sortValue: (r) => r.highestCpc,
    },
  ];
}

/** Client-side Grand Total for the currently visible/filtered rows — fn_bleeders
 * only returns individual search terms, no aggregate, so this is computed
 * here rather than in SQL. avgCpc is total spend / total clicks (not an
 * average of each row's avgCpc); highestCpc is the max across all rows. */
function computeBleederGrandTotal(rows: BleederRow[]): BleederRow | undefined {
  if (rows.length === 0) return undefined;
  let spend = 0;
  let clicks = 0;
  let orders = 0;
  let highestCpc: number | null = null;
  for (const r of rows) {
    spend += r.spend;
    clicks += r.clicks;
    orders += r.orders;
    if (r.highestCpc !== null && (highestCpc === null || r.highestCpc > highestCpc)) {
      highestCpc = r.highestCpc;
    }
  }
  return {
    customerSearchTerm: "Grand Total",
    spend,
    clicks,
    orders,
    avgCpc: clicks > 0 ? spend / clicks : null,
    highestCpc,
  };
}

function BleederTable({
  title,
  description,
  rows,
  sectionKey,
  columns,
}: {
  title: string;
  description: string;
  rows: BleederRow[];
  sectionKey: string;
  columns: Column<BleederRow>[];
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      count={formatCount(rows.length, "search term")}
      sectionKey={sectionKey}
    >
      <DataTable
        columns={columns}
        rows={rows}
        footer={computeBleederGrandTotal(rows)}
        keyFn={(r, i) => `${r.customerSearchTerm}-${i}`}
        maxHeightPx={420}
        emptyMessage="No zero-order search terms in this band."
      />
    </SectionCard>
  );
}

interface BleedersData {
  spOver10: BleederRow[];
  spUnder10: BleederRow[];
  sbOver10: BleederRow[];
  sbUnder10: BleederRow[];
}

export function BleedersBoard({ auditId, marketplace }: { auditId: string; marketplace: string | null }) {
  const [filter, setFilter] = useState<BleederTermFilter>("both");
  const [data, setData] = useState<BleedersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const columns = useMemo(() => buildColumns(marketplace), [marketplace]);

  const load = useCallback(
    async (termFilter: BleederTermFilter) => {
      setLoading(true);
      setErrorMessage(null);
      console.log(`[CLIENT PERF] fetching bleeders (top 100/band, filter=${termFilter})...`);
      console.time(`[CLIENT PERF] bleeders ${termFilter}`);
      try {
        const supabase = createClient();
        const [spOver10, spUnder10, sbOver10, sbUnder10] = await withTimeout(
          Promise.all([
            fetchBleeders(supabase, auditId, "sp", 10, null, termFilter),
            fetchBleeders(supabase, auditId, "sp", 0, 10, termFilter),
            fetchBleeders(supabase, auditId, "sb", 10, null, termFilter),
            fetchBleeders(supabase, auditId, "sb", 0, 10, termFilter),
          ]),
          FETCH_TIMEOUT_MS,
          "Bleeders fetch"
        );
        setData({ spOver10, spUnder10, sbOver10, sbUnder10 });
      } catch (err) {
        console.error("[CLIENT PERF] bleeders fetch failed:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load bleeders.");
      } finally {
        setLoading(false);
        console.timeEnd(`[CLIENT PERF] bleeders ${termFilter}`);
      }
    },
    [auditId]
  );

  // Fires on mount and every time the term-type filter changes — re-queries
  // the database rather than re-filtering stale client-side data, since the
  // top-100-by-spend cutoff differs per filter. Deferred via setTimeout so
  // kicking off the fetch never runs synchronously inside the effect.
  useEffect(() => {
    const timeoutId = setTimeout(() => void load(filter), 0);
    return () => clearTimeout(timeoutId);
  }, [filter, load]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <div className="flex overflow-hidden rounded-md border border-neutral-300 text-xs font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              disabled={loading}
              className={`px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                filter === f.value ? "bg-green text-white" : "bg-white text-navy hover:bg-neutral-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}{" "}
          <button onClick={() => void load(filter)} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

      {!data ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <BleederTable
            title="SP — Over $10 Spend, 0 Sales"
            description="Highest-priority cleanup: meaningful spend with zero orders. Top 100 by spend."
            rows={data.spOver10}
            sectionKey="bleeders_sp_over10"
            columns={columns}
          />
          <div className="h-8" />
          <BleederTable
            title="SP — Under $10 Spend, 0 Sales"
            description="Lower-priority, but still worth a negative-targeting pass at scale. Top 100 by spend."
            rows={data.spUnder10}
            sectionKey="bleeders_sp_under10"
            columns={columns}
          />
          <div className="h-8" />
          <BleederTable
            title="SB — Over $10 Spend, 0 Sales"
            description="Highest-priority cleanup: meaningful spend with zero orders. Top 100 by spend."
            rows={data.sbOver10}
            sectionKey="bleeders_sb_over10"
            columns={columns}
          />
          <div className="h-8" />
          <BleederTable
            title="SB — Under $10 Spend, 0 Sales"
            description="Lower-priority, but still worth a negative-targeting pass at scale. Top 100 by spend."
            rows={data.sbUnder10}
            sectionKey="bleeders_sb_under10"
            columns={columns}
          />
        </div>
      )}
    </div>
  );
}
