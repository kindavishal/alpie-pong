import { describe, expect, it } from 'vitest';
import { MEASUREMENT, measurementFor } from './site';

describe('measurementFor', () => {
  it('names the Vercel region a recording saved', () => {
    expect(measurementFor('sfo1')).toBe("Vercel (sfo1), via each model's own API");
  });

  it('says a recording made off Vercel was not made on Vercel', () => {
    expect(measurementFor(null)).toBe("a local machine, not Vercel, via each model's own API");
  });

  it('keeps iad1 for the recording from before the region was saved', () => {
    expect(measurementFor(undefined)).toBe("Vercel (iad1), via each model's own API");
    expect(MEASUREMENT).toBe(measurementFor(undefined));
  });
});
