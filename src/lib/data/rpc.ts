import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** camelCase shapes the dashboard components render — kept identical to the
 * old client-computed types (LabeledMetricsRow etc.) so metricsColumns() and
 * every DataTable column definition didn't need to change, only where the
 * data comes from. */
export interface OverallKpis {
  totalRevenue: number;
  totalSpend: number;
  tacos: number | null;
  avgCvr: number | null;
  totalUnits: number;
}

export interface TopAsinRow {
  asin: string;
  title: string | null;
  unitsOrdered: number;
  revenue: number;
  aov: number | null;
  cvr: number | null;
  sessions: number;
  pageViewsPerSession: number | null;
  spSpend: number;
  spTacos: number | null;
  pctOfSpSpend: number;
  pctOfUnitSales: number;
}

export interface AdvertisedAsinRow {
  asin: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
  cvr: number | null;
  pctOfSpend: number;
  pctOfSales: number;
}

export interface LabeledMetricsRow {
  label: string;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  spend: number;
  sales: number;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
  cvr: number | null;
  pctOfSpend: number;
  pctOfSales: number;
}

export interface BrandedSplitRow extends LabeledMetricsRow {
  searchTermCount: number;
  hasBrandKeywords: boolean;
}

export interface BrandedSearchTermRow {
  customerSearchTerm: string | null;
  spend: number;
  orders: number;
  clicks: number;
  acos: number | null;
  roas: number | null;
}

export interface WastedSpendRow {
  matchType: string;
  spend: number;
  orders: number;
  searchTermCount: number;
  minClicks: number;
  maxClicks: number;
  highestCpc: number;
}

export interface BleederRow {
  customerSearchTerm: string;
  spend: number;
  orders: number;
  clicks: number;
  avgCpc: number | null;
  highestCpc: number | null;
}

function toLabeledRow(r: {
  label: string;
  impressions: number;
  clicks: number;
  orders: number;
  units: number;
  spend: number;
  sales: number;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
  cvr: number | null;
  pct_of_spend: number;
  pct_of_sales: number;
}): LabeledMetricsRow {
  return {
    label: r.label,
    impressions: r.impressions,
    clicks: r.clicks,
    orders: r.orders,
    units: r.units,
    spend: r.spend,
    sales: r.sales,
    cpc: r.cpc,
    acos: r.acos,
    roas: r.roas,
    cvr: r.cvr,
    pctOfSpend: r.pct_of_spend,
    pctOfSales: r.pct_of_sales,
  };
}

/** Splits an RPC result that ends with a synthetic "Grand Total" row (every
 * fn_* function that returns a category breakdown does this) into the
 * category rows and the footer row DataTable expects separately. */
function splitGrandTotal<T extends { label: string }>(rows: T[]): { rows: T[]; grandTotal: T | undefined } {
  const grandTotal = rows.find((r) => r.label === "Grand Total");
  const rest = rows.filter((r) => r.label !== "Grand Total");
  return { rows: rest, grandTotal };
}

export async function fetchSummaryKpis(supabase: SupabaseClient<Database>, auditId: string): Promise<OverallKpis> {
  console.time(`[PERF] rpc fn_summary_kpis ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_summary_kpis", { p_audit_id: auditId });
    if (error) {
      console.error("[PERF] fn_summary_kpis failed:", error);
      throw new Error(error.message);
    }
    const row = data?.[0];
    return {
      totalRevenue: row?.total_revenue ?? 0,
      totalSpend: row?.total_spend ?? 0,
      tacos: row?.tacos ?? null,
      avgCvr: row?.avg_cvr ?? null,
      totalUnits: row?.total_units ?? 0,
    };
  } finally {
    console.timeEnd(`[PERF] rpc fn_summary_kpis ${auditId}`);
  }
}

export async function fetchTopAsins(supabase: SupabaseClient<Database>, auditId: string): Promise<TopAsinRow[]> {
  console.time(`[PERF] rpc fn_top_asins ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_top_asins", { p_audit_id: auditId, p_limit: 10 });
    if (error) {
      console.error("[PERF] fn_top_asins failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      asin: r.asin,
      title: r.title,
      unitsOrdered: r.units_ordered,
      revenue: r.revenue,
      aov: r.aov,
      cvr: r.cvr,
      sessions: r.sessions,
      pageViewsPerSession: r.page_views_per_session,
      spSpend: r.sp_spend,
      spTacos: r.sp_tacos,
      pctOfSpSpend: r.pct_of_sp_spend,
      pctOfUnitSales: r.pct_of_unit_sales,
    }));
  } finally {
    console.timeEnd(`[PERF] rpc fn_top_asins ${auditId}`);
  }
}

