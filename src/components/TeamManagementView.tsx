"use client";

import { useActionState, useRef, useState } from "react";
import { updateUserRole, updateClientBrandAccess, inviteUser, type TeamActionState } from "@/app/dashboard/team/actions";
import type { UserRole } from "@/types/database";
import type { TeamUserRow } from "@/lib/data/roles";

interface BrandOption {
  id: string;
  name: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "team", label: "Team Member" },
  { value: "client", label: "Client" },
];

const inviteInitialState: TeamActionState = { error: null };

function InviteUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: TeamActionState, formData: FormData) => {
    const email = String(formData.get("email") ?? "");
    const result = await inviteUser(prev, formData);
    if (!result.error) {
      setSuccessEmail(email);
      formRef.current?.reset();
    } else {
      setSuccessEmail(null);
    }
    return result;
  }, inviteInitialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-light">
          Invite by email
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          onChange={() => setSuccessEmail(null)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {successEmail && <span className="text-xs font-medium text-green-dark">Invite sent to {successEmail}.</span>}
    </form>
  );
}

function UserRow({
  user,
  brands,
  initialAccess,
}: {
  user: TeamUserRow;
  brands: BrandOption[];
  initialAccess: string[];
}) {
  const [role, setRole] = useState<UserRole | "">(user.role ?? "");
  const [savingRole, setSavingRole] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialAccess);
  const [savingAccess, setSavingAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(next: UserRole) {
    const previous = role;
    setRole(next);
    setSavingRole(true);
    setError(null);
    const result = await updateUserRole(user.id, next);
    if (result.error) {
      setError(result.error);
      setRole(previous);
    }
    setSavingRole(false);
  }

  async function handleSaveAccess() {
    setSavingAccess(true);
    setError(null);
    const result = await updateClientBrandAccess(user.id, selectedBrands);
    if (result.error) setError(result.error);
    else setAccessOpen(false);
    setSavingAccess(false);
  }

  return (
    <>
      <tr className="border-t border-black/5">
        <td className="px-4 py-3">
          <p className="font-medium text-navy">{user.email ?? "(no email)"}</p>
          <p className="text-xs text-neutral-400">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
        </td>
        <td className="px-4 py-3">
          <select
            value={role}
            onChange={(e) => void handleRoleChange(e.target.value as UserRole)}
            disabled={savingRole}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-navy outline-none focus:border-green disabled:opacity-60"
          >
            <option value="" disabled>
              No role assigned
            </option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          {role === "client" ? (
            <button
              type="button"
              onClick={() => setAccessOpen((v) => !v)}
              className="text-xs font-semibold text-green hover:underline"
            >
              {accessOpen ? "Hide" : "Manage"} brand access ({selectedBrands.length})
            </button>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
      {role === "client" && accessOpen && (
        <tr className="border-t border-black/5 bg-neutral-50">
          <td colSpan={3} className="px-4 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {brands.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 text-sm text-navy">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(b.id)}
                    onChange={(e) =>
                      setSelectedBrands((prev) =>
                        e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                      )
                    }
                  />
                  {b.name}
                </label>
              ))}
              {brands.length === 0 && <span className="text-xs text-neutral-400">No brands yet.</span>}
            </div>
            <button
              type="button"
              onClick={() => void handleSaveAccess()}
              disabled={savingAccess}
              className="mt-3 rounded-md bg-green px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-dark disabled:opacity-60"
            >
              {savingAccess ? "Saving…" : "Save access"}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

export function TeamManagementView({
  users,
  brands,
  accessMap,
}: {
  users: TeamUserRow[];
  brands: BrandOption[];
  accessMap: Record<string, string[]>;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <InviteUserForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-left text-xs font-semibold uppercase tracking-wide text-white">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Brand Access</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-neutral-400">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow key={u.id} user={u} brands={brands} initialAccess={accessMap[u.id] ?? []} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
