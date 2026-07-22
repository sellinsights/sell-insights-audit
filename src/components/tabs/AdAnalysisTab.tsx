import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { SectionCard } from "@/components/SectionCard";
import { DataTable } from "@/components/DataTable";
import { metricsColumns } from "@/components/metricsTableColumns";
import { BrandedVsNonBrandedSection } from "@/components/BrandedVsNonBrandedSection";
import type { AuditData } from "@/lib/data/audit";

// recharts is a large, browser-only (ResizeObserver/SVG-measuring) library —
// keep it out of the audit dashboard's initial SSR pass and JS chunk, and
// only load it once this tab actually renders.
const AdTypePieChart = dynamic(() => import("@/components/AdTypePieChart").then((m) => m.AdTypePieChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-neutral-100" />,
});

export const AdAnalysisTab = memo(function AdAnalysisTab({ data, auditId }: { data: AuditData; auditId: string }) {
  const { adTypeSplit, autoManualSplit, spMatchTypes, sbMatchTypes, placements, biddingStrategy, brandedSplit } = data;

  const pieData = useMemo(
    () => adTypeSplit.rows.map((r) => ({ name: r.label, value: r.spend })),
    [adTypeSplit.rows]
  );

  const autoRow = autoManualSplit.rows.find((r) => r.label === "Auto");
  const autoVerdict =
    (autoRow?.pctOfSpend ?? 0) < 10
      ? "Auto spend under 10% — good"
      : "Auto spend over 10% — consider shifting validated auto search terms to manual campaigns";

  const columns = metricsColumns("Ad Type");

  return (
    <div className="space-y-8">
      <SectionCard title="Ad Type Spend Split" description="Entity = Campaign, grouped by SP / SB / SD.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataTable columns={columns} rows={adTypeSplit.rows} footer={adTypeSplit.grandTotal} keyFn={(r) => r.label} />
          </div>
          <AdTypePieChart data={pieData} />
        </div>
      </SectionCard>

      <SectionCard title="Auto vs Manual (SP only)" description={autoVerdict}>
        <DataTable
          columns={metricsColumns("Targeting Type")}
          rows={autoManualSplit.rows}
          footer={autoManualSplit.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <BrandedVsNonBrandedSection auditId={auditId} initialData={brandedSplit} />

      <SectionCard
        title="SP Match Type Analysis"
        description="Entity = Keyword or Product Targeting, grouped by final match type."
      >
        <DataTable
          columns={metricsColumns("Match Type")}
          rows={spMatchTypes.rows}
          footer={spMatchTypes.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard
        title="SB Match Type Analysis"
        description="Entity = Keyword or Product Targeting, grouped by final match type."
      >
        <DataTable
          columns={metricsColumns("Match Type")}
          rows={sbMatchTypes.rows}
          footer={sbMatchTypes.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard title="Placements (SP only)" description="Entity = Bidding Adjustment, grouped by placement.">
        <DataTable
          columns={metricsColumns("Placement")}
          rows={placements.rows}
          footer={placements.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard title="Bidding Strategy (SP only)" description="Entity = Bidding Adjustment, grouped by bidding strategy.">
        <DataTable
          columns={metricsColumns("Bidding Strategy")}
          rows={biddingStrategy.rows}
          footer={biddingStrategy.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>
    </div>
  );
});
