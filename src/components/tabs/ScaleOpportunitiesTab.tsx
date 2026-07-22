import { memo } from "react";
import { OpportunityTable } from "@/components/OpportunityTable";
import { fetchScaleOpportunities } from "@/lib/data/rpc";

export const ScaleOpportunitiesTab = memo(function ScaleOpportunitiesTab({
  auditId,
  marketplace,
}: {
  auditId: string;
  marketplace: string | null;
}) {
  return (
    <OpportunityTable
      auditId={auditId}
      marketplace={marketplace}
      fetchFn={fetchScaleOpportunities}
      title="Opportunities to Scale"
      description="Orders ≥ 1 and ACOS under 50% — efficient search terms worth scaling up."
      sectionKey="scale_opportunities"
    />
  );
});
