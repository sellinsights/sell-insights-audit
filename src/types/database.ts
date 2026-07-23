// Hand-written types mirroring supabase-schema.sql. If you regenerate this
// project against a live Supabase project, prefer swapping this file for the
// output of `supabase gen types typescript`.
//
// NOTE: every row shape below is a `type` alias, not an `interface`. The
// Supabase client's generic `Database` constraint requires each table's Row
// to structurally satisfy `Record<string, unknown>`, and TypeScript only
// recognizes that for plain object type aliases — a named `interface`
// (even with identical members) does not satisfy an index-signature
// constraint, which silently collapses every query's inferred type to
// `never`.

import type {
  AdvertisedAsinRpcRow,
  BleederRpcRow,
  BrandedSearchTermRpcRow,
  BrandedSplitRpcRow,
  LabeledMetricsRpcRow,
  ListUserRpcRow,
  OpportunityRpcRow,
  SummaryKpisRpcRow,
  TopAsinRpcRow,
  WastedSpendRpcRow,
} from "./rpc";

export type AuditStatus = "draft" | "processing" | "complete";
/** admin: full access + user management + delete. team: full data access,
 * no delete, no user management. client: read-only, brand-scoped via
 * client_brand_access. `null` (no row in user_roles) means no access yet —
 * every RLS policy and every role check in the app treats it as the most
 * restrictive state, not as a fallback to any particular role. */
export type UserRole = "admin" | "team" | "client";
export type AuditFileType =
  | "business_report"
  | "bulk_ads"
  | "sqp"
  | "brand_keywords"
  | "top_keywords";
export type SearchTermType = "keyword" | "asin";

export type BrandRow = {
  id: string;
  name: string;
  logo_url: string | null;
  created_by: string;
  created_at: string;
};

export type AuditRow = {
  id: string;
  brand_id: string;
  title: string;
  status: AuditStatus;
  /** Amazon marketplace this audit's data belongs to (e.g. "US", "UK") —
   * see src/lib/marketplace.ts for the full supported list. Nullable at the
   * type level because audits created before this column existed won't have
   * it until the DB backfill runs; every marketplace-aware consumer treats
   * null the same as "US". */
  marketplace: string | null;
  created_by: string;
  created_at: string;
  /** Bumped by a DB trigger on every UPDATE — the cache-invalidation check on
   * the audit dashboard compares this against the cached value to detect
   * changes made from another device/session. Nullable at the type level for
   * the same reason as `marketplace`: rows that predate the column. */
  updated_at: string | null;
};

export type AuditFileRow = {
  id: string;
  audit_id: string;
  file_type: AuditFileType;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
};

export type BusinessReportRow = {
  id: string;
  audit_id: string;
  parent_asin: string | null;
  child_asin: string | null;
  title: string | null;
  sessions_total: number | null;
  session_percentage_total: number | null;
  page_views_total: number | null;
  page_views_percentage_total: number | null;
  buy_box_percentage: number | null;
  units_ordered: number | null;
  unit_session_percentage: number | null;
  ordered_product_sales: number | null;
  total_order_items: number | null;
};

/** Shared ad-performance metrics present on every campaign / search-term table. */
export type AdMetrics = {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  conversion_rate: number | null;
  acos: number | null;
  cpc: number | null;
  roas: number | null;
};

export type SpCampaignRow = AdMetrics & {
  id: string;
  audit_id: string;
  entity: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  targeting_type: string | null;
  state: string | null;
  asin: string | null;
  sku: string | null;
  match_type: string | null;
  bidding_strategy: string | null;
  placement: string | null;
  product_targeting_expression: string | null;
  final_match_type: string | null;
};

export type SbCampaignRow = AdMetrics & {
  id: string;
  audit_id: string;
  entity: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  state: string | null;
  asin: string | null;
  match_type: string | null;
  product_targeting_expression: string | null;
  final_match_type: string | null;
};

export type SdCampaignRow = AdMetrics & {
  id: string;
  audit_id: string;
  entity: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  targeting_type: string | null;
  state: string | null;
  asin: string | null;
  sku: string | null;
  cost_type: string | null;
};

export type SearchTermRow = AdMetrics & {
  id: string;
  audit_id: string;
  campaign_name: string | null;
  ad_group_name: string | null;
  keyword_text: string | null;
  match_type: string | null;
  product_targeting_expression: string | null;
  final_match_type: string | null;
  customer_search_term: string | null;
  search_term_type: SearchTermType | null;
};

export type BrandKeywordRow = {
  id: string;
  audit_id: string;
  keyword: string;
};

export type AuditNoteRow = {
  id: string;
  audit_id: string;
  section_key: string;
  content: string;
  updated_at: string;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
};

export type ClientBrandAccessRow = {
  id: string;
  user_id: string;
  brand_id: string;
  created_at: string;
};

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type FunctionDef<Args, Returns> = {
  Args: Args;
  Returns: Returns;
};

