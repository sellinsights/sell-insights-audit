import type { ReactNode } from "react";
import type { Column } from "@/components/DataTable";
import { amazonAsinUrl, amazonSearchTermUrl } from "@/lib/marketplace";

export function AmazonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-[#00B341] hover:underline">
      {children}
    </a>
  );
}

/** Reusable Column<T> builder for any table where a row has an ASIN — links
 * out to that product's Amazon detail page in the audit's marketplace.
 * Defined once at the column level so every table (Top ASINs, Advertised
 * ASIN Performance, etc.) gets the same link/style behavior for free
 * instead of a hardcoded <a> per table. */
export function asinColumn<T>({
  key = "asin",
  header = "ASIN",
  getAsin,
  marketplace,
}: {
  key?: string;
  header?: string;
  getAsin: (row: T) => string;
  marketplace: string | null | undefined;
}): Column<T> {
  return {
    key,
    header,
    render: (row) => {
      const asin = getAsin(row);
      return (
        <AmazonLink href={amazonAsinUrl(asin, marketplace)}>
          <span className="font-medium">{asin}</span>
        </AmazonLink>
      );
    },
    sortValue: (row) => getAsin(row),
  };
}

/** Reusable Column<T> builder for any table where a row has a customer
 * search term — links to Amazon search results, or to the product page when
 * the term is itself an ASIN target (starts with "B0"). */
export function searchTermColumn<T>({
  key = "term",
  header = "Customer Search Term",
  getTerm,
  marketplace,
}: {
  key?: string;
  header?: string;
  getTerm: (row: T) => string | null;
  marketplace: string | null | undefined;
}): Column<T> {
  return {
    key,
    header,
    render: (row) => {
      const term = getTerm(row);
      if (!term) return "—";
      return <AmazonLink href={amazonSearchTermUrl(term, marketplace)}>{term}</AmazonLink>;
    },
    sortValue: (row) => getTerm(row),
  };
}
