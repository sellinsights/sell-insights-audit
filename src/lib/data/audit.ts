import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRow, Database } from "@/types/database";
import { withAuthRetry } from "@/lib/supabase/authRetry";
import { fetchAuditNotes } from "./notes";
import {
  fetchAdTypeSplit,
  fetchAdvertisedAsinPerformance,
  fetchAutoManualSplit,
  fetchBiddingStrategy,
  fetchBrandedSplit,
  fetchMatchTypeAnalysis,
  fetchPlacements,
  fetchSdCostType,
  fetchSummaryKpis,
  fetchTopAsins,
  fetchWastedSpend,
  type AdvertisedAsinRow,
  type BrandedSplitRow,
  type LabeledMetricsRow,
  type OverallKpis,
  type TopAsinRow,
  type WastedSpendRow,
} from "./rpc";

/** No `next/headers`/server imports here — safe to import from Client
 * Components (used for the cache-miss fetch on the audit dashboard). All
 * console.time/console.log calls run wherever this code executes — from a
 * Client Component that means the BROWSER console, not the terminal. */

interface LabeledSection {
  rows: LabeledMetricsRow[];
  grandTotal: LabeledMetricsRow | undefined;
}

interface WastedSpendSection {
  rows: WastedSpendRow[];
  grandTotal: WastedSpendRow;
}

