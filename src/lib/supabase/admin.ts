import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — bypasses RLS entirely and can call the
 * Auth Admin API (inviteUserByEmail, etc.), neither of which the normal
 * anon/authenticated-key client can do regardless of role or RLS policy.
 *
 * Only ever call this from a Server Action / Route Handler, and only after
 * independently verifying the caller is an admin (see requireAdmin() in
 * src/app/dashboard/team/actions.ts) — this client has no notion of "who is
 * calling," so every permission check has to happen before it's used, not
 * through it. The `server-only` import makes any accidental Client
 * Component import of this file a build error instead of a leaked key.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for admin actions like inviting users. " +
        "Add it to .env.local (Supabase dashboard → Project Settings → API → service_role secret). " +
        "Never prefix it with NEXT_PUBLIC_ — it must stay server-only."
    );
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
