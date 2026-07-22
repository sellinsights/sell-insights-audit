"use client";

import type { ReactNode } from "react";
import { useSortableRows } from "@/lib/useSortableRows";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  className?: string;
  /** Raw comparable value for this column. Omit to make the column
   * unsortable (its header won't be clickable). */
  sortValue?: (row: T) => string | number | null;
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
  const { sortedRows, sortKey, sortDirection, toggleSort } = useSortableRows(rows, (row, key) => {
    const col = columns.find((c) => c.key === key);
    return col?.sortValue ? col.sortValue(row) : null;
  });

  return (
    <div className="overflow-hidden rounded-lg border border-[rgba(0,179,65,0.2)] bg-white shadow-sm">
      <div className="overflow-x-auto" style={maxHeightPx ? { maxHeight: maxHeightPx, overflowY: "auto" } : undefined}>
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-navy">
              {columns.map((col) => {
                const sortable = !!col.sortValue;
                const active = sortable && sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}
                    aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white ${alignClass[col.align ?? "left"]} ${
                      sortable ? "cursor-pointer select-none transition-colors hover:bg-white/10" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {active && <span aria-hidden="true">{sortDirection === "desc" ? "▼" : "▲"}</span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-neutral-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => (
                <tr key={keyFn ? keyFn(row, i) : i} className="border-t border-black/5 even:bg-neutral-50 hover:bg-[rgba(0,179,65,0.04)]">
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
            <tfoot className="sticky bottom-0 z-10">
              {/* Solid brand green, not a translucent tint — this row sits
                  over scrolling content via `sticky`, so it needs to be fully
                  opaque or rows scrolling underneath show through it. */}
              <tr className="border-t border-green-dark bg-green font-semibold text-white">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap bg-green px-4 py-3 tabular-nums ${alignClass[col.align ?? "left"]}`}
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
