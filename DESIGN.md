---
version: alpha
name: CurateVision
description: Design system for CurateVision, a modern front end for Kleros Curate registries. v2, built on roobinium's glow stage (the YMax dashboard), 2026-10-19; round 2 (full bleed, the "Lit edge" controls) the same day.
colors:
  primary: "#3D7BFF"
  primary-fill: "#2962FF"
  primary-hover: "#5A8FFF"
  primary-fill-hover: "#1F56F5"
  on-primary: "#FFFFFF"
  stage: "#02040B"
  background: "#060912"
  surface: "#0C111D"
  surface-raised: "rgba(255,255,255,0.045)"
  text: "#F4F6FB"
  text-muted: "#A1ABC0"
  text-faint: "#7A849E"
  border: "rgba(255,255,255,0.07)"
  border-strong: "rgba(255,255,255,0.16)"
  aurora-a: "#1B2FFF"
  aurora-b: "#0A7CFF"
  aurora-c: "#5B2BFF"
  edge-1: "#7AA7FF"
  edge-2: "#45D4FF"
  edge-3: "#9B7BFF"
  cta-top: "#15264F"
  cta-bottom: "#0A1226"
  cta-ink: "#F4F6FB"
  recess: "rgba(0,0,0,0.32)"
  popover: "rgba(14,19,32,0.9)"
  success: "#34D399"
  warning: "#F5B04A"
  danger: "#FF6B7A"
typography:
  hero:
    fontFamily: "Urbanist"
    fontSize: 84px
    fontWeight: 500
    lineHeight: 82px
  display:
    fontFamily: "Urbanist"
    fontSize: 48px
    fontWeight: 500
    lineHeight: 50px
  figure:
    fontFamily: "Geist"
    fontSize: 64px
    fontWeight: 500
    lineHeight: 61px
  heading:
    fontFamily: "Urbanist"
    fontSize: 30px
    fontWeight: 500
    lineHeight: 34px
  body:
    fontFamily: "Geist"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: "Geist"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 16px
  data:
    fontFamily: "Geist"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 18px
rounded:
  sm: 8px
  button: 10px
  md: 12px
  lg: 18px
  xl: 24px
  popover: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 80px
components:
  button-primary:
    backgroundColor: "linear-gradient({colors.cta-top}, {colors.cta-bottom})"
    borderColor: "conic({colors.edge-1}, {colors.edge-2}, {colors.edge-3})"
    textColor: "{colors.cta-ink}"
    rounded: "{rounded.pill}"
    typography: "{typography.body}"
    height: 44px
  button-secondary:
    backgroundColor: "transparent"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    typography: "{typography.body}"
    height: 44px
  segmented:
    backgroundColor: "{colors.recess}"
    rounded: "{rounded.pill}"
    typography: "{typography.data}"
    height: 38px
  select-menu:
    backgroundColor: "{colors.popover}"
    rounded: "{rounded.popover}"
    typography: "{typography.data}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
---

# Overview

CurateVision is a front end for Kleros Curate: on-chain lists that anyone can add to with a deposit,
anyone can challenge during a challenge window, and Kleros jurors settle when there is a dispute.

v2 is built on roobinium's **glow stage** (the YMax DeFi dashboard): a near-black **stage** with an
**aurora** in the theme's hues glowing behind the top of the page. Since round 2 the app runs **full
bleed**: no floating frame, no corner or side borders. The drama comes from **luminous data**
(gradient rings that draw in, a glowing activity wave with a live head, figures that roll into
place) and from **lit edges** on the controls. Copy is short; every page leads with its most
important number or visual.

Principles, in order:

1. **True data, labelled.** Every figure comes from the indexers or the chain, and every drawing says
   what it measures and over what window. Figures on one page describe the same scope.
2. **Money and time are legible.** Deposits show total and breakdown before anything is signed;
   deadlines read both ways (relative, absolute UTC on hover).
3. **Data first, words last.** One sentence under a title at most; explainers collapse into a pill.
4. **Smooth.** Motion explains change: reveals, count-ups, rings drawing in, sliding indicators,
   hover lift. Reduced motion turns it off.
