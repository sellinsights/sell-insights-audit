"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/login/actions";
import type { UserRole } from "@/types/database";

export function DashboardHeader({ userEmail, role }: { userEmail: string | null; role: UserRole | null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-[rgba(0,179,65,0.15)] bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/dashboard">
          <Logo className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          {role === "admin" && (
            <Link
              href="/dashboard/team"
              className="text-xs font-semibold text-neutral-500 hover:text-navy"
            >
              Team
            </Link>
          )}
          {userEmail && <span className="text-sm text-neutral-500">{userEmail}</span>}
          {role === "client" && (
            <span className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-semibold text-navy">
              Client View
            </span>
          )}
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
  );
}
