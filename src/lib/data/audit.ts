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

type RpcOutcome = "ok" | "empty" | "error";

interface RpcLogEntry {
  section: string;
  outcome: RpcOutcome;
  detail: string;
}

/** Wraps one RPC call so its outcome (succeeded with data / succeeded but
 * empty / failed) is recorded for the summary table fetchAuditData prints at
 * the end, regardless of which of the 16 parallel calls it is. "Empty" is
 * tracked separately from "error" on purpose — an empty section (an audit
 * genuinely has no SD campaigns, say) is normal, but a wall of empty
 * sections that should have data is exactly the RLS-misconfiguration
 * symptom this exists to make visible at a glance. */
function trackRpc<T>(
  log: RpcLogEntry[],
  section: string,
  promise: Promise<T>,
  fallback: T,
  isEmpty: (value: T) => boolean
): Promise<T> {
  return promise
    .then((value) => {
      log.push({ section, outcome: isEmpty(value) ? "empty" : "ok", detail: isEmpty(value) ? "0 rows / all-zero" : "has data" });
      return value;
    })
    .catch((err: unknown) => {
      console.error(`[PERF] ${section} failed, defaulting to empty:`, err);
      log.push({ section, outcome: "error", detail: err instanceof Error ? err.message : String(err) });
      return fallback;
    });
}

function logRpcOutcomes(auditId: string, log: RpcLogEntry[]): void {
  console.log(`[PERF] fetchAuditData ${auditId} — RPC call outcomes:`);
  console.table(log.map((e) => ({ section: e.section, outcome: e.outcome.toUpperCase(), detail: e.detail })));
  const failed = log.filter((e) => e.outcome === "error");
  const empty = log.filter((e) => e.outcome === "empty");
  if (failed.length > 0) {
    console.warn(
      `[PERF] ${failed.length}/${log.length} RPC call(s) FAILED and fell back to empty:`,
      failed.map((e) => e.section)
    );
  }
  if (empty.length > 0) {
    console.log(
      `[PERF] ${empty.length}/${log.length} RPC call(s) succeeded but returned no data (may be genuinely empty, or a sign of an RLS/access issue if unexpected):`,
      empty.map((e) => e.section)
    );
  }
}

