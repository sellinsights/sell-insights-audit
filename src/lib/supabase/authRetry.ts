import type { SupabaseClient } from "@supabase/supabase-js";

/** Proactively refresh if the current token is within this many seconds of
 * expiring — catches the case where the SDK's background refresh timer
 * hasn't fired yet (e.g. a backgrounded/throttled tab) before we actually
 * need the token for a request. */
const REFRESH_BUFFER_SECONDS = 60;

/** Ensures the session's access token isn't already expired or about to
 * expire before a request goes out. Safe to call often — getSession() reads
 * the in-memory/cookie-cached session, no network round trip unless a
 * refresh is actually needed. */
export async function ensureFreshSession(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("[AUTH] getSession() failed, attempting refreshSession():", error);
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) console.error("[AUTH] refreshSession() failed:", refreshError);
    return;
  }

  if (!session) return; // Not logged in — nothing to refresh; let the query fail/redirect as normal.

  const expiresAt = session.expires_at ?? 0;
  const nowSeconds = Date.now() / 1000;
  if (expiresAt - nowSeconds < REFRESH_BUFFER_SECONDS) {
    console.log("[AUTH] session expiring soon, refreshing proactively", {
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    });
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) console.error("[AUTH] proactive refreshSession() failed:", refreshError);
  }
}

/** True for the shapes a JWT/auth failure actually shows up as: PostgREST's
 * "JWT expired" (PGRST301, HTTP 401), a raw 401 status, or a message
 * mentioning JWT — covers both PostgrestError (from .from()/.rpc()) and
 * AuthError (from .auth.*) without importing either type directly. */
function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string; message?: string };
  if (e.status === 401) return true;
  if (e.code === "PGRST301") return true;
  if (typeof e.message === "string" && /jwt/i.test(e.message)) return true;
  return false;
}

/**
 * Reusable wrapper for every Supabase RPC/table call: ensures the session is
 * fresh before the request, and if the request still comes back with a
 * JWT/auth error (token expired mid-flight, refresh raced the request,
 * etc.), refreshes once more and retries the exact same request one time
 * before giving up. This is what fixes the "JWT expired, works on retry"
 * bug — the retry now happens automatically instead of requiring the user
 * to manually reload.
 */
export async function withAuthRetry<R extends { error: unknown }>(
  supabase: SupabaseClient,
  run: () => PromiseLike<R>
): Promise<R> {
  await ensureFreshSession(supabase);

  const first = await run();
  if (!first.error || !isAuthError(first.error)) return first;

  console.warn("[AUTH] request failed with a JWT/auth error, refreshing session and retrying once:", first.error);
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error("[AUTH] refreshSession() failed during retry — giving up, returning original error:", refreshError);
    return first;
  }

  const second = await run();
  if (second.error) {
    console.error("[AUTH] retry after refresh still failed:", second.error);
  } else {
    console.log("[AUTH] retry after refresh succeeded");
  }
  return second;
}
