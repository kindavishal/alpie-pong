# Alpie Pong

Pong where the ball moves one step per model decision. Slow model, slow ball.

![Four Pong lanes, one per model. Alpie Seed's blue ball crosses the court again and again while Alpie Core's has barely left the centre line.](public/media/clip-wide.gif)

Alpie Pong races **Alpie Seed**, 169Pi's 9B model, against other models in a game that will not wait. Every lane plays the same game, asked the same question, and every ball moves only when its model answers. The time beside each court is the round trip of that one model call and nothing else.

**Play it: [alpie-pong.vercel.app](https://alpie-pong.vercel.app)**. Arrow keys or W/S, or drag on a phone.

Created by Vishal Das. Inspired by [Jev Pong](https://github.com/ably-labs/jev-pong) from Ably Labs.

## The race

| Lane | Model | Served by | Why it is here |
|---|---|---|---|
| **Alpie Seed 9B** | `alpie_9b`, thinking off | 169Pi | the model this site is about |
| Sarvam 105B | `sarvam-105b`, thinking off | Sarvam | the other Indian model family; about 10.3B parameters active per answer |
| Ministral 3 8B | `ministral-8b-2512` | Mistral | the Ministral 3 size closest to Seed's 9B; does not think |
| Qwen 3.8 27B | `@cf/qwen/qwen3.8-27b`, thinking off | Cloudflare Workers AI | three times Seed's size, a bigger rival |
| Gemma 4 26B-A4B | `@cf/google/gemma-4-26b-a4b-it`, thinking off | Cloudflare Workers AI | a mixture of experts with about 4B parameters active per answer |
| Alpie Core 32B | `alpie-32b` | 169Pi | 169Pi's reasoning model, which thinks before every answer; watch-only, to show what that costs |

The rivals are chosen to be fair to Alpie Seed: about its size or larger, answering without thinking first, and free to start on with no credit card, as Alpie is.

Recorded on 25 October 2026 from a local machine, each model through its own API, 45 seconds per lane:

| Lane | Decisions | Per second | Average | p95 | Returns |
|---|---|---|---|---|---|
| **Alpie Seed 9B** | **110** | **2.44** | **410 ms** | 404 ms | 14 |
| Ministral 3 8B | 76 | 1.67 | 600 ms | 1,111 ms | 9 |
| Gemma 4 26B-A4B | 62 | 1.37 | 732 ms | 1,851 ms | 8 |
| Alpie Core 32B | 4 | 0.07 | 14.9 s | 17.4 s | 0 |

![Decisions in 12 seconds: Alpie Seed 9B 27, Ministral 3 8B 18, Gemma 4 26B-A4B 18, Alpie Core 32B 0.](public/media/clip-endcard-wide.png)

These figures include the recording machine's network, so treat them as a local run, not a benchmark. Every number on the site is read from `public/replay-stats.json`; nothing is typed in by hand. Re-record from a deployment before quoting them (see [Re-recording](#re-recording)).

### Models we tried and left out

- **Gemini 3.5 Flash-Lite** (Google AI Studio): the free tier allows 15 requests a minute, and a lane makes about 60, so a free lane stops within seconds.
- **Gemma 4 on Google AI Studio**: failed about one call in six. The same model on Cloudflare is reliable, so it races there.
- **gpt-oss-20b**: its API cannot switch reasoning off, which would make the lane a test of thinking rather than of the model.
- **Sarvam 105B** was left out at first for the same reason, wrongly: its documented `reasoning_effort` setting never goes below "low", but the API also accepts the chat template's `enable_thinking` switch, which turns thinking off. It now races.
- **Llama 3.1 8B, Qwen 3 30B-A3B and Granite 4.0 Micro** on Cloudflare: Llama cannot return a JSON schema and took 3.5 to 4.6 s, Qwen returned empty replies, and Granite got half its moves wrong.

## What counts as one decision

The state is a JSON object of numbers and nothing else, about 125 bytes:

```json
{"court":{"w":160,"h":100},"ball":{"x":80,"y":50,"vx":19,"vy":4.4},"paddle":{"y":50,"h":20},"interceptY":67.4,"dir":"toward"}
```

The question is `DECISION_INSTRUCTIONS` in `lib/decide/prompt.ts`: move the right paddle to cover `interceptY`, treating it as covered within five units. There are three answers, `up`, `down` and `stay`, described by `MOVE_CRITERIA` in the same file. Every lane reads those two constants, so nothing is worded twice.

Every lane is asked through its own provider's API with structured output, a JSON schema that allows only those three answers, at temperature 0 and the lowest reasoning setting that API accepts. Nobody gets a retry. Alpie Core's API ignores the schema and writes its reasoning out, so its move is read from its final answer (`moveFromText` in `lib/decide/llm.ts`).

One decision moves the ball one segment, and eight segments cross the court. Nothing is skipped or sped up, so a lane's speed is its model's decision latency. When you play, a step never completes faster than 260 ms, so a fast model is a game rather than a reflex test; the published latency is still the real one.

## How a game runs

Every participant in a game is a member of one [Ably](https://ably.com) channel, `pong:game:{id}`, including the model.

- The browser gets a short-lived token from `/api/ably-token`, enters presence as a player, subscribes to `state` and publishes `input`. An input is a level, not an event: `up`, `down` or `stay`, repeated while held, and forgotten after 400 ms, so a closed laptop can never pin a paddle against the wall.
- The model's side is a worker started by `POST /api/game` and kept alive inside the same function invocation with `after()`. It joins the channel, enters presence as `agent`, runs the physics, asks the model for a move once per ball step, and publishes a `state` snapshot after every decision.
- Spectators attach to the same channel with `rewind`, so a late joiner sees the current state at once. The viewer count is presence.
- A referee ends the game when a score reaches five, when a player has been gone for 15 seconds, when nobody joined within a minute, when a demo has been unwatched for two minutes, or shortly before the platform deadline.

The browser predicts the player's own paddle and reconciles it against the wire only after a frame acknowledges the player's latest input, so the paddle never jumps backwards. The ball's step is timed by the worker's clock, not by when its frames arrived. `lib/ui/paddle.ts` and `lib/render/live.ts` are both pure and tested.

## Read the code in this order

1. `lib/game/types.ts`: the contract. The court, the mechanic, the lanes and the hero.
2. `lib/game/engine.ts`: the whole game as pure functions.
3. `lib/decide/prompt.ts`: the one question every model is asked, and its three answers.
4. `lib/decide/endpoints.ts`: how each lane reaches its model's own API, with no key in the code.
5. `lib/decide/llm.ts`: the one timed call, structured output or a move read from a prose answer.
6. `lib/worker/game-worker.ts`: the model as a member of the channel.
7. `lib/worker/referee.ts`: when a game stops, as a pure state machine.
8. `app/api/game/route.ts`: one HTTP request, one function, one game.
9. `lib/ably/hooks.ts`: everything a browser does.

## Run it

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys
pnpm dev
```

Every model in the race starts free, with no credit card:

| Variable | What it is for |
|---|---|
| `ABLY_API_KEY` | Realtime transport. Ably's free plan is enough; the key needs **publish**, **subscribe** and **presence**. |
| `ALPIE_SEED_BASE_URL`, `ALPIE_CORE_BASE_URL`, `ALPIE_API_KEY` | Alpie Seed and Alpie Core on 169Pi's API (OpenAI-compatible, ending in `/v1`). |
| `SARVAM_API_KEY` | Sarvam 105B, on Sarvam's free sign-up credits. |
| `MISTRAL_API_KEY` | Ministral 3 8B, on Mistral's free Experiment plan. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Qwen 3.8 and Gemma 4 on Cloudflare Workers AI's free plan (a token from the "Workers AI" template). |
| `ADMIN_TOKEN` | Guards anything that spends model credit with nobody playing: `/arena`, demo games, `/api/record`, `/api/compare`. |
| `AI_GATEWAY_API_KEY` | Optional, for the original Vercel AI Gateway lanes in the comparison tool. |

`.env.example` lists them all. No key reaches a browser.

It deploys to Vercel's free Hobby plan. Functions there run for at most 300 seconds, so a live game lasts up to 4 minutes 45 seconds (a game to five points usually takes one to two), and `/api/record` records at most 240 seconds.

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Re-recording

`POST /api/record` records the race and returns the replay and its stats; drop them into `public/`. `scripts/compare-models.ts` puts the question to more models, one call at a time, and writes `public/model-comparison.json`, which the how-it-works page renders. Run both from a deployment, so the latencies are measured from a server rather than from somebody's broadband. `pnpm render:clip` renders the recording as a video clip (it needs `ffmpeg`); the GIF and end card at the top of this file come from the same frame renderer.

## Credits

Alpie Pong is created by Vishal Das, inspired by [Jev Pong](https://github.com/ably-labs/jev-pong), an open-source demo by Ably Labs, and builds on its code under the Apache License 2.0. See `LICENSE` and `NOTICE`. Alpie Seed and Alpie Core are made by [169Pi](https://169pi.ai). Realtime transport by [Ably](https://ably.com). Next.js on Vercel, the AI SDK, Tailwind, and canvas courts with no game engine.