5. **One accent, no flat fills.** Action is a lit edge on glass (dark glass, or lit white glass on
   the light theme), never a flat blue fill.
   Status colors are status. The aurora is the only other color, and charts take their categories
   from a fixed data set (`--viz-1…4`) that never reuses a status color.
6. **Equal choices look equal.** Nothing is pre-highlighted among options of equal standing; every
   control says what it does (a label, a hint or a heading).

Three themes: **Dark** (blue aurora, the default on a dark system), **Light** (a pale stage with a
pastel aurora) and **Kleros** (the production Kleros palette on a purple aurora). **System** follows
the OS between Light and Dark. `?cv-theme=light|dark|kleros` previews a theme without saving it. In
the theme menu the Kleros theme is marked by a wireframe icosahedron (`IcosahedronIcon` in
`components/layout/theme-menu.tsx`); each mode's hint says what it does in plain words ("Matches
your device", "Light background", "Dark background", "Kleros purple").

# Stage and app bar

- **Full bleed.** The page is the stage colour edge to edge. There is no frame, no frame radius, no
  inset ring and no side borders (round 2: the frame read as claustrophobic). The old
  `--frame-gap` and `--frame-radius` tokens are gone.
- **Aurora at the top only.** Two slowly drifting pools and one shallow band in `aurora-a/b/c`, under
  a faint grain, sit behind the top of the page (1040px tall on the dashboard, 680px dimmer on inner
  routes, shorter on phones) and fade out before the content gets dense. They scroll away with the
  page. Hidden tabs and reduced motion stop the drift. The glow is tuned so `text-faint` keeps
  4.5:1 wherever page content can start (measured from 88px down, all three themes).
- **App bar.** Full-width and sticky. Transparent at rest; once the page scrolls it takes a
  translucent stage fill (72%) with a 16px backdrop blur and a hairline bottom border. It never
  floats, insets or turns into a pill. Content keeps `--page-max-width` (1344px) and
  `--horizontal-padding` (min(4.69vw, 56px); 16px on phones), so widths match the old frame at 1440.
- Nothing on a page paints its own full-bleed background or grid.

# Colors

| Role | Light | Dark | Kleros |
|---|---|---|---|
| stage (page) | `#F5F7FC` | `#02040B` | `#07001A` |
| background | `#FBFCFE` | `#060912` | `#10022A` |
| surface (panel) | `#FFFFFF` | `#0C111D` | `#1A073D` |
| text | `#0B1220` | `#F4F6FB` | `#EAF4FF` |
| text-muted | `#4D5A6E` | `#A1ABC0` | `#B9C6E0` |
| text-faint | `#5E6A7D` | `#7A849E` | `#8F87BD` |
| primary (links, focus, selection) | `#2A63F0` | `#3D7BFF` | `#6CC5FF` |
| primary-fill (small indicators only, never a button) | `#2A63F0` | `#2962FF` | `#6CC5FF` |
| primary-fill-hover | `#2459E0` | `#1F56F5` | `#A5DBFF` |
| on-primary | `#FFFFFF` | `#FFFFFF` | `#14002F` |
| success / warning / danger | `#127D47` / `#9A5B00` / `#C92A2A` | `#34D399` / `#F5B04A` / `#FF6B7A` | `#65DC7F` / `#FFC46B` / `#FF5A78` |
| aurora a / b / c | `#9DB7FF` / `#B8E3FF` / `#C9B8FF` | `#1B2FFF` / `#0A7CFF` / `#5B2BFF` | `#7E1BD4` / `#4D00B4` / `#27CDFE` |
| viz 1–4 (chart categories) | `#2A63F0` `#0A87AD` `#7B4FD6` `#C43C84` | `#3D7BFF` `#1AA3C4` `#A274FF` `#D9558F` | as Dark |
| edge 1 / 2 / 3 (the lit edge) | `#2A63F0` / `#0A9FD0` / `#7B4FD6` | `#7AA7FF` / `#45D4FF` / `#9B7BFF` | `#C084FF` / `#27CDFE` / `#6CC5FF` |
| cta top / bottom (primary glass) | `#1D2742` / `#0B1220` | `#15264F` / `#0A1226` | `#2C1266` / `#150437` |
| cta-ink (primary label) | `#FFFFFF` | `#F4F6FB` | `#EAF4FF` |
| recess (tracks) | ink 5.5% | black 32% | black 30% |
| popover (glass menus) | white 92% | `#0E1320` 90% | `#1E0A42` 90% |

