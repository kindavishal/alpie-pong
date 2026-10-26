'use client';

/**
 * /how — the page for anyone who wants to check the claim rather than take it.
 *
 * Everything here that can be derived is derived. The state block is built by
 * the engine, the question and its answers are imported from the file the
 * models are actually sent, and every number in the prose — steps per crossing,
 * paddle step, the play-mode floor — is the constant the game runs on. None of
 * it can drift from the thing it describes.
 *
 * It is deliberately short. The first version explained everything twice; a
 * sceptic wants the state, the question, the method and the source, in that
 * order, and wants them on one screen.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeaderNav, SiteFooter, SiteHeader } from './chrome';
import { ATARI_PAPER_URL, REPO_URL } from '@/lib/config/site';
import { DECISION_INSTRUCTIONS, MOVE_CRITERIA, stateForModel } from '@/lib/decide/prompt';
import { createEngine, serve, toDecisionState } from '@/lib/game/engine';
import {
  accuracySentence,
  COMPARISON_FLOOR_MS,
  COMPARISON_FROM,
  COMPARISON_MEASURED_AT,
  COMPARISON_STATES,
  comparisonRows,
  type ComparisonRow,
} from '@/lib/ui/comparison';
import { INDIAN_FROM, INDIAN_MEASURED_AT, INDIAN_STATES, UNMEASURED, indianRows } from '@/lib/ui/indian-models';
import {
  LANES,
  MODEL_PADDLE_STEP,
  PLAY_MIN_STEP_MS,
  SEGMENTS_PER_CROSSING,
  heroLane,
  laneSource,
} from '@/lib/game/types';

const HERO_LABEL = heroLane().label;

export function How() {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-6 lg:px-20">
      <SiteHeader right={<HeaderNav />} />

      <h1 className="font-display max-w-[760px] pt-5 text-[28px] leading-[1.1] font-medium tracking-[-0.028em] lg:pt-10 lg:text-[44px]">
        How it works
      </h1>
      <p className="text-fg-muted max-w-[700px] pt-2.5 text-[16px] leading-[1.45] text-pretty lg:pt-4 lg:text-[20px]">
        One question in every lane, and a number that is only ever the time the model took.
      </p>

      <div className="flex flex-col gap-8 pt-8 lg:gap-11 lg:pt-11">
        <WhyPong />
        <Rules />
        <WhatTheModelSees />
        <Lineup />
        <OtherModels />
        <IndianModels />
        <OverAbly />
        <ReadTheCode />
      </div>

      <div className="pt-10 lg:pt-14">
        <SiteFooter />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ why Pong */

function WhyPong() {
  return (
    <Section id="why" title="Why Pong">
      <Body>
        Pong is the Atari game chat models handle worst: below random in the{' '}
        <Cite href={ATARI_PAPER_URL}>Atari-GPT benchmark</Cite>, mostly because deciding takes them
        longer than the game gives them. A live loop is the one job where speed is the whole point,
        so it is the fair place to see what a fast answer is worth. Alpie Seed is 169Pi&apos;s 9B model;
        with its thinking switched off it reads the state and answers the question directly.
      </Body>
    </Section>
  );
}

/* -------------------------------------------------------------------- rules */

const RULES: string[] = [
  'Same serve, same rules, same question in every lane.',
  `One decision moves the ball one step. ${SEGMENTS_PER_CROSSING} steps cross the court.`,
  `The model's paddle moves at most ${MODEL_PADDLE_STEP} units per decision, which is enough reach over a crossing to get anywhere the ball can go.`,
  'The left paddle is a script, not a model. It always returns the ball and it takes no time to decide, so the only difference between lanes is the model on the right.',
  `When you play, a step never finishes in under ${PLAY_MIN_STEP_MS} ms, so a fast model is a game rather than a reflex test. The floor paces the ball, not the clock: the number beside the court is still ${HERO_LABEL}'s real round trip.`,
];

