/**
 * lib/ui/comparison.ts — "the same question, more models", for the how page.
 *
 * The lanes on the home page are a recording. This is the wider check: the
 * same 125-byte state, the same instruction and three answers, put to more
 * models one call at a time (lib/compare), including Alpie Seed and Alpie Core
 * and Sarvam 105B with thinking on as well as off. The run
 * lives in `public/model-comparison.json`, written by
 * `scripts/compare-models.ts`, with where and when it was measured recorded
 * beside the numbers. This file derives the columns a reader wants. Nothing
 * here is typed in by hand.
 *
 * The first row is the baseline every other row is measured against: Alpie
 * Seed with thinking off, the lane the front page leads with.
 *
 * `floorMs` is the per-request overhead of wherever the run was made, to be
 * removed before comparing. It is 0 unless a run says otherwise.
 */

import comparison from '../../public/model-comparison.json';

/** One row as `public/model-comparison.json` stores it. */
export interface ComparisonSourceRow {
  model: string;
  provider: string;
  setting: string;
  answered: number;
  correct: number;
  p50Ms: number;
  p95Ms: number;
  /** States this row ran, when fewer than the file's `states` (a thinking lane). */
  states?: number;
  key?: string;
  latenciesMs?: number[];
  warning?: string;
  error?: string;
}

export interface ComparisonRow extends ComparisonSourceRow {
  /** Median and p95 with the floor removed; from Vercel the floor is 0. */
  adjustedP50Ms: number;
  adjustedP95Ms: number;
  /** adjustedP50Ms over the baseline row's, one decimal. The baseline is 1. */
  timesHero: number;
}

export const COMPARISON_STATES: number = comparison.states;
export const COMPARISON_FLOOR_MS: number = comparison.floorMs;
export const COMPARISON_MEASURED_AT: string = comparison.measuredAt;
export const COMPARISON_FROM: string = comparison.from;

/** Rows in the order the file lists them (the baseline first, then fastest to slowest). */
export function comparisonRows(
  rows: readonly ComparisonSourceRow[] = comparison.rows,
  floorMs: number = comparison.floorMs,
): ComparisonRow[] {
  const baseline = rows[0];
  const baselineAdjusted = Math.max(1, (baseline?.p50Ms ?? 0) - floorMs);
  return rows.map((r) => {
    const adjustedP50Ms = Math.max(0, r.p50Ms - floorMs);
    return {
      ...r,
      adjustedP50Ms,
      adjustedP95Ms: Math.max(0, r.p95Ms - floorMs),
      timesHero: Math.round((Math.max(1, adjustedP50Ms) / baselineAdjusted) * 10) / 10,
    };
  });
}

/** "29 of 30" as a percentage for the table. */
export function accuracyPercent(row: Pick<ComparisonRow, 'answered' | 'correct'>): number {
  return row.answered === 0 ? 0 : Math.round((100 * row.correct) / row.answered);
}

/**
 * The sentence under the table about who got the question right, built from
 * the rows so it cannot drift from them. The baseline is the first row. A model
 * that got no answer to a call is said so, because the table then shows fewer
 * answers than states for it.
 */
export function accuracySentence(
  rows: readonly Pick<ComparisonRow, 'model' | 'answered' | 'correct' | 'states'>[],
  states: number = COMPARISON_STATES,
): string {
  const [hero, ...others] = rows;
  if (hero === undefined || others.length === 0) return '';
  // A row that ran fewer states (a thinking lane) is measured against its own count.
  const missing = (r: (typeof rows)[number]) => (r.states ?? states) - r.answered;
  const unanswered = rows
    .filter((r) => missing(r) > 0)
    .map((r) => `${r.model} got no answer to ${plural(missing(r), 'call')}, which ${missing(r) === 1 ? 'is' : 'are'} not counted`);
  const allRight = others.every((r) => r.correct === r.answered);
  const sameCount = others.every((r) => r.answered === others[0].answered);
  const rest = allRight
    ? sameCount
      ? `Every other model answered all ${others[0].answered} correctly`
      : 'Every other model answered every call it answered correctly'
    : `The other models answered ${others.reduce((n, r) => n + r.correct, 0)} of ${others.reduce((n, r) => n + r.answered, 0)} correctly between them`;
  const missed = hero.answered - hero.correct;
  // "so did" only reads right after "every other model answered all of them".
  const heroPart =
    missed === 0
      ? allRight
        ? `so did ${hero.model}`
        : `${hero.model} answered all ${hero.answered} correctly`
      : missed === 1
        ? `${hero.model} missed one`
        : `${hero.model} missed ${missed}`;
  return [`${rest}; ${heroPart}.`, ...unanswered.map((u) => `${u}.`)].join(' ');
}

function plural(n: number, noun: string): string {
  return n === 1 ? `one ${noun}` : `${n} ${noun}s`;
}
