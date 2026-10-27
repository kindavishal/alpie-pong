import { describe, expect, it } from 'vitest';
import { LANES } from '../game/types';
import { COMPARISON_STATES, accuracyPercent, comparisonRows, accuracySentence, spreadSentence } from './comparison';

describe('comparisonRows', () => {
  it('names the row and the first error when a model with two rows misses calls', () => {
    const base = { states: 30, correct: 28 };
    const sentence = accuracySentence(
      [
        { model: 'Alpie Seed 9B', answered: 30, correct: 30, states: 30, setting: 'thinking off' },
        { model: 'Sarvam 105B', answered: 30, ...base, setting: 'thinking off' },
        { model: 'Sarvam 105B', answered: 29, ...base, setting: 'thinking on', error: 'Too Many Requests' },
      ],
      30,
    );
    expect(sentence).toContain('Sarvam 105B with thinking on got no answer to one call (first error: \u201cToo Many Requests\u201d), which is not counted.');
  });

  // Every lane that races is in the table, under the name the race gives it, and nothing is measured apart.
  it('has a row for every race lane, by its race name, all from one run', () => {
    const rows = comparisonRows();
    for (const lane of LANES) expect(rows.map((r) => r.model)).toContain(lane.label);
    expect(rows.filter((r) => r.note !== undefined)).toEqual([]);
  });

  // A rival may well be faster than the baseline; the table has to be able to say so.
  it('puts the baseline first at exactly 1x and the rest fastest to slowest', () => {
    const rows = comparisonRows();
    expect(rows[0].model).toBe('Alpie Seed 9B');
    expect(rows[0].setting).toBe('thinking off');
    expect(rows[0].timesHero).toBe(1);
    const medians = rows.slice(1).map((r) => r.adjustedP50Ms);
    expect(medians).toEqual([...medians].sort((a, b) => a - b));
  });

  it('removes the local floor from every median and never goes below zero', () => {
    const rows = comparisonRows(
      [
        { model: 'Alpie Seed', provider: 'x', setting: 's', answered: 30, correct: 30, p50Ms: 300, p95Ms: 400 },
        { model: 'Slow', provider: 'x', setting: 's', answered: 30, correct: 30, p50Ms: 1500, p95Ms: 2000 },
        { model: 'Faster than the floor', provider: 'x', setting: 's', answered: 30, correct: 30, p50Ms: 50, p95Ms: 60 },
      ],
      120,
    );
    expect(rows[0].adjustedP50Ms).toBe(180);
    expect(rows[1].adjustedP50Ms).toBe(1380);
    expect(rows[1].timesHero).toBe(7.7);
    expect(rows[2].adjustedP50Ms).toBe(0);
  });

  it('never lets a model answer more states than its run had', () => {
    for (const row of comparisonRows()) {
      expect(row.answered).toBeLessThanOrEqual(row.states ?? COMPARISON_STATES);
      expect(row.correct).toBeLessThanOrEqual(row.answered);
    }
  });

  it('reports accuracy as a whole percentage of the answers given', () => {
    expect(accuracyPercent({ answered: 30, correct: 29 })).toBe(97);
    expect(accuracyPercent({ answered: 0, correct: 0 })).toBe(0);
  });
});

describe('accuracySentence', () => {
  const row = (model: string, answered: number, correct: number) => ({ model, answered, correct });

  it('says every other model was right and how many the baseline missed', () => {
    expect(accuracySentence([row('Alpie Seed', 30, 29), row('A', 30, 30), row('B', 30, 30)], 30)).toBe(
      'Every other model answered all 30 correctly; Alpie Seed missed one.',
    );
    expect(accuracySentence([row('Alpie Seed', 30, 30), row('A', 30, 30)], 30)).toBe(
      'Every other model answered all 30 correctly; so did Alpie Seed.',
    );
    expect(accuracySentence([row('Alpie Seed', 30, 27), row('A', 30, 30)], 30)).toBe(
      'Every other model answered all 30 correctly; Alpie Seed missed 3.',
    );
  });

  it('totals the other models when one of them slipped', () => {
    expect(accuracySentence([row('Alpie Seed', 30, 30), row('A', 30, 29), row('B', 30, 30)], 30)).toBe(
      'The other models answered 59 of 60 correctly between them; Alpie Seed answered all 30 correctly.',
    );
  });

  it('mentions calls that got no answer', () => {
    expect(accuracySentence([row('Alpie Seed', 29, 28), row('A', 30, 30)], 30)).toBe(
      'Every other model answered all 30 correctly; Alpie Seed missed one. Alpie Seed got no answer to one call, which is not counted.',
    );
    expect(accuracySentence([row('Alpie Seed', 30, 30), row('A', 28, 28)], 30)).toBe(
      'Every other model answered all 28 correctly; so did Alpie Seed. A got no answer to 2 calls, which are not counted.',
    );
  });

  it('measures a row that ran fewer states against its own count', () => {
    const thinking = { model: 'T', answered: 10, correct: 10, states: 10 };
    expect(accuracySentence([row('Alpie Seed', 30, 30), row('A', 30, 30), thinking], 30)).toBe(
      'Every other model answered every call it answered correctly; so did Alpie Seed.',
    );
    expect(accuracySentence([row('Alpie Seed', 30, 30), { ...thinking, answered: 9, correct: 9 }], 30)).toBe(
      'Every other model answered all 9 correctly; so did Alpie Seed. T got no answer to one call, which is not counted.',
    );
  });

  it('is empty without a second model', () => {
    expect(accuracySentence([])).toBe('');
    expect(accuracySentence([row('Alpie Seed', 30, 30)])).toBe('');
  });
});

describe('spreadSentence', () => {
  it('names a row whose p95 comes from a few slow calls, from its own latencies', () => {
    const steady = { model: 'A', setting: 's', p50Ms: 500, p95Ms: 600, latenciesMs: [500, 500, 600] };
    const spiky = { model: 'B', setting: 's', p50Ms: 1000, p95Ms: 17000, latenciesMs: [1000, 1000, 1000, 5000, 20000] };
    expect(spreadSentence([steady])).toBe('');
    expect(spreadSentence([steady, spiky])).toContain('(B: 2 of 5 calls took over three times its median, the longest 20.0 s)');
  });

  it('accounts for every row in the published run whose p95 is over three times its median', () => {
    const rows = comparisonRows();
    const sentence = spreadSentence(rows);
    for (const r of rows.filter((r) => r.p95Ms > 3 * r.p50Ms)) expect(sentence).toContain(r.model);
  });
});

describe('adjustedP95Ms', () => {
  it('removes the floor from p95 as well', () => {
    const rows = comparisonRows(
      [
        { model: 'Alpie Seed', provider: 'x', setting: 'y', answered: 1, correct: 1, p50Ms: 300, p95Ms: 500 },
        { model: 'A', provider: 'x', setting: 'y', answered: 1, correct: 1, p50Ms: 1000, p95Ms: 1200 },
      ],
      100,
    );
    expect(rows.map((r) => r.adjustedP95Ms)).toEqual([400, 1100]);
  });
});
