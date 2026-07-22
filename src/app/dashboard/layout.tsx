import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  console.time("[PERF] dashboard layout getSession");
  const supabase = await createClient();
  // getSession() reads the already-verified cookie locally (no network call) —
  // middleware already did the authoritative getUser() check for this
  // request, so this only needs to be fast enough to show the header email.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  console.timeEnd("[PERF] dashboard layout getSession");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard">
            <Logo className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            {user?.email && <span className="text-sm text-neutral-500">{user.email}</span>}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-navy"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="w-full flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
