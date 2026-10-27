/**
 * lib/decide/endpoints.ts — the models that are not on the Gateway.
 *
 * Alpie (169Pi), Mistral, Cloudflare Workers AI, Sarvam, Google's Gemini API and
 * the Hugging Face router each serve an OpenAI-style chat completions API, so a lane for them is asked through
 * `@ai-sdk/openai-compatible` pointed at that API instead of through a Gateway
 * model string. Everything else about the call is what every chat lane gets
 * (`generateObject`, the same schema, the same instruction, the same state),
 * and the clock still runs around the call alone. The live game (../decide)
 * and the comparison tool (../compare) both come through here.
 *
 * None of them needs a credit card to start: Alpie's test endpoint takes no
 * key at all, and the others hand out free keys on sign-up. The Hugging Face
 * router is the exception: every call is charged, against prepaid credits or
 * a PRO or organisation plan's monthly credits (a free account has none), so
 * its lanes are in the comparison only, not the race. `HF_BILL_TO` names the
 * organisation a call is billed to, when it is not the token's owner. Google's
 * Gemini API is paid too once billing is on, which is what lifts the free tier's
 * 15 requests a minute; Gemini 3.5 Flash-Lite races as a billed lane.
 *
 * Where these models live is never written in the repo. Base URLs, keys and
 * model ids are read from the environment when a lane runs, so a private test
 * endpoint is never published with the code.
 *
 * Every one of these APIs enforces a JSON schema (vLLM guided decoding for
 * Alpie, verified against alpie_9b on 2026-10-25; `response_format:
 * json_schema` in Mistral's, Cloudflare's and Sarvam's docs), so
 * `supportsStructuredOutputs` is on: the model is constrained to `{ move }`,
 * exactly as the Gateway lanes are. Alpie Core's API is the exception that
 * ignores it; see the `answer: 'text'` lanes in ../compare. On the Hugging Face
 * router, Featherless enforces the schema too (Sarvam-M answered `{"move":…}`
 * in 5 or 6 tokens, 2026-10-26), and so does the Gemini API's OpenAI-compatible
 * endpoint (Gemini 3.5 Flash-Lite answered `{"move":…}` on every probe, 2026-10-26).
 *
 * Some hosts put a model's whole reply in the message's `reasoning` field and
 * leave `content` empty: Featherless does for Sarvam-M and Fathom-R1-14B, and
 * Cloudflare did for Qwen 3 30B-A3B. The SDK reads `content` alone, so the
 * reply would be scored as no answer. `replyFromReasoning` moves that text into
 * `content`, for every endpoint, and only when `content` is empty and the reply
 * finished, so a model that answers normally is untouched and thinking cut off
 * at the token limit still counts as no answer. It runs after the response has arrived;
 * the clock around the call is unchanged.
 *
 * Fields under `providerOptions[name]` are copied into the request body as
 * they are, which is how a lane sends Alpie's `chat_template_kwargs` thinking
 * switch. The one exception is the reasoning effort: the SDK writes its own
 * `reasoning_effort` after the copied fields, so a lane must name it
 * `reasoningEffort`. Spelt `reasoning_effort`, it is overwritten and never sent,
 * which until 2026-10-26 was true of Sarvam 105B's thinking-on lane.
 *
 * Amazon Bedrock is the one endpoint that is not OpenAI-style for every model:
 * its Chat Completions route does not serve Claude Haiku 5.5 and wants another
 * message shape for Nova 2 Lite (2026-10-27), so its lanes go through Bedrock's
 * own Converse API with `@ai-sdk/amazon-bedrock`, still through `generateObject`
 * with the same schema. Every call is billed to the AWS account behind
 * `BEDROCK_API_KEY`. The region defaults to us-east-1, beside Vercel's iad1
 * where the race is recorded, and the lanes use its `us.` inference profiles,
 * which keep a call inside the United States. How each Bedrock model is held
 * to the schema is the lane's `structuredOutputMode`: `outputFormat` is
 * Bedrock's JSON-schema output, and `jsonTool` a tool call the model is made
 * to use, for a model that refuses `outputFormat` (Nova 2 Lite).
 *
 * Grok 4.7 sometimes writes its move twice in one reply, as text and in that
 * tool call (2 of 5 calls, 2026-10-27), and this SDK version joins the two into
 * one string that no longer parses. `answerFromJsonTool` drops the text when the
 * reply carries the tool call, for every Bedrock lane, so the move the model was
 * made to give is the one read. Like `replyFromReasoning`, it runs after the
 * response has arrived.
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { EndpointKey } from '../game/types';

export type { EndpointKey };

interface EndpointConfig {
  /**
   * Provider name: the `providerOptions` key whose fields go into the body.
   * A lane on this endpoint keys its options by it ('alpie', 'mistral',
   * 'cloudflare', 'sarvam', 'gemini' or 'huggingface').
   */
  name: string;
  baseUrl: string | undefined;
  /** What to tell the operator when `baseUrl` is missing. */
  baseUrlEnv: string;
  apiKey: string | undefined;
  /** Sarvam refuses a call without a key; Alpie's test endpoint takes none. */
  keyRequired: string | null;
  headers?: Record<string, string>;
  /** Overrides the lane's model id, for a model whose id is not settled yet. */
  model: string | undefined;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

