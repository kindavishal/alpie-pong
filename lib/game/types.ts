/**
 * Alpie Pong — shared contract.
 *
 * Every module (engine, decide API, Ably plumbing, UI) builds against this file.
 * Change it only by agreement; everything else may depend on it.
 *
 * Core mechanic ("ball steps per decision"):
 *   Each lane has its own clock. One model decision = one tick. On every tick the
 *   ball advances exactly one SEGMENT along its velocity (bouncing off top/bottom),
 *   and the model's paddle moves by at most MODEL_PADDLE_STEP in the chosen
 *   direction. A slow model therefore means a slow ball. Nothing is skipped.
 *
 * Court: 160 x 100 units. Origin top-left. y grows downward. "up" DEcreases y.
 * The paddles do NOT stand on the court edge: each one is PADDLE_INSET in from
 * it, and the ball turns at that paddle's inner face (LEFT_PLANE / RIGHT_PLANE),
 * which is where the paddle is drawn. Reflecting at the edge instead is what put
 * the ball through the paddle on screen.
 * Left paddle is a scripted, zero-latency perfect returner ("the wall"); in play
 * mode it is the human. Right paddle is the model.
 */

import type { JSONValue } from 'ai';

export const COURT_W = 160;
export const COURT_H = 100;
export const PADDLE_H = 20;
export const BALL_R = 1.5;
/** How far a paddle's inner face stands in from the court edge. */
export const PADDLE_INSET = 4;
/** The x plane the ball turns at on each side: the paddle's inner face. */
export const LEFT_PLANE = PADDLE_INSET;
export const RIGHT_PLANE = COURT_W - PADDLE_INSET;
/** Plane to plane. This — not COURT_W — is what the ball actually crosses. */
export const CROSSING_X = RIGHT_PLANE - LEFT_PLANE;
/** Decisions the ball takes to cross from one paddle to the other. */
export const SEGMENTS_PER_CROSSING = 8;
/** Ball travels this far along x per decision. */
export const SEGMENT_X = CROSSING_X / SEGMENTS_PER_CROSSING;
/**
 * Max model paddle movement per DECISION. 8 decisions per crossing x 12 = 96
 * units of reach against a paddle range of 80, so a model that answers on every
 * tick can always get there (see the reach budget in lib/game/engine.ts).
 */
export const MODEL_PADDLE_STEP = 12;
/**
 * A human paddle moves in COURT UNITS PER SECOND, continuously: the worker
 * integrates the held direction over real elapsed time, on input arrival and on
 * its own paddle tick, so a 300ms press moves the paddle 24 units whether the
 * tick fell in the middle of it or not. 80 units/s covers the whole 80-unit
 * paddle range in one second, while the ball needs at least
 * 8 x PLAY_MIN_STEP_MS = 2.1s to reach them.
 */
export const HUMAN_PADDLE_SPEED = 80;
export const POINTS_TO_WIN = 5;

/* --------------------------------------------------------- live game pacing */
/**
 * These four are the worker's, but they live here because a browser has to know
 * them too: what "get ready" means, and how long silence may last before a lane
 * is stalled rather than still. The worker is the only thing that owns a clock.
 */

/**
 * In a mode a human plays, a ball step never completes faster than this, even
 * when the model answers sooner. A model at ~200ms would otherwise cross the court
 * in 1.6s, which is not a game, it is a reflex test. The published `latencyMs`
 * is still the real model latency — this paces the ball, it does not fake a
 * number. Demo mode is unpaced: there is nobody to be fair to.
 *
 * 260ms: a crossing takes 2.1s, and the human paddle covers the court in 1s.
 * (350 was the first guess; it played slow.)
 */
export const PLAY_MIN_STEP_MS = 260;
/** Wait this long after the players are present before the first serve. */
export const SERVE_DELAY_MS = 2500;
/** And this long after a point before the next serve. */
export const POINT_SERVE_DELAY_MS = 1200;
/** A player's latest input expires this long after it arrived. */
export const INPUT_TTL_MS = 400;
/** A frame goes out at least this often, so silence always means "stalled". */
export const HEARTBEAT_MS = 1000;

export type Move = 'up' | 'down' | 'stay';

export type ModelId =
  | 'alpie'
  | 'sarvam'
  | 'ministral-8b'
  | 'qwen-cf'
  | 'gemma-cf'
  | 'gemini-flash-lite'
  | 'alpie-core'
  | 'jev'
  | 'haiku'
  | 'gpt'
  | 'gemini'
  | 'human'
  | 'wall'
  | 'mock';

export type DecideKind = 'evaluate' | 'structured' | 'local';

