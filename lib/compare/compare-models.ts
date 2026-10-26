/**
 * lib/compare/compare-models.ts — the same question, put to other models.
 *
 * The four lanes on the home page are a recording. This is the other half of
 * the evidence: one model at a time is given the same real game states, the
 * same instruction and the same three answers, one call per state, sequential,
 * with reasoning switched to the lowest setting the provider accepts. What
 * comes back is the row for one model: how many it answered, how many it got
 * right, and the median and p95 of the clock run around the model call.
 *
 * No CLI and no filesystem here, so it can run in two places identically:
 *   - `POST /api/compare`, from a Vercel function — the one that matters,
 *     because the latency is then function-to-Gateway rather than somebody's
 *     broadband;
 *   - `scripts/compare-models.ts`, which drives that route lane by lane from a
 *     laptop and writes `public/model-comparison.json`.
 *
 * Jev is measured the way the game measures it (`decideWithJev`). A chat model
 * is asked for structured output exactly as the chat lanes are (`decideWithLlm`
 * in ../decide/llm.ts), except that a lane here may carry its own provider
 * options, because the newest reasoning models refuse the generic "off" switch
 * and each takes a different lowest setting.
 *
 * Alpie, Sarvam and the models on the Hugging Face router are not on the Gateway. Their lanes name an `endpoint`
 * (./endpoints.ts) and are asked the same way through their own APIs.
 */

import { generateObject, generateText, type JSONValue } from 'ai';
import { decideWithJev } from '../decide/jev';
import { MAX_OUTPUT_TOKENS, moveFromText, moveSchema, parseMove, reasoningOff } from '../decide/llm';

export { moveFromText };
import { LLM_SYSTEM_PROMPT, expectedMove, stateForModel } from '../decide/prompt';
import { applyTick, createEngine, serve, toDecisionState } from '../game/engine';
import type { DecisionState, Move } from '../game/types';
import { endpointModel, type EndpointKey } from '../decide/endpoints';

export interface CompareLane {
  /** Short stable key, the thing the route and the script pass around. */
  key: string;
  /** Gateway model id, or the model id on `endpoint` when there is one. */
  id: string;
  /** Present for a model served outside the Gateway. */
  endpoint?: EndpointKey;
  /** How the table names it. */
  model: string;
  provider: string;
  /** The reasoning setting, in words the table can show. */
  setting: string;
  /** Present only when the generic `reasoningOff` switch is not what this model takes. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
  /**
   * Room for a lane that thinks before it answers. The thinking counts toward
   * the limit, and a cut-off answer would be scored as no answer at all.
   */
  maxOutputTokens?: number;
  /**
   * A cap on the states this lane runs in one request. Thinking lanes take
   * about 15 s a call, so one function can only fit a few; the script runs
   * them in chunks (`offset` on /api/compare) and merges the chunks with
   * `mergeRows`, so every row in the table covers the same states.
   */
  maxStates?: number;
  /**
   * 'text' for an API that ignores the JSON schema and answers in prose: the
   * lane asks for plain text and reads the move from its final answer
   * (`moveFromText`). Same prompt, same clock; only the parsing differs, and
   * the lane's `setting` says so.
   */
  answer?: 'text';
}

/** Alpie Seed wrote about 1,800 tokens of thinking for one move (2026-10-25). */
const THINKING_OUTPUT_TOKENS = 8192;
const THINKING_STATES = 10;

const ALPIE_THINKING_OFF = { alpie: { chat_template_kwargs: { enable_thinking: false } } };
const ALPIE_THINKING_ON = { alpie: { chat_template_kwargs: { enable_thinking: true } } };

/**
 * Every model the comparison can run. The published subset is whatever the
 * script is asked for; the extra Astra and Fable settings exist so the claim
 * "the setting made no difference" is measured rather than assumed.
 */
