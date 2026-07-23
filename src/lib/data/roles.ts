import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";
import { withAuthRetry } from "@/lib/supabase/authRetry";

/** A user with no row in user_roles yet — brand new signup, not assigned by
 * an admin — resolves to `null`, never a default role. Every caller must
 * treat null as "no access", not as any particular permission level. */
export async function fetchUserRole(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserRole | null> {
  console.time(`[PERF] fetchUserRole ${userId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle()
    );
    if (error) {
      console.error(`[PERF] fetchUserRole — query failed for ${userId}:`, error);
      return null;
    }
    return data?.role ?? null;
  } finally {
    console.timeEnd(`[PERF] fetchUserRole ${userId}`);
  }
}

export interface TeamUserRow {
  id: string;
  email: string | null;
  createdAt: string;
  role: UserRole | null;
}

/** Powers the Team page's user list — calls fn_list_users(), a SECURITY
 * DEFINER function that reads auth.users (not otherwise reachable through
 * PostgREST) and self-enforces an is_admin() check, so this throws for any
 * non-admin caller rather than silently returning nothing. */
export async function fetchAllUsersWithRoles(supabase: SupabaseClient<Database>): Promise<TeamUserRow[]> {
  console.time("[PERF] fn_list_users");
  try {
    const { data, error } = await withAuthRetry(supabase, () => supabase.rpc("fn_list_users", {}));
    if (error) {
      console.error("[PERF] fn_list_users failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: r.created_at,
      role: (r.role as UserRole | null) ?? null,
    }));
  } finally {
    console.timeEnd("[PERF] fn_list_users");
  }
}

export interface ClientBrandAccessRow {
  userId: string;
  brandId: string;
}

/** Every client_brand_access row, unfiltered — only ever called from the
 * admin-only Team page, so a flat list is fine (the page groups it by user). */
export async function fetchAllClientBrandAccess(
  supabase: SupabaseClient<Database>
): Promise<ClientBrandAccessRow[]> {
  console.time("[PERF] fetchAllClientBrandAccess");
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("client_brand_access").select("user_id, brand_id")
    );
    if (error) {
      console.error("[PERF] fetchAllClientBrandAccess failed:", error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({ userId: r.user_id, brandId: r.brand_id }));
  } finally {
    console.timeEnd("[PERF] fetchAllClientBrandAccess");
  }
}