/**
 * An OpenAI-style API outside the Gateway, configured from the environment in
 * lib/decide/endpoints.ts. None of them needs a credit card to start, except the
 * Hugging Face router, which bills per call and serves comparison lanes only, and
 * Google's Gemini API, which bills per call for a billed race lane.
 */
export type EndpointKey = 'alpie-seed' | 'alpie-core' | 'mistral' | 'cloudflare' | 'sarvam' | 'gemini' | 'huggingface';

export interface LaneConfig {
  id: ModelId;
  /** Display name, e.g. "Alpie Seed", "Ministral 3 8B". */
  label: string;
  /** Vercel AI Gateway model id, e.g. "typesafe-ai/jev". Null for local deciders and endpoint lanes. */
  gateway: string | null;
  /** How /api/decide talks to it. Jev = evaluate; LLMs = structured output. */
  kind: DecideKind;
  /** Accent colour for the lane (CSS colour). */
  color: string;
  /** For a model outside the Gateway: the API it is served from, and its model id there. */
  endpoint?: EndpointKey;
  modelId?: string;
  /** Who serves it, as the lane's tag shows it. Gateway lanes derive it from `gateway`. */
  provider?: string;
  /** The lowest reasoning setting this model's API accepts, keyed by provider name. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
  /** Room for a model that reasons before it answers even at its lowest setting. */
  maxOutputTokens?: number;
  /** 'text' for an API that ignores the JSON schema and answers in prose (lib/decide/llm.ts). */
  answer?: 'text';
  /** A longer ceiling on one call than the default 20 s, for a model that reasons first. */
  timeoutMs?: number;
}

/** Numbers only, about 125 bytes of JSON. This is exactly what the model sees. */
export interface DecisionState {
  court: { w: number; h: number };
  ball: { x: number; y: number; vx: number; vy: number };
  paddle: { y: number; h: number };
  /**
   * Predicted y (centre) where the ball will cross the paddle's x plane,
   * after wall bounces. Null when the ball is moving away from the paddle.
   */
  interceptY: number | null;
  /** 'toward' when the ball is heading at this paddle. */
  dir: 'toward' | 'away';
}

export type DecideMode = 'demo' | 'play';

export interface DecideRequest {
  model: ModelId;
  state: DecisionState;
  mode: DecideMode;
}

export type DecideErrorCode =
  | 'out_of_credits'
  | 'rate_limited'
  | 'model_error'
  | 'model_not_allowed'
  | 'bad_request';

export type DecideResponse =
  | { ok: true; move: Move; latencyMs: number; model: ModelId }
  | { ok: false; error: DecideErrorCode; message: string };

/** Anything that turns a DecisionState into a Move. Server route, mock, human input. */
export interface Decider {
  decide(state: DecisionState, signal?: AbortSignal): Promise<DecideResponse>;
}

export type LaneStatus =
  | 'idle'
  | 'serving'
  | 'playing'
  | 'point'
  | 'over'
  | 'credits'
  | 'error';

/**
 * Full lane state after a tick. Small enough to publish to Ably at every tick
 * (a fast model ~10/s) and to store thousands of in a replay file.
 */
export interface Snapshot {
  /** ms since the lane started (lane-local clock). */
  t: number;
  /** Decision counter, starts at 0 on serve. */
  tick: number;
  seed: number;
  ball: { x: number; y: number; vx: number; vy: number };
  leftY: number;
  rightY: number;
  /** [left, right] */
  score: [number, number];
  model: ModelId;
  /** Latency of the decision that produced this tick. Null on serve/reset. */
  latencyMs: number | null;
  move: Move | null;
  status: LaneStatus;
  /**
   * Human-readable note. On 'error'/'credits' the failure text; on 'over' the
   * end reason (worker); on a 'playing' tick that a transient failure held,
   * 'held: <error>' (runner). Never contains secrets.
   */
  message?: string;
  /**
   * Per human side, the `seq` of the newest input the worker had applied when
   * this frame was taken. A browser predicts its own paddle and only pulls it
   * back onto the wire once the wire has heard its latest input — before that
   * the wire position is simply older than the player's hand, and reconciling
   * against it drags the paddle backwards (lib/ui/paddle.ts).
   */
  inputSeq?: Partial<Record<'left' | 'right', number>>;
}

/** Pure engine state (no timing). Engine functions are deterministic given seed. */
export interface EngineState {
  seed: number;
  rng: number; // PRNG cursor (mulberry32 state)
  tick: number;
  ball: { x: number; y: number; vx: number; vy: number };
  leftY: number;
  rightY: number;
  score: [number, number];
  status: LaneStatus;
  /** Who is serving next: -1 left, +1 right. */
  serveDir: -1 | 1;
}

