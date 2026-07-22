import type { Column } from "@/components/DataTable";
import type { LabeledMetricsRow } from "@/lib/data/rpc";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

/** Standard column order used across every Ad Analysis / metrics table:
 * Impressions, Clicks, Orders, Spend, Sales, CPC, ACOS, ROAS, PPC CVR%, % of
 * Spend, % of Sales — with a leading label column. */
export function metricsColumns(labelHeader: string): Column<LabeledMetricsRow>[] {
  return [
    {
      key: "label",
      header: labelHeader,
      render: (r) => (
        <span className={r.label === "Grand Total" ? "font-semibold text-navy" : "font-medium text-navy"}>
          {r.label}
        </span>
      ),
      sortValue: (r) => r.label,
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
      key: "pctOfSpend",
      header: "% of Spend",
      align: "right",
      render: (r) => formatPercent(r.pctOfSpend),
      sortValue: (r) => r.pctOfSpend,
    },
    {
      key: "pctOfSales",
      header: "% of Sales",
      align: "right",
      render: (r) => formatPercent(r.pctOfSales),
      sortValue: (r) => r.pctOfSales,
    },
  ];
}
