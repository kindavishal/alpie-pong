/**
 * Site-level constants that are not part of the game contract.
 *
 * One place, so a placeholder is obvious and changing it is one edit. The
 * measurement line in particular is ONE string in ONE place (design/SPEC.md,
 * must-not-get-wrong h) — the site, the clip and the OG image all quote it.
 */

/**
 * The public repository. Null hides the Source button rather than shipping a
 * dead link.
 */
export const REPO_URL: string | null = 'https://github.com/kindavishal/alpie-pong';

/** The one line that describes the whole thing. Also the OG image subtitle. */
export const TAGLINE =
  'Pong where the ball moves one step per model decision. Slow model, slow ball.';

/**
 * Where a recorded run was measured from, from the region its stats saved:
 * POST /api/record on the deployed site runs in a Vercel region, and anywhere
 * else (a laptop) saves null. A recording from before the region was saved is
 * the 25 October 2026 one, made in iad1.
 */
export function measurementFor(region?: string | null): string {
  if (region === null) return "a local machine, not Vercel, via each model's own API";
  return `Vercel (${region ?? 'iad1'}), via each model's own API`;
}

/** The published recording's measurement line, for the rendered clip. */
export const MEASUREMENT = measurementFor();

/** The credit line under every surface. */
export const CREDIT_PARTS = ['AI SDK', 'Alpie by 169Pi'] as const;
export const CREDITS = CREDIT_PARTS.join(' · ');

/**
 * The end card's headline window, in seconds. The clip counts decisions over
 * it, and so does the social card (lib/render/og.ts) — neither quotes a number
 * anybody typed in.
 */
export const CLIP_SECONDS = 12;

/**
 * Where "Realtime agent transport powered by Ably" points. Verified 200 with no
 * redirect on 2026-09-17; the whole lockup is one link, on every surface.
 */
export const ABLY_URL = 'https://ably.com/ai-transport';

/** The words in front of the Ably lockup. One string, one place. */
export const ABLY_CREDIT = 'Realtime agent transport powered by';

/**
 * Atari-GPT. Pong is the title the chat models handled worst — the reason this
 * demo is Pong and not something turn-based.
 */
export const ATARI_PAPER_URL = 'https://arxiv.org/html/2408.15950v2';

/** The open-source project Alpie Pong is inspired by and builds on (see NOTICE). */
export const INSPIRED_BY_URL = 'https://github.com/ably-labs/jev-pong';

/** 169Pi, linked from the wordmark in the footer credit. */
export const COMPANY_URL = 'https://169pi.ai';