export interface LaneRunnerEvents {
  snapshot: (s: Snapshot) => void;
  end: (final: Snapshot) => void;
}

/**
 * Drives one lane: ask the decider, apply the move, advance the ball, emit.
 * Implemented in lib/game/runner.ts (used by the recorder and the replay hero).
 * Live games are driven by lib/worker/game-worker.ts, which uses the engine directly.
 */
export interface LaneRunner {
  readonly model: ModelId;
  start(): void;
  stop(): void;
  /** Left paddle input for play mode; ignored in demo mode. */
  setLeftInput(move: Move): void;
  on<E extends keyof LaneRunnerEvents>(event: E, cb: LaneRunnerEvents[E]): () => void;
  latest(): Snapshot | null;
}

/** Recorded run, replayed on "/" as the hero. Timing is preserved via Snapshot.t. */
export interface Replay {
  version: 1;
  recordedAt: string;
  seed: number;
  lanes: Array<{ model: ModelId; label: string; snapshots: Snapshot[] }>;
}

/** Ably channel names. Keep in one place. */
export const CHANNELS = {
  lobby: 'pong:lobby',
  game: (id: string) => `pong:game:${id}`,
} as const;

/** Presence data on pong:lobby. */
export interface LobbyPresence {
  gameId: string;
  model: ModelId;
  score: [number, number];
  status: LaneStatus;
  startedAt: number;
}

/**
 * The model the site is about: the one you play against, the one lane that carries
 * the accent colour, and the one every headline measures the others against.
 */
export const HERO: ModelId = 'alpie';

/**
 * The race, in display order, never re-sorted live: Alpie Seed first, then
 * rivals of about its size that also answer without thinking first, each from a
 * different lab. The first rivals run on free keys with no credit card; the
 * frontier labs' small models that follow are billed per call, and their lanes
 * say so.
 *
 *   Sarvam 105B      the other Indian model family, a mixture of experts with
 *                    about 10.3B parameters active per answer (Seed is 9B).
 *                    Its API takes the same chat_template_kwargs thinking switch
 *                    as Alpie: with thinking off it answered in about 300 ms with
 *                    7 tokens, 9 of 12 right, when probed on 2026-10-26.
 *   Ministral 3 8B   the Ministral 3 size closest to Seed's 9B; it does not think.
 *   Qwen 3.8 27B     on Cloudflare Workers AI, thinking off: 12 of 12 right at a
 *                    632 ms median when probed on 2026-10-26. Three times Seed's
 *                    size, so a bigger rival rather than a same-size one.
 *                    Cloudflare's other candidates were worse: Llama 3.1 8B cannot
 *                    return a JSON schema and took 3.5 to 4.6 s, Qwen 3 30B-A3B
 *                    returned its answer in the reasoning field and none in the
 *                    reply, and Granite 4.0 Micro got half its moves wrong. That
 *                    reply is now read (replyFromReasoning in lib/decide/endpoints.ts);
 *                    measured again, Qwen 3 30B-A3B got 22 of 30 right at a 435 ms
 *                    median (2026-10-26, from a laptop). It is in the comparison,
 *                    not the race, which nobody has re-decided since.
 *   Gemini 3.5 Flash-Lite  Google's newest small Gemini (2026-07-21) on Google's own
 *                    Gemini API, billed per call. It rejects every way of turning
 *                    thinking off, so it runs at reasoning effort "minimal", its
 *                    lowest, at which Google reported no thinking tokens; 30 of 30
 *                    right at a 1,071 ms median in the published comparison
 *                    (public/model-comparison.json, 2026-10-26).
 *
 * Google's free tier was tried and dropped: it allows Gemini 3.5 Flash-Lite 15
 * requests a minute and a lane makes about 60, which billing lifts. gpt-oss cannot
 * switch reasoning off. Those stay in the comparison table (lib/compare), where
 * that is said.
 * Only the hero carries an accent; the others use the neutral ball colour (design tokens --ball).
 */