export const COMPARE_LANES: readonly CompareLane[] = [
  { key: 'jev', id: 'typesafe-ai/jev', model: 'Jev', provider: 'TypeSafe AI', setting: 'evaluate' },
  { key: 'haiku', id: 'anthropic/claude-haiku-4.5', model: 'Claude Haiku 4.5', provider: 'Anthropic', setting: 'thinking off' },
  { key: 'sol', id: 'openai/gpt-5.6-sol', model: 'GPT-5.6 Sol', provider: 'OpenAI', setting: 'default' },
  // Astra takes low, medium, high, xhigh or max; the Gateway refuses "minimal".
  { key: 'astra-fast-low', id: 'openai/gpt-6-astra-fast', model: 'GPT-6 Astra-fast', provider: 'OpenAI', setting: 'reasoning effort low', providerOptions: { openai: { reasoningEffort: 'low' } } },
  { key: 'astra-low', id: 'openai/gpt-6-astra', model: 'GPT-6 Astra', provider: 'OpenAI', setting: 'reasoning effort low', providerOptions: { openai: { reasoningEffort: 'low' } } },
  { key: 'astra-medium', id: 'openai/gpt-6-astra', model: 'GPT-6 Astra', provider: 'OpenAI', setting: 'reasoning effort medium', providerOptions: { openai: { reasoningEffort: 'medium' } } },
  { key: 'astra-high', id: 'openai/gpt-6-astra', model: 'GPT-6 Astra', provider: 'OpenAI', setting: 'reasoning effort high', providerOptions: { openai: { reasoningEffort: 'high' } } },
  // Fable 5.1 refuses thinking "disabled"; it wants "adaptive" plus an effort.
  { key: 'fable-low', id: 'anthropic/claude-fable-5.1', model: 'Claude Fable 5.1', provider: 'Anthropic', setting: 'adaptive thinking, effort low', providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'low' } } },
  // Qwen, the largest open model family on the Gateway.
  // Qwen 3.8 thinks by default (85 output tokens for a one-word answer, 3 to 11 s a call);
  // `enableThinking: false` is the switch the Gateway honours, verified 2026-09-19.
  { key: 'qwen-flash', id: 'alibaba/qwen3.8-flash', model: 'Qwen 3.8 Flash', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'qwen-27b', id: 'alibaba/qwen3.8-27b', model: 'Qwen 3.8 27B', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'qwen-max', id: 'alibaba/qwen3.8-max', model: 'Qwen 3.8 Max', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'qwen-235b', id: 'alibaba/qwen-3-235b', model: 'Qwen 3 235B', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  // The smallest, cheapest chat models on the Gateway: the fair "fastest chat model" candidates.
  { key: 'gemini-flash-lite', id: 'google/gemini-3.5-flash-lite', model: 'Gemini 3.5 Flash-Lite', provider: 'Google', setting: 'thinking off' },
  { key: 'gpt-nano', id: 'openai/gpt-5.4-nano', model: 'GPT-5.4 Nano', provider: 'OpenAI', setting: 'default' },
  { key: 'ministral-3b', id: 'mistral/ministral-3b', model: 'Ministral 3B', provider: 'Mistral', setting: 'default' },
  { key: 'nemotron-nano', id: 'nvidia/nemotron-nano-9b-v2', model: 'Nemotron Nano 9B', provider: 'NVIDIA', setting: 'default' },
  { key: 'fable-high', id: 'anthropic/claude-fable-5.1', model: 'Claude Fable 5.1', provider: 'Anthropic', setting: 'adaptive thinking, effort high', providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } } },

  // Alpie, by 169Pi, on its own API. Seed is the 9B model (alpie_9b); Core is the
  // 32B reasoning model (alpie-32b on api.169pi.com, verified 2026-10-25). Both are
  // run with thinking off and on, because the switch is what decides whether a model
  // belongs in a game at all.
  { key: 'alpie-seed', id: 'alpie_9b', endpoint: 'alpie-seed', model: 'Alpie Seed', provider: '169Pi', setting: 'thinking off', providerOptions: ALPIE_THINKING_OFF },
  { key: 'alpie-seed-thinking', id: 'alpie_9b', endpoint: 'alpie-seed', model: 'Alpie Seed', provider: '169Pi', setting: 'thinking on', providerOptions: ALPIE_THINKING_ON, maxOutputTokens: THINKING_OUTPUT_TOKENS, maxStates: THINKING_STATES },
  // Core's API ignores both the JSON schema and the thinking switch (2026-10-25): it
  // reasons for about 400 tokens and ends "**Final Answer**: down", whichever is asked.
  // So both lanes read the move from that answer and get the thinking budget; the
  // switch is still sent, so the rows show whether it ever starts to matter.
  { key: 'alpie-core', id: 'alpie-32b', endpoint: 'alpie-core', model: 'Alpie Core', provider: '169Pi', setting: 'thinking off (ignored), move read from text', providerOptions: ALPIE_THINKING_OFF, answer: 'text', maxOutputTokens: THINKING_OUTPUT_TOKENS, maxStates: THINKING_STATES },
  { key: 'alpie-core-thinking', id: 'alpie-32b', endpoint: 'alpie-core', model: 'Alpie Core', provider: '169Pi', setting: 'thinking on, move read from text', providerOptions: ALPIE_THINKING_ON, answer: 'text', maxOutputTokens: THINKING_OUTPUT_TOKENS, maxStates: THINKING_STATES },

  // Alpie Seed's weight class, 8 to 14B. Qwen 3 takes the same thinking switch Seed does.
  { key: 'qwen-14b', id: 'alibaba/qwen-3-14b', model: 'Qwen 3 14B', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'ministral-8b', id: 'mistral/ministral-8b', model: 'Ministral 8B', provider: 'Mistral', setting: 'default' },
  { key: 'llama-8b', id: 'meta/llama-3.1-8b', model: 'Llama 3.1 8B', provider: 'Meta', setting: 'default' },
  // Alpie Core's weight class, about 30B.
  { key: 'qwen-32b', id: 'alibaba/qwen-3-32b', model: 'Qwen 3 32B', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'gemma-31b', id: 'google/gemma-4-31b-it', model: 'Gemma 4 31B', provider: 'Google', setting: 'default' },
  // Built for speed: a diffusion model, and mixtures with 2 to 3B parameters active per token.
  { key: 'mercury-2.5', id: 'inception/mercury-2.5', model: 'Mercury 2.5', provider: 'Inception', setting: 'default' },
  { key: 'mercury-3', id: 'inception/mercury-3', model: 'Mercury 3', provider: 'Inception', setting: 'default' },
  { key: 'lfm-24b', id: 'liquid/lfm2.5-24b-a2b', model: 'LFM2.5 24B-A2B', provider: 'Liquid AI', setting: 'default' },
  { key: 'qwen-30b-a3b', id: 'alibaba/qwen-3-30b', model: 'Qwen 3 30B-A3B', provider: 'Alibaba', setting: 'thinking off', providerOptions: { alibaba: { enableThinking: false } } },
  { key: 'nemotron-3-nano', id: 'nvidia/nemotron-3-nano-30b-a3b', model: 'Nemotron 3 Nano 30B-A3B', provider: 'NVIDIA', setting: 'default' },
  // The other Indian open model, on Sarvam's own API, both ways. Its documented
  // switch is reasoning_effort, and "low" is the lowest it accepts (leaving it
  // out means "max"; "low" still reasons for about 230 tokens). The chat
  // template's enable_thinking switch, which the API also accepts, turns thinking
  // off: about 300 ms and 7 tokens (2026-10-26). The race uses that switch, as it
  // does for Alpie, Qwen and Gemma; the "low" lane is Sarvam's thinking-on row.
  // sarvam-30b is retired from the API (deprecated on v1, not found on v2, 2026-10-25).
  { key: 'sarvam-105b-free', id: 'sarvam-105b', endpoint: 'sarvam', model: 'Sarvam 105B', provider: 'Sarvam', setting: 'thinking off', providerOptions: { sarvam: { chat_template_kwargs: { enable_thinking: false } } } },
  { key: 'sarvam-105b', id: 'sarvam-105b', endpoint: 'sarvam', model: 'Sarvam 105B', provider: 'Sarvam', setting: 'thinking on, reasoning effort low (its lowest)', providerOptions: { sarvam: { reasoningEffort: 'low' } }, maxOutputTokens: THINKING_OUTPUT_TOKENS, maxStates: THINKING_STATES },
  // The race rivals on their own free APIs, as the race asks them (lib/game/types.ts).
  // Ministral 3 does not think, so it has no switch to send.
  { key: 'ministral-3b-free', id: 'ministral-3b-2512', endpoint: 'mistral', model: 'Ministral 3 3B', provider: 'Mistral', setting: 'does not think' },
  { key: 'ministral-8b-free', id: 'ministral-8b-2512', endpoint: 'mistral', model: 'Ministral 3 8B', provider: 'Mistral', setting: 'does not think' },
  { key: 'ministral-14b-free', id: 'ministral-14b-2512', endpoint: 'mistral', model: 'Ministral 3 14B', provider: 'Mistral', setting: 'does not think' },
  { key: 'qwen-3.8-cf', id: '@cf/qwen/qwen3.8-27b', endpoint: 'cloudflare', model: 'Qwen 3.8 27B', provider: 'Cloudflare', setting: 'thinking off', providerOptions: { cloudflare: { chat_template_kwargs: { enable_thinking: false } } } },
  { key: 'gemma-4-cf', id: '@cf/google/gemma-4-26b-a4b-it', endpoint: 'cloudflare', model: 'Gemma 4 26B-A4B', provider: 'Cloudflare', setting: 'thinking off', providerOptions: { cloudflare: { chat_template_kwargs: { enable_thinking: false } } } },
  // Dropped from the race for filing its reply under `reasoning` with none in `content`.
  // That reply is now read (replyFromReasoning in ../decide/endpoints.ts), so it is
  // measured again on the same terms as the Hugging Face lanes below.
  { key: 'qwen-30b-a3b-cf', id: '@cf/qwen/qwen3-30b-a3b-fp8', endpoint: 'cloudflare', model: 'Qwen 3 30B-A3B', provider: 'Cloudflare', setting: 'thinking off', providerOptions: { cloudflare: { chat_template_kwargs: { enable_thinking: false } } } },

  // Google's newest small Gemini (released 2026-07-21) on Google's own Gemini API, billed
  // per call. It rejects reasoning_effort "none" and a zero thinking budget (HTTP 400), so
  // it gets "minimal", the lowest level the API accepts; at that level Google's native API
  // reported no thinking tokens (2026-10-26). The Gateway lane above sends a zero budget.
  { key: 'gemini-3.5-flash-lite-google', id: 'gemini-3.5-flash-lite', endpoint: 'gemini', model: 'Gemini 3.5 Flash-Lite', provider: 'Google', setting: 'reasoning effort minimal (its lowest)', providerOptions: { gemini: { reasoningEffort: 'minimal' } } },

  // The other Indian models still served anywhere (2026-10-26), both on Featherless
  // through the Hugging Face router, which bills per call: comparison only, not the race.
  // Sarvam-M is Sarvam's 24B post-training of Mistral Small. Featherless rejects the
  // chat_template_kwargs thinking switch (HTTP 400), so none is sent; with the schema it
  // answered in 5 or 6 tokens, so it did not think first.
  { key: 'sarvam-m-hf', id: 'sarvamai/sarvam-m:featherless-ai', endpoint: 'huggingface', model: 'Sarvam-M 24B', provider: 'Featherless', setting: 'default, no thinking switch accepted' },
  // Fathom-R1-14B is Fractal's 14B reasoning model, which always thinks. With the schema
  // enforced it cannot, and answered in 8 or 9 tokens. Allowed to think, it ran to the
  // 8,192-token limit without an answer on both states tried (about 81 s each,
  // 2026-10-26), so it has no thinking lane: 30 states would be 40 minutes of no answers.
  { key: 'fathom-r1-14b-hf', id: 'FractalAIResearch/Fathom-R1-14B:featherless-ai', endpoint: 'huggingface', model: 'Fathom-R1-14B', provider: 'Featherless', setting: 'schema enforced, so no room to think' },
];

