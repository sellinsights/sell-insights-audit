import { memo } from "react";
import { BleedersBoard } from "@/components/BleedersBoard";

export const BleedersTab = memo(function BleedersTab({ auditId }: { auditId: string }) {
  return <BleedersBoard auditId={auditId} />;
});
