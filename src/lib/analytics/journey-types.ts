/** Session Journey ("replay lite") shapes — shared by route + page. */

export interface JourneyStep {
  event: string;
  cocktailSlug: string | null;
  /** ISO timestamp of the step. */
  at: string;
  value: number | null;
}

export interface SessionJourney {
  sessionId: string;
  start: string;
  end: string;
  /** Visit length in ms (end − start). */
  durationMs: number;
  tableId: string | null;
  source: string | null;
  origin: string | null;
  device: string | null;
  language: string | null;
  steps: JourneyStep[];
  // Value summary — what an owner actually looks at.
  views: number;
  ingredients: number;
  shares: number;
  orders: number;
  units: number;
  ordered: boolean;
  revenue: number;
  profit: number;
}

export interface SessionJourneys {
  sessions: SessionJourney[];
  hasData: boolean;
}
