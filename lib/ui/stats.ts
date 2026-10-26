/**
 * The measured run, as the pages print it.
 *
 * `public/replay-stats.json` is written by the recorder alongside
 * `public/replay.json` (scripts/record-replay.ts, or `POST /api/record` running
 * in the worker's own region). Every number the home page headline and the
 * results strip show is read from it here, at build time. Nothing on either
 * surface is a figure somebody typed in, so re-recording the run changes the
 * copy with it.
 *
 * The one column this file cannot answer is "decisions in the first N seconds":
 * that is counted off the recording itself by the same function the clip's end
 * card and the social card use (lib/render/og.ts). The server page hands the
 * counts in — see `resultRows`.
 */

import stats from '../../public/replay-stats.json';
import { measurementFor } from '../config/site';
import { HERO, LANES, heroLane, laneSource } from '../game/types';
import { CLIP_TOKENS, providerFor } from '../render/tokens';

/** How long the recorded run is, in seconds. */
export const RECORDED_SECONDS: number = stats.seconds;

/** When it was recorded, ISO-8601. */
export const RECORDED_AT: string = stats.recordedAt;

/** Where the recording on the home page was made, from the region it saved. */
export const RECORDED_FROM: string = measurementFor((stats as { region?: string | null }).region);

export interface LaneStat {
  model: string;
  label: string;
  /** "169Pi", "Mistral", … */
  provider: string;
  decisionsPerSec: number;
  avgMs: number;
  p95Ms: number;
  returns: number;
}

/**
 * One row per lane, in contract order. Lanes never re-sort (design/SPEC.md,
 * must-not-get-wrong b), so the strip reads the same way the courts above it do.
 */
export const LANE_STATS: LaneStat[] = LANES.flatMap((lane) => {
  const row = stats.lanes.find((l) => l.model === lane.id);
  if (row === undefined) return [];
  return [
    {
      model: lane.id,
      label: lane.label,
      provider: providerFor(CLIP_TOKENS, laneSource(lane)),
      decisionsPerSec: row.decisionsPerSec,
      avgMs: row.avgMs,
      p95Ms: row.p95Ms,
      returns: row.returns,
    },
  ];
});

/* ------------------------------------------------------------- the headline */

/** The hero's average round trip, whole milliseconds. */
export function heroAvgMs(rows: LaneStat[] = LANE_STATS): number {
  const hero = rows.find((row) => row.model === HERO);
  return Math.round(hero?.avgMs ?? 0);
}

/**
 * The rivals: every lane that is neither the hero nor another model from the
 * hero's own provider. Alpie Core races to show what thinking costs, not as a
 * rival, so the headline does not count it against Alpie Seed.
 */
export function rivalRows(rows: LaneStat[] = LANE_STATS): LaneStat[] {
  const hero = rows.find((row) => row.model === HERO);
  return rows.filter((row) => row.model !== HERO && row.provider !== hero?.provider);
}

/** What the rivals took, as a range in seconds to one decimal. */
export function chatRangeSec(rows: LaneStat[] = LANE_STATS): { low: string; high: string } {
  const others = rivalRows(rows).map((row) => row.avgMs);
  if (others.length === 0) return { low: '0.0', high: '0.0' };
  const low = Math.min(...others) / 1000;
  const high = Math.max(...others) / 1000;
  return { low: low.toFixed(1), high: high.toFixed(1) };
}

/**
 * The claim, in three sentences, built from the numbers above.
 *
 * Sentence one is the whole point of the demo, so it is the one thing on the
 * page that carries the hero's colour.
 */
export function headlineSentences(rows: LaneStat[] = LANE_STATS): {
  hero: string;
  heroMs: string;
  chat: string;
  watch: string;
} {
  const { low, high } = chatRangeSec(rows);
  // Until every rival has a key, the recording may hold only one of them: name it.
  const rivals = rivalRows(rows);
  const chat =
    rivals.length === 1
      ? `${rivals[0].label} takes ${low} seconds.`
      : low === high
        ? `Its rivals take ${low} seconds.`
        : `Its rivals take ${low} to ${high} seconds.`;
  return {
    hero: `${heroLane().label} returns a decision in`,
    heroMs: `${heroAvgMs(rows)} ms`,
    chat,
    watch: "Here's what that does to a game of Pong.",
  };
}

/* --------------------------------------------------------- the results strip */

export interface ResultRow extends LaneStat {
  /** Decisions counted over the first `CLIP_SECONDS` of the recording. */
  inWindow: number;
}

/**
 * The strip under the lanes: the same four lanes, measured.
 *
 * `windowDecisions` is `ogRows()` keyed by model — counted off the recording by
 * the clip's own counter, so the strip, the clip's end card and the social card
 * cannot disagree.
 */
export function resultRows(
  windowDecisions: Record<string, number>,
  rows: LaneStat[] = LANE_STATS,
): ResultRow[] {
  return rows.map((row) => ({ ...row, inWindow: windowDecisions[row.model] ?? 0 }));
}
