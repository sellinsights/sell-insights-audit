"use client";

import { useState } from "react";
import { AuditTabs } from "./AuditTabs";
import { SummaryTab } from "./tabs/SummaryTab";
import { AdAnalysisTab } from "./tabs/AdAnalysisTab";
import { WastedSpendTab } from "./tabs/WastedSpendTab";
import { BleedersTab } from "./tabs/BleedersTab";
import { AcosImprovementTab } from "./tabs/AcosImprovementTab";
import { ScaleOpportunitiesTab } from "./tabs/ScaleOpportunitiesTab";
import { CostReductionTab } from "./tabs/CostReductionTab";
import { SqpTab } from "./tabs/SqpTab";
import type { AuditData } from "@/lib/data/audit";

export type TabKey =
  | "summary"
  | "ad-analysis"
  | "wasted-spend"
  | "bleeders"
  | "acos-improvement"
  | "scale-opportunities"
  | "cost-reduction"
  | "sqp";

/** Fetched once by the server; kept in state so tab switches never re-fetch or re-hit the DB. */
export function AuditDashboard({ data }: { data: AuditData }) {
  const [auditData] = useState(data);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const marketplace = auditData.audit.marketplace;

  return (
    <div>
      <div className="mb-6">
        <AuditTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* All tabs render once and stay mounted — switching just toggles visibility, so it's instant. */}
      <div className={activeTab === "summary" ? "" : "hidden"}>
        <SummaryTab data={auditData} />
      </div>
      <div className={activeTab === "ad-analysis" ? "" : "hidden"}>
        <AdAnalysisTab data={auditData} auditId={auditData.audit.id} />
      </div>
      <div className={activeTab === "wasted-spend" ? "" : "hidden"}>
        <WastedSpendTab data={auditData} />
      </div>
      <div className={activeTab === "bleeders" ? "" : "hidden"}>
        <BleedersTab auditId={auditData.audit.id} marketplace={marketplace} />
      </div>
      <div className={activeTab === "acos-improvement" ? "" : "hidden"}>
        <AcosImprovementTab auditId={auditData.audit.id} marketplace={marketplace} />
      </div>
      <div className={activeTab === "scale-opportunities" ? "" : "hidden"}>
        <ScaleOpportunitiesTab auditId={auditData.audit.id} marketplace={marketplace} />
      </div>
      <div className={activeTab === "cost-reduction" ? "" : "hidden"}>
        <CostReductionTab auditId={auditData.audit.id} marketplace={marketplace} />
      </div>
      <div className={activeTab === "sqp" ? "" : "hidden"}>
        <SqpTab />
      </div>
    </div>
  );
}
