import { memo } from "react";
import { BleedersBoard } from "@/components/BleedersBoard";

export const BleedersTab = memo(function BleedersTab({
  auditId,
  marketplace,
}: {
  auditId: string;
  marketplace: string | null;
}) {
  return <BleedersBoard auditId={auditId} marketplace={marketplace} />;
});
