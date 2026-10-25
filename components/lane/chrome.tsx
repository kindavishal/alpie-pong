'use client';

/**
 * The furniture every page shares: the header, the footer, the "Powered by
 * Ably" lockup, the live dot and the status badge.
 *
 * Every colour here is a token. The Ably logo is the real brand SVG at 22px
 * with its 16px clearspace, in the variant the background asks for — the light
 * page gets the black wordmark, the dark page the white one.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ABLY_CREDIT, ABLY_URL, COMPANY_URL, CREDIT_PARTS, REPO_URL } from '@/lib/config/site';

/* --------------------------------------------------------------- the logo */

/**
 * The credit, and what it is a credit for.
 *
 * The whole lockup — words and mark — is one link to the Ably AI transport
 * page, because the sentence and the logo are one statement. The mark is the
 * real brand SVG at 22px with its 16px clearspace, in the variant the
 * background asks for: the light page gets the black wordmark, the dark page
 * the white one.
 */
export function AblyLockup({ className }: { className?: string }) {
  return (
    <a
      href={ABLY_URL}
      className={`text-fg-muted hover:text-fg -my-2 -ml-1 flex flex-wrap items-center rounded-control px-1 py-2 ${className ?? ''}`}
    >
      <span className="text-[13px]">{ABLY_CREDIT}</span>
      <span className="flex p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ably-logo-horizontal-light-bg.svg"
          alt="Ably"
          height={22}
          width={70}
          className="block h-[22px] w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ably-logo-horizontal-dark-bg.svg"
          alt=""
          aria-hidden
          height={22}
          width={70}
          className="hidden h-[22px] w-auto dark:block"
        />
      </span>
    </a>
  );
}

/* ------------------------------------------------------------ the 169Pi mark */

/**
 * 169Pi's wordmark (public/brand/169pi-wordmark.svg, from 169Pi's own site).
 * It is drawn as a mask over `currentColor`, the way 169Pi's site draws it, so
 * it takes the colour of the text it sits in, in either theme. The aspect
 * ratio is the file's cropped viewBox.
 */
