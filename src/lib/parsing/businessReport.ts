import * as XLSX from "xlsx";
import { buildLookup, cleanInt, cleanNumber, field, str, type RawRow } from "./helpers";
import type { BusinessReportRow } from "@/types/database";

export type ParsedBusinessReportRow = Omit<BusinessReportRow, "id" | "audit_id">;

/** Parses the single-sheet Business Report export (CSV or Excel). B2B
 * columns are simply never selected, so they're implicitly ignored. */
export function parseBusinessReport(data: ArrayBuffer): ParsedBusinessReportRow[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });

  return rows
    .map((row) => {
      const lookup = buildLookup(row);
      return {
        parent_asin: str(field(lookup, "(Parent) ASIN", "Parent ASIN")),
        child_asin: str(field(lookup, "(Child) ASIN", "Child ASIN", "ASIN")),
        title: str(field(lookup, "Title")),
        sessions_total: cleanInt(field(lookup, "Sessions - Total", "Sessions Total")),
        session_percentage_total: cleanNumber(
          field(lookup, "Session Percentage - Total", "Session Percentage Total")
        ),
        page_views_total: cleanInt(field(lookup, "Page Views - Total", "Page Views Total")),
        page_views_percentage_total: cleanNumber(
          field(lookup, "Page Views Percentage - Total", "Page Views Percentage Total")
        ),
        buy_box_percentage: cleanNumber(
          field(
            lookup,
            "Featured Offer (Buy Box) Percentage",
            "Featured Offer Buy Box Percentage",
            "Buy Box Percentage"
          )
        ),
        units_ordered: cleanInt(field(lookup, "Units Ordered")),
        unit_session_percentage: cleanNumber(field(lookup, "Unit Session Percentage")),
        ordered_product_sales: cleanNumber(field(lookup, "Ordered Product Sales")),
        total_order_items: cleanInt(field(lookup, "Total Order Items")),
      } satisfies ParsedBusinessReportRow;
    })
    .filter((row) => row.child_asin !== null);
}