export async function fetchAdvertisedAsinPerformance(
  supabase: SupabaseClient<Database>,
  auditId: string
): Promise<AdvertisedAsinRow[]> {
  console.time(`[PERF] rpc fn_advertised_asin_performance ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_advertised_asin_performance", { p_audit_id: auditId });
    if (error) {
      console.error("[PERF] fn_advertised_asin_performance failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      asin: r.asin,
      impressions: r.impressions,
      clicks: r.clicks,
      orders: r.orders,
      spend: r.spend,
      sales: r.sales,
      cpc: r.cpc,
      acos: r.acos,
      roas: r.roas,
      cvr: r.cvr,
      pctOfSpend: r.pct_of_spend,
      pctOfSales: r.pct_of_sales,
    }));
  } finally {
    console.timeEnd(`[PERF] rpc fn_advertised_asin_performance ${auditId}`);
  }
}

async function fetchLabeledRows(
  supabase: SupabaseClient<Database>,
  fnName: "fn_ad_type_split" | "fn_auto_manual_split" | "fn_placements" | "fn_bidding_strategy",
  auditId: string
): Promise<{ rows: LabeledMetricsRow[]; grandTotal: LabeledMetricsRow | undefined }> {
  console.time(`[PERF] rpc ${fnName} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc(fnName, { p_audit_id: auditId });
    if (error) {
      console.error(`[PERF] ${fnName} failed:`, error);
      throw new Error(error.message);
    }
    return splitGrandTotal((data ?? []).map(toLabeledRow));
  } finally {
    console.timeEnd(`[PERF] rpc ${fnName} ${auditId}`);
  }
}

export const fetchAdTypeSplit = (supabase: SupabaseClient<Database>, auditId: string) =>
  fetchLabeledRows(supabase, "fn_ad_type_split", auditId);

export const fetchAutoManualSplit = (supabase: SupabaseClient<Database>, auditId: string) =>
  fetchLabeledRows(supabase, "fn_auto_manual_split", auditId);

export const fetchPlacements = (supabase: SupabaseClient<Database>, auditId: string) =>
  fetchLabeledRows(supabase, "fn_placements", auditId);

export const fetchBiddingStrategy = (supabase: SupabaseClient<Database>, auditId: string) =>
  fetchLabeledRows(supabase, "fn_bidding_strategy", auditId);

export async function fetchMatchTypeAnalysis(
  supabase: SupabaseClient<Database>,
  auditId: string,
  adType: "sp" | "sb"
): Promise<{ rows: LabeledMetricsRow[]; grandTotal: LabeledMetricsRow | undefined }> {
  console.time(`[PERF] rpc fn_match_type_analysis ${adType} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_match_type_analysis", { p_audit_id: auditId, p_ad_type: adType });
    if (error) {
      console.error("[PERF] fn_match_type_analysis failed:", error);
      throw new Error(error.message);
    }
    return splitGrandTotal((data ?? []).map(toLabeledRow));
  } finally {
    console.timeEnd(`[PERF] rpc fn_match_type_analysis ${adType} ${auditId}`);
  }
}

export type BrandedScope = "both" | "sp" | "sb";

export async function fetchBrandedSplit(
  supabase: SupabaseClient<Database>,
  auditId: string,
  scope: BrandedScope
): Promise<{ branded: BrandedSplitRow; nonBranded: BrandedSplitRow; grandTotal: BrandedSplitRow }> {
  console.time(`[PERF] rpc fn_branded_split ${scope} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_branded_split", { p_audit_id: auditId, p_term_filter: scope });
    if (error) {
      console.error("[PERF] fn_branded_split failed:", error);
      throw new Error(error.message);
    }
    const rows = data ?? [];
    const toBranded = (label: string): BrandedSplitRow => {
      const r = rows.find((row) => row.label === label);
      return {
        ...toLabeledRow(
          r ?? {
            label,
            impressions: 0,
            clicks: 0,
            orders: 0,
            units: 0,
            spend: 0,
            sales: 0,
            cpc: null,
            acos: null,
            roas: null,
            cvr: null,
            pct_of_spend: 0,
            pct_of_sales: 0,
          }
        ),
        searchTermCount: r?.search_term_count ?? 0,
        hasBrandKeywords: r?.has_brand_keywords ?? false,
      };
    };
    return {
      branded: toBranded("Branded"),
      nonBranded: toBranded("Non-Branded"),
      grandTotal: toBranded("Grand Total"),
    };
  } finally {
    console.timeEnd(`[PERF] rpc fn_branded_split ${scope} ${auditId}`);
  }
}

