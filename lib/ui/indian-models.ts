/**
 * lib/ui/indian-models.ts — the search for Indian rivals, for the how page.
 *
 * Sarvam 105B is the only Indian model in the race besides Alpie. This is
 * what the search for others found (2026-10-26). The models still served
 * anywhere were put the same question as the comparison table (lib/compare),
 * beside Alpie Seed and Sarvam 105B, and the run lives in
 * `public/indian-comparison.json`, written by `scripts/compare-models.ts`
 * with where it was measured recorded beside the numbers. Nothing in the
 * table is typed in by hand.
 *
 * The models that could not be asked at all are listed with the reason, so
 * the table is not read as everything there is.
 */

import indian from '../../public/indian-comparison.json';
import { comparisonRows, type ComparisonRow } from './comparison';

export const INDIAN_STATES: number = indian.states;
export const INDIAN_MEASURED_AT: string = indian.measuredAt;
export const INDIAN_FROM: string = indian.from;
/** The Vercel region the run was made in; null when it was made off Vercel. */
export const INDIAN_REGION: string | null = indian.region;

/** The baseline first, then fastest to slowest, as the file lists them. */
export function indianRows(): ComparisonRow[] {
  return comparisonRows(indian.rows, indian.floorMs);
}

export interface UnmeasuredModel {
  model: string;
  maker?: string;
  reason: string;
}

/** Indian models that could not be put the question, and why. Checked 2026-10-26. */
export const UNMEASURED: readonly UnmeasuredModel[] = [
  { model: 'Sarvam 30B', maker: 'Sarvam', reason: "retired from Sarvam's API; open weights with no other host found" },
  { model: 'Krutrim-2 12B', maker: 'Ola Krutrim', reason: "no longer served, as Krutrim Cloud's catalogue now holds only other companies' models" },
  { model: 'Param2 17B-A2.4B', maker: 'BharatGen', reason: "open weights with no hosted API found, under BharatGen's non-commercial licence" },
  { model: 'Zia LLM', maker: 'Zoho', reason: 'announced at 1.3B, 2.6B and 7B, with no public API found' },
  { model: 'Soket, Tech Mahindra (Indus), Genloop, CoRover (BharatGPT) and Hanooman', reason: 'no public chat API or hosted model found' },
  { model: 'Inya VoiceOS', maker: 'Gnani', reason: "a 5B voice-to-voice research preview; Gnani's released models work on speech, not text chat" },
];
