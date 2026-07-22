import { memo } from "react";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { DataTable, type Column } from "@/components/DataTable";
import { formatCurrency, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import type { AdvertisedAsinRow, TopAsinRow } from "@/lib/data/rpc";
import type { AuditData } from "@/lib/data/audit";

const topAsinColumns: Column<TopAsinRow>[] = [
  { key: "asin", header: "ASIN", render: (r) => <span className="font-medium text-navy">{r.asin}</span> },
  { key: "units", header: "Units Ordered", align: "right", render: (r) => formatNumber(r.unitsOrdered) },
  { key: "revenue", header: "Revenue", align: "right", render: (r) => formatCurrency(r.revenue) },
  { key: "aov", header: "AOV", align: "right", render: (r) => formatCurrency(r.aov) },
  { key: "cvr", header: "CVR%", align: "right", render: (r) => formatPercent(r.cvr) },
  { key: "sessions", header: "Sessions", align: "right", render: (r) => formatNumber(r.sessions) },
  { key: "pvps", header: "Page Views / Session", align: "right", render: (r) => formatDecimal(r.pageViewsPerSession) },
  { key: "spSpend", header: "Ad Spend (SP)", align: "right", render: (r) => formatCurrency(r.spSpend) },
  { key: "spTacos", header: "TACOS% (SP)", align: "right", render: (r) => formatPercent(r.spTacos) },
  { key: "pctSpSpend", header: "% of SP Spend", align: "right", render: (r) => formatPercent(r.pctOfSpSpend) },
  { key: "pctUnits", header: "% of Unit Sales", align: "right", render: (r) => formatPercent(r.pctOfUnitSales) },
];

const advertisedColumns: Column<AdvertisedAsinRow>[] = [
  { key: "asin", header: "ASIN", render: (r) => <span className="font-medium text-navy">{r.asin}</span> },
  { key: "impressions", header: "Impressions", align: "right", render: (r) => formatNumber(r.impressions) },
  { key: "clicks", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
  { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders) },
  { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend) },
  { key: "sales", header: "Sales", align: "right", render: (r) => formatCurrency(r.sales) },
  { key: "cpc", header: "CPC", align: "right", render: (r) => formatCurrency(r.cpc) },
  { key: "acos", header: "ACOS", align: "right", render: (r) => formatPercent(r.acos) },
  { key: "roas", header: "ROAS", align: "right", render: (r) => formatDecimal(r.roas) },
  { key: "cvr", header: "CVR%", align: "right", render: (r) => formatPercent(r.cvr) },
  { key: "pctSpend", header: "% of Spend", align: "right", render: (r) => formatPercent(r.pctOfSpend) },
  { key: "pctSales", header: "% of Sales", align: "right", render: (r) => formatPercent(r.pctOfSales) },
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
          <KpiCard label="Average CVR%" value={formatPercent(kpis.avgCvr)} />
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