export const COMPARE_LANE_KEYS = COMPARE_LANES.map((l) => l.key);

export function compareLane(key: string): CompareLane | undefined {
  return COMPARE_LANES.find((l) => l.key === key);
}

/** Calls the model does not count toward the row; they warm the connection. */
export const WARMUP_CALLS = 2;
export const DEFAULT_STATES = 30;
export const MAX_STATES = 60;

/**
 * A spread of real game states from the engine: three seeds, a rally each,
 * interleaved so the ball is coming toward the paddle in half of them and
 * moving away in the other half. Deterministic, so every lane sees the same
 * states in the same order.
 */
export function compareStates(n: number = DEFAULT_STATES): DecisionState[] {
  const all: DecisionState[] = [];
  for (const seed of [11, 23, 37]) {
    let s = serve(createEngine(seed, 1));
    for (let i = 0; i < 40 && all.length < n * 2; i += 1) {
      const d = toDecisionState(s, 'right');
      all.push(d);
      s = applyTick(s, expectedMove(d), 'auto');
      if (s.status === 'point') s = serve(s);
    }
  }
  const toward = all.filter((d) => d.dir === 'toward');
  const away = all.filter((d) => d.dir === 'away');
  const mixed: DecisionState[] = [];
  for (let i = 0; mixed.length < n && (toward[i] || away[i]); i += 1) {
    if (toward[i]) mixed.push(toward[i]);
    if (away[i] && mixed.length < n) mixed.push(away[i]);
  }
  return mixed;
}

