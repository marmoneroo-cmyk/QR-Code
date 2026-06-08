/** Shared analytics shapes (no server-only imports — safe for client + server). */

export interface TopItem {
  slug: string;
  views: number;
  orders: number;
  units: number;
  conversionPct: number;
  /** Revenue in ILS attributed to this item. */
  revenue: number;
}

/** A single raw event row for the inspector. */
export interface RawEvent {
  id: number;
  event_name: string | null;
  cocktail_slug: string | null;
  session_id: string | null;
  table_id: string | null;
  device_type: string | null;
  language: string | null;
  value_num: number | null;
  metadata: unknown;
  occurred_at: string | null;
  created_at: string;
}

export interface RawEventsResult {
  events: RawEvent[];
  eventNames: string[];
  total: number;
}

/** Data-integrity invariant check + any violations found. */
export interface IntegrityIssue {
  slug: string;
  rule: string;
  detail: string;
}

export interface IntegrityReport {
  totalEvents: number;
  checks: { name: string; passed: boolean }[];
  issues: IntegrityIssue[];
  allPassed: boolean;
}

/** Classic menu-engineering quadrant. */
export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface MenuEngineeringItem {
  slug: string;
  price: number;
  cost: number;
  margin: number;
  marginPct: number;
  /** Drink-page views (cocktail_opened). */
  views: number;
  orders: number;
  /** Total drinks ordered. */
  units: number;
  conversionPct: number;
  /** 0–100 engagement score (relative to the most-engaging item). */
  attentionScore: number;
  klass: MenuClass;
  /** High attention but weak conversion — a "fix the offer" signal. */
  highInterestLowConversion: boolean;
}

export interface MenuEngineering {
  items: MenuEngineeringItem[];
  medianDemand: number;
  medianMargin: number;
  hasData: boolean;
}

export interface AnalyticsOverview {
  /** Drink-page views (cocktail_opened events) in the window. */
  totalViews: number;
  /** Completed orders (order_completed events). */
  totalOrders: number;
  /** Total drinks ordered (sum of order_completed quantities). */
  totalUnits: number;
  /** orders / views, percent. */
  conversionPct: number;
  /** Total revenue (ILS) in the window. */
  totalRevenue: number;
  /** Total gross profit (revenue − pour cost), ILS. */
  totalProfit: number;
  topItemSlug: string | null;
  /** Last 30 days, one bucket per day (oldest → today). */
  viewsByDay: number[];
  ordersByDay: number[];
  /** 24 buckets, normalized 0..1. */
  hourHeatmap: number[];
  topItems: TopItem[];
  /** False when there are no events yet (show an empty state). */
  hasData: boolean;
}
