"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format";

export function RefreshDataButton({
  cachedAt,
  refreshing,
  onRefresh,
}: {
  cachedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // Ticks so "Last updated: Xm ago" keeps advancing without a manual refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      {cachedAt !== null && <span>Last updated: {formatRelativeTime(cachedAt)}</span>}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh data"
        className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {refreshing ? "Refreshing…" : "Refresh Data"}
      </button>
    </div>
  );
}