export interface CompareCall {
  move: Move | null;
  ms: number;
  /** First Gateway warning, if any; says whether the reasoning switch was honoured. */
  warning?: string;
  error?: string;
}

/** One decision from one lane, timed around the model call. */
export async function callLane(lane: CompareLane, state: DecisionState): Promise<CompareCall> {
  const startedAt = performance.now();
  try {
    if (lane.key === 'jev') {
      const r = await decideWithJev(state);
      return { move: r.move, ms: r.latencyMs };
    }
    const model = lane.endpoint === undefined ? lane.id : endpointModel(lane.endpoint, lane.id);
    if (lane.answer === 'text') {
      const r = await generateText({
        model,
        system: LLM_SYSTEM_PROMPT,
        prompt: JSON.stringify(stateForModel(state)),
        temperature: 0,
        maxOutputTokens: lane.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        providerOptions: lane.providerOptions ?? reasoningOff(lane.id),
      });
      const ms = performance.now() - startedAt;
      return { move: moveFromText(r.text), ms };
    }
    const r = await generateObject({
      model,
      schema: moveSchema,
      schemaName: 'PaddleMove',
      schemaDescription: 'The move for the right paddle on this tick.',
      system: LLM_SYSTEM_PROMPT,
      prompt: JSON.stringify(stateForModel(state)),
      temperature: 0,
      maxOutputTokens: lane.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      providerOptions: lane.providerOptions ?? reasoningOff(lane.id),
    });
    const ms = performance.now() - startedAt;
    const warning = r.warnings?.[0] ? short(JSON.stringify(r.warnings[0])) : undefined;
    return { move: parseMove(r.object), ms, warning };
  } catch (e) {
    return { move: null, ms: performance.now() - startedAt, error: short(e instanceof Error ? e.message : String(e)) };
  }
}

