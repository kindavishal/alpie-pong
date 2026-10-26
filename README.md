# Alpie Pong

Pong where the ball moves one step per model decision. Slow model, slow ball.

![Six Pong lanes, one per model. Alpie Seed's blue ball crosses the court again and again while Alpie Core's has barely left the centre line.](public/media/clip-wide.gif)

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
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite`, reasoning effort minimal (its lowest) | Google, billed per call | Google's newest small Gemini; it cannot turn thinking off, and at "minimal" Google reported no thinking tokens |
| Alpie Core 32B | `alpie-32b` | 169Pi | 169Pi's reasoning model, which thinks before every answer; watch-only, to show what that costs |

The rivals are chosen to be fair to Alpie Seed: about its size or larger, and answering without thinking first, or at the lowest reasoning setting their API accepts. The first rivals are free to start on with no credit card, as Alpie is. The frontier labs' small models that follow are billed per call, and their lanes say so; Gemini 3.5 Flash-Lite is the first.

Every lane that can think races with thinking off through the same switch, the chat template's `enable_thinking: false`, sent to Alpie Seed, Sarvam, Qwen and Gemma alike. Sarvam's `reasoning_effort` does not turn thinking off: "low" is its lowest named level, and its docs say setting it to null disables reasoning, but on 26 October 2026 null, "low", "medium", "high" and leaving it out all thought for about 160 to 540 tokens per answer, so the race does not use it. The comparison on the how-it-works page shows it as Sarvam's thinking-on row, over the same 30 states as every other row. Alpie Core ignores the switch and thinks anyway, which is what its watch-only lane is there to show.

Alpie Seed and Alpie Core are called on 169Pi's test endpoint; the rivals are called on their providers' public APIs, free tiers for all but the billed lanes. The two are not necessarily provisioned the same way, and the numbers here do not separate the model from the service in front of it.

Recorded on 25 October 2026 from the deployed site, in a Vercel function in iad1 (Washington, D.C.), each model through its own API, 45 seconds per lane:

| Lane | Decisions | Per second | Average | p95 | Returns |
|---|---|---|---|---|---|
| **Alpie Seed 9B** | **173** | **3.82** | **261 ms** | 260 ms | 22 |
| Sarvam 105B | 116 | 2.56 | 389 ms | 514 ms | 14 |
| Ministral 3 8B | 78 | 1.71 | 580 ms | 1,090 ms | 10 |
| Qwen 3.8 27B | 75 | 1.64 | 607 ms | 1,617 ms | 9 |
| Gemma 4 26B-A4B | 38 | 0.82 | 989 ms | 2,344 ms | 5 |
| Alpie Core 32B | 4 | 0.07 | 14.5 s | 15.2 s | 0 |

![Decisions in 12 seconds: Alpie Seed 9B 45, Sarvam 105B 27, Ministral 3 8B 19, Qwen 3.8 27B 25, Gemma 4 26B-A4B 23, Alpie Core 32B 0.](public/media/clip-endcard-wide.png)

Each latency is the round trip from that server to the model's own API, so it includes the network distance to wherever the provider serves the model. From iad1, Alpie's endpoint in San Jose is nearer than Sarvam's API in Mumbai, while Mistral and Cloudflare answer from their nearest edge; from a server in India the order between Alpie Seed and Sarvam could change. Every number on the site is read from `public/replay-stats.json`; nothing is typed in by hand.

### Models we tried and left out

- **Gemini 3.5 Flash-Lite on Google's free tier**: it allows 15 requests a minute, and a lane makes about 60, so a free lane stops within seconds. With billing on, the limit lifts, and it now races as a billed lane.
- **Gemma 4 on Google AI Studio**: failed about one call in six. The same model on Cloudflare is reliable, so it races there.
- **gpt-oss-20b**: its API cannot switch reasoning off, which would make the lane a test of thinking rather than of the model.
- **Sarvam 105B** was left out at first for the same reason, wrongly: its documented `reasoning_effort` setting never goes below "low", but the API also accepts the chat template's `enable_thinking` switch, which turns thinking off. It now races.
- **Llama 3.1 8B, Qwen 3 30B-A3B and Granite 4.0 Micro** on Cloudflare: Llama cannot return a JSON schema and took 3.5 to 4.6 s, Qwen returned empty replies, and Granite got half its moves wrong. Qwen's replies were not empty: Cloudflare filed them under `reasoning` instead of `content`. Every lane now reads such a reply (`replyFromReasoning` in `lib/decide/endpoints.ts`), and Qwen 3 30B-A3B answered all 30 states, 22 right, at a 435 ms median in the run below. It has not been added to the race, because it was not part of the search for Indian rivals; it could be.

### Other Indian models

Alpie Seed's rivals were also searched for among Indian models (26 October 2026). Sarvam 105B is the only one served free on a provider's own API. What else exists:

- **Sarvam 30B and Sarvam-M** are retired from Sarvam's API, which answers both with "has been deprecated". Of Sarvam's own models it now serves only Sarvam 105B and a conversational variant of it.
- **Sarvam-M (24B, built on Mistral Small 3.1)** and **Fractal's Fathom-R1-14B (built on DeepSeek-R1-Distill-Qwen-14B)** are still served by Featherless through the Hugging Face router, which charges for every call (a free Hugging Face account gets no monthly credits). Both are in the comparison tool, not the race. Featherless rejects the `enable_thinking` switch, so Sarvam-M runs with no switch; it answered the schema in 5 or 6 tokens, so it did not think first. Fathom always thinks unless the schema stops it: with the schema it answered in 8 or 9 tokens, and allowed to think it ran to the 8,192-token limit with no answer after about 81 s, twice.
- **Krutrim-2 (12B)** is no longer served: Krutrim Cloud's catalogue now holds only other companies' models.
- **BharatGen Param2 17B-A2.4B** (under BharatGen's non-commercial licence) and **Sarvam 30B** are open weights with no hosted API that we could find. Hosting them ourselves would time our own hardware rather than a provider's service, so they are not in either table.
- **Zoho Zia LLM** was announced in July 2025 at 1.3B, 2.6B and 7B; we found no public API for it. **Soket, Tech Mahindra (Indus), Genloop, CoRover (BharatGPT) and Hanooman**: no public chat API or hosted model found. **Gnani**'s Inya VoiceOS is a 5B voice-to-voice research preview, and its other released models are for speech, not text chat.

The same 30 states went to Alpie Seed, Sarvam 105B and the two Featherless models in one run, one call at a time, recorded in `public/indian-comparison.json` and shown on the how-it-works page. This run was made from a Mac on home broadband through `pnpm dev`, as was the comparison on the how-it-works page, so the latencies include that connection. The race table above was recorded from Vercel, so the two are not comparable; the rows within each are.

| Model | Served by | Setting | Correct | Median | p95 |
|---|---|---|---|---|---|
| Alpie Seed 9B | 169Pi | thinking off | 30 / 30 | 401 ms | 403 ms |
| Sarvam 105B | Sarvam | thinking off | 21 / 30 | 226 ms | 317 ms |
| Fathom-R1-14B | Featherless | schema enforced, so no room to think | 7 / 30 | 1,605 ms | 3,649 ms |
| Sarvam-M 24B | Featherless | default, no thinking switch accepted | 24 / 30 | 1,624 ms | 3,240 ms |

Neither Featherless model is in the race: both are billed per call, and their medians are about four times Alpie Seed's. An earlier run the same day, with the free race lanes alongside, gave similar figures (Sarvam-M 24 right at 1,717 ms, Fathom 6 of 29 answered right at 1,682 ms, Sarvam 105B 20 right at 235 ms); its Qwen 3 30B-A3B result is the one quoted above. That run was not saved to a file.

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

Every model in the race but the billed lanes starts free, with no credit card:

| Variable | What it is for |
|---|---|
| `ABLY_API_KEY` | Realtime transport. Ably's free plan is enough; the key needs **publish**, **subscribe** and **presence**. |
| `ALPIE_SEED_BASE_URL`, `ALPIE_CORE_BASE_URL`, `ALPIE_API_KEY` | Alpie Seed and Alpie Core on 169Pi's API (OpenAI-compatible, ending in `/v1`). |
| `GEMINI_API_KEY` | Gemini 3.5 Flash-Lite on Google's Gemini API, a billed lane: a key from Google AI Studio, with billing on for its project. |
| `SARVAM_API_KEY` | Sarvam 105B, on Sarvam's free sign-up credits. |
| `MISTRAL_API_KEY` | Ministral 3 8B, on Mistral's free Experiment plan. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Qwen 3.8 and Gemma 4 on Cloudflare Workers AI's free plan (a token from the "Workers AI" template). |
| `ADMIN_TOKEN` | Guards anything that spends model credit with nobody playing: `/arena`, demo games, `/api/record`, `/api/compare`. |
| `AI_GATEWAY_API_KEY` | Optional, for the original Vercel AI Gateway lanes in the comparison tool. |
| `HF_TOKEN`, `HF_BILL_TO` | Optional, for the Sarvam-M and Fathom-R1-14B comparison lanes on the Hugging Face router, which charges for every call. A fine-grained token with "Make calls to Inference Providers"; `HF_BILL_TO` names an organisation to bill instead of the token's owner. |

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
