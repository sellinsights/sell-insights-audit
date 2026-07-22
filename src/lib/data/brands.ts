import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRow, BrandRow, Database } from "@/types/database";
import { withAuthRetry } from "@/lib/supabase/authRetry";

export async function fetchBrands(supabase: SupabaseClient<Database>): Promise<BrandRow[]> {
  console.time("[PERF] fetchBrands");
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("brands").select("*").order("created_at", { ascending: false })
    );
    if (error) {
      console.error("[PERF] fetchBrands — query failed:", error);
      throw new Error(error.message);
    }
    return data ?? [];
  } finally {
    console.timeEnd("[PERF] fetchBrands");
  }
}

/** Lightweight existence check for cache invalidation: a `head: true` count
 * query returns just a row count, no rows — cheap enough to run on every
 * page load even when the cached brand list already renders instantly, so
 * a brand created from another device/session shows up without a full
 * re-fetch every time. */
export async function fetchBrandCount(supabase: SupabaseClient<Database>): Promise<number> {
  console.time("[PERF] fetchBrandCount");
  try {
    const { count, error } = await withAuthRetry(supabase, () =>
      supabase.from("brands").select("*", { count: "exact", head: true })
    );
    if (error) {
      console.error("[PERF] fetchBrandCount — query failed:", error);
      throw new Error(error.message);
    }
    return count ?? 0;
  } finally {
    console.timeEnd("[PERF] fetchBrandCount");
  }
}

/** Same lightweight-count pattern as fetchBrandCount, scoped to one brand's
 * audits — used to invalidate the audit list cache when a teammate creates
 * an audit for this brand elsewhere. */
export async function fetchBrandAuditCount(supabase: SupabaseClient<Database>, brandId: string): Promise<number> {
  console.time(`[PERF] fetchBrandAuditCount ${brandId}`);
  try {
    const { count, error } = await withAuthRetry(supabase, () =>
      supabase.from("audits").select("*", { count: "exact", head: true }).eq("brand_id", brandId)
    );
    if (error) {
      console.error(`[PERF] fetchBrandAuditCount — query failed for ${brandId}:`, error);
      throw new Error(error.message);
    }
    return count ?? 0;
  } finally {
    console.timeEnd(`[PERF] fetchBrandAuditCount ${brandId}`);
  }
}

export async function fetchBrand(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<BrandRow | null> {
  console.time(`[PERF] fetchBrand ${brandId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("brands").select("*").eq("id", brandId).single()
    );
    if (error) {
      // RLS now grants every authenticated user access to every brand, so a
      // failure here just means the id doesn't exist (or the row was deleted).
      console.error(`[PERF] fetchBrand — query failed for ${brandId}:`, error);
      return null;
    }
    return data ?? null;
  } finally {
    console.timeEnd(`[PERF] fetchBrand ${brandId}`);
  }
}

export async function fetchBrandAudits(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<AuditRow[]> {
  console.time(`[PERF] fetchBrandAudits ${brandId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase
        .from("audits")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
    );
    if (error) {
      console.error(`[PERF] fetchBrandAudits — query failed for ${brandId}:`, error);
      throw new Error(error.message);
    }
    return data ?? [];
  } finally {
    console.timeEnd(`[PERF] fetchBrandAudits ${brandId}`);
  }
}
