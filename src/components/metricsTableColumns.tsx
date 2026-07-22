import type { Column } from "@/components/DataTable";
import type { LabeledMetricsRow } from "@/lib/data/rpc";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

/** Standard column order used across every Ad Analysis / metrics table:
 * Impressions, Clicks, Orders, Spend, Sales, CPC, ACOS, ROAS, CVR%, % of
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
    },
    { key: "impressions", header: "Impressions", align: "right", render: (r) => formatNumber(r.impressions) },
    { key: "clicks", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
    { key: "orders", header: "Orders", align: "right", render: (r) => formatNumber(r.orders) },
    { key: "spend", header: "Spend", align: "right", render: (r) => formatCurrency(r.spend) },
    { key: "sales", header: "Sales", align: "right", render: (r) => formatCurrency(r.sales) },
    { key: "cpc", header: "CPC", align: "right", render: (r) => formatCurrency(r.cpc) },
    { key: "acos", header: "ACOS", align: "right", render: (r) => formatPercent(r.acos) },
    { key: "roas", header: "ROAS", align: "right", render: (r) => formatDecimal(r.roas) },
    { key: "cvr", header: "CVR%", align: "right", render: (r) => formatPercent(r.cvr) },
    { key: "pctOfSpend", header: "% of Spend", align: "right", render: (r) => formatPercent(r.pctOfSpend) },
    { key: "pctOfSales", header: "% of Sales", align: "right", render: (r) => formatPercent(r.pctOfSales) },
  ];
}
