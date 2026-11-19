---
version: alpha
name: CurateVision
description: Design system for CurateVision, a modern front end for Kleros Curate lists. v2, built on roobinium's glow stage (the YMax dashboard), 2026-10-19; round 2 (full bleed, the "Lit edge" controls) the same day.
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
`components/layout/theme-menu.tsx`); only System carries a hint ("Matches your device"), as the
others are named by their label and icon (`THEME_MODES` in `contexts/theme-context.tsx`).

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
- **Footer.** The app bar carries no guide link: the footer's does, and it reads "Guide & Skills",
  since the guide also holds the skill for agent builders (an explainer may link it in context).

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
| edge 1 / 2 / 3 (the lit edge) | `#2A63F0` / `#00A0DC` / `#8A4DFF` | `#7AA7FF` / `#45D4FF` / `#9B7BFF` | `#C084FF` / `#27CDFE` / `#6CC5FF` |
| cta top / bottom (primary glass) | `#1D2742` / `#0B1220` | `#15264F` / `#0A1226` | `#2C1266` / `#150437` |
| cta-ink (primary label) | `#FFFFFF` | `#F4F6FB` | `#EAF4FF` |
| recess (tracks) | ink 5.5% | black 32% | black 30% |
| popover (glass menus) | white 92% | `#0E1320` 90% | `#1E0A42` 90% |

`primary-on-soft` (primary mixed 70% with text) is the text color on `primary-soft` fills and
featured tints. The viz set passes the categorical checks (lightness band, chroma, CVD and normal
separation, 3:1 on the surface) in each theme; lists take the hues in rank order, "other" is
`text-faint`.

**The viz set keys chart series, and nothing else.** A drawing with one series takes `viz-1` or
`viz-2`; `viz-3` and `viz-4` exist for a chart with three or four real categories and are never
borrowed for a single series, for a diagram or for chrome. Round 3 found three drawings that had
borrowed `viz-3`, a pastel purple, for exactly that: a money band, a share bar and the first swatch
of a two-colour tally. Where a quantity needs a hue of its own — money is a quantity, not a state,
so the status roles are wrong for it — it takes `viz-2`.