export async function fetchBrandedSearchTerms(
  supabase: SupabaseClient<Database>,
  auditId: string,
  scope: BrandedScope,
  branded: boolean,
  limit = 100,
  offset = 0
): Promise<BrandedSearchTermRow[]> {
  console.time(`[PERF] rpc fn_branded_search_terms ${scope}/${branded} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_branded_search_terms", {
      p_audit_id: auditId,
      p_term_filter: scope,
      p_branded: branded,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      console.error("[PERF] fn_branded_search_terms failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      customerSearchTerm: r.customer_search_term,
      spend: r.spend,
      orders: r.orders,
      clicks: r.clicks,
      acos: r.acos,
      roas: r.roas,
    }));
  } finally {
    console.timeEnd(`[PERF] rpc fn_branded_search_terms ${scope}/${branded} ${auditId}`);
  }
}

export async function fetchWastedSpend(
  supabase: SupabaseClient<Database>,
  auditId: string,
  adType: "sp" | "sb",
  minClicks: number,
  maxClicks: number | null
): Promise<{ rows: WastedSpendRow[]; grandTotal: WastedSpendRow }> {
  console.time(`[PERF] rpc fn_wasted_spend ${adType} ${minClicks}-${maxClicks ?? "+"} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_wasted_spend", {
      p_audit_id: auditId,
      p_ad_type: adType,
      p_min_clicks: minClicks,
      p_max_clicks: maxClicks,
    });
    if (error) {
      console.error("[PERF] fn_wasted_spend failed:", error);
      throw new Error(error.message);
    }
    const mapped = (data ?? []).map((r) => ({
      matchType: r.match_type,
      spend: r.spend,
      orders: r.orders,
      searchTermCount: r.search_term_count,
      minClicks: r.min_clicks,
      maxClicks: r.max_clicks,
      highestCpc: r.highest_cpc,
    }));
    const grandTotal = mapped.find((r) => r.matchType === "Grand Total") ?? {
      matchType: "Grand Total",
      spend: 0,
      orders: 0,
      searchTermCount: 0,
      minClicks: 0,
      maxClicks: 0,
      highestCpc: 0,
    };
    return { rows: mapped.filter((r) => r.matchType !== "Grand Total"), grandTotal };
  } finally {
    console.timeEnd(`[PERF] rpc fn_wasted_spend ${adType} ${minClicks}-${maxClicks ?? "+"} ${auditId}`);
  }
}

export async function fetchBleeders(
  supabase: SupabaseClient<Database>,
  auditId: string,
  adType: "sp" | "sb",
  minSpend: number,
  maxSpend: number | null,
  termType: "both" | "keyword" | "asin",
  limit = 100,
  offset = 0
): Promise<BleederRow[]> {
  console.time(`[PERF] rpc fn_bleeders ${adType} ${minSpend}-${maxSpend ?? "+"} ${termType} ${auditId}`);
  try {
    const { data, error } = await supabase.rpc("fn_bleeders", {
      p_audit_id: auditId,
      p_ad_type: adType,
      p_min_spend: minSpend,
      p_max_spend: maxSpend,
      p_term_type: termType,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      console.error("[PERF] fn_bleeders failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      customerSearchTerm: r.customer_search_term,
      spend: r.spend,
      orders: r.orders,
      clicks: r.clicks,
      avgCpc: r.avg_cpc,
      highestCpc: r.highest_cpc,
    }));
  } finally {
    console.timeEnd(`[PERF] rpc fn_bleeders ${adType} ${minSpend}-${maxSpend ?? "+"} ${termType} ${auditId}`);
  }
}
