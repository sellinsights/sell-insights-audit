import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  footer?: T;
  keyFn?: (row: T, index: number) => string;
  maxHeightPx?: number;
  emptyMessage?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({
  columns,
  rows,
  footer,
  keyFn,
  maxHeightPx,
  emptyMessage = "No data for this audit.",
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto" style={maxHeightPx ? { maxHeight: maxHeightPx, overflowY: "auto" } : undefined}>
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-navy">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white ${alignClass[col.align ?? "left"]}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-neutral-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={keyFn ? keyFn(row, i) : i} className="border-t border-black/5 even:bg-neutral-50 hover:bg-green-light/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-800 ${alignClass[col.align ?? "left"]} ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t-2 border-navy bg-navy/5 font-semibold text-navy">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 tabular-nums ${alignClass[col.align ?? "left"]}`}
                  >
                    {col.render(footer)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
