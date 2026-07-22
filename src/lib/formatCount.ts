/** Formats a section's row count for display under its title, e.g.
 * formatCount(10, "ASIN") -> "10 ASINs", formatCount(1, "ASIN) -> "1 ASIN".
 * Pass `plural` explicitly when a trailing "s" isn't correct (e.g.
 * formatCount(n, "strategy", "strategies")). */
export function formatCount(n: number, singular: string, plural: string = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