export type Database = {
  public: {
    Tables: {
      brands: TableDef<
        BrandRow,
        Omit<BrandRow, "id" | "created_at" | "logo_url"> &
          Partial<Pick<BrandRow, "id" | "created_at" | "logo_url">>
      >;
      audits: TableDef<
        AuditRow,
        Omit<AuditRow, "id" | "created_at" | "updated_at" | "status" | "marketplace"> &
          Partial<Pick<AuditRow, "id" | "created_at" | "updated_at" | "status" | "marketplace">>
      >;
      audit_files: TableDef<
        AuditFileRow,
        Omit<AuditFileRow, "id" | "uploaded_at"> &
          Partial<Pick<AuditFileRow, "id" | "uploaded_at">>
      >;
      business_report_data: TableDef<
        BusinessReportRow,
        Omit<BusinessReportRow, "id"> & Partial<Pick<BusinessReportRow, "id">>
      >;
      sp_campaign_data: TableDef<
        SpCampaignRow,
        Omit<SpCampaignRow, "id"> & Partial<Pick<SpCampaignRow, "id">>
      >;
      sb_campaign_data: TableDef<
        SbCampaignRow,
        Omit<SbCampaignRow, "id"> & Partial<Pick<SbCampaignRow, "id">>
      >;
      sd_campaign_data: TableDef<
        SdCampaignRow,
        Omit<SdCampaignRow, "id"> & Partial<Pick<SdCampaignRow, "id">>
      >;
      sp_search_term_data: TableDef<
        SearchTermRow,
        Omit<SearchTermRow, "id"> & Partial<Pick<SearchTermRow, "id">>
      >;
      sb_search_term_data: TableDef<
        SearchTermRow,
        Omit<SearchTermRow, "id"> & Partial<Pick<SearchTermRow, "id">>
      >;
      brand_keywords: TableDef<
        BrandKeywordRow,
        Omit<BrandKeywordRow, "id"> & Partial<Pick<BrandKeywordRow, "id">>
      >;
      audit_notes: TableDef<
        AuditNoteRow,
        Omit<AuditNoteRow, "id" | "updated_at"> & Partial<Pick<AuditNoteRow, "id" | "updated_at">>
      >;
      user_roles: TableDef<
        UserRoleRow,
        Omit<UserRoleRow, "id" | "created_at"> & Partial<Pick<UserRoleRow, "id" | "created_at">>
      >;
      client_brand_access: TableDef<
        ClientBrandAccessRow,
        Omit<ClientBrandAccessRow, "id" | "created_at"> & Partial<Pick<ClientBrandAccessRow, "id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      fn_summary_kpis: FunctionDef<{ p_audit_id: string }, SummaryKpisRpcRow[]>;
      fn_top_asins: FunctionDef<{ p_audit_id: string; p_limit?: number }, TopAsinRpcRow[]>;
      fn_advertised_asin_performance: FunctionDef<{ p_audit_id: string }, AdvertisedAsinRpcRow[]>;
      fn_ad_type_split: FunctionDef<{ p_audit_id: string }, LabeledMetricsRpcRow[]>;
      fn_auto_manual_split: FunctionDef<{ p_audit_id: string }, LabeledMetricsRpcRow[]>;
      fn_match_type_analysis: FunctionDef<{ p_audit_id: string; p_ad_type: string }, LabeledMetricsRpcRow[]>;
      fn_placements: FunctionDef<{ p_audit_id: string }, LabeledMetricsRpcRow[]>;
      fn_bidding_strategy: FunctionDef<{ p_audit_id: string }, LabeledMetricsRpcRow[]>;
      fn_sd_cost_type: FunctionDef<{ p_audit_id: string }, LabeledMetricsRpcRow[]>;
      fn_branded_split: FunctionDef<{ p_audit_id: string; p_term_filter?: string }, BrandedSplitRpcRow[]>;
      fn_branded_search_terms: FunctionDef<
        { p_audit_id: string; p_term_filter: string; p_branded: boolean; p_limit?: number; p_offset?: number },
        BrandedSearchTermRpcRow[]
      >;
      fn_wasted_spend: FunctionDef<
        { p_audit_id: string; p_ad_type: string; p_min_clicks: number; p_max_clicks?: number | null },
        WastedSpendRpcRow[]
      >;
      fn_bleeders: FunctionDef<
        {
          p_audit_id: string;
          p_ad_type: string;
          p_min_spend: number;
          p_max_spend?: number | null;
          p_term_type?: string;
          p_limit?: number;
          p_offset?: number;
        },
        BleederRpcRow[]
      >;
      fn_acos_improvement: FunctionDef<
        { p_audit_id: string; p_ad_type?: string; p_term_type?: string; p_limit?: number; p_offset?: number },
        OpportunityRpcRow[]
      >;
      fn_scale_opportunities: FunctionDef<
        { p_audit_id: string; p_ad_type?: string; p_term_type?: string; p_limit?: number; p_offset?: number },
        OpportunityRpcRow[]
      >;
      fn_cost_reduction: FunctionDef<
        { p_audit_id: string; p_ad_type?: string; p_term_type?: string; p_limit?: number; p_offset?: number },
        OpportunityRpcRow[]
      >;
      fn_list_users: FunctionDef<Record<string, never>, ListUserRpcRow[]>;
    };
  };
};
