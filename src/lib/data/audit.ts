import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRow, Database } from "@/types/database";
import {
  fetchAdTypeSplit,
  fetchAdvertisedAsinPerformance,
  fetchAutoManualSplit,
  fetchBiddingStrategy,
  fetchBrandedSplit,
  fetchMatchTypeAnalysis,
  fetchPlacements,
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
  brandedSplit: { branded: BrandedSplitRow; nonBranded: BrandedSplitRow; grandTotal: BrandedSplitRow };
  wastedSpend: {
    spUnder5: WastedSpendSection;
    spOver5: WastedSpendSection;
    sbUnder5: WastedSpendSection;
    sbOver5: WastedSpendSection;
  };
}

/** Loads the whole dashboard as pre-aggregated rows — one RPC call per
 * section, all in parallel, instead of downloading every raw table row and
 * computing KPIs in the browser. Each RPC does its filtering/grouping/summing
 * inside Postgres and returns only the handful of rows the UI renders. */
export async function fetchAuditData(supabase: SupabaseClient<Database>, auditId: string): Promise<AuditData | null> {
  const perfLabel = `[PERF] fetchAuditData ${auditId}`;
  console.time(perfLabel);
  try {
    console.time("[PERF] fetchAuditData audits row");
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("*")
      .eq("id", auditId)
      .single();
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
      brandedSplit,
      spUnder5,
      spOver5,
      sbUnder5,
      sbOver5,
    ] = await Promise.all([
      fetchSummaryKpis(supabase, auditId),
      fetchTopAsins(supabase, auditId),
      fetchAdvertisedAsinPerformance(supabase, auditId),
      fetchAdTypeSplit(supabase, auditId),
      fetchAutoManualSplit(supabase, auditId),
      fetchMatchTypeAnalysis(supabase, auditId, "sp"),
      fetchMatchTypeAnalysis(supabase, auditId, "sb"),
      fetchPlacements(supabase, auditId),
      fetchBiddingStrategy(supabase, auditId),
      fetchBrandedSplit(supabase, auditId, "both"),
      fetchWastedSpend(supabase, auditId, "sp", 1, 5),
      fetchWastedSpend(supabase, auditId, "sp", 6, null),
      fetchWastedSpend(supabase, auditId, "sb", 1, 5),
      fetchWastedSpend(supabase, auditId, "sb", 6, null),
    ]);
    console.timeEnd("[PERF] fetchAuditData all RPC sections (parallel)");

    return {
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
      brandedSplit,
      wastedSpend: { spUnder5, spOver5, sbUnder5, sbOver5 },
    };
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
    const { data, error } = await supabase.from("brands").select("name").eq("id", brandId).single();
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
