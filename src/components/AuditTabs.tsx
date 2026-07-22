"use client";

import type { TabKey } from "./AuditDashboard";

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "ad-analysis", label: "Ad Analysis" },
  { key: "wasted-spend", label: "Wasted Spend" },
  { key: "bleeders", label: "Bleeders" },
  { key: "acos-improvement", label: "ACOS Improvement" },
  { key: "scale-opportunities", label: "Scale Opportunities" },
  { key: "cost-reduction", label: "Cost Reduction" },
  { key: "sqp", label: "SQP" },
];

export function AuditTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="flex gap-1 border-b border-black/10">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-t-md border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            active === tab.key
              ? "border-green bg-[rgba(0,179,65,0.05)] text-navy"
              : "border-transparent text-neutral-500 hover:text-navy"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
