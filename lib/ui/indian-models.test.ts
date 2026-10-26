import { describe, expect, it } from 'vitest';
import { INDIAN_STATES, UNMEASURED, indianRows } from './indian-models';

describe('the Indian models table', () => {
  it('leads with Alpie Seed, the baseline, and puts every row over the same states', () => {
    const rows = indianRows();
    expect(rows[0].model).toBe('Alpie Seed');
    expect(rows[0].timesHero).toBe(1);
    for (const r of rows) expect(r.states).toBe(INDIAN_STATES);
  });

  it('measures the two Featherless models and Sarvam 105B the race uses', () => {
    const keys = indianRows().map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['sarvam-105b-free', 'sarvam-m-hf', 'fathom-r1-14b-hf']));
  });

  it('gives every model left out a reason, and leaves out none that is in the table', () => {
    const measured = new Set(indianRows().map((r) => r.model));
    for (const m of UNMEASURED) {
      expect(m.reason.length).toBeGreaterThan(0);
      expect(measured.has(m.model)).toBe(false);
    }
  });
});