export function Mark169Pi({ height, className }: { height: number; className?: string }) {
  const mask = 'url(/brand/169pi-wordmark.svg)';
  return (
    <span
      role="img"
      aria-label="169Pi"
      className={`inline-block shrink-0 bg-current ${className ?? ''}`}
      style={{
        height,
        aspectRatio: '790 / 268',
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

/* ------------------------------------------------------------- the header */

export interface SiteHeaderProps {
  /** Anything on the right: the nav links, "playing", "Live", "Ended · …". */
  right?: ReactNode;
  /** The wordmark links home everywhere except on the home page itself. */
  home?: boolean;
}

/**
 * Wordmark, and whatever the page has to say on the right.
 *
 * There is exactly one "Alpie Pong" on any page and it is this one, so no page
 * repeats it as a heading (design/SPEC.md, the home board).
 */
export function SiteHeader({ right, home = false }: SiteHeaderProps) {
  const mark = (
    <span className="font-display text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap lg:text-[16px]">Alpie Pong</span>
  );
  return (
    <header className="flex h-[52px] items-center justify-between gap-3 lg:h-[72px] lg:gap-6">
      <div className="flex min-w-0 items-center gap-2.5 lg:gap-3">
        {home ? mark : <Link href="/">{mark}</Link>}
        <span className="text-fg-muted hidden items-center gap-1.5 text-[12px] sm:flex lg:text-[13px]">
          by <Mark169Pi height={12} className="lg:h-[13px]" />
        </span>
      </div>
      {right}
    </header>
  );
}

/**
 * The header's right-hand side on the pages that are there to be read.
 *
 * A phone (under 640px) has room for the wordmark, the badge and one button, so
 * there the button says "Play" and the two text links drop out; the footer
 * carries both of them on every page.
 */
export function HeaderNav({ source = true }: { source?: boolean }) {
  return (
    <nav className="text-fg-muted flex shrink-0 items-center gap-3.5 text-[12px] lg:gap-5 lg:text-[13px]">
      <Link
        href="/play"
        className="bg-fg text-btn-fg rounded-control flex h-8 items-center px-3 text-[12px] font-semibold whitespace-nowrap hover:opacity-90 lg:h-9 lg:px-3.5 lg:text-[13px]"
      >
        <span className="sm:hidden">Play</span>
        <span className="hidden sm:inline">Play against Alpie</span>
      </Link>
      <Link href="/how" className="hover:text-fg hidden whitespace-nowrap sm:inline">
        How it works
      </Link>
      {source && REPO_URL !== null && (
        <a href={REPO_URL} className="hover:text-fg hidden whitespace-nowrap sm:inline">
          Source
        </a>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------- the footer */

/** The way to the explanation, and to the code, from anywhere. */
export function HowLink({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Link href="/how" className="text-fg hover:underline">
        How it works
      </Link>
      {REPO_URL !== null && (
        <>
          <span className="text-fg-muted"> · </span>
          <a href={REPO_URL} className="text-fg hover:underline">
            Source
          </a>
        </>
      )}
    </span>
  );
}

export function SiteFooter({ stacked = false }: { stacked?: boolean }) {
  const credits = (
    <div
      className={`flex flex-col gap-1 text-[12px] leading-[1.5] sm:text-[13px] ${
        stacked ? '' : 'sm:items-end sm:text-right'
      }`}
    >
      <HowLink />
      <p className={`text-fg-muted flex flex-wrap items-center gap-x-1 ${stacked ? '' : 'sm:justify-end'}`}>
        {/* The credits, with the last one ("Alpie by 169Pi") ending in 169Pi's mark. */}
        <span>{CREDIT_PARTS.slice(0, -1).join(' · ')} · Alpie by</span>
        <a href={COMPANY_URL} className="hover:text-fg inline-flex items-center" aria-label="169Pi">
          <Mark169Pi height={11} className="sm:h-[12px]" />
        </a>
      </p>
    </div>
  );

  if (stacked) {
    return (
      <footer className="border-hair flex flex-col gap-2 border-t pt-3">
        <AblyLockup />
        {credits}
      </footer>
    );
  }

  return (
    <footer className="border-hair flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pt-4">
      <AblyLockup />
      {credits}
    </footer>
  );
}

/* ------------------------------------------------------- dots and badges */

/**
 * The presence dot. Motion note 06: it breathes 1 -> 0.4 -> 1 over 2 s, and
 * it is never orange — orange is the hero's ball, trail, number and bar only.
 */
export function LiveDot({ breathing = false, size = 7 }: { breathing?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`bg-fg inline-block shrink-0 rounded-full ${breathing ? 'breathe' : ''}`}
      style={{ width: size, height: size }}
    />
  );
}

/** A hollow dot: connecting, not yet live. */
export function PendingDot({ size = 7 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="border-fg-muted inline-block shrink-0 rounded-full border-[1.5px]"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Motion note 05: a badge fades 150 ms in and out and never pushes layout, so
 * it keeps its box whether or not it has anything to say.
 */
export function StatusBadge({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden={!show}
      className={`fade-150 inline-flex items-center gap-[7px] text-[12px] font-semibold ${
        show ? 'opacity-100' : 'pointer-events-none opacity-0'
      } ${className ?? ''}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- icons */

export function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="block">
      <path
        d="M5.5 3.5 L2 8 L5.5 12.5 M10.5 3.5 L14 8 L10.5 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- buttons */

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-fg text-btn-fg rounded-control flex h-12 items-center justify-center px-[22px] text-[16px] font-semibold"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="border-btn-border text-fg rounded-control flex h-12 items-center justify-center gap-2 border px-5 text-[16px] font-medium"
    >
      {children}
    </a>
  );
}

/** The same two shapes, for something that happens on this page. */
export function PrimaryButton({
  onClick,
  children,
  type = 'button',
}: {
  onClick?: () => void;
  children: ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="bg-fg text-btn-fg rounded-control flex h-12 items-center justify-center px-[22px] text-[16px] font-semibold"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-btn-border bg-surface text-fg rounded-control flex h-12 items-center justify-center gap-2 border px-5 text-[16px] font-medium"
    >
      {children}
    </button>
  );
}
