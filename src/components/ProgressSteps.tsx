export interface ProgressStepState {
  key: string;
  label: string;
  progress: number;
  status: "pending" | "active" | "done" | "error";
}

const STATUS_TEXT_CLASS: Record<ProgressStepState["status"], string> = {
  pending: "text-neutral-400",
  active: "font-semibold text-navy",
  done: "text-green-dark",
  error: "font-semibold text-red-600",
};

const STATUS_PREFIX: Record<ProgressStepState["status"], string> = {
  pending: " ",
  active: "→",
  done: "✓",
  error: "✕",
};

export function ProgressSteps({ steps }: { steps: ProgressStepState[] }) {
  const overall = steps.length ? Math.round(steps.reduce((sum, s) => sum + s.progress, 0) / steps.length) : 0;

  return (
    <div className="mt-6 rounded-lg border border-navy/10 bg-navy/5 p-4">
      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className={STATUS_TEXT_CLASS[step.status]}>
                {STATUS_PREFIX[step.status]} {step.label}
              </span>
              <span className="tabular-nums text-xs text-neutral-500">{step.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  step.status === "error" ? "bg-red-500" : "bg-green"
                }`}
                style={{ width: `${step.progress}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {steps.length > 0 && (
        <div className="mt-4 border-t border-navy/10 pt-4">
          <div className="mb-1 flex items-center justify-between text-sm font-semibold text-navy">
            <span>Overall progress</span>
            <span className="tabular-nums">{overall}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-green transition-[width] duration-200"
              style={{ width: `${overall}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