`primary-on-soft` (primary mixed 70% with text) is the text color on `primary-soft` fills and
featured tints. The viz set passes the categorical checks (lightness band, chroma, CVD and normal
separation, 3:1 on the surface) in each theme; chains keep one hue each (Gnosis 1, Ethereum 2,
Sepolia 3), lists take them in rank order, "other" is `text-faint`.

Every text pair clears WCAG 2.2 AA (4.5:1), measured. Status roles: green registered, blue window
open, amber contested, red off the list, grey neutral; always a haloed dot plus a text label.

# Typography

- **Urbanist** (the Kleros brand face) for display: hero lines, page titles, section titles, big
  figures. Weight 500, tight tracking (-0.03 to -0.045em).
- **Geist** for everything people read and operate, and for every figure that animates or lines up
  in a column (`--font-figure`, tabular figures; Urbanist has none). Labels are small uppercase
  Geist (11px, 0.06em).
- **Geist Mono** only for addresses, hashes and IDs (`<Data $mono>`, `<Mono>`). Counts, amounts,
  ranks and status words are Geist with tabular figures.
- There is no typeface switch (removed in round 2: nobody could tell what it did). The pairing is
  fixed; index.html loads Urbanist 400–600, Geist 400–600 and Geist Mono 400–500 and nothing else.
  A preference stored by the old switch (`curatevision-typeface`) is deleted on load and ignored.

# Surfaces and controls

- Panels: `surface`, `lg` radius, 1px border, a 1px top highlight. One **featured** panel per page
  carries the iridescent rim (aurora hues and a touch of amber) and a single comet of light that
  travels the rim on load.
- Rows: 56px table rows, or full-width rounded list rows that lift on hover. Chips are pills.

## Controls: "Lit edge" (round 2)

Light lives on the edges, never in a flat fill. Three directions were compared side by side in
[`docs/design/controls/`](docs/design/controls/index.html); this is the one built. The helpers live in
`src/components/ui/kit-styles.ts` (`ctaButton`, `ctaButtonLit`, `quietButton`, `recessTrack`,
`litThumb`, `glassPopover`, `litEdgeBackground`) and every control composes them.

The glass follows the theme. On dark and Kleros it is dark glass (`cta-top` to `cta-bottom`) with a
1px edge and a light label. On light it is **lit white glass**: white tinted toward the lower lip
(`#ffffff` to `#dde7ff`), a 1.5px edge (`--edge-width`) in higher-chroma hues, a blue glow inside the
lip and under the pill, and a deep ink label (`#0d1838`, 14:1 or more). Light never falls back to
an ink-black pill or a flat blue fill. Every element drawn with `litEdgeBackground` declares
`--edge-angle` itself, so the edge survives a browser without `@property`.

