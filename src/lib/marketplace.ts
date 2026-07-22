export interface MarketplaceOption {
  code: string;
  label: string;
  domain: string;
}

/** The 19 marketplaces selectable when creating an audit — code is what's
 * stored on `audits.marketplace`, domain drives every outbound Amazon link
 * (product pages, search results) generated across the dashboard. */
export const MARKETPLACES: MarketplaceOption[] = [
  { code: "US", label: "United States", domain: "amazon.com" },
  { code: "UK", label: "United Kingdom", domain: "amazon.co.uk" },
  { code: "DE", label: "Germany", domain: "amazon.de" },
  { code: "FR", label: "France", domain: "amazon.fr" },
  { code: "IT", label: "Italy", domain: "amazon.it" },
  { code: "ES", label: "Spain", domain: "amazon.es" },
  { code: "CA", label: "Canada", domain: "amazon.ca" },
  { code: "AU", label: "Australia", domain: "amazon.com.au" },
  { code: "IN", label: "India", domain: "amazon.in" },
  { code: "AE", label: "United Arab Emirates", domain: "amazon.ae" },
  { code: "SA", label: "Saudi Arabia", domain: "amazon.sa" },
  { code: "JP", label: "Japan", domain: "amazon.co.jp" },
  { code: "MX", label: "Mexico", domain: "amazon.com.mx" },
  { code: "BR", label: "Brazil", domain: "amazon.com.br" },
  { code: "NL", label: "Netherlands", domain: "amazon.nl" },
  { code: "SE", label: "Sweden", domain: "amazon.se" },
  { code: "PL", label: "Poland", domain: "amazon.pl" },
  { code: "BE", label: "Belgium", domain: "amazon.com.be" },
  { code: "SG", label: "Singapore", domain: "amazon.sg" },
];

const DEFAULT_MARKETPLACE_CODE = "US";

/** Returns the Amazon storefront origin (e.g. "https://www.amazon.co.uk")
 * for a marketplace code. Falls back to amazon.com for null/unrecognized
 * codes — audits created before the marketplace column existed will have
 * `marketplace: null` until normalized, and should still produce a working
 * (if not marketplace-accurate) link rather than a broken one. */
export function getAmazonBaseUrl(marketplace: string | null | undefined): string {
  const domain =
    MARKETPLACES.find((m) => m.code === marketplace)?.domain ??
    MARKETPLACES.find((m) => m.code === DEFAULT_MARKETPLACE_CODE)!.domain;
  return `https://www.${domain}`;
}

export function amazonAsinUrl(asin: string, marketplace: string | null | undefined): string {
  return `${getAmazonBaseUrl(marketplace)}/dp/${encodeURIComponent(asin)}`;
}

export function amazonSearchUrl(term: string, marketplace: string | null | undefined): string {
  return `${getAmazonBaseUrl(marketplace)}/s?k=${encodeURIComponent(term)}`;
}

/** Search terms starting with "B0" are ASIN targets, not real search
 * queries — those link straight to the product page instead of a search
 * results page that wouldn't show anything meaningful for a raw ASIN. */
export function amazonSearchTermUrl(term: string, marketplace: string | null | undefined): string {
  return term.toUpperCase().startsWith("B0") ? amazonAsinUrl(term, marketplace) : amazonSearchUrl(term, marketplace);
}