function Rules() {
  return (
    <Section id="rules" title="The rules">
      <ul className="flex max-w-[700px] flex-col gap-2">
        {RULES.map((rule) => (
          <li
            key={rule}
            className="text-fg-muted flex gap-3 text-[13px] leading-[1.55] text-pretty lg:text-[14px]"
          >
            <span aria-hidden className="text-fg-muted pt-[7px]">
              <Bullet />
            </span>
            <span className="min-w-0">{rule}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Bullet() {
  return (
    <svg width="5" height="5" viewBox="0 0 5 5" aria-hidden className="block">
      <circle cx="2.5" cy="2.5" r="2.5" fill="currentColor" />
    </svg>
  );
}

/* ---------------------------------------------- what counts as one decision */

/**
 * The comparison is only a fair fight if every lane is asked the same thing, so
 * the page shows the thing rather than claiming it.
 *
 * Nothing here is typed out by hand. The state block is built by the engine —
 * a fresh game, served, as the right-hand paddle sees it — and the question and
 * its answers are imported from lib/decide/prompt.ts, which is the file the
 * models are actually sent. Neither can drift from what goes on the wire.
 */
const SAMPLE_SEED = 20260917;

/** Exactly the JSON a model is given on a decision. Any seed gives this shape. */
const SAMPLE_STATE = JSON.stringify(
  stateForModel(toDecisionState(serve(createEngine(SAMPLE_SEED)), 'right')),
);

/** "up · down · stay" — the three answers, from the criteria themselves. */
const ANSWERS = Object.keys(MOVE_CRITERIA).join(' · ');

function WhatTheModelSees() {
  return (
    <Section id="state" title="What the model sees">
      <div className="flex max-w-[700px] flex-col gap-1.5">
        <p className="text-fg-muted text-[12px] lg:text-[13px]">
          The whole state, numbers only, {SAMPLE_STATE.length} bytes:
        </p>
        <pre className="mono bg-surface border-hair rounded-card border px-3.5 py-3 text-[11px] leading-[1.6] break-all whitespace-pre-wrap lg:text-[12px]">
          {SAMPLE_STATE}
        </pre>
      </div>

      <div className="flex max-w-[700px] flex-col gap-1.5 pt-1">
        <p className="text-fg-muted text-[12px] lg:text-[13px]">
          The question, in the words every lane is given:
        </p>
        <p className="text-fg text-[12px] leading-[1.5] lg:text-[13px]">{DECISION_INSTRUCTIONS}</p>
        <p className="text-fg-muted text-[12px] lg:text-[13px]">
          Three answers: <span className="mono text-fg">{ANSWERS}</span>.
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- the line-up */

/** Why each lane is in the race, keyed by lane id. The lanes themselves come from the contract. */
const WHY: Partial<Record<string, string>> = {
  alpie: 'the model this site is about, with its thinking switched off',
  sarvam: 'the other Indian model family, about 10B parameters active per answer, thinking off',
  'qwen-cf': 'three times Seed\'s size, thinking off',
  'ministral-8b': "the Ministral 3 size closest to Seed's 9B; does not think",
  'gemma-cf': 'a mixture of experts with about 4B parameters active per answer, thinking off',
  'alpie-core': "169Pi's reasoning model, which thinks before every answer; watch-only",
};

function Lineup() {
  return (
    <Section id="method" title="The line-up">
      <ul className="flex max-w-[700px] flex-col gap-2">
        {LANES.map((lane) => (
          <li key={lane.id} className="text-fg-muted flex gap-3 text-[13px] leading-[1.55] text-pretty lg:text-[14px]">
            <span aria-hidden className="text-fg-muted pt-[7px]">
              <Bullet />
            </span>
            <span className="min-w-0">
              <span className={lane.id === heroLane().id ? 'text-hero-ink font-semibold' : 'text-fg font-semibold'}>
                {lane.label}
              </span>{' '}
              on {laneSource(lane)}
              {WHY[lane.id] ? `: ${WHY[lane.id]}.` : '.'}
            </span>
          </li>
        ))}
      </ul>
      <Body>
        Every lane is asked through its own provider&apos;s API with structured output, a JSON schema
        that allows only <Mono>up</Mono>, <Mono>down</Mono> or <Mono>stay</Mono>, at temperature 0 and
        the lowest reasoning setting that API accepts. Nobody gets a retry. Alpie Core&apos;s API ignores
        the schema and writes its reasoning out, so its move is read from its final answer. The number
        on a lane is the round trip of that one call, timed on the server, and nothing else.
      </Body>
      <Body>
        The rivals are chosen to be fair to Alpie Seed: about its size or larger, answering without thinking
        first, and free to start on with no credit card, as Alpie is. Gemini 3.5 Flash-Lite was tried
        and dropped: Google&apos;s free tier allows it 15 requests a minute and a lane makes about 60.
        gpt-oss was dropped from the race because its API cannot switch reasoning off. Sarvam 105B
        and both Alpie models also appear in the table below with thinking on.
      </Body>
      <Body>
        Every lane that can think races with thinking off through the same switch: the chat
        template&apos;s <Mono>enable_thinking: false</Mono>, sent to Alpie Seed, Sarvam, Qwen and Gemma
        alike. Sarvam&apos;s documented <Mono>reasoning_effort</Mono> setting cannot do that, since
        &ldquo;low&rdquo; is the lowest it accepts and still reasons first, so the race does not use it;
        the table shows it as Sarvam&apos;s thinking-on row. Alpie Core is the one exception: its API
        ignores the switch and thinks anyway, which is what its watch-only lane is there to show.
      </Body>
      <Body>
        Alpie Seed and Alpie Core are called on 169Pi&apos;s test endpoint; the rivals are called on
        their providers&apos; public free-tier APIs. The two are not necessarily provisioned the same
        way, and the numbers here do not separate the model from the service in front of it.
      </Body>
    </Section>
  );
}

/* ------------------------------------------------------ the other models */

function OtherModels() {
  const rows = comparisonRows();
  return (
    <Section id="other-models" title="More models, same question">
      <Body>
        The race shows a few models at once. This is the wider check: on {COMPARISON_MEASURED_AT} the
        same question went to more models, one call per decision, sequential, {COMPARISON_STATES} real
        game states each, the same states in the same order for every row, including Sarvam 105B and
        both Alpie models with thinking on as well as off. Models that reason first take about 15 s a
        call, so they are run in several requests and the parts added up; they still answer the same{' '}
        {COMPARISON_STATES}. The first row is the baseline.
      </Body>

      <ComparisonTable rows={rows} />

      <Body>
        Measured from {COMPARISON_FROM}, so every latency includes that machine&apos;s network.
        {COMPARISON_FLOOR_MS > 0
          ? ` Every row carries the same ${COMPARISON_FLOOR_MS} ms of request overhead from there, removed before the columns are shown.`
          : ''}{' '}
        {accuracySentence(rows)}
      </Body>
    </Section>
  );
}

/** The comparison columns, shared by both tables. The first row is the baseline. */
function ComparisonTable({ rows, showProvider = false }: { rows: readonly ComparisonRow[]; showProvider?: boolean }) {
  return (
    <div className="max-w-[700px] overflow-x-auto">
      <table className="w-full min-w-[520px] text-[12px] lg:text-[13px]">
        <thead>
          <tr className="text-fg-muted border-hair border-b text-left">
            <th className="py-1.5 pr-3 font-medium">Model</th>
            {showProvider ? <th className="py-1.5 pr-3 font-medium">Served by</th> : null}
            <th className="py-1.5 pr-3 font-medium">Setting</th>
            <th className="py-1.5 pr-3 text-right font-medium">Correct</th>
            <th className="py-1.5 pr-3 text-right font-medium">Median</th>
            <th className="py-1.5 pr-3 text-right font-medium">p95</th>
            <th className="py-1.5 text-right font-medium">vs {rows[0]?.model ?? HERO_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.model} ${row.setting}`} className="border-hair border-b">
              <td className={`py-1.5 pr-3 font-semibold ${i === 0 ? 'text-hero-ink' : 'text-fg'}`}>{row.model}</td>
              {showProvider ? <td className="text-fg-muted py-1.5 pr-3">{row.provider}</td> : null}
              <td className="text-fg-muted py-1.5 pr-3">{row.setting}</td>
              <td className="mono py-1.5 pr-3 text-right">
                {row.correct}/{row.answered}
              </td>
              <td className="mono py-1.5 pr-3 text-right">{row.adjustedP50Ms} ms</td>
              <td className="mono py-1.5 pr-3 text-right">{row.adjustedP95Ms} ms</td>
              <td className="mono py-1.5 text-right">{row.timesHero}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------- the other Indian models */

function IndianModels() {
  const rows = indianRows();
  return (
    <Section id="indian-models" title="Other Indian models">
      <Body>
        Sarvam 105B is the only other Indian model in the race, because it is the only one we found
        served free on a provider&apos;s own API. Two more are still served, both by Featherless through
        the Hugging Face router, which charges for every call, so they are measured here rather than
        raced. On {INDIAN_MEASURED_AT} they were asked the same question as every lane, with the same
        schema, at temperature 0 and with no retries, over {INDIAN_STATES} game states, beside Alpie
        Seed and Sarvam 105B.
      </Body>
      <Body>
        Sarvam-M is Sarvam&apos;s post-training of Mistral Small 3.1 24B. Featherless rejects the{' '}
        <Mono>enable_thinking</Mono> switch the race sends, so it runs with no switch; it answered
        without thinking first. Fathom-R1-14B is Fractal&apos;s reasoning model, built on
        DeepSeek-R1-Distill-Qwen-14B, which always thinks unless something stops it: here the schema
        does. Allowed to think, it ran out of tokens before it answered on both states tried, so it has
        no thinking row. Featherless files both models&apos; replies under{' '}
        <Mono>reasoning</Mono> instead of <Mono>content</Mono>; a finished reply there is read as the
        answer, for every lane alike.
      </Body>

      <ComparisonTable rows={rows} showProvider />

      <Body>
        Measured from {INDIAN_FROM}, so every latency includes that machine&apos;s network, and the
        rows are comparable with each other rather than with the race. {accuracySentence(rows, INDIAN_STATES)}
      </Body>

      <p className="text-fg-muted max-w-[700px] pt-1 text-[13px] leading-[1.6] lg:text-[14px]">
        Not in the table, because they could not be put the question:
      </p>
      <ul className="flex max-w-[700px] flex-col gap-2">
        {UNMEASURED.map((m) => (
          <li key={m.model} className="text-fg-muted flex gap-3 text-[13px] leading-[1.55] text-pretty lg:text-[14px]">
            <span aria-hidden className="text-fg-muted pt-[7px]">
              <Bullet />
            </span>
            <span className="min-w-0">
              <span className="text-fg font-semibold">{m.model}</span>
              {m.maker ? ` (${m.maker})` : ''}: {m.reason}.
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------- the Ably part */

function OverAbly() {
  return (
    <Section id="ably" title="Where Ably comes in">
      <Body>
        <Mono>POST /api/game</Mono> leaves a worker running on Vercel. It joins the channel{' '}
        <Mono>pong:game:&lt;id&gt;</Mono> as an ordinary member, announces itself in presence as the
        agent, runs the physics and publishes a state snapshot after every decision. Your browser is
        another member of the same channel: present as a player, publishing <Mono>input</Mono>{' '}
        messages carrying one move, drawing what the channel says rather than a simulation of its
        own.
      </Body>
      <Body>
        That is why the watch link works. Anyone who opens it attaches to the same channel with
        rewind, so the current state arrives immediately instead of at the next decision, and the
        number of people watching is that presence set, counted.
      </Body>
    </Section>
  );
}

/* ----------------------------------------------------------- read the code */

/** The reading order from the README, so the two cannot disagree. */
const READING: Array<{ path: string; note: string }> = [
  {
    path: 'lib/game/types.ts',
    note: 'the contract: the court, one decision = one tick, and the bytes a model is given',
  },
  {
    path: 'lib/game/engine.ts',
    note: 'the whole game as pure functions, including the paddle that never misses',
  },
  { path: 'lib/decide/prompt.ts', note: 'the one question every model is asked, and its answers' },
  {
    path: 'lib/decide/endpoints.ts',
    note: "how each lane reaches its model's own API, with no key in the code",
  },
  {
    path: 'lib/decide/llm.ts',
    note: 'the one timed call: structured output, or a move read from a prose answer',
  },
  {
    path: 'lib/worker/game-worker.ts',
    note: 'the agent as a member of the channel: the decision loop and the wire',
  },
  { path: 'lib/worker/referee.ts', note: 'when a game stops, with no clock of its own' },
  { path: 'app/api/game/route.ts', note: 'one HTTP request, one function, one game' },
  {
    path: 'lib/ably/hooks.ts',
    note: 'everything a browser does: subscribe, be present, publish input',
  },
];

function ReadTheCode() {
  return (
    <Section id="code" title="Read the code">
      <Body>It is all public, and it is meant to be read. Start with these, in order.</Body>

      <ol className="flex max-w-[700px] flex-col gap-2 pt-1">
        {READING.map((entry, i) => (
          <li key={entry.path} className="flex gap-3 text-[12px] leading-[1.5] lg:text-[13px]">
            <span className="mono text-fg-muted w-4 shrink-0 text-right">{i + 1}</span>
            <span className="min-w-0">
              <SourceLink path={entry.path} />
              <span className="text-fg-muted"> · {entry.note}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="pt-4">
        <Link href="/play" className="text-fg text-[13px] hover:underline">
          Play against Alpie
        </Link>
        <span className="text-fg-muted text-[13px]"> · </span>
        <Link href="/" className="text-fg text-[13px] hover:underline">
          Back to the lanes
        </Link>
      </p>
    </Section>
  );
}

function SourceLink({ path }: { path: string }) {
  if (REPO_URL === null) return <Mono>{path}</Mono>;
  return (
    <a href={`${REPO_URL}/blob/main/${path}`} className="mono text-fg hover:underline">
      {path}
    </a>
  );
}

/* --------------------------------------------------------------- the type */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-[15px] font-semibold lg:text-[16px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <p className="text-fg-muted max-w-[700px] text-[13px] leading-[1.6] text-pretty lg:text-[14px]">
      {children}
    </p>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="mono text-fg">{children}</span>;
}

function Cite({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-fg hover:underline">
      {children}
    </a>
  );
}

export default How;
