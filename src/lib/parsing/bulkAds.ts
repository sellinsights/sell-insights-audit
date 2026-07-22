import * as XLSX from "xlsx";
import {
  buildLookup,
  cleanInt,
  cleanNumber,
  deriveBiddingStrategy,
  deriveCampaignFinalMatchType,
  derivePlacement,
  deriveSearchTermFinalMatchType,
  deriveSearchTermType,
  field,
  str,
  type RawRow,
} from "./helpers";
import type { AdMetrics, SbCampaignRow, SdCampaignRow, SearchTermRow, SpCampaignRow } from "@/types/database";

export type ParsedSpCampaignRow = Omit<SpCampaignRow, "id" | "audit_id">;
export type ParsedSbCampaignRow = Omit<SbCampaignRow, "id" | "audit_id">;
export type ParsedSdCampaignRow = Omit<SdCampaignRow, "id" | "audit_id">;
export type ParsedSearchTermRow = Omit<SearchTermRow, "id" | "audit_id">;

export interface ParsedBulkAds {
  spCampaigns: ParsedSpCampaignRow[];
  sbCampaigns: ParsedSbCampaignRow[];
  sdCampaigns: ParsedSdCampaignRow[];
  spSearchTerms: ParsedSearchTermRow[];
  sbSearchTerms: ParsedSearchTermRow[];
}

function findSheet(workbook: XLSX.WorkBook, ...candidates: string[]): XLSX.WorkSheet | null {
  const names = workbook.SheetNames;
  for (const candidate of candidates) {
    const exact = names.find((n) => n.trim().toLowerCase() === candidate.trim().toLowerCase());
    if (exact) return workbook.Sheets[exact];
  }
  for (const candidate of candidates) {
    const partial = names.find((n) => n.trim().toLowerCase().includes(candidate.trim().toLowerCase()));
    if (partial) return workbook.Sheets[partial];
  }
  return null;
}

function rowsOf(sheet: XLSX.WorkSheet | null): RawRow[] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
}

function parseMetrics(lookup: Map<string, unknown>): AdMetrics {
  return {
    impressions: cleanInt(field(lookup, "Impressions")),
    clicks: cleanInt(field(lookup, "Clicks")),
    ctr: cleanNumber(field(lookup, "Click-through Rate", "CTR")),
    spend: cleanNumber(field(lookup, "Spend")),
    sales: cleanNumber(field(lookup, "Sales")),
    orders: cleanInt(field(lookup, "Orders")),
    units: cleanInt(field(lookup, "Units")),
    conversion_rate: cleanNumber(field(lookup, "Conversion Rate", "CVR")),
    acos: cleanNumber(field(lookup, "ACOS")),
    cpc: cleanNumber(field(lookup, "CPC")),
    roas: cleanNumber(field(lookup, "ROAS")),
  };
}

function parseSpCampaigns(sheet: XLSX.WorkSheet | null): ParsedSpCampaignRow[] {
  return rowsOf(sheet)
    .map((row): ParsedSpCampaignRow | null => {
      const lookup = buildLookup(row);
      const entity = str(field(lookup, "Entity"));
      if (!entity) return null;

      const isBiddingAdjustment = entity.toLowerCase() === "bidding adjustment";
      const matchType = str(field(lookup, "Match Type"));
      const productTargetingExpression = str(field(lookup, "Product Targeting Expression"));
      const rawBiddingStrategy = str(field(lookup, "Bidding Strategy"));
      const rawPlacement = str(field(lookup, "Placement"));

      return {
        entity,
        campaign_id: str(field(lookup, "Campaign ID")),
        campaign_name: str(field(lookup, "Campaign Name")),
        ad_group_name: str(field(lookup, "Ad Group Name")),
        targeting_type: str(field(lookup, "Targeting Type")),
        state: str(field(lookup, "State")),
        asin: str(field(lookup, "ASIN (Informational only)", "ASIN")),
        sku: str(field(lookup, "SKU")),
        match_type: matchType,
        bidding_strategy: isBiddingAdjustment
          ? deriveBiddingStrategy(rawBiddingStrategy)
          : rawBiddingStrategy,
        placement: isBiddingAdjustment ? derivePlacement(rawPlacement) : rawPlacement,
        product_targeting_expression: productTargetingExpression,
        final_match_type: deriveCampaignFinalMatchType(
          entity,
          matchType,
          productTargetingExpression,
          true
        ),
        ...parseMetrics(lookup),
      };
    })
    .filter((row): row is ParsedSpCampaignRow => row !== null);
}