/** Loads the whole dashboard as pre-aggregated rows — one RPC call per
 * section, all in parallel, instead of downloading every raw table row and
 * computing KPIs in the browser. Each RPC does its filtering/grouping/summing
 * inside Postgres and returns only the handful of rows the UI renders.
 *
 * Every call below has a `.catch()` fallback (via trackRpc): if one RPC
 * fails (a function that isn't deployed yet, a transient error, an RLS/access
 * issue, etc.) that one section degrades to an empty/zeroed state instead of
 * failing the entire dashboard load — the failure is still logged, and
 * logRpcOutcomes() prints a single table at the end showing every section's
 * status so a partial-data page is diagnosable at a glance instead of
 * requiring a scroll through 16 separate console.error calls. */
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
      // PGRST116 = "no rows" — expected when the id is wrong or the audit
      // was deleted (RLS now grants every authenticated user access to
      // every audit, so ownership is no longer a possible cause). Anything
      // else is a real failure.
      console.error(`[PERF] fetchAuditData — audits query failed for ${auditId}:`, auditError);
    }
    if (auditError || !audit) return null;

    console.time("[PERF] fetchAuditData all RPC sections (parallel)");
    const rpcLog: RpcLogEntry[] = [];
    const isEmptyKpis = (k: OverallKpis) => k.totalRevenue === 0 && k.totalSpend === 0 && k.totalUnits === 0;
    const isEmptyArray = (rows: unknown[]) => rows.length === 0;
    const isEmptySection = (s: LabeledSection) => s.rows.length === 0;
    const isEmptyWastedSpend = (s: WastedSpendSection) => s.rows.length === 0;
    const isEmptyBranded = (b: AuditData["brandedSplit"]) =>
      b.grandTotal.spend === 0 && b.grandTotal.searchTermCount === 0;
    const isEmptyNotes = (n: Record<string, string>) => Object.keys(n).length === 0;

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
      trackRpc(rpcLog, "fn_summary_kpis", fetchSummaryKpis(supabase, auditId), emptyKpis(), isEmptyKpis),
      trackRpc(rpcLog, "fn_top_asins", fetchTopAsins(supabase, auditId), [], isEmptyArray),
      trackRpc(
        rpcLog,
        "fn_advertised_asin_performance",
        fetchAdvertisedAsinPerformance(supabase, auditId),
        [],
        isEmptyArray
      ),
      trackRpc(rpcLog, "fn_ad_type_split", fetchAdTypeSplit(supabase, auditId), emptyLabeledSection(), isEmptySection),
      trackRpc(
        rpcLog,
        "fn_auto_manual_split",
        fetchAutoManualSplit(supabase, auditId),
        emptyLabeledSection(),
        isEmptySection
      ),
      trackRpc(
        rpcLog,
        "fn_match_type_analysis(sp)",
        fetchMatchTypeAnalysis(supabase, auditId, "sp"),
        emptyLabeledSection(),
        isEmptySection
      ),
      trackRpc(
        rpcLog,
        "fn_match_type_analysis(sb)",
        fetchMatchTypeAnalysis(supabase, auditId, "sb"),
        emptyLabeledSection(),
        isEmptySection
      ),
      trackRpc(rpcLog, "fn_placements", fetchPlacements(supabase, auditId), emptyLabeledSection(), isEmptySection),
      trackRpc(
        rpcLog,
        "fn_bidding_strategy",
        fetchBiddingStrategy(supabase, auditId),
        emptyLabeledSection(),
        isEmptySection
      ),
      // fn_sd_cost_type is the newest RPC — audits created (or dashboards
      // cached) before it existed must still render fine, and a database
      // that hasn't had supabase-functions.sql re-run yet won't have this
      // function at all, so this is the most likely one to fail in practice.
      trackRpc(rpcLog, "fn_sd_cost_type", fetchSdCostType(supabase, auditId), emptyLabeledSection(), isEmptySection),
      trackRpc(
        rpcLog,
        "fn_branded_split",
        fetchBrandedSplit(supabase, auditId, "both"),
        emptyBrandedSplit(),
        isEmptyBranded
      ),
      trackRpc(
        rpcLog,
        "fn_wasted_spend(sp,1-5)",
        fetchWastedSpend(supabase, auditId, "sp", 1, 5),
        emptyWastedSpendSection(),
        isEmptyWastedSpend
      ),
      trackRpc(
        rpcLog,
        "fn_wasted_spend(sp,6+)",
        fetchWastedSpend(supabase, auditId, "sp", 6, null),
        emptyWastedSpendSection(),
        isEmptyWastedSpend
      ),
      trackRpc(
        rpcLog,
        "fn_wasted_spend(sb,1-5)",
        fetchWastedSpend(supabase, auditId, "sb", 1, 5),
        emptyWastedSpendSection(),
        isEmptyWastedSpend
      ),
      trackRpc(
        rpcLog,
        "fn_wasted_spend(sb,6+)",
        fetchWastedSpend(supabase, auditId, "sb", 6, null),
        emptyWastedSpendSection(),
        isEmptyWastedSpend
      ),
      // audit_notes is also new — a database that hasn't had
      // supabase-schema.sql re-run yet won't have this table.
      trackRpc(rpcLog, "audit_notes", fetchAuditNotes(supabase, auditId), {}, isEmptyNotes),
    ]);
    console.timeEnd("[PERF] fetchAuditData all RPC sections (parallel)");
    logRpcOutcomes(auditId, rpcLog);

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

/** Lightweight cache-invalidation check for the audit dashboard: the full
 * bundle doesn't change once an audit finishes processing, so instead of
 * re-fetching everything on every load, the page compares this single
 * column against the `updated_at` stored in the cached bundle and only
 * re-fetches when the DB row is actually newer (e.g. re-processed from
 * another device, or a future edit feature touches the row). */
export async function fetchAuditUpdatedAt(
  supabase: SupabaseClient<Database>,
  auditId: string
): Promise<string | null> {
  console.time(`[PERF] fetchAuditUpdatedAt ${auditId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("audits").select("updated_at").eq("id", auditId).single()
    );
    if (error) {
      console.error(`[PERF] fetchAuditUpdatedAt — query failed for ${auditId}:`, error);
      throw new Error(error.message);
    }
    return data?.updated_at ?? null;
  } finally {
    console.timeEnd(`[PERF] fetchAuditUpdatedAt ${auditId}`);
  }
}

// BleedersBoard and BrandedVsNonBrandedSection call fn_bleeders /
// fn_branded_split / fn_branded_search_terms directly (via src/lib/data/rpc.ts)
// when their filter/scope toggles change, rather than through this bundle —
// those are interactive, parameter-dependent queries that need a fresh
// server-side re-query, not a client-side re-filter of stale cached rows.