const ENDPOINTS: Record<Exclude<EndpointKey, 'bedrock'>, () => EndpointConfig> = {
  'alpie-seed': () => ({
    name: 'alpie',
    baseUrl: env('ALPIE_SEED_BASE_URL') ?? env('ALPIE_BASE_URL'),
    baseUrlEnv: 'ALPIE_SEED_BASE_URL (or ALPIE_BASE_URL)',
    apiKey: env('ALPIE_API_KEY'),
    keyRequired: null,
    model: env('ALPIE_SEED_MODEL'),
  }),
  'alpie-core': () => ({
    name: 'alpie',
    baseUrl: env('ALPIE_CORE_BASE_URL') ?? env('ALPIE_BASE_URL'),
    baseUrlEnv: 'ALPIE_CORE_BASE_URL (or ALPIE_BASE_URL)',
    apiKey: env('ALPIE_CORE_API_KEY') ?? env('ALPIE_API_KEY'),
    keyRequired: null,
    model: env('ALPIE_CORE_MODEL'),
  }),
  cloudflare: () => {
    // Workers AI's OpenAI-compatible API lives under the account; a full base URL can override it.
    const account = env('CLOUDFLARE_ACCOUNT_ID');
    return {
      name: 'cloudflare',
      baseUrl: env('CLOUDFLARE_BASE_URL') ?? (account === undefined ? undefined : `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1`),
      baseUrlEnv: 'CLOUDFLARE_ACCOUNT_ID',
      apiKey: env('CLOUDFLARE_API_TOKEN'),
      keyRequired: 'CLOUDFLARE_API_TOKEN',
      model: undefined,
    };
  },
  sarvam: () => {
    const apiKey = env('SARVAM_API_KEY');
    return {
      name: 'sarvam',
      baseUrl: env('SARVAM_BASE_URL') ?? 'https://api.sarvam.ai/v2',
      baseUrlEnv: 'SARVAM_BASE_URL',
      apiKey,
      keyRequired: 'SARVAM_API_KEY',
      // Sarvam documents both this header and a bearer token; send both.
      headers: apiKey === undefined ? undefined : { 'api-subscription-key': apiKey },
      model: undefined,
    };
  },
  gemini: () => ({
    name: 'gemini',
    baseUrl: env('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
    baseUrlEnv: 'GEMINI_BASE_URL',
    apiKey: env('GEMINI_API_KEY'),
    keyRequired: 'GEMINI_API_KEY',
    model: undefined,
  }),
  huggingface: () => {
    const billTo = env('HF_BILL_TO');
    return {
      name: 'huggingface',
      baseUrl: env('HF_BASE_URL') ?? 'https://router.huggingface.co/v1',
      baseUrlEnv: 'HF_BASE_URL',
      apiKey: env('HF_TOKEN'),
      keyRequired: 'HF_TOKEN',
      headers: billTo === undefined ? undefined : { 'X-HF-Bill-To': billTo },
      // Each lane names its host in its model id ("org/model:provider"), so there is no one-model override.
      model: undefined,
    };
  },
  mistral: () => ({
    name: 'mistral',
    baseUrl: env('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1',
    baseUrlEnv: 'MISTRAL_BASE_URL',
    apiKey: env('MISTRAL_API_KEY'),
    keyRequired: 'MISTRAL_API_KEY',
    // Three lanes share this endpoint (Ministral 3 at 3B, 8B and 14B), so there is no one-model override.
    model: undefined,
  }),
};

/** A language model for `modelId` on that endpoint, or a thrown reason it is not configured. */
export function endpointModel(endpoint: EndpointKey, modelId: string): LanguageModel {
  if (endpoint === 'bedrock') {
    const apiKey = env('BEDROCK_API_KEY');
    if (apiKey === undefined) throw new Error('BEDROCK_API_KEY is not set.');
    return createAmazonBedrock({ region: env('BEDROCK_REGION') ?? 'us-east-1', apiKey, fetch: answerFromJsonTool })(modelId);
  }
  const config = ENDPOINTS[endpoint]();
  if (config.baseUrl === undefined) throw new Error(`${config.baseUrlEnv} is not set.`);
  if (config.keyRequired !== null && config.apiKey === undefined) {
    throw new Error(`${config.keyRequired} is not set.`);
  }
  const provider = createOpenAICompatible({
    name: config.name,
    // The SDK appends /chat/completions itself; a URL copied from a curl example already has it.
    baseURL: config.baseUrl.replace(/\/chat\/completions\/?$/, ''),
    apiKey: config.apiKey,
    headers: config.headers,
    supportsStructuredOutputs: true,
    fetch: replyFromReasoning,
  });
  return provider.chatModel(config.model ?? modelId);
}

interface ConverseBlock {
  text?: string;
  toolUse?: { name?: string };
}

/**
 * Drops the text from a Converse reply that also carries the forced `json`
 * tool call (see the header), so the tool call alone is read as the answer.
 * Anything else is passed through as it came.
 */
export async function answerFromJsonTool(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return res;
  const body = (await res.clone().json()) as { output?: { message?: { content?: ConverseBlock[] } } };
  const content = body.output?.message?.content;
  if (content === undefined || !content.some((b) => b.toolUse?.name === 'json') || !content.some((b) => b.text !== undefined)) return res;
  body.output!.message!.content = content.filter((b) => b.text === undefined);
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers });
}

interface ChatMessage {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
}

/**
 * Moves a reply its host filed under `reasoning` into `content`, when
 * `content` is empty (see the header). Anything that is not a JSON chat
 * completion is passed through as it came.
 */
export async function replyFromReasoning(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return res;
  const body = (await res.clone().json()) as { choices?: { message?: ChatMessage; finish_reason?: string }[] };
  let moved = false;
  for (const choice of body.choices ?? []) {
    const message = choice.message;
    const reasoning = message?.reasoning_content ?? message?.reasoning;
    // Only a reply that finished: thinking cut off at the token limit is not an answer.
    if (message && choice.finish_reason === 'stop' && !message.content && typeof reasoning === 'string' && reasoning.trim() !== '') {
      message.content = reasoning;
      delete message.reasoning;
      delete message.reasoning_content;
      moved = true;
    }
  }
  if (!moved) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers });
}