export const LANES: LaneConfig[] = [
  {
    id: 'alpie', label: 'Alpie Seed 9B', gateway: null, endpoint: 'alpie-seed', modelId: 'alpie_9b', provider: '169Pi',
    kind: 'structured', color: '#1F72D8', providerOptions: { alpie: { chat_template_kwargs: { enable_thinking: false } } },
  },
  {
    id: 'sarvam', label: 'Sarvam 105B', gateway: null, endpoint: 'sarvam', modelId: 'sarvam-105b', provider: 'Sarvam',
    kind: 'structured', color: '#A1A1A6', providerOptions: { sarvam: { chat_template_kwargs: { enable_thinking: false } } },
  },
  // Ministral 3 does not think, so there is nothing to switch off.
  { id: 'ministral-8b', label: 'Ministral 3 8B', gateway: null, endpoint: 'mistral', modelId: 'ministral-8b-2512', provider: 'Mistral', kind: 'structured', color: '#A1A1A6' },
  {
    id: 'qwen-cf', label: 'Qwen 3.8 27B', gateway: null, endpoint: 'cloudflare', modelId: '@cf/qwen/qwen3.8-27b', provider: 'Cloudflare',
    kind: 'structured', color: '#A1A1A6', providerOptions: { cloudflare: { chat_template_kwargs: { enable_thinking: false } } },
  },
  {
    id: 'gemini-flash-lite', label: 'Gemini 3.5 Flash-Lite', gateway: null, endpoint: 'gemini', modelId: 'gemini-3.5-flash-lite', provider: 'Google',
    kind: 'structured', color: '#A1A1A6', providerOptions: { gemini: { reasoningEffort: 'minimal' } },
  },
];

/**
 * Lanes that raced until 2026-10-26 and were taken out, kept so the recordings
 * and watch links that name them still resolve. Both are still measured in the
 * comparison table (lib/compare).
 *
 *   Gemma 4 26B-A4B  on Cloudflare Workers AI, thinking off. Taken out once Gemini
 *                    gave Google a lane on its own API: it made Google the one lab
 *                    with two lanes, and it was the least steady (989 ms in the
 *                    25 October recording, 1.6 s and 3 s on 26 October).
 *   Alpie Core       169Pi's 32B reasoning model. Its API ignores the JSON
 *                    schema and the thinking switch and writes about 400 tokens
 *                    before answering (~12 s), so it reads the move from its
 *                    final answer. It raced watch-only to show what thinking
 *                    costs; the comparison table shows that with numbers.
 */
export const FORMER_LANES: LaneConfig[] = [
  {
    id: 'gemma-cf', label: 'Gemma 4 26B-A4B', gateway: null, endpoint: 'cloudflare', modelId: '@cf/google/gemma-4-26b-a4b-it', provider: 'Cloudflare',
    kind: 'structured', color: '#A1A1A6', providerOptions: { cloudflare: { chat_template_kwargs: { enable_thinking: false } } },
  },
  {
    id: 'alpie-core', label: 'Alpie Core 32B', gateway: null, endpoint: 'alpie-core', modelId: 'alpie-32b', provider: '169Pi',
    // Probed at 13.7 to 18.9 s a decision, close to the default 20 s ceiling.
    kind: 'structured', color: '#A1A1A6', answer: 'text', maxOutputTokens: 8192, timeoutMs: 45_000,
    providerOptions: { alpie: { chat_template_kwargs: { enable_thinking: false } } },
  },
];

/**
 * The original Jev Pong lanes, all on the Vercel AI Gateway, which needs a card on
 * file. They are not in the race, but they can still be decided and recorded by id
 * once the Gateway is paid for (recorded on Vercel iad1, 2026-09-17: Jev ~230ms,
 * Gemini ~2.1s, Haiku ~2.0s, GPT ~4.1s).
 */
export const GATEWAY_LANES: LaneConfig[] = [
  { id: 'jev', label: 'Jev', gateway: 'typesafe-ai/jev', kind: 'evaluate', color: '#A1A1A6' },
  { id: 'gemini', label: 'Gemini 3.8 Flash', gateway: 'google/gemini-3.8-flash', kind: 'structured', color: '#A1A1A6' },
  { id: 'haiku', label: 'Claude Haiku 4.5', gateway: 'anthropic/claude-haiku-4.5', kind: 'structured', color: '#A1A1A6' },
  { id: 'gpt', label: 'GPT-5.6 Sol', gateway: 'openai/gpt-5.6-sol', kind: 'structured', color: '#A1A1A6' },
];

/** Every lane that has a model behind it, race first. */
export const ALL_LANES: LaneConfig[] = [...LANES, ...FORMER_LANES, ...GATEWAY_LANES];

export const PLAYABLE: ModelId[] = [HERO];

/** The hero's lane config. */
export function heroLane(): LaneConfig {
  return ALL_LANES.find((lane) => lane.id === HERO) ?? LANES[0];
}

/** What a lane's tag says served it: the endpoint's provider, or the Gateway route. */
export function laneSource(lane: LaneConfig): string | null {
  return lane.provider ?? lane.gateway;
}
