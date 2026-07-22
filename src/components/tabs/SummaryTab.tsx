import { memo, useMemo } from "react";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { DataTable, type Column } from "@/components/DataTable";
import { asinColumn } from "@/components/amazonLinkColumns";
import { formatCurrency, formatNumber, formatPercent, formatDecimal } from "@/lib/format";
import { formatCount } from "@/lib/formatCount";
import type { AdvertisedAsinRow, TopAsinRow } from "@/lib/data/rpc";
import type { AuditData } from "@/lib/data/audit";

function buildTopAsinColumns(marketplace: string | null): Column<TopAsinRow>[] {
  return [
  asinColumn({ getAsin: (r) => r.asin, marketplace }),
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
}

/** Client-side Grand Total for Top ASINs — fn_top_asins returns individual
 * ASIN rows only. AOV/CVR%/TACOS% are recomputed as ratios of the summed
 * totals (not an average of each row's already-divided value) — CVR% in
 * particular needs the raw spClicks/spOrders fn_top_asins added for exactly
 * this, since averaging each row's cvr would misweight low-click ASINs. % of
 * SP Spend and % of Unit Sales are already per-row percentages of the same
 * grand total, so they just sum (to ~100%). */
function computeTopAsinGrandTotal(rows: TopAsinRow[]): TopAsinRow | undefined {
  if (rows.length === 0) return undefined;
  let unitsOrdered = 0;
  let revenue = 0;
  let sessions = 0;
  let spSpend = 0;
  let spClicks = 0;
  let spOrders = 0;
  let pctOfSpSpend = 0;
  let pctOfUnitSales = 0;
  for (const r of rows) {
    unitsOrdered += r.unitsOrdered;
    revenue += r.revenue;
    sessions += r.sessions;
    spSpend += r.spSpend;
    spClicks += r.spClicks;
    spOrders += r.spOrders;
    pctOfSpSpend += r.pctOfSpSpend;
    pctOfUnitSales += r.pctOfUnitSales;
  }
  return {
    asin: "Grand Total",
    title: null,
    unitsOrdered,
    revenue,
    aov: unitsOrdered > 0 ? revenue / unitsOrdered : null,
    cvr: spClicks > 0 ? (spOrders / spClicks) * 100 : null,
    sessions,
    pageViewsPerSession: null,
    spSpend,
    spClicks,
    spOrders,
    spTacos: revenue > 0 ? (spSpend / revenue) * 100 : null,
    pctOfSpSpend,
    pctOfUnitSales,
  };
}

/** Client-side Grand Total for Advertised ASIN Performance — same
 * ratio-of-sums approach as every other metrics Grand Total in this app. */
function computeAdvertisedGrandTotal(rows: AdvertisedAsinRow[]): AdvertisedAsinRow | undefined {
  if (rows.length === 0) return undefined;
  let impressions = 0;
  let clicks = 0;
  let orders = 0;
  let spend = 0;
  let sales = 0;
  let pctOfSpend = 0;
  let pctOfSales = 0;
  for (const r of rows) {
    impressions += r.impressions;
    clicks += r.clicks;
    orders += r.orders;
    spend += r.spend;
    sales += r.sales;
    pctOfSpend += r.pctOfSpend;
    pctOfSales += r.pctOfSales;
  }
  return {
    asin: "Grand Total",
    impressions,
    clicks,
    orders,
    spend,
    sales,
    cpc: clicks > 0 ? spend / clicks : null,
    acos: sales > 0 ? (spend / sales) * 100 : null,
    roas: spend > 0 ? sales / spend : null,
    cvr: clicks > 0 ? (orders / clicks) * 100 : null,
    pctOfSpend,
    pctOfSales,
  };
}

function buildAdvertisedColumns(marketplace: string | null): Column<AdvertisedAsinRow>[] {
  return [
  asinColumn({ getAsin: (r) => r.asin, marketplace }),
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
}

export const SummaryTab = memo(function SummaryTab({ data }: { data: AuditData }) {
  const { kpis, topAsins, advertisedAsins } = data;
  const marketplace = data.audit.marketplace;
  const topAsinColumns = useMemo(() => buildTopAsinColumns(marketplace), [marketplace]);
  const advertisedColumns = useMemo(() => buildAdvertisedColumns(marketplace), [marketplace]);
  const topAsinGrandTotal = useMemo(() => computeTopAsinGrandTotal(topAsins), [topAsins]);
  const advertisedGrandTotal = useMemo(() => computeAdvertisedGrandTotal(advertisedAsins), [advertisedAsins]);

  return (
    <div className="space-y-8">
      <SectionCard title="Overall Performance" sectionKey="summary_overall_performance">
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
        count={formatCount(topAsins.length, "ASIN")}
        sectionKey="summary_top_asins"
      >
        <DataTable
          columns={topAsinColumns}
          rows={topAsins}
          footer={topAsinGrandTotal}
          keyFn={(r) => r.asin}
          maxHeightPx={520}
        />
      </SectionCard>

      <SectionCard
        title="Advertised ASIN Performance (SP only)"
        description="Sponsored Products, Entity = Product Ad, grouped by ASIN."
        count={formatCount(advertisedAsins.length, "ASIN")}
        sectionKey="summary_advertised_asin"
      >
        <DataTable
          columns={advertisedColumns}
          rows={advertisedAsins}
          footer={advertisedGrandTotal}
          keyFn={(r) => r.asin}
          maxHeightPx={520}
        />
      </SectionCard>
    </div>
  );
});
