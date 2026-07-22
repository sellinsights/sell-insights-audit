export default function AuditLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-green border-t-transparent" />
      <p className="text-sm text-neutral-500">Loading audit…</p>
    </div>
  );
}
