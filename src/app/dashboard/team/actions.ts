"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export interface TeamActionState {
  error: string | null;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<TeamActionState> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/team");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update role." };
  }
}

/** Replaces the full set of brands a client user can access — simplest
 * correct implementation of "save these checkboxes" without needing to diff
 * against the previous selection. */
export async function updateClientBrandAccess(userId: string, brandIds: string[]): Promise<TeamActionState> {
  try {
    const { supabase } = await requireAdmin();
    const { error: deleteError } = await supabase.from("client_brand_access").delete().eq("user_id", userId);
    if (deleteError) return { error: deleteError.message };
    if (brandIds.length > 0) {
      const { error: insertError } = await supabase
        .from("client_brand_access")
        .insert(brandIds.map((brandId) => ({ user_id: userId, brand_id: brandId })));
      if (insertError) return { error: insertError.message };
    }
    revalidatePath("/dashboard/team");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update brand access." };
  }
}

export async function inviteUser(_prevState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  try {
    await requireAdmin();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/team");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}