function parseSbCampaigns(sheet: XLSX.WorkSheet | null): ParsedSbCampaignRow[] {
  return rowsOf(sheet)
    .map((row): ParsedSbCampaignRow | null => {
      const lookup = buildLookup(row);
      const entity = str(field(lookup, "Entity"));
      if (!entity) return null;

      const matchType = str(field(lookup, "Match Type"));
      const productTargetingExpression = str(field(lookup, "Product Targeting Expression"));

      return {
        entity,
        campaign_id: str(field(lookup, "Campaign ID")),
        campaign_name: str(field(lookup, "Campaign Name")),
        state: str(field(lookup, "State")),
        asin: str(field(lookup, "ASIN (Informational only)", "ASIN")),
        match_type: matchType,
        product_targeting_expression: productTargetingExpression,
        final_match_type: deriveCampaignFinalMatchType(
          entity,
          matchType,
          productTargetingExpression,
          false
        ),
        ...parseMetrics(lookup),
      };
    })
    .filter((row): row is ParsedSbCampaignRow => row !== null);
}

function parseSdCampaigns(sheet: XLSX.WorkSheet | null): ParsedSdCampaignRow[] {
  return rowsOf(sheet)
    .map((row): ParsedSdCampaignRow | null => {
      const lookup = buildLookup(row);
      const entity = str(field(lookup, "Entity"));
      if (!entity) return null;

      return {
        entity,
        campaign_id: str(field(lookup, "Campaign ID")),
        campaign_name: str(field(lookup, "Campaign Name")),
        ad_group_name: str(field(lookup, "Ad Group Name")),
        targeting_type: str(field(lookup, "Targeting Type")),
        state: str(field(lookup, "State")),
        asin: str(field(lookup, "ASIN (Informational only)", "ASIN")),
        sku: str(field(lookup, "SKU")),
        ...parseMetrics(lookup),
      };
    })
    .filter((row): row is ParsedSdCampaignRow => row !== null);
}

function parseSearchTermReport(sheet: XLSX.WorkSheet | null, isSP: boolean): ParsedSearchTermRow[] {
  return rowsOf(sheet)
    .map((row): ParsedSearchTermRow | null => {
      const lookup = buildLookup(row);
      const customerSearchTerm = str(field(lookup, "Customer Search Term"));
      if (!customerSearchTerm) return null;

      const matchType = str(field(lookup, "Match Type"));
      const productTargetingExpression = str(field(lookup, "Product Targeting Expression"));

      return {
        campaign_name: str(field(lookup, "Campaign Name (Informational only)", "Campaign Name")),
        ad_group_name: str(field(lookup, "Ad Group Name (Informational only)", "Ad Group Name")),
        keyword_text: str(field(lookup, "Keyword Text")),
        match_type: matchType,
        product_targeting_expression: productTargetingExpression,
        final_match_type: deriveSearchTermFinalMatchType(
          matchType,
          productTargetingExpression,
          isSP
        ),
        customer_search_term: customerSearchTerm,
        search_term_type: deriveSearchTermType(customerSearchTerm),
        ...parseMetrics(lookup),
      };
    })
    .filter((row): row is ParsedSearchTermRow => row !== null);
}

/** Reads the workbook once so its sheets can be parsed one at a time (each step reported separately). */
export function readBulkAdsWorkbook(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { type: "array" });
}

export function parseSpCampaignsFromWorkbook(workbook: XLSX.WorkBook): ParsedSpCampaignRow[] {
  return parseSpCampaigns(findSheet(workbook, "Sponsored Products Campaigns", "SP Campaigns"));
}

export function parseSbCampaignsFromWorkbook(workbook: XLSX.WorkBook): ParsedSbCampaignRow[] {
  return parseSbCampaigns(findSheet(workbook, "Sponsored Brands Campaigns", "SB Campaigns"));
}

export function parseSdCampaignsFromWorkbook(workbook: XLSX.WorkBook): ParsedSdCampaignRow[] {
  return parseSdCampaigns(findSheet(workbook, "Sponsored Display Campaigns", "SD Campaigns"));
}

export function parseSpSearchTermsFromWorkbook(workbook: XLSX.WorkBook): ParsedSearchTermRow[] {
  return parseSearchTermReport(findSheet(workbook, "SP Search Term Report"), true);
}

export function parseSbSearchTermsFromWorkbook(workbook: XLSX.WorkBook): ParsedSearchTermRow[] {
  return parseSearchTermReport(findSheet(workbook, "SB Search Term Report"), false);
}

/** Parses the 5 relevant tabs out of the Bulk Ads Excel export. */
export function parseBulkAdsWorkbook(data: ArrayBuffer): ParsedBulkAds {
  const workbook = readBulkAdsWorkbook(data);

  return {
    spCampaigns: parseSpCampaignsFromWorkbook(workbook),
    sbCampaigns: parseSbCampaignsFromWorkbook(workbook),
    sdCampaigns: parseSdCampaignsFromWorkbook(workbook),
    spSearchTerms: parseSpSearchTermsFromWorkbook(workbook),
    sbSearchTerms: parseSbSearchTermsFromWorkbook(workbook),
  };
}
