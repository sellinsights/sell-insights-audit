import { memo } from "react";

export const SqpTab = memo(function SqpTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-light">
        <span className="text-2xl">🔍</span>
      </div>
      <h2 className="text-lg font-bold text-navy">Search Query Performance — Coming Soon</h2>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        SQP and Top Keywords processing is on the roadmap. The files you uploaded for this audit have been
        saved and will be analyzed automatically once this section ships.
      </p>
    </div>
  );
});
