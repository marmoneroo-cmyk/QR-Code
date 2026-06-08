/** Signal Verification (internal QA) shapes — shared by route + page. */

export type HealthStatus = 'healthy' | 'warning' | 'fail';

export interface PercentileStats {
  count: number;
  avg: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  min: number;
  max: number;
}

/** A numeric signal with its distribution + data-quality verdict. */
export interface SignalBlock {
  stats: PercentileStats;
  invalidPct: number;
  missingPct: number;
  status: HealthStatus;
}

export interface QualityCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** One row of the Instrumentation Health Score — verifies the MEASUREMENT. */
export interface HealthItem {
  signal: string;
  status: HealthStatus;
  detail: string;
}

/** Direction of a coverage metric: recent window vs the prior window. */
export interface CoverageTrend {
  metric: string;
  recentPct: number;
  priorPct: number;
  trend: 'up' | 'down' | 'flat';
}

/** A signal whose distribution shifted sharply — a bug often looks like drift,
 *  not a hard Fail. */
export interface DriftItem {
  signal: string;
  recent: number;
  baseline: number;
  deltaPct: number;
  status: HealthStatus;
}

/** The unambiguous go/no-go. No "feels ready". */
export interface EngineReadiness {
  ready: boolean;
  consecutiveReadyDays: number;
  requiredDays: number;
  blockedBy: string[];
}

export interface SignalVerification {
  totalEvents: number;
  collectedSinceDays: number | null;
  hasVisitorColumn: boolean;
  readiness: EngineReadiness;
  trends: CoverageTrend[];
  drift: DriftItem[];
  /** Active dwell seconds. */
  dwell: SignalBlock;
  /** Scroll depth %, 0–100, plus the share of events at exactly 100% (a spike = bug). */
  scrollDepth: SignalBlock & { full100Pct: number };
  favorites: {
    events: number;
    addEvents: number;
    removeEvents: number;
    distinctItems: number;
    addRatePct: number;
    removeRatePct: number;
    status: HealthStatus;
  };
  identity: {
    uniqueVisitors: number;
    uniqueSessions: number;
    totalEvents: number;
    visitorCoveragePct: number;
    returnVisitors: number;
    sessionsPerVisitor: number;
    maxEventsPerVisitor: number;
    maxEventsPerSession: number;
    avgEventsPerSession: number;
    status: HealthStatus;
  };
  /** Per-signal Healthy/Warning/Fail — the system checking its own instruments. */
  instrumentationHealth: HealthItem[];
  quality: QualityCheck[];
}
