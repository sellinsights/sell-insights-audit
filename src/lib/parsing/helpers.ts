/** Shared helpers used by every file parser: header matching, number
 * cleaning, and the derivation rules that are common across the Bulk Ads
 * tabs (final match type, search term type, placement, bidding strategy). */

export type RawRow = Record<string, unknown>;

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a case/whitespace/parenthetical-insensitive lookup for one parsed
 * spreadsheet row so parsers can be resilient to minor header variations. */
export function buildLookup(row: RawRow): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    map.set(normalizeKey(key), value);
  }
  return map;
}

export function field(lookup: Map<string, unknown>, ...candidates: string[]): unknown {
  for (const candidate of candidates) {
    const value = lookup.get(normalizeKey(candidate));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Strips $, %, and thousands separators before parsing. Amazon export
 * percentages are already in percentage form (e.g. "35.98%" -> 35.98). */
export function cleanNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .replace(/[$,%,]/g, "")
    .replace(/,/g, "")
    .trim();
  if (cleaned === "" || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function cleanInt(value: unknown): number | null {
  const num = cleanNumber(value);
  return num === null ? null : Math.round(num);
}

const MATCH_TYPES = new Set(["broad", "phrase", "exact"]);

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Derives the display match type from a Product Targeting Expression,
 * shared by the campaign-entity and search-term-report derivation rules. */
function deriveFromExpression(
  expression: string | null,
  isSP: boolean
): string | null {
  if (!expression) return null;
  const expr = expression.trim().toLowerCase();
  if (expr.startsWith("asin-expanded=")) return "ASIN-Expanded";
  if (expr.startsWith("asin=")) return "ASIN-Exact";
  if (expr.startsWith("category")) return "Category";
  if (isSP && expr.startsWith("keyword-group")) return "Keyword Group";
  if (isSP && expr.startsWith("close-match")) return "Auto Close-match";
  if (isSP && expr.startsWith("loose-match")) return "Auto Loose-match";
  if (isSP && expr.startsWith("substitutes")) return "Auto Substitutes";
  if (isSP && expr.startsWith("complements")) return "Auto Complements";
  return null;
}

/** Final Match Type for SP/SB Campaign rows: Entity = "Keyword" uses Match
 * Type directly; Entity = "Product Targeting" derives from the PTE. */
export function deriveCampaignFinalMatchType(
  entity: string | null,
  matchType: string | null,
  productTargetingExpression: string | null,
  isSP: boolean
): string | null {
  const entityLower = entity?.trim().toLowerCase() ?? "";
  if (entityLower === "keyword") {
    const mt = matchType?.trim().toLowerCase();
    return mt && MATCH_TYPES.has(mt) ? titleCase(mt) : str(matchType);
  }
  if (entityLower === "product targeting") {
    return deriveFromExpression(productTargetingExpression, isSP);
  }
  return null;
}

/** Final Match Type for SP/SB Search Term Report rows: use Match Type if it's
 * already broad/phrase/exact, otherwise derive from the PTE. */
export function deriveSearchTermFinalMatchType(
  matchType: string | null,
  productTargetingExpression: string | null,
  isSP: boolean
): string | null {
  const mt = matchType?.trim().toLowerCase();
  if (mt && MATCH_TYPES.has(mt)) return titleCase(mt);
  return deriveFromExpression(productTargetingExpression, isSP);
}

/** Customer Search Term starting with "B0" is an ASIN search term. */
export function deriveSearchTermType(customerSearchTerm: string | null): "keyword" | "asin" {
  if (customerSearchTerm && customerSearchTerm.trim().toUpperCase().startsWith("B0")) {
    return "asin";
  }
  return "keyword";
}

const PLACEMENT_MAP: Record<string, string> = {
  "placement top": "Top of Search",
  "placement rest of search": "Rest of Search",
  "placement product page": "Product Pages",
  "placement amazon business": "Amazon Business",
};

/** Placement derivation for SP "Bidding Adjustment" rows. Blank -> Audience. */
export function derivePlacement(raw: string | null): string {
  if (!raw || !raw.trim()) return "Audience";
  const key = raw.trim().toLowerCase();
  return PLACEMENT_MAP[key] ?? raw.trim();
}

const BIDDING_STRATEGY_MAP: Record<string, string> = {
  "fixed bid": "Fixed Bid",
  "dynamic bids - up and down": "Up and Down",
  "dynamic bids - down only": "Down Only",
};

/** Bidding Strategy display name for SP "Bidding Adjustment" rows. */
export function deriveBiddingStrategy(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const key = raw.trim().toLowerCase();
  return BIDDING_STRATEGY_MAP[key] ?? raw.trim();
}

/** Case-insensitive "contains" check against every supplied brand keyword. */
export function isBrandedSearchTerm(
  searchTerm: string | null,
  brandKeywords: string[]
): boolean {
  if (!searchTerm) return false;
  const term = searchTerm.toLowerCase();
  return brandKeywords.some((kw) => kw.trim() && term.includes(kw.trim().toLowerCase()));
}
