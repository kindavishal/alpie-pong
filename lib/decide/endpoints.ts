/**
 * lib/decide/endpoints.ts — the models that are not on the Gateway.
 *
 * Alpie (169Pi), Mistral, Cloudflare Workers AI and Sarvam each serve an OpenAI-style
 * chat completions API, so a lane for them is asked through
 * `@ai-sdk/openai-compatible` pointed at that API instead of through a Gateway
 * model string. Everything else about the call is what every chat lane gets
 * (`generateObject`, the same schema, the same instruction, the same state),
 * and the clock still runs around the call alone. The live game (../decide)
 * and the comparison tool (../compare) both come through here.
 *
 * None of them needs a credit card to start: Alpie's test endpoint takes no
 * key at all, and the others hand out free keys on sign-up.
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
 * ignores it; see the `answer: 'text'` lanes in ../compare.
 *
 * Fields under `providerOptions[name]` are copied into the request body as
 * they are, which is how a lane sends Alpie's `chat_template_kwargs` thinking
 * switch, or the `reasoning_effort` the others take.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { EndpointKey } from '../game/types';

export type { EndpointKey };

interface EndpointConfig {
  /**
   * Provider name: the `providerOptions` key whose fields go into the body.
   * A lane on this endpoint keys its options by it ('alpie', 'mistral',
   * 'cloudflare' or 'sarvam').
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

const ENDPOINTS: Record<EndpointKey, () => EndpointConfig> = {
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
  });
  return provider.chatModel(config.model ?? modelId);
}
