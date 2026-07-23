"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/types/database";

interface RoleContextValue {
  role: UserRole | null;
  isAdmin: boolean;
  isTeam: boolean;
  isClient: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/** Fetched once server-side in the dashboard layout and provided down —
 * every role-gated UI decision in the app reads from here instead of
 * re-fetching. Falls back to "no access" (all flags false) outside a
 * provider rather than throwing, matching useNotesContext()'s style, so a
 * component doesn't have to know whether it's always mounted under one. */
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  return ctx ?? { role: null, isAdmin: false, isTeam: false, isClient: false };
}

export function RoleProvider({ role, children }: { role: UserRole | null; children: ReactNode }) {
  const value: RoleContextValue = {
    role,
    isAdmin: role === "admin",
    isTeam: role === "team",
    isClient: role === "client",
  };
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