function short(text: string): string {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export interface CompareRow {
  key: string;
  model: string;
  provider: string;
  setting: string;
  states: number;
  answered: number;
  correct: number;
  p50Ms: number;
  p95Ms: number;
  /** Every counted latency, rounded, so a reader can recompute the percentiles. */
  latenciesMs: number[];
  warning?: string;
  error?: string;
}

/** Nearest-rank percentile on a copy; NaN for an empty list. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/**
 * One row from the chunks of a lane run in several requests (see `maxStates`):
 * counts add up and the percentiles are taken again over every counted latency.
 */
export function mergeRows(chunks: readonly CompareRow[]): CompareRow {
  const [first] = chunks;
  if (first === undefined) throw new Error('mergeRows needs at least one chunk');
  const latencies = chunks.flatMap((c) => c.latenciesMs);
  const warning = chunks.find((c) => c.warning !== undefined)?.warning;
  const error = chunks.find((c) => c.error !== undefined)?.error;
  return {
    key: first.key,
    model: first.model,
    provider: first.provider,
    setting: first.setting,
    states: chunks.reduce((n, c) => n + c.states, 0),
    answered: chunks.reduce((n, c) => n + c.answered, 0),
    correct: chunks.reduce((n, c) => n + c.correct, 0),
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(percentile(latencies, 0.95)),
    latenciesMs: latencies,
    ...(warning !== undefined ? { warning } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

export interface RunLaneOptions {
  states?: DecisionState[];
  /** Test seam: replaces the model call. */
  call?: (lane: CompareLane, state: DecisionState) => Promise<CompareCall>;
  onProgress?: (done: number, total: number, last: CompareCall) => void;
}

/** Runs one lane over the states, sequentially, and summarises it. */
export async function runLane(lane: CompareLane, opts: RunLaneOptions = {}): Promise<CompareRow> {
  const states = opts.states ?? compareStates();
  const call = opts.call ?? callLane;
  for (let i = 0; i < Math.min(WARMUP_CALLS, states.length); i += 1) await call(lane, states[i]);

  const latencies: number[] = [];
  let answered = 0;
  let correct = 0;
  let warning: string | undefined;
  let error: string | undefined;
  for (const [i, state] of states.entries()) {
    const r = await call(lane, state);
    warning ??= r.warning;
    error ??= r.error;
    if (r.move !== null) {
      answered += 1;
      latencies.push(r.ms);
      if (r.move === expectedMove(state)) correct += 1;
    }
    opts.onProgress?.(i + 1, states.length, r);
  }
  return {
    key: lane.key,
    model: lane.model,
    provider: lane.provider,
    setting: lane.setting,
    states: states.length,
    answered,
    correct,
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(percentile(latencies, 0.95)),
    latenciesMs: latencies.map(Math.round),
    ...(warning !== undefined ? { warning } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}
