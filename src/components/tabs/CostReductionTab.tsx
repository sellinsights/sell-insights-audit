import { memo } from "react";
import { OpportunityTable } from "@/components/OpportunityTable";
import { fetchCostReduction } from "@/lib/data/rpc";

export const CostReductionTab = memo(function CostReductionTab({
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
      fetchFn={fetchCostReduction}
      title="Cost Reduction Opportunities"
      description="Orders ≥ 1 and ACOS over 100% — unprofitable search terms needing cost control."
      sectionKey="cost_reduction"
    />
  );
});
