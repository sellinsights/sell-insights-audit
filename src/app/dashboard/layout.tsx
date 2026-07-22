import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/DashboardHeader";

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
      <DashboardHeader userEmail={user?.email ?? null} />
      <main className="w-full flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
