"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[CLIENT PERF] Dashboard page crashed during render:", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-12 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong.</p>
      <p className="mt-1 text-xs text-red-500">{error.message}</p>
      <button
        onClick={() => unstable_retry()}
        className="mt-3 text-sm font-medium text-green hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
