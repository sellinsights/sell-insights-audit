import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TableName = keyof Database["public"]["Tables"];

/** Inserts rows in chunks (Supabase/Postgres request payloads have practical
 * size limits, and large search-term reports can run into the thousands). */
export async function bulkInsert<T extends object>(
  supabase: SupabaseClient<Database>,
  table: TableName,
  auditId: string,
  rows: T[],
  chunkSize = 500,
  onRowsInserted?: (count: number) => void
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({ ...row, audit_id: auditId }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table).insert(chunk as any);
    if (error) throw new Error(`Failed inserting into ${table}: ${error.message}`);
    onRowsInserted?.(chunk.length);
  }
}
