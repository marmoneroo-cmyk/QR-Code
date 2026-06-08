/** A cocktail co-viewed alongside another in the same guest session. */
export interface RelatedItem {
  slug: string;
  coViews: number;
}

/** One cocktail's distinct-session views plus its top co-viewed neighbours. */
export interface CoViewRow {
  slug: string;
  views: number;
  related: RelatedItem[];
}

/** Co-view recommendations payload: "guests who viewed X also viewed Y". */
export interface Recommendations {
  rows: CoViewRow[];
  hasData: boolean;
}
