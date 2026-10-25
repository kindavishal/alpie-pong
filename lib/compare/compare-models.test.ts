import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecisionState } from '../game/types';
import { expectedMove } from '../decide/prompt';
import {
  COMPARE_LANES,
  DEFAULT_STATES,
  WARMUP_CALLS,
  callLane,
  compareLane,
  compareStates,
  moveFromText,
  percentile,
  runLane,
} from './compare-models';

describe('compareStates', () => {
  it('is deterministic and half toward, half away', () => {
    const a = compareStates(30);
    const b = compareStates(30);
    expect(a).toEqual(b);
    expect(a).toHaveLength(30);
    expect(a.filter((s) => s.dir === 'toward')).toHaveLength(15);
    expect(a.filter((s) => s.dir === 'away')).toHaveLength(15);
  });
});

describe('percentile', () => {
  it('uses nearest rank and copes with an empty list', () => {
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe('runLane', () => {
  const lane = compareLane('jev')!;
  const states = compareStates(4);

  it('summarises the counted calls and skips the warm-ups', async () => {
    const seen: DecisionState[] = [];
    const row = await runLane(lane, {
      states,
      call: async (_lane, state) => {
        seen.push(state);
        const n = seen.length;
        // Warm-ups are the first WARMUP_CALLS calls; make the last counted call wrong and one fail.
        if (n === WARMUP_CALLS + states.length) return { move: null, ms: 999, error: 'boom' };
        const right = expectedMove(state);
        const move = n === WARMUP_CALLS + states.length - 1 ? (right === 'up' ? 'down' : 'up') : right;
        return { move, ms: 100 * (n - WARMUP_CALLS) };
      },
    });
    expect(seen).toHaveLength(WARMUP_CALLS + states.length);
    expect(row.states).toBe(4);
    expect(row.answered).toBe(3);
    expect(row.correct).toBe(2);
    expect(row.latenciesMs).toEqual([100, 200, 300]);
    expect(row.p50Ms).toBe(200);
    expect(row.p95Ms).toBe(300);
    expect(row.error).toBe('boom');
    expect(row.warning).toBeUndefined();
  });

  it('every lane has a distinct key and a Gateway id or an endpoint', () => {
    const keys = COMPARE_LANES.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of COMPARE_LANES) {
      if (l.endpoint === undefined) expect(l.id).toMatch(/^[a-z-]+\/[a-z0-9.-]+$/);
      else expect(l.id).toMatch(/^@?[a-z0-9._/-]+$/);
    }
  });

  it('keys an endpoint lane’s options by its provider name, so they reach the request body', () => {
    const names: Record<string, string> = { 'alpie-seed': 'alpie', 'alpie-core': 'alpie', sarvam: 'sarvam', mistral: 'mistral', cloudflare: 'cloudflare' };
    // A lane with nothing to switch (Ministral does not think) sends no options at all.
    for (const l of COMPARE_LANES.filter((x) => x.endpoint !== undefined && x.providerOptions !== undefined)) {
      expect(Object.keys(l.providerOptions!)).toEqual([names[l.endpoint!]]);
    }
  });

  it('runs every Alpie model with thinking off and on, and gives the thinking lanes room', () => {
    for (const model of ['Alpie Seed', 'Alpie Core']) {
      const lanes = COMPARE_LANES.filter((l) => l.model === model);
      const switches = lanes.map((l) => (l.providerOptions?.alpie as { chat_template_kwargs: { enable_thinking: boolean } }).chat_template_kwargs.enable_thinking);
      expect(switches.sort()).toEqual([false, true]);
      const thinking = lanes.find((l) => l.setting.startsWith('thinking on'))!;
      expect(thinking.maxOutputTokens).toBeGreaterThanOrEqual(4096);
      expect(thinking.maxStates).toBeLessThan(DEFAULT_STATES);
    }
  });
});

describe('moveFromText', () => {
  it('takes the final answer, not the moves the model weighed on the way', () => {
    const core =
      'If interceptY were above I would move up, or stay if close. The difference is 17.4, so down.\n\n**Final Answer**: ⬛ down';
    expect(moveFromText(core)).toBe('down');
    expect(moveFromText('Moving down would be wrong. FINAL ANSWER: Stay.')).toBe('stay');
  });

  it('falls back to the last move anywhere, and refuses an answer with none', () => {
    expect(moveFromText('down? no. up')).toBe('up');
    expect(() => moveFromText('I am not sure.')).toThrow(/No move/);
  });
});

describe('callLane on an endpoint lane', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it('records a missing endpoint as an error on the call, not a crash', async () => {
    delete process.env.ALPIE_BASE_URL;
    delete process.env.ALPIE_SEED_BASE_URL;
    const r = await callLane(compareLane('alpie-seed')!, compareStates(1)[0]);
    expect(r.move).toBeNull();
    expect(r.error).toMatch(/ALPIE_SEED_BASE_URL/);
  });

  it('refuses a Sarvam lane without a key', async () => {
    delete process.env.SARVAM_API_KEY;
    const r = await callLane(compareLane('sarvam-105b')!, compareStates(1)[0]);
    expect(r.error).toMatch(/SARVAM_API_KEY/);
  });

  it('posts the thinking switch, the schema and the model id to the configured endpoint', async () => {
    process.env.ALPIE_BASE_URL = 'https://alpie.example/v1';
    process.env.ALPIE_API_KEY = 'test-key';
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({
        id: 'x',
        created: 0,
        model: 'alpie_9b',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"move":"down"}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = compareStates(1)[0];
    const r = await callLane(compareLane('alpie-seed')!, state);
    expect(r.error).toBeUndefined();
    expect(r.move).toBe('down');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://alpie.example/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('alpie_9b');
    expect(body.temperature).toBe(0);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages.at(-1).content).toBe(JSON.stringify(state));
  });
});