export interface AuditData {
  audit: AuditRow;
  kpis: OverallKpis;
  topAsins: TopAsinRow[];
  advertisedAsins: AdvertisedAsinRow[];
  adTypeSplit: LabeledSection;
  autoManualSplit: LabeledSection;
  spMatchTypes: LabeledSection;
  sbMatchTypes: LabeledSection;
  placements: LabeledSection;
  biddingStrategy: LabeledSection;
  sdCostType: LabeledSection;
  brandedSplit: { branded: BrandedSplitRow; nonBranded: BrandedSplitRow; grandTotal: BrandedSplitRow };
  wastedSpend: {
    spUnder5: WastedSpendSection;
    spOver5: WastedSpendSection;
    sbUnder5: WastedSpendSection;
    sbOver5: WastedSpendSection;
  };
  /** section_key -> note content, one row per section, fetched in a single
   * query and cached alongside everything else — see src/lib/data/notes.ts. */
  notes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Empty fallback shapes — used two places: (1) per-RPC-call .catch() below,
// so one failing function (e.g. fn_sd_cost_type not deployed yet) degrades
// that one section instead of failing the whole dashboard, and (2)
// normalizeAuditData(), so a bundle cached before a field like sdCostType or
// notes existed doesn't crash the UI on a cache hit — cache hits render
// straight from localStorage with no fetch at all, so a stale shape there
// can't be caught by fixing fetchAuditData alone.
// ---------------------------------------------------------------------------
function emptyKpis(): OverallKpis {
  return { totalRevenue: 0, totalSpend: 0, tacos: null, avgCvr: null, totalUnits: 0 };
}

function emptyLabeledSection(): LabeledSection {
  return { rows: [], grandTotal: undefined };
}

function emptyLabeledMetricsRow(label: string): LabeledMetricsRow {
  return {
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
    pctOfSpend: 0,
    pctOfSales: 0,
  };
}

function emptyBrandedSplit(): AuditData["brandedSplit"] {
  const row = (label: string): BrandedSplitRow => ({
    ...emptyLabeledMetricsRow(label),
    searchTermCount: 0,
    hasBrandKeywords: false,
  });
  return { branded: row("Branded"), nonBranded: row("Non-Branded"), grandTotal: row("Grand Total") };
}

function emptyWastedSpendSection(): WastedSpendSection {
  return {
    rows: [],
    grandTotal: { matchType: "Grand Total", spend: 0, orders: 0, searchTermCount: 0, minClicks: 0, maxClicks: 0, highestCpc: 0 },
  };
}

/** Fills in any missing/undefined fields on a (possibly incomplete —
 * e.g. loaded from an old cached bundle) AuditData-shaped object with safe
 * empty defaults, so the dashboard always has something non-crashing to
 * render regardless of when the bundle was created. `audit` is the only
 * field assumed present (it's been part of the cached shape since the
 * caching feature itself was introduced). */
export function normalizeAuditData<T extends { audit: AuditRow } & Partial<AuditData>>(data: T): T & AuditData {
  return {
    ...data,
    kpis: data.kpis ?? emptyKpis(),
    topAsins: data.topAsins ?? [],
    advertisedAsins: data.advertisedAsins ?? [],
    adTypeSplit: data.adTypeSplit ?? emptyLabeledSection(),
    autoManualSplit: data.autoManualSplit ?? emptyLabeledSection(),
    spMatchTypes: data.spMatchTypes ?? emptyLabeledSection(),
    sbMatchTypes: data.sbMatchTypes ?? emptyLabeledSection(),
    placements: data.placements ?? emptyLabeledSection(),
    biddingStrategy: data.biddingStrategy ?? emptyLabeledSection(),
    sdCostType: data.sdCostType ?? emptyLabeledSection(),
    brandedSplit: data.brandedSplit ?? emptyBrandedSplit(),
    wastedSpend: data.wastedSpend ?? {
      spUnder5: emptyWastedSpendSection(),
      spOver5: emptyWastedSpendSection(),
      sbUnder5: emptyWastedSpendSection(),
      sbOver5: emptyWastedSpendSection(),
    },
    notes: data.notes ?? {},
  };
}

/** Loads the whole dashboard as pre-aggregated rows — one RPC call per
 * section, all in parallel, instead of downloading every raw table row and
 * computing KPIs in the browser. Each RPC does its filtering/grouping/summing
 * inside Postgres and returns only the handful of rows the UI renders.
 *
 * Every call below has a `.catch()` fallback: if one RPC fails (a function
 * that isn't deployed yet, a transient error, RLS hiding a table, etc.) that
 * one section degrades to an empty/zeroed state instead of failing the
 * entire dashboard load — the failure is still logged so it's diagnosable. */
export async function fetchAuditData(supabase: SupabaseClient<Database>, auditId: string): Promise<AuditData | null> {
  const perfLabel = `[PERF] fetchAuditData ${auditId}`;
  console.time(perfLabel);
  try {
    console.time("[PERF] fetchAuditData audits row");
    const { data: audit, error: auditError } = await withAuthRetry(supabase, () =>
      supabase.from("audits").select("*").eq("id", auditId).single()
    );
    console.timeEnd("[PERF] fetchAuditData audits row");
    if (auditError) {
      // PGRST116 = "no rows" — expected when RLS hides the row (not this
      // user's audit) or the id is wrong. Anything else is a real failure.
      console.error(`[PERF] fetchAuditData — audits query failed for ${auditId}:`, auditError);
    }
    if (auditError || !audit) return null;

    console.time("[PERF] fetchAuditData all RPC sections (parallel)");
    const [
      kpis,
      topAsins,
      advertisedAsins,
      adTypeSplit,
      autoManualSplit,
      spMatchTypes,
      sbMatchTypes,
      placements,
      biddingStrategy,
      sdCostType,
      brandedSplit,
      spUnder5,
      spOver5,
      sbUnder5,
      sbOver5,
      notes,
    ] = await Promise.all([
      fetchSummaryKpis(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchSummaryKpis failed, defaulting to empty:", err);
        return emptyKpis();
      }),
      fetchTopAsins(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchTopAsins failed, defaulting to empty:", err);
        return [];
      }),
      fetchAdvertisedAsinPerformance(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchAdvertisedAsinPerformance failed, defaulting to empty:", err);
        return [];
      }),
      fetchAdTypeSplit(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchAdTypeSplit failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      fetchAutoManualSplit(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchAutoManualSplit failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      fetchMatchTypeAnalysis(supabase, auditId, "sp").catch((err) => {
        console.error("[PERF] fetchMatchTypeAnalysis(sp) failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      fetchMatchTypeAnalysis(supabase, auditId, "sb").catch((err) => {
        console.error("[PERF] fetchMatchTypeAnalysis(sb) failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      fetchPlacements(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchPlacements failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      fetchBiddingStrategy(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchBiddingStrategy failed, defaulting to empty:", err);
        return emptyLabeledSection();
      }),
      // fn_sd_cost_type is the newest RPC — audits created (or dashboards
      // cached) before it existed must still render fine, and a database
      // that hasn't had supabase-functions.sql re-run yet won't have this
      // function at all, so this is the most likely one to fail in practice.
      fetchSdCostType(supabase, auditId).catch((err) => {
        console.error(
          "[PERF] fetchSdCostType failed (function may not be deployed yet, or this audit predates cost_type) — defaulting to empty:",
          err
        );
        return emptyLabeledSection();
      }),
      fetchBrandedSplit(supabase, auditId, "both").catch((err) => {
        console.error("[PERF] fetchBrandedSplit failed, defaulting to empty:", err);
        return emptyBrandedSplit();
      }),
      fetchWastedSpend(supabase, auditId, "sp", 1, 5).catch((err) => {
        console.error("[PERF] fetchWastedSpend(sp,1-5) failed, defaulting to empty:", err);
        return emptyWastedSpendSection();
      }),
      fetchWastedSpend(supabase, auditId, "sp", 6, null).catch((err) => {
        console.error("[PERF] fetchWastedSpend(sp,6+) failed, defaulting to empty:", err);
        return emptyWastedSpendSection();
      }),
      fetchWastedSpend(supabase, auditId, "sb", 1, 5).catch((err) => {
        console.error("[PERF] fetchWastedSpend(sb,1-5) failed, defaulting to empty:", err);
        return emptyWastedSpendSection();
      }),
      fetchWastedSpend(supabase, auditId, "sb", 6, null).catch((err) => {
        console.error("[PERF] fetchWastedSpend(sb,6+) failed, defaulting to empty:", err);
        return emptyWastedSpendSection();
      }),
      // audit_notes is also new — a database that hasn't had
      // supabase-schema.sql re-run yet won't have this table.
      fetchAuditNotes(supabase, auditId).catch((err) => {
        console.error("[PERF] fetchAuditNotes failed (table may not be deployed yet) — defaulting to empty:", err);
        return {};
      }),
    ]);
    console.timeEnd("[PERF] fetchAuditData all RPC sections (parallel)");

    return normalizeAuditData({
      audit,
      kpis,
      topAsins,
      advertisedAsins,
      adTypeSplit,
      autoManualSplit,
      spMatchTypes,
      sbMatchTypes,
      placements,
      biddingStrategy,
      sdCostType,
      brandedSplit,
      wastedSpend: { spUnder5, spOver5, sbUnder5, sbOver5 },
      notes,
    });
  } catch (err) {
    console.error(`[PERF] fetchAuditData threw for ${auditId}:`, err);
    throw err;
  } finally {
    console.timeEnd(perfLabel);
  }
}

export async function fetchBrandName(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<string | null> {
  console.time(`[PERF] fetchBrandName ${brandId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("brands").select("name").eq("id", brandId).single()
    );
    if (error) {
      console.error(`[PERF] fetchBrandName — query failed for ${brandId}:`, error);
      return null;
    }
    return data?.name ?? null;
  } catch (err) {
    console.error(`[PERF] fetchBrandName threw for ${brandId}:`, err);
    return null;
  } finally {
    console.timeEnd(`[PERF] fetchBrandName ${brandId}`);
  }
}

// BleedersBoard and BrandedVsNonBrandedSection call fn_bleeders /
// fn_branded_split / fn_branded_search_terms directly (via src/lib/data/rpc.ts)
// when their filter/scope toggles change, rather than through this bundle —
// those are interactive, parameter-dependent queries that need a fresh
// server-side re-query, not a client-side re-filter of stale cached rows.
