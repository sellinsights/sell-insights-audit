import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let listenerAttached = false;

/**
 * @supabase/ssr's createBrowserClient() is already a singleton in browser
 * contexts (it caches one instance at module scope internally, keyed on
 * `isSingleton` defaulting to true when `isBrowser()`), so every call here
 * returns the same underlying client — auto-refresh keeps running
 * continuously for the tab's lifetime instead of a fresh timer/session read
 * starting from scratch on every fetch cycle.
 */
export function createClient() {
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  // createClient() is called on every fetch cycle throughout the app, but
  // they all resolve to the same singleton client above — guard so we only
  // ever attach one listener instead of leaking a new subscription per call.
  if (!listenerAttached) {
    listenerAttached = true;
    client.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH] ${event}`, {
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      });
    });
  }

  return client;
}
