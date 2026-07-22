import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRow, BrandRow, Database } from "@/types/database";

export async function fetchBrands(supabase: SupabaseClient<Database>): Promise<BrandRow[]> {
  console.time("[PERF] fetchBrands");
  try {
    const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("[PERF] fetchBrands — query failed:", error);
      throw new Error(error.message);
    }
    return data ?? [];
  } finally {
    console.timeEnd("[PERF] fetchBrands");
  }
}

export async function fetchBrand(
  supabase: SupabaseClient<Database>,
  brandId: string
): Promise<BrandRow | null> {
  console.time(`[PERF] fetchBrand ${brandId}`);
  try {
    const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).single();
    if (error) {
      // Expected when RLS hides the row (not this user's brand) or the id is wrong.
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
    const { data, error } = await supabase
      .from("audits")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`[PERF] fetchBrandAudits — query failed for ${brandId}:`, error);
      throw new Error(error.message);
    }
    return data ?? [];
  } finally {
    console.timeEnd(`[PERF] fetchBrandAudits ${brandId}`);
  }
}
