import * as XLSX from "xlsx";

const HEADER_VALUES = new Set(["keyword", "keywords", "brand keyword", "brand keywords"]);

/** Parses the single-column Brand Keywords file (CSV or Excel). A header
 * row, if present, is detected and skipped. Values are trimmed and deduped. */
export function parseBrandKeywords(data: ArrayBuffer): string[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const keywords: string[] = [];
  for (const row of rows) {
    const raw = row?.[0];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (!value || HEADER_VALUES.has(value.toLowerCase())) continue;
    keywords.push(value);
  }

  return Array.from(new Set(keywords));
}
