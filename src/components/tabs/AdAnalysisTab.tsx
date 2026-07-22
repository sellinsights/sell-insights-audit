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
  const { adTypeSplit, autoManualSplit, spMatchTypes, sbMatchTypes, placements, biddingStrategy, sdCostType, brandedSplit } =
    data;

  const pieData = useMemo(
    () => (adTypeSplit?.rows ?? []).map((r) => ({ name: r.label, value: r.spend })),
    [adTypeSplit]
  );

  const autoRow = autoManualSplit?.rows.find((r) => r.label === "Auto");
  const autoVerdict =
    (autoRow?.pctOfSpend ?? 0) < 10
      ? "Auto spend under 10% — good"
      : "Auto spend over 10% — consider shifting validated auto search terms to manual campaigns";

  const columns = metricsColumns("Ad Type");

  return (
    <div className="space-y-8">
      <SectionCard
        title="Ad Type Spend Split"
        description="Entity = Campaign, grouped by SP / SB / SD."
        sectionKey="ad_analysis_ad_type_split"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataTable columns={columns} rows={adTypeSplit?.rows ?? []} footer={adTypeSplit?.grandTotal} keyFn={(r) => r.label} />
          </div>
          <AdTypePieChart data={pieData} />
        </div>
      </SectionCard>

      <SectionCard title="Auto vs Manual (SP only)" description={autoVerdict} sectionKey="ad_analysis_auto_manual">
        <DataTable
          columns={metricsColumns("Targeting Type")}
          rows={autoManualSplit?.rows ?? []}
          footer={autoManualSplit?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <BrandedVsNonBrandedSection auditId={auditId} initialData={brandedSplit} sectionKey="ad_analysis_branded" />

      <SectionCard
        title="SP Match Type Analysis"
        description="Entity = Keyword or Product Targeting, grouped by final match type."
        sectionKey="ad_analysis_sp_match_type"
      >
        <DataTable
          columns={metricsColumns("Match Type")}
          rows={spMatchTypes?.rows ?? []}
          footer={spMatchTypes?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard
        title="SB Match Type Analysis"
        description="Entity = Keyword or Product Targeting, grouped by final match type."
        sectionKey="ad_analysis_sb_match_type"
      >
        <DataTable
          columns={metricsColumns("Match Type")}
          rows={sbMatchTypes?.rows ?? []}
          footer={sbMatchTypes?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard
        title="SD Cost Type Analysis"
        description="Entity = Campaign, grouped by Cost Type."
        sectionKey="ad_analysis_sd_cost_type"
      >
        {/* Defensive: undefined for an audit dashboard cached before this
            section existed, or if fn_sd_cost_type isn't deployed yet — falls
            back to an empty table (DataTable's own "No data" state) instead
            of crashing. normalizeAuditData() upstream should always fill
            this in, but this guard is cheap insurance either way. */}
        <DataTable
          columns={metricsColumns("Cost Type")}
          rows={sdCostType?.rows ?? []}
          footer={sdCostType?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard
        title="Placements (SP only)"
        description="Entity = Bidding Adjustment, grouped by placement."
        sectionKey="ad_analysis_placements"
      >
        <DataTable
          columns={metricsColumns("Placement")}
          rows={placements?.rows ?? []}
          footer={placements?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>

      <SectionCard
        title="Bidding Strategy (SP only)"
        description="Entity = Bidding Adjustment, grouped by bidding strategy."
        sectionKey="ad_analysis_bidding_strategy"
      >
        <DataTable
          columns={metricsColumns("Bidding Strategy")}
          rows={biddingStrategy?.rows ?? []}
          footer={biddingStrategy?.grandTotal}
          keyFn={(r) => r.label}
        />
      </SectionCard>
    </div>
  );
});
