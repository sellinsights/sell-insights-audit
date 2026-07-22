import type { LabeledMetricsRow } from "@/lib/data/rpc";

/** fn_placements already returns one row per placement category (Top of
 * Search, Rest of Search, Product Pages, Amazon Business, Audience) plus its
 * own Grand Total across all five. This module re-groups those same five
 * rows client-side into the three sub-sections the Ad Analysis tab renders,
 * deriving cpc/acos/roas/cvr/% columns fresh for every combined row instead
 * of reusing any per-category percentage (which was relative to the
 * five-category total, not these sub-section totals). */

type RawTotals = Pick<LabeledMetricsRow, "impressions" | "clicks" | "orders" | "units" | "spend" | "sales">;

function emptyRaw(): RawTotals {
  return { impressions: 0, clicks: 0, orders: 0, units: 0, spend: 0, sales: 0 };
}

function sumRaw(rows: RawTotals[]): RawTotals {
  return rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      orders: acc.orders + r.orders,
      units: acc.units + r.units,
      spend: acc.spend + r.spend,
      sales: acc.sales + r.sales,
    }),
    emptyRaw()
  );
}

function subtractRaw(a: RawTotals, b: RawTotals): RawTotals {
  return {
    impressions: a.impressions - b.impressions,
    clicks: a.clicks - b.clicks,
    orders: a.orders - b.orders,
    units: a.units - b.units,
    spend: a.spend - b.spend,
    sales: a.sales - b.sales,
  };
}

/** Mirrors fn_derive_metrics' formulas so client-recombined rows use the
 * same math as every server-aggregated row. pct columns are relative to
 * `totalSpend`/`totalSales` (always Sub-Section A's Grand Total here, so
 * every sub-section's own Grand Total row reads 100%). */
function deriveRow(label: string, raw: RawTotals, totalSpend: number, totalSales: number): LabeledMetricsRow {
  const { impressions, clicks, orders, units, spend, sales } = raw;
  return {
    label,
    impressions,
    clicks,
    orders,
    units,
    spend,
    sales,
    cpc: clicks > 0 ? spend / clicks : null,
    acos: sales > 0 ? (spend / sales) * 100 : null,
    roas: spend > 0 ? sales / spend : null,
    cvr: clicks > 0 ? (orders / clicks) * 100 : null,
    pctOfSpend: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
    pctOfSales: totalSales > 0 ? (sales / totalSales) * 100 : 0,
  };
}

function findRaw(rows: LabeledMetricsRow[], label: string): RawTotals {
  const row = rows.find((r) => r.label === label);
  return row ? { impressions: row.impressions, clicks: row.clicks, orders: row.orders, units: row.units, spend: row.spend, sales: row.sales } : emptyRaw();
}

export interface PlacementSubsection {
  rows: LabeledMetricsRow[];
  grandTotal: LabeledMetricsRow;
}

export interface PlacementSubsections {
  /** Sub-section A — Placement Analysis: Top of Search, Rest of Search, Product Pages. */
  core: PlacementSubsection;
  /** Sub-section B — Business Placement Analysis: Amazon Business, Non-Amazon Business. */
  business: PlacementSubsection;
  /** Sub-section C — Audience Placement Analysis: Audience, Non-Audience. */
  audience: PlacementSubsection;
}

export function buildPlacementSubsections(placementRows: LabeledMetricsRow[]): PlacementSubsections {
  const tosRaw = findRaw(placementRows, "Top of Search");
  const rosRaw = findRaw(placementRows, "Rest of Search");
  const ppRaw = findRaw(placementRows, "Product Pages");
  const amazonBusinessRaw = findRaw(placementRows, "Amazon Business");
  const audienceRaw = findRaw(placementRows, "Audience");

  const coreRaw = sumRaw([tosRaw, rosRaw, ppRaw]);
  const coreTotal = deriveRow("Grand Total", coreRaw, coreRaw.spend, coreRaw.sales);

  const nonAmazonBusinessRaw = subtractRaw(coreRaw, amazonBusinessRaw);
  const nonAudienceRaw = subtractRaw(coreRaw, audienceRaw);

  return {
    core: {
      rows: [
        deriveRow("Top of Search", tosRaw, coreRaw.spend, coreRaw.sales),
        deriveRow("Rest of Search", rosRaw, coreRaw.spend, coreRaw.sales),
        deriveRow("Product Pages", ppRaw, coreRaw.spend, coreRaw.sales),
      ],
      grandTotal: coreTotal,
    },
    business: {
      rows: [
        deriveRow("Amazon Business", amazonBusinessRaw, coreRaw.spend, coreRaw.sales),
        deriveRow("Non-Amazon Business", nonAmazonBusinessRaw, coreRaw.spend, coreRaw.sales),
      ],
      grandTotal: coreTotal,
    },
    audience: {
      rows: [
        deriveRow("Audience", audienceRaw, coreRaw.spend, coreRaw.sales),
        deriveRow("Non-Audience", nonAudienceRaw, coreRaw.spend, coreRaw.sales),
      ],
      grandTotal: coreTotal,
    },
  };
}
