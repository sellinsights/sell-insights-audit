"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndRole, requireAdmin } from "@/lib/supabase/requireRole";

export interface CreateBrandState {
  error: string | null;
}

export async function createBrand(
  _prevState: CreateBrandState,
  formData: FormData
): Promise<CreateBrandState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Brand name is required." };

  const { supabase, userId, role } = await getCurrentUserAndRole();
  if (role !== "admin" && role !== "team") {
    return { error: "You don't have permission to create brands." };
  }

  const { error } = await supabase.from("brands").insert({ name, created_by: userId });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export interface DeleteState {
  error: string | null;
}

/** Cascades to every audit/upload/parsed-data row for this brand via the
 * `on delete cascade` foreign keys already in supabase-schema.sql — nothing
 * else to clean up on the DB side. (Storage objects in the audit-files
 * bucket are not cascade-deleted by Postgres; see the note in deleteAudit.) */
export async function deleteBrand(brandId: string): Promise<DeleteState> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("brands").delete().eq("id", brandId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete brand." };
  }
}

/** Cascades to every upload/parsed-data row for this audit. Storage objects
 * under `${auditId}/` in the audit-files bucket are a separate system from
 * the Postgres tables `on delete cascade` covers — deleting the audit row
 * does not remove them, they're just orphaned (unreachable via the app,
 * still billed/counted in the bucket). Not cleaned up here to avoid a
 * recursive per-file-type Storage list+remove for a case the task didn't
 * ask for; flagged here for whoever revisits this. */
export async function deleteAudit(auditId: string, brandId: string): Promise<DeleteState> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("audits").delete().eq("id", auditId);
    if (error) return { error: error.message };
    revalidatePath(`/dashboard/${brandId}`);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete audit." };
  }
}
