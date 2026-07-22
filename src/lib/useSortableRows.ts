import { useMemo, useState } from "react";

export type SortDirection = "desc" | "asc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

/** Generic 3-click column sort: first click sorts a column high-to-low,
 * second click low-to-high, third click clears back to the original order.
 * Only one column is sorted at a time. Nulls always sort to the end
 * regardless of direction, since "no data" isn't meaningfully high or low. */
export function useSortableRows<T>(rows: T[], getSortValue: (row: T, key: string) => string | number | null) {
  const [sort, setSort] = useState<SortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { key, direction } = sort;
    return [...rows].sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv), undefined, { numeric: true })
          : av - bv;
      return direction === "desc" ? -cmp : cmp;
    });
  }, [rows, sort, getSortValue]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "desc" };
      if (prev.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  return { sortedRows, sortKey: sort?.key ?? null, sortDirection: sort?.direction ?? null, toggleSort };
}
