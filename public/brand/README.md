# Brand assets

The Ably logo files here credit the realtime service the game runs on, in a "Powered by Ably" lockup on the site footer, the clip strip, the end card and the social card. They come from Ably's brand kit, and Ably's rules apply:

- Pick the variant by background: `-light-bg` (black wordmark) on light, `-dark-bg` (white wordmark) on dark. The symbol keeps its orange gradient in both.
- Clearspace: the height of the lowercase "l" in the wordmark, on all sides. Nothing inside that zone.
- Never recolour the symbol, never separate the wordmark from the symbol, never stretch.
- The lockup is the words "Powered by" in the UI font, then the horizontal logo at the same cap height.

The site footer carries both variants and swaps them on `prefers-color-scheme`; the clip, the end card and the social card are always dark, so they use `-dark-bg` only. Every surface draws the logo at 22px tall with 16px of clearspace.

## 169Pi

`169pi-wordmark.svg` is 169Pi's wordmark, taken unchanged from 169Pi's website. It appears only in the footer credit ("Alpie by 169Pi"), drawn as a mask over the text colour (`Mark169Pi` in `components/lane/chrome.tsx`), so it is one solid colour that follows the theme. Never recolour it into more than one colour, stretch it, or redraw it.

The model providers are credited as text, not logos.
