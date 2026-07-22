import { memo } from "react";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { DataTable, type Column } from "@/components/DataTable";
import { formatCurrency, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import type { AdvertisedAsinRow, TopAsinRow } from "@/lib/data/rpc";
import type { AuditData } from "@/lib/data/audit";

const topAsinColumns: Column<TopAsinRow>[] = [
  {
    key: "asin",
    header: "ASIN",
    render: (r) => <span className="font-medium text-navy">{r.asin}</span>,
    sortValue: (r) => r.asin,
  },
  {
    key: "units",
    header: "Units Ordered",
    align: "right",
    render: (r) => formatNumber(r.unitsOrdered),
    sortValue: (r) => r.unitsOrdered,
  },
  { key: "revenue", header: "Revenue", align: "right", render: (r) => formatCurrency(r.revenue), sortValue: (r) => r.revenue },
  { key: "aov", header: "AOV", align: "right", render: (r) => formatCurrency(r.aov), sortValue: (r) => r.aov },
  { key: "cvr", header: "PPC CVR%", align: "right", render: (r) => formatPercent(r.cvr), sortValue: (r) => r.cvr },
  {
    key: "sessions",
    header: "Sessions",
    align: "right",
    render: (r) => formatNumber(r.sessions),
    sortValue: (r) => r.sessions,
  },
  {
    key: "pvps",
    header: "Page Views / Session",
    align: "right",
    render: (r) => formatDecimal(r.pageViewsPerSession),
    sortValue: (r) => r.pageViewsPerSession,
  },
  {
    key: "spSpend",
    header: "Ad Spend (SP)",
    align: "right",
    render: (r) => formatCurrency(r.spSpend),
    sortValue: (r) => r.spSpend,
  },
  {
    key: "spTacos",
    header: "TACOS% (SP)",
    align: "right",
    render: (r) => formatPercent(r.spTacos),
    sortValue: (r) => r.spTacos,
  },
  {
    key: "pctSpSpend",
    header: "% of SP Spend",
    align: "right",
    render: (r) => formatPercent(r.pctOfSpSpend),
    sortValue: (r) => r.pctOfSpSpend,
  },
  {
    key: "pctUnits",
    header: "% of Unit Sales",
    align: "right",
    render: (r) => formatPercent(r.pctOfUnitSales),
    sortValue: (r) => r.pctOfUnitSales,
  },
];

const advertisedColumns: Column<AdvertisedAsinRow>[] = [
  {
    key: "asin",
    header: "ASIN",
    render: (r) => <span className="font-medium text-navy">{r.asin}</span>,
    sortValue: (r) => r.asin,
  },
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
  {
    key: "pctSpend",
    header: "% of Spend",
    align: "right",
    render: (r) => formatPercent(r.pctOfSpend),
    sortValue: (r) => r.pctOfSpend,
  },
  {
    key: "pctSales",
    header: "% of Sales",
    align: "right",
    render: (r) => formatPercent(r.pctOfSales),
    sortValue: (r) => r.pctOfSales,
  },
];

export const SummaryTab = memo(function SummaryTab({ data }: { data: AuditData }) {
  const { kpis, topAsins, advertisedAsins } = data;

  return (
    <div className="space-y-8">
      <SectionCard title="Overall Performance">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total Revenue" value={formatCurrency(kpis.totalRevenue)} />
          <KpiCard label="Total Spend" value={formatCurrency(kpis.totalSpend)} />
          <KpiCard label="TACOS" value={formatPercent(kpis.tacos)} />
          <KpiCard label="Avg PPC CVR%" value={formatPercent(kpis.avgCvr)} />
          <KpiCard label="Total Units" value={formatNumber(kpis.totalUnits)} />
        </div>
      </SectionCard>

      <SectionCard
        title="Top 10 ASINs by Units Ordered"
        description="Business Report joined with SP Campaign data (Product Ad entity)."
      >
        <DataTable columns={topAsinColumns} rows={topAsins} keyFn={(r) => r.asin} maxHeightPx={520} />
      </SectionCard>

      <SectionCard
        title="Advertised ASIN Performance (SP only)"
        description="Sponsored Products, Entity = Product Ad, grouped by ASIN."
      >
        <DataTable columns={advertisedColumns} rows={advertisedAsins} keyFn={(r) => r.asin} maxHeightPx={520} />
      </SectionCard>
    </div>
  );
});
