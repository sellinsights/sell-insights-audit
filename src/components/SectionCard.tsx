import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white/60 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-navy">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
