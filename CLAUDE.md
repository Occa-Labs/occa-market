# OCCA Open Market — Brand & Design System

The single source of truth for how OCCA Open Market looks and feels. Loaded every session. When building or editing any UI in this project, follow this. If a request conflicts with it, flag the conflict before shipping.

Product blueprint (what we're building, scope, economics): [agent-marketplace-blueprint.md](agent-marketplace-blueprint.md). Token utility & economics: [agent-marketplace-token.md](agent-marketplace-token.md). Public-messaging guardrails live in the blueprint's §12 — check before writing any user-facing marketing copy.

## What this is

OCCA Open Market is the light, fun, crypto-native front door to OCCA. A public catalog of ready-made agents: browse, pick one, put it to work, pay in USDC. It is deliberately NOT the heavy OS "company" product.

But "crypto-fun" does not mean loud. The brand target is **refined, calm, premium dark** — the polish of a top-tier developer SaaS, applied to a crypto agent marketplace. Think calm confidence, not neon casino.

## Design philosophy

Reference aesthetic: **Clerk's dark mode**. The whole system is built to feel like that — and explicitly moves away from the earlier terminal/HUD direction (pure black, dotted grid, hard cyan, sharp corners). That older look is retired.

Five principles, in priority order:

1. **Monochrome first.** The interface is grayscale. Color is an event, not a default. A screen with zero saturated color is correct and normal.
2. **Near-black, never pure black.** Backgrounds are deep neutral grays. Pure `#000` reads as cheap and flattens depth.
3. **Depth through subtlety.** Polish comes from soft surface gradients, hairline borders, a faint top-edge highlight, and soft shadows — not from glow, neon, or heavy effects.
4. **Rounded and generous.** Rounded corners everywhere. Generous internal padding. Lots of negative space. Nothing cramped.
5. **Quiet typography.** Sans for headings, titles, labels, and buttons; monospace for body/description text and machine data. High-contrast headings, muted body.

## Color

Defined as Tailwind v4 `@theme` tokens in [src/app/globals.css](src/app/globals.css). Use the token, never a raw hex in a component.

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#131316` | Page background. Dark neutral, faint cool tint. |
| `--color-bg-edge` | `#0e0e10` | Outer vignette / radial falloff at edges. |
| `--color-surface` | `#212126` | Card / panel base. A touch lighter than `--color-bg` — see low-contrast rule below. |
| `--color-surface-2` | `#2b2b31` | Raised surface, hover, nested panel, inputs, pills. |
| `--color-surface-top` | `#26262c` | Top stop of a card's surface gradient (fades down to `--color-surface`). |
| `--color-fg` | `#f4f4f5` | Primary text, headings. |
| `--color-muted` | `#8a8d93` | Body / secondary text. The default paragraph color. |
| `--color-faint` | `#5a5d63` | Captions, meta, disabled, placeholder. |
| `--color-line` | `rgba(255,255,255,0.07)` | Default hairline border. |
| `--color-line-strong` | `rgba(255,255,255,0.12)` | Hover border, dividers that need to read. |
| `--color-highlight` | `rgba(255,255,255,0.05)` | Inset top-edge highlight on cards (the "premium" trick). |
| `--color-accent` | `#2ee6d6` | OCCA cyan. The ONE accent. See accent discipline below. |
| `--color-on-accent` | `#05130f` | Text on a cyan fill (rare). |
| `--color-warn` | `#f5a524` | Warning state only. |
| `--color-bad` | `#f04438` | Error / offline / destructive only. |

### Accent discipline

This is the rule that keeps us looking like Clerk and not like a memecoin site.

- The primary button is **white** (`--color-fg` background, `--color-bg` text), not cyan. This matches the reference.
- Cyan is used **sparingly**: live/active indicators (the pulsing online dot), the active nav item, links on hover, a single focused data point. Never as a large fill, never as a background wash, never on more than a small fraction of any screen.
- A whole page can ship with no cyan at all and be correct.
- Never introduce a second accent hue. Warn/bad are states, not brand colors.

## Typography

Two families, self-hosted via `next/font/local` in [src/app/layout.tsx](src/app/layout.tsx). Files in [public/fonts](public/fonts).

- **KH Teka (sans)** → `font-display`, token `--font-display-src`. The **display / UI voice**: headings, titles, section labels, buttons, nav, all UI chrome.
- **KH Teka Mono** → `font-mono`, token `--font-mono-src`. The **reading / technical voice**: body and description paragraphs, plus machine data (prices, token amounts, tickers, handles, wallet addresses, hashes, timestamps, status pills, counts, code). NOT for buttons, headings, or titles.

Scale and weight:

| Role | Family | Size | Weight | Color |
|---|---|---|---|---|
| Hero headline | sans | `text-5xl`–`text-6xl` | 600 | `fg`, tracking-tight |
| Section heading | sans | `text-2xl` | 600 | `fg` |
| Card title | sans | `text-base` | 600 | `fg` |
| Body / description | **mono** | `text-sm`–`text-xs` | 400 | `muted`, relaxed leading |
| Caption / meta | mono | `text-xs` | 400 | `faint` |
| Data / price / ticker | mono | `text-sm`–`text-xs` | 500 | `fg` |
| Label (eyebrow) | mono | `text-xs` | 400 | `faint`, uppercase, `tracking-[0.18em]` |

Two-tone text is on-brand (reference: "**Enterprise-grade** reassurance..."): lead phrase in `fg`, remainder in `muted`, same size.

## Surfaces, borders, radius, elevation

The recipe that makes a card feel premium. A standard card:

- **Low contrast is the point.** The card surface is only slightly lighter than the page. The hairline border, not a brightness jump, does most of the separation. If a card looks like a distinct light box on the page, it's too light — pull it back toward `--color-bg`.
- Background: subtle **vertical gradient** from `--color-surface-top` down to `--color-surface` (top lighter, bottom darker). The delta is tiny — felt, not seen.
- **Edge via inset shadow, not `border`** (Clerk technique): a full 1px ring plus a brighter 1px top line, both white at very low opacity, drawn with `box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.045)`. Reads as lit-from-within rather than outlined, and takes no layout space. This is the signature detail; do not replace it with a plain `border`.
- `position: relative; isolation: isolate; overflow: hidden` so inner illustration layers can stack and the radius clips cleanly.
- All of the above already live in the `.surface-card` utility — use the [`Card`](src/components/ui/card.tsx) component and you get it for free.
- Radius: **generous.** `rounded-[20px]` (≈`rounded-3xl`) for cards/panels — the reference is clearly rounder than a default 2xl. `rounded-xl` (12px) for inputs and inner panels. `rounded-lg` (8px) for buttons. Small status/category pills `rounded-full`; wide data/notification chips `rounded-xl`.
- Shadow: soft and low. `shadow-[0_1px_2px_rgba(0,0,0,0.4)]` for resting cards; a slightly deeper soft shadow on hover. No hard or colored shadows.
- Internal padding: generous. `p-6` minimum for cards, `p-8`+ for feature panels. Gaps between cards `gap-5`–`gap-6`.
- **Illustration spotlight.** When a card holds an illustration/icon, sit it on a faint radial light (a soft `radial-gradient` glow behind it) so it feels lit, not pasted. Illustrations are monochrome, desaturated, dark-on-dark. Optional faint angular/geometric texture at card edges is on-brand.

Retired: sharp corners, the dotted-grid background, `hud-frame` corner ticks, hard cyan borders. Remove these as you touch files.

Page background: `--color-bg` with a very faint radial lighter patch behind the hero (center-top), falling off to `--color-bg-edge` at the edges. Subtle enough to feel like lighting, not a gradient banner. Optional fine grain/noise to avoid banding.

## Spacing & layout

- Container: `max-w-7xl`, horizontal padding `px-5` (mobile) → `px-6`+ (desktop), centered.
- Vertical rhythm: sections breathe. Hero `py-20`+; content sections `py-14`+.
- **Bento grid** for feature/agent collections: a responsive grid where cards may span different sizes for visual rhythm (reference uses 1 tall + 2 stacked). Default catalog grid is uniform 3-up (`lg:grid-cols-3`) with `gap-4`–`gap-6`; reserve bento spans for editorial/landing sections.
- Negative space is a feature. When unsure, add space.

## Components

**Top nav.** Slim bar, `bg-bg/80` + `backdrop-blur`, hairline bottom border. OCCA mark (left), nav links in `muted` → `fg` on hover, active item may carry cyan. Primary action button on the right. A thin secondary sub-nav row underneath is on-brand for sectioned areas (reference shows one).

**Button.** Use the [`Button`](src/components/ui/button.tsx) component — don't hand-roll. `rounded-md`, `font-medium`, sizes `sm | md | lg`. Variants:
- **default** (the standard action, analysed from Clerk's dark button): dark gray `#42434d` with a top gradient sheen, a 0.5px white ring, an inset top highlight, and a soft drop shadow. `text-fg`. Lightens slightly on hover. This is the default CTA.
- **secondary** — ghost: transparent, `border-line-strong`, `text-fg`, hover raises border + `bg-surface-2`.
- **light** — soft off-white (`#e4e4e7`) fill, `text-bg`. High-emphasis alternative; use sparingly.

`withArrow` adds the looping chevron (one slides out right, a fresh one slides in from the left) on hover — nice on the lead CTA. Pass `href` to render an `<a>`. Never cyan, never a second accent.

**Special: liquid-metal button.** [`LiquidMetalButton`](src/components/ui/liquid-metal-button.tsx) is a shader statement piece reserved for ONE spot (currently the header Sign in). Not a general button — do not scatter it.

**Card (agent / feature).** Use the [`Card`](src/components/ui/card.tsx) component (`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`) — it wraps the `.surface-card` recipe. Don't hand-roll the surface. Two layouts, both on-brand:
- **Text-led:** title (sans 600) → muted description → optional illustration/data below.
- **Illustration-led:** illustration on its radial spotlight at top → title → muted description below (the reference's Compliance / Password cards).
Mix the two within a bento section for rhythm. Whole card hover lifts border + shadow.

**Data / notification chip.** `rounded-xl`, `bg-surface-2`, `border-line`, **mono** text in `muted`/`faint`, small. Leading status icon (e.g. a tiny spinner/dot), trailing timestamp in `faint`. This is the reference's "Fraudulent sign-ups detected · 14:09" chip — use it for live events, agent activity, status lines.

**Status / category pill.** Small `rounded-full`, `bg-surface-2`, `border-line`, mono, for "online", category tags, counts.

**Connector / timeline.** A thin vertical `--color-line` line with small node dots is the motif for flow/sequence visuals (reference's right card). Reuse for pipelines, agent steps, activity feeds.

**Input.** `bg-surface-2`, `border-line`, `rounded-xl`, `text-fg`, `placeholder:text-faint`, focus ring in cyan at low opacity.

**Live indicator.** Small `rounded-full` dot in cyan with a gentle pulse for online/active; `faint` (no pulse) for offline.

## Motion

Subtle and fast. `transition-colors`/`transition-all` at ~150–200ms. Hover states change border, background, shadow, opacity — never bounce or slide far. Pulse animation only on live indicators. Respect `prefers-reduced-motion`.

## Do / Don't

Do:
- Reach for grayscale first; justify any color.
- Use the top-edge highlight + surface gradient on every card.
- Use mono for body/description text and machine data; sans for headings, titles, labels, and buttons.
- Add space before adding elements.

Don't:
- Use pure `#000`, dotted grids, neon glow, or HUD corner ticks (all retired).
- Make the primary CTA cyan, or fill large areas with accent.
- Put buttons, headings, or titles in monospace.
- Use sharp corners on cards/buttons.
- Introduce a second brand color or a new font.

## Stack notes

- Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, TypeScript. Standalone project — does not import from the OCCA monorepo.
- Design tokens live in [src/app/globals.css](src/app/globals.css) `@theme`. Fonts wired in [src/app/layout.tsx](src/app/layout.tsx). Brand mark: [public/occa-mark.svg](public/occa-mark.svg) (white fill, works on dark).
- Catalog data is currently mock in [src/lib/agents.ts](src/lib/agents.ts); UI-first, real API later.
- Never run the dev server automatically — the user runs `pnpm dev`. Verify changes with `pnpm build`.
