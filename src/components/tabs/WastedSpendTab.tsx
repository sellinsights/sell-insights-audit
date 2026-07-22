import { memo } from "react";
import { SectionCard } from "@/components/SectionCard";
import { DataTable, type Column } from "@/components/DataTable";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatCount } from "@/lib/formatCount";
import type { WastedSpendRow } from "@/lib/data/rpc";
import type { AuditData } from "@/lib/data/audit";

const columns: Column<WastedSpendRow>[] = [
  {
    key: "matchType",
    header: "Match Type",
    render: (r) => <span className={r.matchType === "Grand Total" ? "font-semibold text-white" : "font-medium text-navy"}>{r.matchType}</span>,
    sortValue: (r) => r.matchType,
  },
  { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend), sortValue: (r) => r.spend },
  { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders), sortValue: (r) => r.orders },
  {
    key: "count",
    header: "Search Term Count",
    align: "right",
    render: (r) => formatNumber(r.searchTermCount),
    sortValue: (r) => r.searchTermCount,
  },
  {
    key: "minClicks",
    header: "Min Clicks",
    align: "right",
    render: (r) => formatNumber(r.minClicks),
    sortValue: (r) => r.minClicks,
  },
  {
    key: "maxClicks",
    header: "Max Clicks",
    align: "right",
    render: (r) => formatNumber(r.maxClicks),
    sortValue: (r) => r.maxClicks,
  },
  {
    key: "highestCpc",
    header: "Highest CPC",
    align: "right",
    render: (r) => formatCurrency(r.highestCpc),
    sortValue: (r) => r.highestCpc,
  },
];

export const WastedSpendTab = memo(function WastedSpendTab({ data }: { data: AuditData }) {
  const { spUnder5, spOver5, sbUnder5, sbOver5 } = data.wastedSpend;

  return (
    <div className="space-y-8">
      <SectionCard
        title="SP — 1 to 5 Clicks, 0 Orders"
        description="Search terms getting clicked but not converting yet — early signal, not necessarily wasted."
        count={formatCount(spUnder5.rows.length, "match type")}
        sectionKey="wasted_spend_sp_under5"
      >
        <DataTable columns={columns} rows={spUnder5.rows} footer={spUnder5.grandTotal} keyFn={(r) => r.matchType} />
      </SectionCard>

      <SectionCard
        title="SP — 6+ Clicks, 0 Orders"
        description="Meaningful click volume with zero orders — strong candidates for negative targeting."
        count={formatCount(spOver5.rows.length, "match type")}
        sectionKey="wasted_spend_sp_over5"
      >
        <DataTable columns={columns} rows={spOver5.rows} footer={spOver5.grandTotal} keyFn={(r) => r.matchType} />
      </SectionCard>

      <SectionCard
        title="SB — 1 to 5 Clicks, 0 Orders"
        description="Search terms getting clicked but not converting yet — early signal, not necessarily wasted."
        count={formatCount(sbUnder5.rows.length, "match type")}
        sectionKey="wasted_spend_sb_under5"
      >
        <DataTable columns={columns} rows={sbUnder5.rows} footer={sbUnder5.grandTotal} keyFn={(r) => r.matchType} />
      </SectionCard>

      <SectionCard
        title="SB — 6+ Clicks, 0 Orders"
        description="Meaningful click volume with zero orders — strong candidates for negative targeting."
        count={formatCount(sbOver5.rows.length, "match type")}
        sectionKey="wasted_spend_sb_over5"
      >
        <DataTable columns={columns} rows={sbOver5.rows} footer={sbOver5.grandTotal} keyFn={(r) => r.matchType} />
      </SectionCard>
    </div>
  );
});
