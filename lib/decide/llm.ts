/**
 * The chat-LLM lanes: the same decision, put to a language model.
 *
 * A lane here gets the identical DecisionState and the identical instruction
 * text as every other lane (./prompt.ts). What differs is how the
 * answer comes back: a language model cannot answer a typed question, so it
 * returns structured output — a one-field object checked against `moveSchema`.
 *
 * The call is kept as small as the comparison allows: one tiny object,
 * temperature 0, few output tokens, and reasoning switched off wherever the
 * provider has a switch for it (see `reasoningOff`). A model that stops to think
 * before it answers is latency the demo would be measuring by accident. As in
 * ./jev.ts, the clock runs around the model call alone and `maxRetries: 0` keeps
 * a hidden retry out of the number.
 */
import { generateObject, generateText, type JSONValue, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { DecisionState, Move } from '../game/types';
import { LLM_SYSTEM_PROMPT, MOVES, stateForModel } from './prompt';
import type { ModelDecision } from './types';

/** Enough for the object plus the small amount of slack providers need. */
export const MAX_OUTPUT_TOKENS = 256;

export const moveSchema = z.object({ move: z.enum(MOVES) });

export interface LlmOptions {
  signal?: AbortSignal;
  /** Test seam: a language model instance instead of the Gateway string id. */
  modelOverride?: LanguageModel;
  /** A model outside the Gateway (lib/decide/endpoints.ts), in place of the string id. */
  model?: LanguageModel;
  /** This lane's own reasoning switch, when the generic `reasoningOff` is not what it takes. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
  /** Room for a model that reasons even at its lowest setting. */
  maxOutputTokens?: number;
  /**
   * 'text' for an API that ignores the JSON schema and answers in prose (Alpie
   * Core): ask for plain text and read the move from its final answer. Same
   * prompt, same clock; only the parsing differs.
   */
  answer?: 'text';
}

/** Validates whatever came back and returns the move, or throws a short reason. */
/**
 * The move in a prose answer: the last up, down or stay after "final answer"
 * when the model writes one, otherwise the last one anywhere. A model that
 * reasons aloud mentions all three on the way, so the last word is the answer.
 */
export function moveFromText(text: string): Move {
  const marker = text.search(/final answer/i);
  const tail = marker === -1 ? text : text.slice(marker);
  const found = [...tail.matchAll(/\b(up|down|stay)\b/gi)].at(-1);
  if (found === undefined) throw new Error(`No move in the answer: ${describe(text.slice(-80))}`);
  return found[1].toLowerCase() as Move;
}

export function parseMove(value: unknown): Move {
  const parsed = moveSchema.safeParse(value);
  if (parsed.success) return parsed.data.move;
  throw new Error(`Model returned an unusable decision: ${describe(value)}`);
}

function describe(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/**
 * Provider-specific switches that stop a model thinking before it answers.
 * Unknown providers get nothing, which is the safe default.
 *
 * There is no openai entry on purpose: verified live on 2026-09-17, the Gateway
 * answers reasoningEffort for openai/gpt-5.6-sol with an "unsupported feature"
 * warning and drops it. (It warns about temperature on the same model too, from
 * the opposite direction — the two warnings contradict each other, so the lane
 * keeps temperature 0 for parity with the others and lets the Gateway drop what
 * it will not take.) Add an entry here if a reasoning model becomes a lane.
 */
export function reasoningOff(gatewayModelId: string): Record<string, Record<string, JSONValue>> | undefined {
  switch (gatewayModelId.split('/')[0]) {
    case 'anthropic':
      return { anthropic: { thinking: { type: 'disabled' } } };
    case 'google':
      return { google: { thinkingConfig: { thinkingBudget: 0 } } };
    default:
      return undefined;
  }
}

export async function decideWithLlm(
  gatewayModelId: string,
  state: DecisionState,
  opts: LlmOptions = {},
): Promise<ModelDecision> {
  const model: LanguageModel = opts.modelOverride ?? opts.model ?? gatewayModelId;

  if (opts.answer === 'text') {
    const startedAt = performance.now();
    const result = await generateText({
      model,
      system: LLM_SYSTEM_PROMPT,
      prompt: JSON.stringify(stateForModel(state)),
      temperature: 0,
      maxOutputTokens: opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal: opts.signal,
      providerOptions: opts.providerOptions ?? reasoningOff(gatewayModelId),
    });
    const latencyMs = performance.now() - startedAt;
    return { move: moveFromText(result.text), latencyMs };
  }

  const startedAt = performance.now();
  const result = await generateObject({
    model,
    schema: moveSchema,
    schemaName: 'PaddleMove',
    schemaDescription: 'The move for the right paddle on this tick.',
    system: LLM_SYSTEM_PROMPT,
    prompt: JSON.stringify(stateForModel(state)),
    temperature: 0,
    maxOutputTokens: opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: opts.signal,
    providerOptions: opts.providerOptions ?? reasoningOff(gatewayModelId),
  });
  const latencyMs = performance.now() - startedAt;

  return { move: parseMove(result.object), latencyMs };
}