Chain **marks** carry each chain's own brand hue on a tinted plate (`components/chain-logo.tsx`,
where the contrast work is done); the viz set does not key chains.

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
- `--shadow-card` (the theme's `shadow`) is always one valid `<shadow>`: it ends comma-separated
  box-shadow lists (a panel's top highlight, the live dispute's edge, the launch page's chosen
  card). A theme with no card shadow sets the no-op `0 0 #0000`, never `none`, which would void the
  whole list (it did in Dark and Kleros until round 5).
- Rows: 56px table rows. A hovered row lights its leading edge and its open chevron in `primary`,
  the accent every link and focus ring already carries, never a hue of its own. Entry cards lay out
  from a 260px minimum (four across at 1440) for text fields, and 272px when the page's entries
  have pictures (four across at 1440 and at 1280, as on the base), whose cover fills the width. A
  hidden ("potentially offensive") entry's card is veiled down to its footer, with the notice
  centred in it, never an empty band over an empty body. A hovered card keeps the house lit edge
  (`edge-1/2/3`) and lights its chevron in `primary`. Chips are pills.
- Bullets in a box are one glyph everywhere, the factory Previews included: the check
  (`CurateIcon name="check"`), never a dot, a dash or a minus, whatever the line says.
- A figure never parts from its unit across a line break, nor a sum of two coins from itself ("4.5
  sDAI + 7.2 xDAI", "under 2 MB"): composed sentences join them with non-breaking spaces.

## Controls: "Lit edge" (round 2)

Light lives on the edges, never in a flat fill. Three directions were compared side by side (the
explorations, mock-ups and taste interview stay in the
[CurateVision repo](https://github.com/fortuvp/curatevision/tree/master/docs/design)); this is the
one built. The helpers live in
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

## Addresses (round 5)

- **A person is never a contract, and a contract is never a person.** A person's address (a
  submitter, a challenger, a juror, a list's governor) is a `CuratorAddress`
  (`components/curate/chrome-address.tsx`): Geist Mono, cut 6…4, it opens that address's Curate
  profile, with no arrow, and a copy button beside it that keeps its 24px at rest so hover never
  shifts the row. Standard and Stake draw it the same way (`AddressLink` re-exports it). A contract
  (a list, an arbitrator) opens the chain's explorer with its ↗ and a copy button: `ChromeAddress`,
  or `ExplorerAddressLink` on an entry page. A contract's Curate profile would be empty.
- A list's own address in its header opens the list on the explorer. Its ↗ shows at rest, because
  alone in the identity row it has to read as a link; hover and keyboard focus brighten the address
  to `text` and the arrow to `primary`. The footer carries no separate "Contract" link.
- An explorer link says where it goes to a screen reader: hidden text around the visible address
  ("List contract 0x66260c…4c59f2 on the explorer (opens in a new tab)"), so the accessible name
  still contains what is seen. A copy-on-click identifier (an entry's item ID) is named by its
  visible short value first, then the action ("0x0100cc…2b6263, copy item ID"); the full value is
  the title, and the copy report is a live region beside the control, never inside its name.
- In a Parameters drawer the Governor is a person (`CuratorAddress`) and the Arbitrator a contract
  (an explorer link with ↗), both cut 6…4. A contract link followed by more facts
  (" · xDai Curation · 5 jurors") breaks only at the dots: each fact is its own inline box.
- Courts are named by name ("xDai Curation (Hidden Voting) · 3 jurors"), read from the chain's
  Kleros Display indexer and only for the chain's Kleros arbitrator; the number ("Court 19") shows
  only while the name loads or if it cannot be read. In a sentence, `courtPhrase` builds it: "the
  Kleros xDai Curation court (Hidden Voting)".
- A profile reaches the explorer through one cluster of equal 28px round controls beside the
  address: copy (`CopyValue variant="round"`), then one chain plate per chain the address acted on,
  each opening that chain's explorer, named in its tooltip. Never named pills of different lengths.
  An arrow badge on hover or focus says the link leaves the app (touch always shows it). With no
  actions the plates are Ethereum and Gnosis; Sepolia only when the address acted there, with a
  dashed ring.

## Drop zones and upload rows

- A file held over a drop zone lights its 1px edge with the conic `edge-1/2/3` and an `edge-2` halo
  around an opaque fill (the zone's raised tint with 6% `primary`, laid on `surface`): the raised
  tint alone is translucent in Dark and Kleros and let the conic wash through the zone. A box that
  is not a well shows an opaque veil inside its edge carrying only the message ("Drop to attach",
  or the blocker in the gate's own words, "Connect wallet to upload the logo"), so the box's own
  text never shows through.
- Upload rows (both factories, the governor's MetaEvidence field) name their action group with
  `data-upload-actions`, never `:last-child` (the hidden file input comes after it); on phones that
  group takes a line of its own. A gate is said once: when its own control (Connect wallet, Sign
  in, Switch to …) is in the row, no gate line is drawn under it (the words stay as a visually
  hidden status, so a gate that moves on is announced), and a refused drag says the same words.

## Dialogs that edit a list

- A dialog never grows past the window: a column capped at the window's height (`100dvh` less the
  layer's gutters), hung from a fixed top so switching sections only moves its bottom edge. The
  head stays pinned (the title, a "?" with what the dialog does, the close button, what stops a
  save with its fix, such as "Switch to Gnosis", and the sections); only the body scrolls. On phones
  it is a bottom sheet of fixed height (92dvh). The section control keeps its own width.
- The governor's dialog (`pages/address/governance.tsx`) has four sections in a small
  SegmentedControl: Court, Deposits (Stake Curate: Stake), Timing & appeals, Advanced. A closed
  section is hidden, never unmounted, so typed values and an armed governor transfer survive a look
  elsewhere; a newly opened one starts at the top of the body.
- What a parameter means sits behind a "?" beside its label (the shared Tooltip; under the label on
  a touch screen), in the factories' own words. Only what cannot be undone stays in view under a
  field (the governor transfer), with the figures that confirm what will be signed ("3 days 12
  hours (302,400 s)", "Stored as 10,000 basis points") and money ("Fee per juror").
- A control that cannot be pressed stays focusable with `aria-disabled` and says why in the shared
  Tooltip, never in a native `title`.
- **Update list parameters.** A list's governor, once their wallet is connected, sees this
  secondary block button (layers icon) under the list's main action, on both list kinds and
  whatever chain the wallet is on (`components/curate/list-governance.tsx`). Whether the wallet
  governs is checked against the governor the page reads through the list's own chain. It opens
  the profile's dialog, which offers the switch to the list's chain before anything is signed.
  Nothing is drawn while the governor or the list data the dialog reads with is loading, so it
  never appears and then vanishes; everyone else sees nothing, and it goes as soon as a read names
  another governor. The profile's governed rows use the same label.

# Motion kit (`src/components/curate/motion`)

- `Odometer`: digits roll on their own columns, then settle into plain text.
- `AnimatedNumber`: ease-out count-up.
- `RingGauge`: a 270° conic-gradient arc with the gap at the bottom; only the head glows, a crown
  of ticks lights as it passes, the figure (Geist, tabular) sits inside. Expo ease, no overshoot.
- `ActivityWave`: one series as a glowing area above a baseline with a live head at the newest
  point, a second series mirrored below as bars on its own labelled scale; scanner reveal; hover
  tooltip.
- `reveal` (staggered entrance). Curves are monotone cubic, so they never overshoot the data.
- **`LaneBar` is the one bar** (`components/curate/lane-bar.tsx`), lifted from the base's list
  lifecycle: a 10px solid run with round caps in a flat hue (`status-window` by default), with no
  track, no gradient and no glow. Several runs sit 4px apart, each at least 10px. It draws once,
  left to right, at a constant speed per full width (`laneDuration`), so two bars on a page stay in
  step; one edge reveals every run, by transforms only (a mask sliding in while the runs slide
  back), so the optional bloom head that rides the leading cap can never leave it. Nothing paints
  before it is armed; reduced motion and print show the final state; forced colours draw it in
  `CanvasText` (a run drawn transparent, an empty stretch of lane, stays empty). It is used for the
  launch page's Open to challenge lane, the jury's tally and the Stake card's challenger share, and nowhere is a bar reinvented. The factory Previews' money
  bars, Marino's, keep their hatch for the arbitration part but use the flat accent, never the
  aurora (which read pastel on Light and purple on Kleros). The bar is an LED row (round 7: the
  owner picked it from the four looks round 6 put on trial): lit 7px segments 3px apart with a
  soft glow in the run's own hue; where the runs are small whole counts (a jury's votes) each unit
  is its own lit pill. A bar of several hues glows in a neutral light, never one side's.
- **The launch drawing** (`pages/launch-list/deposit-fate.tsx`) is the base lifecycle's lanes
  without its steps, durations or axis break. Lane 1, Open to challenge, is a `LaneBar` with its
  bloom head: a Standard bar stops part-way across (0.38 of the lane, not a measurement), a Stake
  bar runs the full width. Lane 2, the money, is a 2px `muted` hairline from a 7px dot to a 9px
  `registered` node with a 3.5px 22% halo, set under the bar's end cap and named under it by the
  event that releases the money ("Registered" / "Withdrawn"); the coin follows the lane's name in
  its head row ("Deposit locked · in xDAI", "Stake locked · in any ERC-20"). On Standard, lane 1
  goes on as the base's did: at its far end a dashed capsule the bar's thickness
  (`status-window-soft` fill, 1.25px dashed `status-window` outline), labelled "Removal request",
  for the window a removal request opens, only if someone makes one; it fades in after the bar has
  drawn. Lane 2 runs 130ms behind the bar at the bar's speed, so the node lands as its line reaches
  it. The drawing is one image to assistive technology: its aria-label says it is ordered by event,
  not to scale, and names the lanes, the removal band and the coin.
- A live dispute's panel carries a 10px haloed `contested` dot that pulses on the 2.4s curve, under
  an `ONGOING DISPUTE` label (12px, weight 600, `text`), in a panel lit in the contested role:
  border at 45%, a 2px `contested` top lip, a 3px soft halo and an amber light pooled from the
  top-left. It is the one pulsing thing in the app, it marks a state that is genuinely running, and
  reduced motion parks it as a static halo. On phones (720px and below) its actions stack full
  width.
- Every countdown drains from the right: the time left is the bright run from the track's left
  end, the time used faint behind it, and a dot marks the end being eaten (EntryStatus's track; the
  dispute period band uses the same in `contested`; the dashboard's rails carry a lit bead there,
  which goes out at zero). Nothing fills from the left as time passes.
- **The jury tally** (`components/curate/dispute-jury.tsx`) is a `LaneBar` and leads its round.
  The submitter's run in `viz-1` and the challenger's in `viz-2` each start from their own end. A
  refusal (or any other choice) is a neutral run beside the leading side's run, and the seats with
  no revealed vote keep their share as empty lane towards the trailing side, so a side at 0 never
  has ink at its end; with no side leading, the neutral run sits in the middle with the empty seats
  on either side. What lies between the sides is captioned under the middle of that stretch, kept
  inside the bar ("1 not cast", "2 still to reveal", "1 refused to rule", "Tied"), never centred
  across the whole bar. Both sides' counts stand at the bar's ends, even at 0, the leading side's
  in `text`; no rule above it. A juror whose vote is public is a filled 8px dot in their side's
  hue; a vote not public yet (committed or not cast) is a hollow 8px ring in `faint`, like the empty
  seat in the bar, never a side's hue or a status colour (`status-window` is the same blue as
  `viz-1`). The jury's pill says "The jury · 3 seats" ("2 of 3 seats drawn" only while the court
  is still drawing); a lone round has no head of its own, and a round among several reads "Round 3
  · 15 seats".
- **The dispute period band** is each step's name and dates, with no explaining sentence: the
  current step adds only its figures ("2 of 3 committed"), an appeal that cannot be made says
  "Cannot be appealed", and a final ruling reads "Final". It stacks at 900px and below, so a step's
  date is never split.
- Easing `cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `(0.2, 0.8, 0.2, 1)` for state changes,
  springs for indicators. All respect `prefers-reduced-motion`.

# Naming

## List, not registry (round 11)

The app says "list" for what the contracts and other tools call a registry or TCR: in every
heading, label, button, empty state, document title and meta description. The guide's glossary is
the one place the other word appears, to say it means the same thing. Code keeps its names
(`registry`, `RegistryLogo`, the indexer's `Registry` entity), and so does the agent skill, which
works on the contracts. A list the indexer has no title for is "List 0x12ab…cdef" (Stake: "Stake
list 0x12ab…cdef").

## Verified and Community

A list's standing has two names. The words come from `components/curate/verified-badge.tsx` and
nowhere else; the rule lives in `components/curate/verified-rule.ts` (no React, so the landing page
uses it too; the hooks are in `registry-shared-verified.ts`), and every page applies it the same
way (dashboard, Browse, registry pages, the profile, the landing page).

- **Kleros Verified**: the chain's Kleros list of lists, or a list on it. The list of lists is the
  chain's Standard one (`VERIFIED_LIST_OF_LISTS_ADDRESSES` in `config/list-of-lists.ts`, where new
  lists are submitted). A list is on it while its entry is Registered, or Registered with a removal
  request still open (it stays until that request is executed); the entry's "Address" field alone
  says which list it is (`listOfListsEntryAddress`), never another field or the file name. The
  old Classic lists of lists grant nothing (`RETIRED_LIST_OF_LISTS_ADDRESSES`,
  `replacedListOfLists`): like every Classic list they show the retired page, which points to the
  current one. A Kleros Verified list carries the approval **seal**, the Kleros icosahedron cut
  as a gem in the edge hues with a check on its front face. Its explanation names what the list
  of lists' policy rejects (offensive, malformed and obviously insecure lists) and claims no more:
  the seal is not a security review.
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
  line beside it. Its figures above are three boxes in a row (round 8): "Kleros Verified lists"
  with its count and logos on the lit rim, Community lists on a lit edge of neutral silver light
  (round 9: Kleros's own blue, violet and amber stay the Verified box's), then the entries and
  open requests.
- Kleros Verified is shown as a count with its lists, each leading to its list (the dashboard's
  tiles, newest to earn the badge first with the month of its earliest registration on its chain's
  list of lists, the lists of lists themselves last as "List of lists"; Browse's logos with their
  names on hover and focus; the landing page's, most open requests first), never as a share of
  every list: most lists are Community lists and always will be.

# Data rules

- "In court" counts disputes open right now (queried directly); "Open requests" counts unresolved
  requests. Per-list status counters drift on some deployments and are not trusted for these.
- "Open for verification" lists unresolved requests nobody has challenged whose challenge window is
  still open: submission time plus the list's `challengePeriodDuration`, read from its contract (the
  indexer has no challenge period). When the windows cannot be read, no window is claimed.
- One 30-day window for every "30 days" figure: the chart's 30 UTC days (today so far included,
  drawn dashed). Active curators and their requests and challenges use the same start. Requests
  count on the day they were made; challenges on the day they were made (Standard `challengeTime`;
  Stake: the challenge), whenever the request was made. The landing page reads the same load.
- Disputes, rulings and bounties won are all time, never windowed: the rulings ledger pages through
  every resolved dispute, and a figure reads "n+" if it stops at its page cap. A bounty is what a
  challenger the court ruled for takes on top of their own deposit back: the requester's base
  deposit (Standard) or the entry's stake (Stake Curate). Amounts stay per coin, never
  added across coins.
- **Dollars lead a coin figure where a price can be read, and are never a total.** Amounts stay
  per coin in every unit, dollars included: nothing on the site adds across coins, because a total
  would merge a one-hour feed with a 24-hour one into a number whose age it could not state. Where
  a Chainlink feed on the coin's own chain answers, the dollars are the figure, at the figure's own
  size and marked `≈` (smaller, muted; "about" for a screen reader), and the exact coin amount sits
  under them at body size, muted (round 5: "put the dollars first, smaller the crypto"). When no
  current price can be read (no feed, an answer past its heartbeat, a testnet), nothing
  dollar-shaped is drawn, no "$—", no error line, no placeholder: the coin amount is the figure. The
  money figures wait at most 1.5s for the first price read, as skeletons, so the lead never swaps
  from coin to dollars under the reader; a later answer fades in. The feed and the age of its
  answer are in the tooltip the figure already carries. The one rule lives in
  `pages/dashboard/board-rows.tsx` (`UsdLead`, `CoinAmount`, `usdFormatFor`). Per coin, only the
  collateral behind the requests open for verification carries dollars; the bounties and what has
  passed through Curate are totals across coins (below). Never a figure somebody is about to
  sign for (an entry page, a launch or stake deposit, a board or ruling row): there the coin amount
  is the obligation. A token that never answered a symbol is unitised by its shortened contract in
  Geist Mono, never left bare. The prices are read on chain in their own query, never inside the
  saved load, which is repainted up to a day later.
- **Two totals across coins: what has passed through Curate, and the bounties** (rounds 14 to 16,
  owner: "remove the reference to crypto at all in the landing", "calculate always at today's
  price", "add the appeals costs and challenge deposits … it passed from our contracts but not
  permanent", "smashed also somewhere in the dashboard"). `pages/dashboard/transit.ts` adds every
  amount paid in to a list, all time: both sides of every round of every request (Standard and
  Classic: the requester's and the challenger's deposits, then appeal funding), and on Stake lists
  the stakes, challenge stakes and appeal funding (the court fee a Stake challenger sends is not
  indexed). It is valued at today's on-chain prices, the same feeds as the figures above, in its
  own query, never in the saved load; an amount with no current price fails the read, and nothing
  is drawn. It is shown as "Passed through Curate" beside Entries in the dashboard's first box, at
  the same size, and on the landing page. The bounties won are the other total, on both pages
  (round 16, the Self-sustaining panel below). Every other money figure keeps the per-coin rule
  above.
- The all-time ledger pages the **retired Classic lists'** resolved disputes too (2020-2022): they
  are the protocol's history, so they count in the bounties (counts and amounts) and in the entries
  ever curated, where the first ring's disputed requests count them too (round 4: "when counting
  the bounties and historically the all time verified items… only for this"). They are never a
  row, a card or a link — a Classic list has no page in this app — so the query reads no list
  address for them and the feed filters them out (`scopedRulings`). The share of disputes that went
  to the challenger, and the dispute count it states, are the Standard and Stake rulings only, the
  same count as the Disputes panel's, so "show more" can always reach it; the self-sustaining
  panel states no Classic line (round 7). A reading of
  that share ("when challenges happen, they are often right", round 9's words) is claimed only on
  at least 30 rulings. Two figures stay
  Standard and Stake only: a curator's own bounties won, which has to match their profile page,
  and the Kleros Verified count, whose tiles are links.
  Classic's share is read live from the same indexer (it still holds `Registry` and `Request`):
  retiring the interface de-indexed nothing, so no snapshot or hardcoded number is involved.
- A count is never the length of a capped list: it comes from its own query, and reads "n+" when
  that query hits its cap.
- "Entries" is every entry a list holds, the figure its registry page shows (Standard: settled entries
  plus those with an open request). Two scopes, and the page says which: the dashboard's live strip
  counts the Standard and Stake lists it can show, beside a Registries count of those same lists;
  the self-sustaining panel's denominator is every entry ever curated, the retired Classic lists'
  included, and the panel names that inclusion in one line. A Classic entry total that came back a
  full page is a lower bound, so the share built on it is left out rather than drawn short.
- Stake Curate has no requests; its listed count is never shown as "open requests". Its status
  counters drift (some go negative): the total is their raw sum and "listed" is submitted +
  disputed; the registry page counts its entries directly when it can.
- **"All chains" means Ethereum and Gnosis**, on the dashboard and on Browse alike (no `chain`
  parameter). Sepolia is a test network: listed apart in the chain menu under a hairline with a
  "testnet" tag, picked on its own, never part of "All chains". The word "Mainnets" is not used.
- List creation time is the factory's `NewGTCR` block time (cached), not the first request.
- **Juror justifications** come from Kleros Court's public store (kleros/court-functions
  `get-justifications`, the read court.kleros.io makes; `REACT_APP_COURT_FUNCTIONS_URL`, default
  `https://kleros-api.netlify.app`). They are read only for disputes Kleros arbitrates and shown
  only once the chain shows that juror's vote revealed, as a quote under the juror's row, clamped
  to three lines with "Read all" only when the clamp hides text. A failed read shows nothing.
- **Juror on Curate** (the profile badge) counts the seats (Kleros Display draws, one per vote
  slot) in disputes whose arbitrable is a Curate list: Standard, Stake and the retired Classic
  lists, the same population as the dashboard's dispute ledger, never a court filter; the tooltip
  says Classic is included. Votes come from the court contract (`getVote`, the `voted` flag only,
  never the choice). A seat in the latest round of a dispute still collecting votes is "still
  voting", never missed. It is a record, not a goal: the seats, the disputes drawn in and the votes,
  as figures, with no target. Its line names the role ("Drawn in 181 disputes"), so it is never read
  as the profile's own Disputes figure (disputes the address was a party to), and its tooltip is
  one sentence ("Seats and votes as a Kleros juror in Curate disputes, Classic lists included."). A
  chain that did not answer makes the figure "n+" and is named; nothing read at all is
  "unavailable", never 0.
- **The share card** (`public/og-image.png`, 1200×630, the og:image and twitter:image of
  `index.html` and `landing/index.html`) is a headless-Chrome screenshot of
  `scripts/og-image.html` (the command is in its header): since round 13 the dashboard's title
  ("Obtain your verification, / or earn by keeping lists clean.", the second clause in the accent)
  and its lede, on the dark stage with the aurora and the Curate mark, no grid or dot pattern.
  When the title changes, the card is rendered again and both `og:image:alt` strings change with
  it. The landing page carries the same title since round 14.
- **The landing page** (rounds 14 and 15) carries the dashboard's title, and no word or mark of a
  coin or a chain: no ETH, xDAI or sDAI, no Ethereum or Gnosis, no "on-chain", no chain logos on the
  Kleros Verified tiles, and no chart. Beside the copy, one card with two figures in dollars, all
  time, at today's prices (`src/landing/money.ts`): **Bounties won**, by challengers (every winning
  ruling that carried an amount, the Classic lists included), and **Passed through Curate**
  (deposits, challenges and appeals, as above), each with its count under it ("696 bounties",
  "33,667 requests") and one line on the prices; compact with three significant figures ("$2.73M"),
  the exact dollars in the title. The Activity band below keeps its four figures over 30 days,
  spread across the band's width. `public/landing/data.js` is a full read of
  `window.CURATE_LANDING_LIVE`, taken only from a load where every chain answered; while it shows,
  the money figures say "to" its day and "at prices of" it.

# Pages (round 5)

## Dashboard

- **Passed through Curate** (round 15) sits beside Entries in the first box, at the hero size: the
  two big figures side by side, the three small ones under them; stacked on a phone. Its tooltip
  gives the whole dollars and what they count.
- **The title** (round 11) names both ways in, one clause to a line, the second in `primary`:
  "Obtain your verification, / or earn by keeping lists clean." It is a sentence, not a slogan, so
  it is set at clamp(38px, 3.4vw + 14px, 64px) rather than `--fs-hero`, each clause balanced on a
  phone. The lede under it, at most 54ch and balanced: "Curate verifies anything, at scale. Built
  to let good actors win: they get verified, or they get the bounty if they spot wrong entries."
- **Open for verification** is not drawn at all when there is no bounty up for grabs (round 10).
  It sits under Happening now with no box (round 6), centred on the page:
  under its title, two large figures side by side, parted by a hairline, the count open now and
  the bounties, dollars first with the coin smaller under them, labelled "Bounties up for grabs" in
  the accent. Under the pair, labelled "Lists with bounties up for grabs" (round 7), the lists
  holding those requests as tiles of one width in a centred row (raised glass, 14px radius): the
  list's logo and name over its count of open requests, a link to them; past the top four, the
  rest as one tile. With nothing open the count says how many requests only wait to be executed,
  and the Stake lists that stay open take the tiles, or one link to them.
- **Whole rows only.** A board column never cuts a card and never scrolls inside the page. The two
  columns share a cap snapped to the submissions' whole rows, the one nearest 760px (776px, six
  rows, on / at 1440). The submissions draw the rows that fit whole, counted over the chrome they
  finally draw under them ("+n more", or "All n by list" when every loaded row fits), and count
  again when their room or rows change size; the rulings beside them draw only whole rows too.
  Below 900px the submissions show their first 6 rows.
- **Expanding lifts the cap.** Once the reader expands either column the page grows. The other
  column fills the new height with whole rows while it has rows, and once it has none it keeps its
  own height and rides beside the long column (sticky under the app bar), never a hollow box.
- **Nothing open, no empty box.** With nothing open and nothing failed, the submissions column is
  not drawn and the Disputes panel takes the width, two rows to a line, its first page even so no
  cell is blank; an odd last row spans the line. Phones stack.
- Tooltip triggers are their own text's width, so a bubble opens over what it explains.
- **The chart** (round 7) shows every mainnet: the dashboard's chain switch is hidden for now and
  the page is always "All chains", unnamed. Its switch is the range, `30D · 6M · 1Y · 3Y` (round
  8: three years is the longest, which starts after a company wallet's bulk submissions of 2023
  without singling out any address): 30D per day from the page's own load; 6M and 1Y per week, 3Y
  per month, from the whole history (Standard requests and challenges, Stake submissions and challenges; Classic left out),
  read in pages after the page's own load, three at a time, and retried as a whole if a chain
  fails, never drawn with a hole. The current bucket is drawn dashed. It opens on 6M (round 16:
  "the standard timeframe should be 6m"), so the page's first chart waits for the history read.
- **Top curators follow the chart's range** (round 8: the date filter is for both), ranked by
  requests plus challenges over it, with their bounties won all time; five of them, filling the
  column beside a 240px chart. The chart's head is one row right above it: what it counts and its
  legend on the left, the range switch on the right (round 9), under the figures.
- **Self-sustaining mechanism** (rounds 16 and 17): no box ("in a box is cringe"), like the Open
  for verification band: the title centred, then one symmetric row, a ring, the bounties, a ring,
  parted by hairlines, and the sentence centred under it at a 68ch measure. On a phone the bounties
  lead and the two rings share the line under them, a hairline between. Each ring carries a tooltip
  built from the same counts as the sentence. No line names the Classic lists (round 7). **Bounties
  won** is one figure in dollars at today's prices, compact ("$73.5K"), with no count of bounties;
  the line under it names what it adds up ("In ETH, xDAI and sDAI on Ethereum and Gnosis, at
  today's prices") and its tooltip gives each coin's amount and dollars. Where any coin has no
  current price, or a token's decimals never answered, there is no honest total: the coins' own
  amounts are listed on one line instead.
- Top curators sit beside the chart (round 7), in the same panel behind a hairline, 320px wide
  (260px below 1100px), each with an LED bar of their activity against the top curator's
  (requests in the accent, challenges in `contested`) and their counts on one line; below 900px
  they stack under the chart. Most active takes the page's width.

## Entry page

- **The hero is two independent columns.** Left, one flow: eyebrow, title and status, the facts
  strip, then Full details directly under it. Right, 360px: the one clock (never boxed), the action
  under it (amount, sentence, button), drawn bare as part of the featured panel, not as a card in
  it. In court there is no action there: the case panel holds the actions. The thing to do is on
  the first screen at 1440x900 in every state. Nothing on the right of an entry floats (round 7):
  the hero's right column and the history's rail scroll with the page. The action card never repeats the ruling or the case while the case
  panel or the court record states them, and a settled clock line says how the case ended, not
  which case ("decided by jurors"): the case is named once, in the court record.
- **The facts strip** (`components/curate/item-hero-facts.tsx`), shared by Standard and Stake:
  date, Bounty (only while a case is live, per coin), By, Challenged by, and the item ID, one
  copy-on-click control in Geist Mono that reports the copy in place without moving the row.
- **Pictures are not always present.** Exactly one is drawn once, on the left (round 8, on
  trial): it opens Full details as a portrait plate (220px wide, 260px tall, the picture contained
  on the quiet fill) with the field rows stacked beside it from 1180px, and above them, the
  column's full width, between 1001 and 1179px. Two or more (round 9) take the same place: the
  first as the portrait plate, the others as small 96px plates under it, as many to a row as fit,
  each opening full size. None: nothing is drawn or reserved. Where the hero stacks,
  a lone plate takes the column's full width, 168-240px tall, under the facts.
- **At 1000px and below** the columns dissolve into one order: identity, clock, facts, picture,
  full details, then the action under an inset hairline.
- **The action stays in reach.** A frosted bar carries the status and the one action
  (`components/curate/item-standard-action-bar.tsx`): on phones and wherever the hero stacks, a
  bottom bar with the action full width; wider, a slim bar floating 16px above the bottom edge, at
  most 680px, the status left and the action at its natural width right. It shows only while the
  card's own action (its button, or the case panel's action group, marked `data-entry-action`) is
  not at least half on screen, counting what sits under the sticky app bar as off screen; it stays
  away while the evidence composer is on screen when its action is "Add evidence", and, wide,
  until the reader has reached the hero's end, so it never floats over the hero's fields. At the
  end of the page it rides 12px above the footer at every width (a 64px reserve at the page's end
  gives the taller bottom bar its room), so the action is in reach even at the very end of a short
  page. Until the card has mounted it stays away. With no action, the wide bar is not drawn.
- **Only a bounty is drawn large** (round 9: "that huge only when it is earn"). Any other action
  (remove, resubmit, execute, fund an appeal) is its sentence and its button, which carries the
  amount; on Stake the amount sits in one muted line. A settled entry's date is a plain 24px
  figure, not a display size.
- **The challenge lead.** While an entry can be challenged, the card leads with one line, "Earn
  30 xDAI": the verb left of the amount at the same size (Urbanist), the amount in Geist with
  tabular figures, the coin small and muted, the line stepping down (56/44/36/30px) as the amount
  grows (`components/curate/item-bounty-figure.tsx`, both kinds). Under it about 150 characters
  (175 for Stake's two coins), two sentences: "Found something that breaks the policy? Challenge it
  and win the bounty. A {cost} deposit keeps challenges serious; if jurors agree, you get
  {total}." Stake's total is what `PermanentGTCR.rule()` pays, per coin and never summed. A
  native-coin amount that rounds to 0 at the precision shown is left out of the button, the phone
  bar and the sentence. A removal request's sentence opens from the defender's side. Jurors are
  named only where the arbitrator is Kleros; otherwise the copy says "the arbitrator".
- **The history spans the page.** A rail sits beside it only while it holds a panel (appeal
  funding; Stake's withdrawal); an empty rail takes no room. On Stake, the court record and the
  rail's first panel end level when their resting heights are within 64px; further apart (the jury
  open) each keeps its own height.
- The countdown ring's caption is the dial plus 80px wide, so each end's date and its UTC stay on
  one line; its footnote is centred on the dial. A settled entry's date block is top-aligned with
  the eyebrow.

## Launch page

- A launch card reads top to bottom: family and name, one "For …" eyebrow, the 28px verdict on the
  money, the two-lane drawing, two check-glyph lines, then a foot that holds the radio pill on both
  cards at all times. Choosing only adds the primary button beside the pill (on phones, on a line
  of its own), so on desktop choosing shifts nothing. Each element says the fate once: the verdict
  states it, the drawing names the events, the lines explain them. No figures and no minimums.

## Lists

- On phones (520px and below) the header's figure band is centred (round 10): the open requests,
  the stats in two centred columns with an odd last one across both, and the two gauges side by
  side, each over its caption.
- Two gauges sit at the right end of the figures row: the share registered (Standard) or listed
  (Stake) now, and "Challenges off the list", drawn on every list whose challenges were read. With
  none resolved it is an empty ring holding "—" (never "0%") and reads "No challenges yet", or
  "None resolved yet" when some are in court (a capped read says "None in the latest 1,000
  entries"). Once any challenge exists, a muted line under its figure reads "{kept} kept · {in
  court} in court". Wrapped onto a line of their own (laptop and tablet widths) the gauges spread
  across it, never hugging the left.
- Open requests come first, larger and in the window blue, and the block is gone at 0; Entries
  follows.
- **Status** is one dropdown on the toolbar's first line (round 6), "Status · All", one choice at
  a time: each status led by its dot, its count at the right; under a hairline, "Previously
  disputed", every entry that has been to court whatever its status now (Standard: any request
  disputed; Stake: any challenge), led by a multicolour LED (a conic of the four status hues) and
  carrying no count (round 7); an id-only read sizes the list under it. Sensitive entries show by
  default (round 7); the reader's "Hide sensitive content" choice is kept. On a
  Stake list "Listed" counts and filters every entry on the list (submitted + disputed, the
  header's and Browse's "Listed"); "Disputed now" is the part a challenge is running on, "Off the
  list" the rest. The toolbar is one line on desktop: search, status, the sensitive-content switch,
  sort, layout.
- Pagination's jump field is a page pill (pill radius, surface fill, inner hairline), as wide as
  the last page's chip and at least 32px, right of the last ellipsis.

## Curator profile

- **Section tabs.** An address with both actions and governed lists gets real tabs
  (`components/curate/section-tabs.tsx`), not a SegmentedControl: "Activity N | Governed lists
  N" in Urbanist at the section-title size (30px, 26px on phones), each count small and faint; the
  open tab in `text` over a 2px `primary` underline that slides on the thumb spring (none under
  reduced motion), the others `muted`; no track, a hairline under the row; ARIA tabs with
  Left/Right/Home/End. `?tab=governed` (Activity is the default and is never written); a tab is
  hidden, never unmounted. The Activity count is omitted when the list is cut at 120. The kind
  filter below stays the smaller SegmentedControl, with the layout control at its right end.
- **No table on the profile.** Its layouts are cards and rows; a stored "table" reads as rows.
- **A row leads with the entry, not the list**: up to two text identifiers in label order (the
  indexer keeps no column order); an address that is a list the registry index knows (a list of
  lists' entry, looked up on its own chain only) leads with that list's title, the short address
  after it in faint mono, shown whole or not at all; else the first identifier, an address short in
  mono with its network; else the first value that is not a picture. The list name, with its seal,
  is the second line; every identifying field is in the row's tooltip.
- **Medals** (round 10, `components/curate/curator-medal.tsx`): each badge is a medal cut in the
  Kleros Verified seal's language, a faceted gem of the primary glass tinted by the edge hues, a
  gradient rim, a top sheen and a soft edge-2 glow, its glyph cut in `cta-ink`. Each has its own
  outline and glyph: Librarian a hexagon and books (submissions), Sheriff a shield and a star
  (challenges), Maintainer an octagon and a broom (removal requests), Juror on Curate a round
  milled seal and the scales (seats in Curate disputes). Unearned, the medal is recessed glass
  with a faint glyph inside a progress ring in `status-window`. Earned, it carries its level on a
  19px pip at its lower right: the numeral in the figure face on the primary glass, lit rim, set
  in pixels so it reads the same at every size.
- **Levels** (round 12, `pages/address/levels.ts`): five per badge, earned from level 1. The
  owner fixed level 2 for two of them (Librarian at 5 submissions, Sheriff at 2 challenges); the
  rest of each ladder comes from the indexers' own counts (Standard lists on Ethereum and Gnosis,
  the court index's seats in Curate disputes, read 2026-11-19), so a level is about as hard on
  every badge: of those who did the thing once, about half or more reach level 2, a quarter to two
  fifths level 3, one in six level 4, one in twelve to twenty level 5.

  | Level | 1 | 2 | 3 | 4 | 5 |
  |---|---|---|---|---|---|
  | Librarian (submissions) | 1 | 5 | 25 | 100 | 500 |
  | Sheriff (challenges) | 1 | 2 | 5 | 20 | 50 |
  | Maintainer (removal requests) | 1 | 2 | 10 | 25 | 100 |
  | Juror on Curate (seats) | 1 | 5 | 10 | 25 | 100 |

- **Earned badges lead the profile**: under the address, each earned medal (44px) with its name
  and "Level N" under it, the count and the next level on hover and focus. On phones (520px and
  below) the medals stand alone with their pips, so four fit on one line beside the avatar; the
  names stay in the labels and the tooltips.
- **The Badges card** lists all four the same way: the medal with its level, the name with a
  "Level N" tag in the accent, what the next level asks for ("Level 3 at 25 submissions"), then
  an LED bar of the count against it and the figure ("23 / 25"); at the top level, "Top level ·
  500+ submissions", the count alone and a full bar; at level 0, "Not started". Its head counts
  how many are earned. The juror row is the same by seats, with the record under its bar (disputes
  drawn in, seats voted, still voting) and its tooltip on a dotted underline under the name, not a
  help icon, which pushed the tag under the name.
- On phones the Activity shows 8 actions to a page (20 elsewhere).
- **The chart's range** (round 13): the dashboard's switch, the same four options from one list
  (`RANGE_OPTIONS` in `pages/dashboard/view.ts`) and the same buckets: 30D by day, 6M and 1Y by
  week, 3Y by month, each ending in the bucket that holds now, with the dashboard's legend ("Per
  week · last year") over the series. It sits at the right of the chart's head and sets the chart
  only: the figures, the challenge record and the badges stay all-time. A profile opens on 3Y (a
  record, not a live feed), kept in `?range=` when another is picked. A range with no action
  keeps the chart's height and says so; a list cut inside the range starts at the bucket after
  the cut and names the dates it covers.
- **Activity search** (round 11): Browse's pill search between the kind filter and the layout
  control, 38px like their tracks; on its own line under them where the three do not fit, and
  always on a phone. It runs in the browser over the actions already read; every word must match,
  in the entry's name and identifying fields, the list's title and address, the entry ID, the
  status with its case number, the other party or the chain. `?q=` keeps it beside the filter; a
  new query starts again at page 1; Escape or the clear button empties it. The filter's counts
  count matches and the footer adds 'matching "…"'. With no match one quiet state offers Clear
  search (on a cut list it says the search reads the most recent actions only); with matches of
  another kind only, it says how many and offers Show all actions.
- **Quiet addresses.** An address with no action in scope gets no row of zeros and no boxed empty
  state. A juror's figures row leads with Juror on Curate (seats, disputes drawn in, voted, still
  voting above 0); a governor with no action gets no figures row, only identity and one muted line
  (the Governed lists heading carries the count). The muted line says there is no submission,
  removal or challenge in scope and names what could not be read. The eyebrow and the document
  title name the address's roles across all chains ("Curator · Juror", "Governor"), or "Address"
  with none, and wait as a skeleton until the profile, the governance scan and the jury read have
  settled, so nothing shows and then relayouts.
- **Governed lists as cards** (round 6): the profile's one Cards/Rows choice, shared with
  Activity, applies to the governed lists too. A card is Browse's shape: logo, name, seal and kind;
  chain and address; the court on its own lines; Entries large and the creation date at its foot;
  the governor's controls under them. Three across at 1440.
- **Governed rows.** Entries is the list's whole total, the same as the list header and Browse;
  the facts sit in fixed figure columns so they align down the list, and the court wraps to a second
  line rather than losing its end.

# Do's and Don'ts

- Do lead with a number or a visual; do label every drawing with its measure and window.
- Do show deposits as total and say when they come back. The breakdown — base deposit against
  arbitration — belongs in the dialog that signs the transaction, where the money is actually
  committed, not on the page behind it: on the card it crowded out the thing a reader came for
  (the bounty), and said twice what the button already says once.
- Don't stack panels inside panels; separate with space and hairlines.
- Don't use grids as backgrounds, emoji, exclamation marks, hype words, thin editorial type,
  decorative charts, or icon-in-a-colored-square tiles.
