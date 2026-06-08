/** Per-table analytics (shared by route + page; no server-only import). */

export interface TableRow {
  tableId: string;
  /** Distinct sessions seen at this table. */
  sessions: number;
  /** Distinct sessions that opened a drink. */
  views: number;
  /** Distinct sessions that completed an order. */
  orders: number;
  /** Total drinks ordered. */
  units: number;
  /** orders / views, percent. */
  conversionPct: number;
  /** Revenue in ILS (price at time of order × quantity). */
  revenue: number;
  /** Distinct sessions that called a waiter. */
  callWaiter: number;
}

/** Activity that arrived via a SHARED table-QR link (origin=table_qr but the
 *  visitor came from WhatsApp/Instagram/etc) — NOT attributed to the table. */
export interface ViralSummary {
  sessions: number;
  orders: number;
  units: number;
  revenue: number;
}

export interface TableIntelligence {
  /** Real per-table performance (source=table_qr only). */
  tables: TableRow[];
  totalRevenue: number;
  /** Revenue from shared links, separated out so it never inflates a table. */
  viral: ViralSummary;
  hasData: boolean;
}
