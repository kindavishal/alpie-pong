import { describe, expect, it } from 'vitest';
import { HERO, LANES } from '../game/types';
import {
  LANE_STATS,
  chatRangeSec,
  headlineSentences,
  heroAvgMs,
  resultRows,
  type LaneStat,
} from './stats';

const ROWS: LaneStat[] = [
  {
    model: 'alpie',
    label: 'Alpie Seed',
    provider: '169Pi',
    decisionsPerSec: 4.4,
    avgMs: 227.4,
    p95Ms: 400,
    returns: 25,
  },
  {
    model: 'gemini',
    label: 'Gemini',
    provider: 'Google',
    decisionsPerSec: 0.32,
    avgMs: 3167,
    p95Ms: 7438,
    returns: 2,
  },
  {
    model: 'haiku',
    label: 'Haiku',
    provider: 'Anthropic',
    decisionsPerSec: 0.4,
    avgMs: 2483,
    p95Ms: 8358,
    returns: 2,
  },
];

describe('LANE_STATS', () => {
  it('is the recorded run, in contract order, hero first', () => {
    // A lane with no key yet is simply not in the recording; the order of the rest holds.
    const recorded = LANES.map((lane) => lane.id).filter((id) => LANE_STATS.some((row) => row.model === id));
    expect(LANE_STATS.map((row) => row.model)).toEqual(recorded);
    expect(LANE_STATS[0]?.model).toBe(HERO);
  });

  it('gives the hero its provider from the lane contract, never a literal', () => {
    expect(LANE_STATS[0]?.provider).toBe('169Pi');
  });

  it('carries a real measurement for every lane', () => {
    // No p95 >= average check: one slow first call can lift a fast lane's average above its p95.
    for (const row of LANE_STATS) {
      expect(row.avgMs).toBeGreaterThan(0);
      expect(row.p95Ms).toBeGreaterThan(0);
      expect(row.decisionsPerSec).toBeGreaterThan(0);
    }
  });
});

describe('heroAvgMs', () => {
  it('rounds to whole milliseconds', () => {
    expect(heroAvgMs(ROWS)).toBe(227);
  });

  it('is 0 when there is no hero lane rather than a guess', () => {
    expect(heroAvgMs(ROWS.filter((row) => row.model !== HERO))).toBe(0);
  });
});

describe('chatRangeSec', () => {
  it('spans the slowest and fastest other model, one decimal', () => {
    expect(chatRangeSec(ROWS)).toEqual({ low: '2.5', high: '3.2' });
  });

  it('never counts the hero among the others', () => {
    const onlyHero = ROWS.filter((row) => row.model === HERO);
    expect(chatRangeSec(onlyHero)).toEqual({ low: '0.0', high: '0.0' });
  });
});

describe('headlineSentences', () => {
  it('quotes the measurement, not a literal', () => {
    const line = headlineSentences(ROWS);
    expect(line.hero).toBe('Alpie Seed 9B returns a decision in');
    expect(line.heroMs).toBe('227 ms');
    expect(line.chat).toBe('Its rivals take 2.5 to 3.2 seconds.');
  });

  it("leaves the hero's own provider out of the rivals", () => {
    const core = { ...ROWS[1], model: 'alpie-core', label: 'Alpie Core', provider: '169Pi', avgMs: 14902 };
    expect(headlineSentences([...ROWS, core]).chat).toBe('Its rivals take 2.5 to 3.2 seconds.');
  });

  it('names the rival when the recording has only one', () => {
    const line = headlineSentences(ROWS.slice(0, 2));
    expect(line.chat).toBe('Gemini takes 3.2 seconds.');
  });

  it('has no em dash and no hype', () => {
    const all = Object.values(headlineSentences()).join(' ');
    expect(all).not.toMatch(/—/);
    expect(all.toLowerCase()).not.toMatch(/revolutionary|game-?chang|blazing/);
  });
});

describe('resultRows', () => {
  it('adds the counted window to each lane', () => {
    const rows = resultRows({ alpie: 53, gemini: 4 }, ROWS);
    expect(rows.map((row) => row.inWindow)).toEqual([53, 4, 0]);
  });
});
