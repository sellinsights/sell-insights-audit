// Raw (snake_case) row shapes returned by the Postgres functions in
// supabase-functions.sql — mirrors each function's `returns table(...)`
// column list exactly. src/lib/data/rpc.ts maps these into the camelCase
// shapes the dashboard components expect.

export interface SummaryKpisRpcRow {
  total_revenue: number;
  total_spend: number;
  tacos: number | null;
  avg_cvr: number | null;
  total_units: number;
}

export interface TopAsinRpcRow {
  asin: string;
  title: string | null;
  units_ordered: number;
  revenue: number;
  aov: number | null;
  cvr: number | null;
  sessions: number;
  page_views_per_session: number | null;
  sp_spend: number;
  sp_clicks: number;
  sp_orders: number;
  sp_tacos: number | null;
  pct_of_sp_spend: number;
  pct_of_unit_sales: number;
}

export interface AdvertisedAsinRpcRow {
  asin: string;
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
}

export interface LabeledMetricsRpcRow {
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
}

export interface BrandedSplitRpcRow extends LabeledMetricsRpcRow {
  search_term_count: number;
  has_brand_keywords: boolean;
}

export interface BrandedSearchTermRpcRow {
  customer_search_term: string | null;
  spend: number;
  orders: number;
  clicks: number;
  acos: number | null;
  roas: number | null;
}

export interface WastedSpendRpcRow {
  match_type: string;
  spend: number;
  orders: number;
  search_term_count: number;
  min_clicks: number;
  max_clicks: number;
  highest_cpc: number;
}

export interface BleederRpcRow {
  customer_search_term: string;
  spend: number;
  orders: number;
  clicks: number;
  avg_cpc: number | null;
  highest_cpc: number | null;
}

/** Shared shape for fn_acos_improvement / fn_scale_opportunities /
 * fn_cost_reduction — individual search-term rows plus a denormalized
 * `total_count` (via `count(*) over()`) on every row, so the client knows
 * how many results exist for the current filter without a second query. */
export interface OpportunityRpcRow {
  customer_search_term: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  cpc: number | null;
  acos: number | null;
  roas: number | null;
  cvr: number | null;
  total_count: number;
}

/** fn_list_users — role is null for a user with no user_roles row yet. */
export interface ListUserRpcRow {
  id: string;
  email: string | null;
  created_at: string;
  role: string | null;
}
