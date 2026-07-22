import { memo } from "react";
import { OpportunityTable } from "@/components/OpportunityTable";
import { fetchAcosImprovement } from "@/lib/data/rpc";

export const AcosImprovementTab = memo(function AcosImprovementTab({
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
      fetchFn={fetchAcosImprovement}
      title="ACOS Improvement Opportunities"
      description="Orders ≥ 1 and ACOS between 50% and 100% — converting, but with room to optimize."
      sectionKey="acos_improvement"
    />
  );
});
