import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRole, fetchAllUsersWithRoles, fetchAllClientBrandAccess } from "@/lib/data/roles";
import { fetchBrands } from "@/lib/data/brands";
import { TeamManagementView } from "@/components/TeamManagementView";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await fetchUserRole(supabase, user.id);
  if (role !== "admin") redirect("/dashboard");

  const [users, brands, accessRows] = await Promise.all([
    fetchAllUsersWithRoles(supabase),
    fetchBrands(supabase),
    fetchAllClientBrandAccess(supabase),
  ]);

  const accessMap: Record<string, string[]> = {};
  for (const row of accessRows) {
    (accessMap[row.userId] ??= []).push(row.brandId);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-1 text-xs text-neutral-400">
        <span className="text-navy">Team Management</span>
      </div>
      <h1 className="mb-1 text-xl font-bold text-navy">Team Management</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Assign roles and, for client users, which brands they can see.
      </p>
      <TeamManagementView
        users={users}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        accessMap={accessMap}
      />
    </div>
  );
}
