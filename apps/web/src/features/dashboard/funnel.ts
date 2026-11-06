import type { Overview } from './dashboard-api';

export interface FunnelRow {
  stage: string;
  label: string;
  count: number;
  /** Width of the bar, 0 to 100, against the widest stage. */
  width: number;
  /** Share of the first stage, as whole percent; null when the first stage is empty. */
  percentOfFirst: number | null;
}

/**
 * The funnel as drawn. The API counts every application that ever reached a stage, so each
 * stage can only be as large as the one before it; bars are scaled to the widest count and
 * the percentage is taken from the first stage.
 */
export function funnelRows(funnel: Overview['funnel']): FunnelRow[] {
  const widest = funnel.reduce((max, item) => Math.max(max, item.count), 0);
  const first = funnel[0]?.count ?? 0;
  return funnel.map((item) => ({
    stage: item.stage,
    label: item.label,
    count: item.count,
    width: widest === 0 ? 0 : (item.count / widest) * 100,
    percentOfFirst: first === 0 ? null : Math.round((item.count / first) * 100),
  }));
}
