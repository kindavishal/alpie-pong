/**
 * Re-measures public/model-comparison.json by asking the deployed app to run
 * each comparison lane from its own Vercel function (POST /api/compare), so
 * every latency is measured from a server, on the same footing as the race.
 *
 * Run (against a deployment, needs ADMIN_TOKEN in .env.local, the deployment's token):
 *   pnpm dlx tsx --env-file=.env.local scripts/compare-models.ts
 * Options via env: COMPARE_URL (default http://localhost:3000, a `pnpm dev`
 * on this machine, which measures from here rather than from Vercel and says
 * so in the file), LANES=alpie-seed,gemma-4-cf (subset, default the Alpie line-up),
 * N (states, default 30), OUT (default public/model-comparison.json).
 */
import { writeFile } from 'node:fs/promises';
import { ADMIN_TOKEN_HEADER } from '../lib/config/admin';
import { COMPARE_LANE_KEYS, DEFAULT_STATES, mergeRows, type CompareRow } from '../lib/compare/compare-models';

const BASE = (process.env.COMPARE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
/**
 * Alpie Seed first (the baseline), then every race rival as it races, the models
 * that raced before (Gemma 4, Alpie Core), the other Ministral sizes, and Sarvam
 * and both Alpies with thinking on. All are free to start on except Gemini 3.5
 * Flash-Lite, a billed race lane. The Gateway lanes need a card on the Gateway, so
 * they are opt-in through LANES.
 */
const PUBLISHED = [
  'alpie-seed',
  'sarvam-105b-free', 'ministral-3b-free', 'ministral-8b-free', 'ministral-14b-free', 'qwen-3.8-cf', 'gemini-3.5-flash-lite-google', 'gemma-4-cf',
  'sarvam-105b', 'alpie-seed-thinking', 'alpie-core', 'alpie-core-thinking',
];
const LANES = process.env.LANES?.split(',').map((s) => s.trim()).filter(Boolean) ?? PUBLISHED;
const N = Number(process.env.N ?? DEFAULT_STATES);
const OUT = process.env.OUT ?? 'public/model-comparison.json';

async function main() {
  // A local `pnpm dev` is open without one; a deployment refuses the run with a 403 if it is missing.
  const token = process.env.ADMIN_TOKEN;
  const unknown = LANES.filter((k) => !COMPARE_LANE_KEYS.includes(k));
  if (unknown.length) throw new Error(`Unknown lanes: ${unknown.join(', ')}. Known: ${COMPARE_LANE_KEYS.join(', ')}`);

  const rows: CompareRow[] = [];
  let region: string | null = null;
  for (const lane of LANES) {
    const t = Date.now();
    // A thinking lane fits only a few states in one function, so it runs in
    // chunks until it has covered all N, the same states as every other lane.
    const chunks: CompareRow[] = [];
    for (let offset = 0; offset < N; offset += chunks[chunks.length - 1].states) {
      const res = await fetch(`${BASE}/api/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { [ADMIN_TOKEN_HEADER]: token } : {}) },
        body: JSON.stringify({ lane, states: N, offset }),
      });
      if (!res.ok) throw new Error(`${lane}: HTTP ${res.status} ${await res.text()}`);
      const body = (await res.json()) as { row: CompareRow; region: string | null };
      region ??= body.region;
      chunks.push(body.row);
    }
    const r = mergeRows(chunks);
    rows.push(r);
    console.log(
      `${lane.padEnd(16)} answered ${r.answered}/${r.states}  correct ${r.correct}/${r.answered}  p50 ${r.p50Ms} ms  p95 ${r.p95Ms} ms  (${Math.round((Date.now() - t) / 1000)} s)${r.warning ? '  WARN ' + r.warning : ''}${r.error ? '  ERR ' + r.error : ''}`,
    );
  }

  // The baseline (the first lane asked for) first, then fastest to slowest, which is the order the table shows.
  const [baseline, ...rest] = rows;
  rest.sort((a, b) => a.p50Ms - b.p50Ms);
  const ordered = baseline ? [baseline, ...rest] : rows;

  const out = {
    version: 1,
    measuredAt: new Date().toISOString().slice(0, 10),
    states: N,
    floorMs: 0,
    // No region means the route ran off Vercel, and the latencies include this machine's network.
    from: region === null ? `a local machine via ${BASE}, not Vercel` : `a Vercel function in ${region}, each model through its own API`,
    region,
    // Every row says how many states it ran, which is N for all of them.
    rows: ordered.map(({ key, model, provider, setting, states, answered, correct, p50Ms, p95Ms, latenciesMs, warning, error }) => ({
      key, model, provider, setting, states, answered, correct, p50Ms, p95Ms, latenciesMs,
      ...(warning ? { warning } : {}),
      ...(error ? { error } : {}),
    })),
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
