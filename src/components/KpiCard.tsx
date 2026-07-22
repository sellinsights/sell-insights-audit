export function KpiCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-light">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-neutral-500">{sublabel}</p>}
    </div>
  );
}