| Control | Rest | Hover / focus | Notes |
|---|---|---|---|
| **Primary** button | Glass pill (`cta-top` to `cta-bottom`), `--edge-width` conic edge in `edge-1/2/3` turned by `--edge-angle`, top sheen (`cta-sheen`), 1px inner highlight (`cta-highlight`), glow pooled inside the lip and under it (`cta-glow`), label `cta-ink` | The edge sweeps round (`--edge-angle` 210° to 570°, 900ms) and the glow blooms with a 4px `edge-2` halo | 44 / 34px (`Button`), 40 / 32px (`ui/Button`). Label 12:1 or more in every theme |
| **Secondary** | Transparent, 1px `border-strong` hairline, `text` label | Fills `raised`, hairline brightens to text 30% | Quiet ghost |
| Ghost, link | As before | | |
| Danger | `danger-soft` tint, `danger` label and 38% hairline | Tint 20%, hairline 60% | Never a solid red fill |
| Disabled (all) | `raised` fill, `muted` label, no edge, no glow | | The label stays legible: it often names the blocker |
| **Connect** (app bar) | The primary look (lit edge, glass, pooled glow) at 38px with a wallet glyph, so the bar's one call to action outranks the hairline chain chip; a brighter light (`sweep-head`) travels the edge (`--cv-sweep`, 5.5s) | As primary: the edge sweeps, the glow blooms | Reduced motion parks the light. Label at every width above 600px; a 38px circle on phones |
| Account (connected) | One glass pill: blockies avatar (opens the account menu) + short address in Geist Mono (opens the profile) | | Phones show the avatar; the phone menu gains "Your profile" |
| **Segmented** | `recess` track (inset shadow), pill; labels Geist 13/500 `muted` | The chosen option sits on a raised, lit glass **thumb** (`thumb`, `thumb-shadow`; on light a blue hairline and glow, never a plain white chip) with a 2px lamp under its label in the three edge hues, about half the label wide; label `text` | The thumb slides on a spring, leading edge first (260ms, the trailing edge 360ms + 40ms). Options take an icon (a name or any element), a `count` (tabular, faint) and a `tag` ("testnet"); `hideLabel` makes icon-only segments. Radio group: arrows, Home, End |
| **ToggleGroup** | The same track, for several independent on/off choices (registry types) | Each pressed option sits on its own lit thumb | Buttons with `aria-pressed`, one tab stop each; `onChange` gets the pressed values in option order. One choice of several is a SegmentedControl, never this |
| Primary nav | The same track and thumb; the thumb follows the current section | | `aria-current="page"` |
| **Switch** | `recess` track, a quiet bead (`bead-off`) | On: the track becomes deep glass (`track-on-top/bottom`, dark in every theme) with the lit edge, the bead a bright `bead-on` light with an `edge-2` glow | 40×24 (32×18 small); the bead springs and stretches while pressed |
| **SelectMenu** | Quiet hairline pill reading "Label  Value ⌄" (or the app bar's glass chip, or a round icon) | Fills `raised` | See below |

**SelectMenu** (`components/curate/primitives.tsx`) is the one dropdown for picking a value: sort
orders, the chain scope, the theme. It replaces native `<select>` and menus of radio items. The
trigger is a combobox button that keeps focus; the panel is a glass listbox (`popover`, 16px radius,
`border-strong` hairline, 18px backdrop blur; solid `surface` where the browser has no backdrop
filter) portalled to `<body>`, placed under the trigger (above
when there is no room) and kept there on scroll. A highlight slides to the hovered or
keyboard-active row; the chosen row reads in full `text` with a `primary` check. Options take an
icon, a hint line, a tag and a divider. Keys: ArrowDown / ArrowUp / Home / End / Enter / Space open
it; the arrows, Home, End, PageUp and PageDown move; Enter or Space pick; Escape closes the menu
alone (never a dialog around it); Tab closes; typing jumps to the matching option. The form field
`ui/Select` keeps its field trigger but shares the glass panel and the row look.

The app bar's chain chip is a SelectMenu on every page but the dashboard, which sets its scope with
its own control next to the figures. Its "All chains" option carries the Ethereum and Gnosis marks
together (`ChainStack`), so the glyph says what it covers; between 901 and 1099px and on phones the
chip shows only that mark and its chevron.

Focus everywhere is a 2px `primary` outline, 2px out (inset inside clipping tracks).

# Motion kit (`src/components/curate/motion`)

- `Odometer`: digits roll on their own columns, then settle into plain text.
- `AnimatedNumber`: ease-out count-up.
- `RingGauge`: a 270° conic-gradient arc with the gap at the bottom; only the head glows, a crown
  of ticks lights as it passes, the figure (Geist, tabular) sits inside. Expo ease, no overshoot.
- `ActivityWave`: one series as a glowing area above a baseline with a live head at the newest
  point, a second series mirrored below as bars on its own labelled scale; scanner reveal; hover
  tooltip.
- `reveal` (staggered entrance); `OrbitChart` in `components/curate/orbit-chart.tsx` (multi-segment
  ring on crisp halos, no blur). Curves are monotone cubic, so they never overshoot the data.
- Easing `cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `(0.2, 0.8, 0.2, 1)` for state changes,
  springs for indicators. All respect `prefers-reduced-motion`.

# Naming

## Verified and Community

A list's standing has two names. The words come from `components/curate/verified-badge.tsx` and
nowhere else; the rule lives in `components/curate/verified-rule.ts` (no React, so the landing page
uses it too; the hooks are in `registry-shared-verified.ts`), and every page applies it the same
way (dashboard, Browse, registry pages, the profile, the landing page).

- **Kleros Verified**: one of the chain's Kleros lists of lists, or a list registered on any of
  them. The lists of lists are the Light ones (`VERIFIED_LIST_OF_LISTS_ADDRESSES`, where new lists
  are submitted) and the older Classic ones (`FALLBACK_LIST_OF_LISTS_ADDRESSES`), all returned by
  `getListOfListsAddresses` in `config/list-of-lists.ts`; they count the same. A Kleros Verified
  list carries the approval **seal**, the Kleros icosahedron cut as a gem in the edge hues with a
  check on its front face. Its explanation names what the lists of lists' policies reject
  (offensive, malformed and obviously insecure lists) and claims no more: the seal is not a
  security review.
- **Community**: every list that is not Kleros Verified. Every Curate list, Verified
  or not, is launched by anyone and kept by its own submitters and challengers; that registration
  is the only difference. A plain name, never a warning (no amber, no shield, no "unverified").
- "Discovery", "unverified" and "not verified" are not used. Old `?trust=unverified` links open
  Community. A list whose chain has not answered yet is neither: it shows no mark and counts in
  neither figure.
- A list's own page shows the pill or the Community chip (`TrustTag`, explained on hover and
  focus), and nothing while the standing is unknown. Rows, cards and tables put a 16px seal after
  a verified list's name, small feeds and rails 12 to 14px, with no tooltip; Community rows carry
  no mark. On a list of lists, the entries it vouches for carry the seal too. Browse picks Kleros
  Verified (the default), Community or All above its toolbar, with the choice's meaning in one
  line beside it.
- Kleros Verified is shown as a count with its lists, each leading to its list (the dashboard's
  tiles, newest to earn the badge first with the month of its earliest registration on any of the
  chain's lists of lists, the lists of lists themselves last as "List of lists"; Browse's logos
  with their names on hover and focus; the landing page's, most open requests first), never as a
  share of every list: most lists are Community lists and always will be.

# Data rules

- "In court" counts disputes open right now (queried directly); "Open requests" counts unresolved
  requests. Per-list status counters drift on some deployments and are not trusted for these.
- "Open for verification" lists unresolved requests nobody has challenged whose challenge window is
  still open: submission time plus the list's `challengePeriodDuration`, read from its contract (the
  indexer has no challenge period). When the windows cannot be read, no window is claimed.
- One 30-day window for every "30 days" figure: the chart's 30 UTC days (today so far included,
  drawn dashed). Active curators and their requests and challenges use the same start. Requests
  count on the day they were made; challenges on the day they were made (Light `challengeTime`,
  Classic: the creation of the request's second round, which the challenge opens; Stake: the
  challenge), whenever the request was made. The landing page reads the same load.
- Disputes, rulings and bounties won are all time, never windowed: the rulings ledger pages through
  every resolved dispute, and a figure reads "n+" if it stops at its page cap. A bounty is what a
  challenger the court ruled for takes on top of their own deposit back: the requester's base
  deposit (Light and Classic) or the entry's stake (Stake Curate). Amounts stay per coin, never
  added across coins.
- A count is never the length of a capped list: it comes from its own query, and reads "n+" when
  that query hits its cap.
- "Entries" is every entry a list holds, the figure its registry page shows (Light: settled entries
  plus those with an open request).
- Stake Curate has no requests; its listed count is never shown as "open requests". Its status
  counters drift (some go negative): the total is their raw sum and "listed" is submitted +
  disputed; the registry page counts its entries directly when it can.
- **"All chains" means Ethereum and Gnosis**, on the dashboard and on Browse alike (no `chain`
  parameter). Sepolia is a test network: listed apart in the chain menu under a hairline with a
  "testnet" tag, picked on its own, never part of "All chains". The word "Mainnets" is not used.
- List creation time is the factory's `NewGTCR` block time (cached), not the first request.

# Do's and Don'ts

- Do lead with a number or a visual; do label every drawing with its measure and window.
- Do show deposits as total and breakdown in the chain's currency, and say when they come back.
- Don't stack panels inside panels; separate with space and hairlines.
- Don't use grids as backgrounds, emoji, exclamation marks, hype words, thin editorial type,
  decorative charts, or icon-in-a-colored-square tiles.
