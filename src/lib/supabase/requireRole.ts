import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole } from "@/lib/data/roles";

/** Resolves the current signed-in user + role for a Server Action — redirects
 * to /login if there's no session at all (mirrors every other Server
 * Action's existing "if (!user) redirect(...)" check), and returns `role:
 * null` rather than throwing when no user_roles row exists yet, so callers
 * decide what "no role assigned" means for their own action. RLS is still
 * the real enforcement boundary; this is the friendly-error layer in front
 * of it so a blocked action fails with a clear message instead of a raw
 * Postgres RLS error string. */
export async function getCurrentUserAndRole(): Promise<{
  supabase: SupabaseClient<Database>;
  userId: string;
  role: UserRole | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await fetchUserRole(supabase, user.id);
  return { supabase, userId: user.id, role };
}

/** Same as getCurrentUserAndRole(), but throws for anything other than
 * admin — for actions (delete, user management) that should never even
 * attempt the underlying query for a non-admin caller. */
export async function requireAdmin(): Promise<{ supabase: SupabaseClient<Database>; userId: string }> {
  const { supabase, userId, role } = await getCurrentUserAndRole();
  if (role !== "admin") throw new Error("Only admins can perform this action.");
  return { supabase, userId };
}
