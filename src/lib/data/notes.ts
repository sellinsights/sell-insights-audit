import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { withAuthRetry } from "@/lib/supabase/authRetry";

/** One query for every section's notes on this audit — not one query per
 * section — so the whole dashboard's notes load in a single round trip and
 * ride along in the same cached bundle as everything else. */
export async function fetchAuditNotes(
  supabase: SupabaseClient<Database>,
  auditId: string
): Promise<Record<string, string>> {
  console.time(`[PERF] fetchAuditNotes ${auditId}`);
  try {
    const { data, error } = await withAuthRetry(supabase, () =>
      supabase.from("audit_notes").select("section_key, content").eq("audit_id", auditId)
    );
    if (error) {
      console.error("[PERF] fetchAuditNotes — query failed:", error);
      throw new Error(error.message);
    }
    const notes: Record<string, string> = {};
    for (const row of data ?? []) {
      notes[row.section_key] = row.content ?? "";
    }
    return notes;
  } finally {
    console.timeEnd(`[PERF] fetchAuditNotes ${auditId}`);
  }
}

export async function saveAuditNote(
  supabase: SupabaseClient<Database>,
  auditId: string,
  sectionKey: string,
  content: string
): Promise<void> {
  const { error } = await withAuthRetry(supabase, () =>
    supabase
      .from("audit_notes")
      .upsert(
        { audit_id: auditId, section_key: sectionKey, content, updated_at: new Date().toISOString() },
        { onConflict: "audit_id,section_key" }
      )
  );
  if (error) {
    console.error(`[NOTES] saveAuditNote failed for ${sectionKey}:`, error);
    throw new Error(error.message);
  }
}
