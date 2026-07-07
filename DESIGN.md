---
version: 2.0
name: CATCHPASS-purple-system
description: A friendly, commerce-native mobile system built around a single confident Purple (#9333EA) on white. Rounded cards, pastel SNS badges, pill chips and a black map FAB give the app the energy of a local-deals service — informative, dense where it counts, never corporate. Pretendard carries every letter; state colors (green/red/yellow/blue) are loud but scoped to badges, banners and validation. Derived from the "[체험단] 디자인시스템" Figma library and the five reference screens (home, explore list, explore map, map sheet, store detail).

colors:
  primary: "#9333EA"
  primary-strong: "#7E22CE"
  primary-tint: "#F3E8FF"
  primary-tint-soft: "#FAF5FF"
  primary-on-dark: "#C084FC"
  ink: "#171717"
  body: "#171717"
  body-secondary: "#525252"
  body-muted: "#737373"
  body-disabled: "#A3A3A3"
  divider-soft: "#F5F5F5"
  hairline: "#E5E5E5"
  border-strong: "#D4D4D4"
  canvas: "#ffffff"
  canvas-soft: "#FAFAFA"
  surface-sunken: "#F5F5F5"
  surface-bk: "#171717"
  info: "#3B82F6"
  info-tint: "#EFF6FF"
  success: "#00BF40"
  success-strong: "#009632"
  success-tint: "#F2FFF6"
  error: "#FF4242"
  error-tint: "#FFFAFA"
  warning: "#EAB308"
  warning-tint: "#FEFCE8"
  sns-blog-bg: "#F2FFF6"
  sns-blog-text: "#009632"
  sns-insta-bg: "#FDF2F8"
  sns-insta-text: "#EC4899"
  sns-tiktok-bg: "#ECFEFF"
  sns-tiktok-text: "#0891B2"
  on-primary: "#ffffff"
  on-dark: "#ffffff"

typography:
  title-xl:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title-lg:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.02em
  headline:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.01em
  body-strong:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: -0.01em
  body:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.01em
  label:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.01em
  price:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  caption:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  caption-strong:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  badge:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: 0
  micro:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
  button-large:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -0.01em
  button-utility:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: 0
  nav-link:
    fontFamily: "Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 40px

components:
  top-app-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: 52px
    padding: 0 20px
  segment-title:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.title-lg}"
    inactiveTextColor: "{colors.body-disabled}"
  bottom-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body-muted}"
    activeTextColor: "{colors.primary}"
    typography: "{typography.nav-link}"
    height: 72px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 0 24px
  button-primary-active:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.body-disabled}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-utility}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    height: 44px
    padding: 0 16px
  button-text:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button-utility}"
  map-fab:
    backgroundColor: "{colors.surface-bk}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-utility}"
    rounded: "{rounded.pill}"
    height: 44px
    padding: 0 18px
  sns-badge:
    backgroundColor: "{colors.sns-blog-bg}"
    textColor: "{colors.sns-blog-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.xs}"
    padding: 4px 6px
  ticket-chip:
    backgroundColor: transparent
    textColor: "{colors.body-secondary}"
    typography: "{typography.caption-strong}"
  category-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    border: "1px solid {colors.hairline}"
    padding: 8px 14px
  category-chip-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    border: "1.5px solid {colors.ink}"
  keyword-chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.body-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  link-state-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.success-strong}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    border: "1px solid {colors.success}"
    padding: 2px 8px
  promo-banner:
    backgroundColor: "{colors.info}"
    textColor: "{colors.on-dark}"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    padding: 20px
  notice-banner:
    backgroundColor: "{colors.primary-tint-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.md}"
    padding: 12px 14px
  stat-strip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.hairline}"
    padding: 16px
  info-strip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    padding: 14px 16px
  experience-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    imageAspect: "4:3"
  experience-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    thumbnail: "96px square, {rounded.md}"
  radio-select-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    padding: 14px 16px
  radio-select-card-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    border: "1.5px solid {colors.primary}"
  radio-select-card-disabled:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body-disabled}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.divider-soft}"
  menu-highlight-row:
    backgroundColor: "{colors.primary-tint-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: 12px 14px
  step-timeline:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    markerColor: "{colors.primary}"
  map-marker-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.pill}"
    border: "1px solid {colors.border-strong}"
    padding: 6px 12px
  map-marker-pill-selected:
    backgroundColor: "{colors.primary-tint-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    border: "1.5px solid {colors.primary}"
  map-bottom-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    padding: 12px
    shadow: "0 8px 24px rgba(0,0,0,0.12)"
  bottom-sheet:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl} {rounded.xl} 0 0"
    shadow: "0 -8px 24px rgba(0,0,0,0.10)"
  cta-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.price}"
    height: 76px
    padding: 12px 20px
    border: "1px solid {colors.divider-soft} (top)"
  text-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    height: 48px
    padding: 0 14px
  search-input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 14px
  footer:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body-muted}"
    typography: "{typography.caption}"
    padding: 24px 20px
---

## Overview

CATCHPASS v2 is a **commerce-native local-deals interface built on one confident Purple**. Every screen is a white canvas populated by rounded cards, pastel SNS badges and pill chips; the single `{colors.primary}` (#9333EA) carries selection, progress, CTAs and the active nav tab. Where the previous system whispered, this one speaks at a friendly retail volume: money is always bold and near-black, remaining-slot counts ride a 🎫 ticket glyph, and playful copy ("걸어서 갈 수 있어요👀") keeps the discovery loop light.

Density is deliberately higher than a marketing site — this is a tool people scan. List rows pack a square thumbnail, three SNS badges, a store name, category·distance and a bold support amount into ~110px of height. Hierarchy comes from weight and tint, not from size explosions: titles top out at 20–22px, and the system leans on Pretendard's 600/700 weights plus gray-scale steps (`{colors.body-secondary}`, `{colors.body-muted}`) to layer information.

Chrome is minimal but visible: 1px `{colors.hairline}` borders define cards, a black pill FAB floats over the explore list, and the bottom nav is a flat white bar whose active tab simply turns purple. Depth appears only where a surface genuinely floats (map cards, bottom sheets).

**Key Characteristics:**
- Single Purple accent (`{colors.primary}` — #9333EA) for every interactive/selected element; black is chrome, never "clickable color".
- White canvas + 1px hairline-bordered rounded cards (`{rounded.md}`/`{rounded.lg}`) — no dark tiles, no parchment section rhythm.
- Pastel SNS badges (blog green / insta pink / tiktok cyan) are the signature identity mark on every campaign card.
- Money (`최대 ₩N 지원`) is always `{typography.price}` bold near-black; remaining slots always `🎫 N 남음`.
- Pretendard everywhere; weight ladder 400/500/600/700; sizes 11–22px only.
- Two button grammars: big purple rounded-rect CTA (`{rounded.md}`, 52px) and black pill map FAB.
- Category chips are icon+label pills; selection = black 1.5px border (not purple — purple is reserved for data selection like radio cards).
- Promo/marketing slots use `{colors.info}` blue as a scoped secondary voice, never for interaction.
- Screen furniture: top app bar with location selector (홈) or segment title 방문형/기자단 (탐색), bottom nav 홈/탐색/체험권/혜택/마이.

## Colors

> **Source:** "[체험단] 디자인시스템" Figma library (Color/* variables, 9-step scales for Purple·Gray·Blue·Green·Red·Yellow) + the five reference screens. Semantic roles below map 1:1 to the library's `Color/Bg|Text|Border|Icon` collections.

### Brand & Accent
- **Primary Purple** (`{colors.primary}` — #9333EA, Purple 60): The one interactive color. CTAs, selected radio cards, active bottom-nav tab, selected map marker border, step-timeline markers, highlighted menu names, stat emphasis. `Color/*/Interactive` in the library.
- **Purple Strong** (`{colors.primary-strong}` — #7E22CE, Purple 70): Pressed state of primary buttons and links.
- **Purple Tint** (`{colors.primary-tint}` — #F3E8FF, Purple 20) and **Purple Tint Soft** (`{colors.primary-tint-soft}` — #FAF5FF, Purple 10): `Interactive-subtle` backgrounds — notice banners, menu highlight rows, selected map marker fill.
- **Purple On Dark** (`{colors.primary-on-dark}` — #C084FC, Purple 50): Purple accents on the rare black surface (map FAB icon accents, dark toasts).

### Surface
- **Canvas** (`{colors.canvas}` — #FFFFFF): Default background of every screen and card. `Color/Bg/Primary`.
- **Canvas Soft** (`{colors.canvas-soft}` — #FAFAFA, Gray 10): Secondary background — disabled radio cards, footers, subtle zebra rows. `Color/Bg/Secondary`.
- **Sunken** (`{colors.surface-sunken}` — #F5F5F5, Gray 20): Search inputs, keyword chips, disabled buttons, skeleton blocks. `Color/Bg/Tertiary`/`Disabled`.
- **Black** (`{colors.surface-bk}` — #171717, Gray 90): The map FAB and (rarely) inverse toasts. `Color/Bg/BK`. Never a section background.
- **Info Blue** (`{colors.info}` — #3B82F6, Blue 60) + **Info Tint** (`{colors.info-tint}` — #EFF6FF): Promo/coupon banner surface — the only allowed non-purple saturated surface, scoped to marketing slots.

### Text
- **Ink** (`{colors.ink}` — #171717): Titles, store names, amounts, primary body. `Color/Text/Primary`.
- **Secondary** (`{colors.body-secondary}` — #525252): Sub copy, list meta. `Color/Text/Secondary`.
- **Muted** (`{colors.body-muted}` — #737373): Captions, placeholder-adjacent copy, inactive nav labels. `Color/Text/Tertiary`.
- **Disabled** (`{colors.body-disabled}` — #A3A3A3): Disabled labels, inactive segment title. `Color/Text/Disabled`.
- **State text**: success `{colors.success-strong}` #009632 · error `{colors.error}` #FF4242 · warning `{colors.warning}` #EAB308 · interactive `{colors.primary}`.

### SNS Badges (signature palette)
- **Blog** — bg `{colors.sns-blog-bg}` #F2FFF6 (Green 10), text `{colors.sns-blog-text}` #009632 (Green 70).
- **Instagram** — bg `{colors.sns-insta-bg}` #FDF2F8, text `{colors.sns-insta-text}` #EC4899 (pink; not in the 6 scales — bespoke badge color).
- **TikTok** — bg `{colors.sns-tiktok-bg}` #ECFEFF, text `{colors.sns-tiktok-text}` #0891B2 (cyan; bespoke badge color).
These three appear together on nearly every card; they are identity, not state — do not repurpose them.

### Hairlines & Borders
- **Hairline** (`{colors.hairline}` — #E5E5E5, Gray 30): Default card/chip/input border. `Color/Border/Default`.
- **Divider Soft** (`{colors.divider-soft}` — #F5F5F5): Section dividers and cta-bar top border. `Color/Border/Subtle`.
- **Border Strong** (`{colors.border-strong}` — #D4D4D4, Gray 40): Map marker pill borders, pressed chip borders. `Color/Border/Strong`.
- **State borders**: success #00BF40 (연동 완료 chip) · error #FF4242 · interactive #9333EA (selected cards/markers).

### Brand Gradient
**No gradients.** The blue promo banner is a flat `{colors.info}` fill (imagery inside the banner may carry its own art). Depth comes from tint steps within a hue (Purple 10→60), never from gradient fills.

## Typography

### Font Family
- **Everything**: `Pretendard, Pretendard Variable, -apple-system, system-ui, sans-serif` — the library ships Pretendard Regular/Medium/SemiBold/Bold. One family for display, body and UI; hierarchy is weight- and tint-driven.
- Numerals: use `font-variant-numeric: tabular-nums` on amounts, countdowns and stats so ₩ figures align.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.title-xl}` | 22px | 700 | 1.3 | -0.02em | Screen-level hero titles (rare) |
| `{typography.title-lg}` | 20px | 700 | 1.3 | -0.02em | Segment title (방문형/기자단), store name on detail |
| `{typography.title}` | 18px | 700 | 1.35 | -0.02em | Section headers ("어느 SNS로 체험할까요?", "걸어서 갈 수 있어요👀") |
| `{typography.headline}` | 16px | 700 | 1.4 | -0.01em | Banner headline, stat values, result count ("근처 체험 24개 발견!") |
| `{typography.body-strong}` | 15px | 600 | 1.45 | -0.01em | Store names in lists/cards, radio card labels |
| `{typography.body}` | 15px | 400 | 1.5 | -0.01em | Paragraphs (매장 소개), descriptions |
| `{typography.label}` | 14px | 500 | 1.4 | -0.01em | Chips, form labels, secondary emphasis |
| `{typography.price}` | 16px | 700 | 1.3 | -0.01em | `최대 ₩N 지원`, cta-bar amount (tabular-nums) |
| `{typography.caption}` | 13px | 400 | 1.4 | 0 | Meta rows (카테고리 · 거리), helper text |
| `{typography.caption-strong}` | 13px | 600 | 1.4 | 0 | 🎫 N 남음, info-strip values, notice banner |
| `{typography.badge}` | 12px | 600 | 1.0 | 0 | SNS badges, link-state chips |
| `{typography.micro}` | 11px | 500 | 1.3 | 0 | Grade suffix, timestamps, legal micro |
| `{typography.button-large}` | 16px | 700 | 1.0 | -0.01em | Primary CTA label ("체험권 발급받기") |
| `{typography.button-utility}` | 14px | 600 | 1.0 | 0 | FAB, secondary buttons, 더 둘러보기 |
| `{typography.nav-link}` | 11px | 500 | 1.0 | 0 | Bottom nav labels |

### Principles
- **Weight over size.** The ladder spans only 11→22px; emphasis is created with 600/700 weights and gray tints, not big display sizes. There is no 30px+ hero type in this system.
- **Money is loud.** Support amounts are always `{typography.price}` at 700 in `{colors.ink}` — never muted, never purple (purple marks *interaction*, black marks *value*).
- **-0.02em on titles only.** Pretendard reads slightly wide at 18px+; tighten titles, leave captions at 0.
- **500 exists.** Unlike the previous system, Medium (500) is a real rung — used for chips, labels and nav where 400 is too light and 600 too shouty.
- **Line-height ~1.4–1.5 body, 1.0 controls.** Buttons, badges and nav labels are single-line locked.

### Note on Font Substitutes
Pretendard is open source (SIL OFL) — ship it, don't substitute. Load the variable dynamic-subset via CDN (`pretendardvariable-dynamic-subset.min.css`) with `system-ui` fallback; on Apple devices the fallback (SF Pro/Apple SD Gothic Neo) is metrically close, so FOUT is mild. Do not swap in Noto Sans KR — its taller x-height and looser tracking break the compact card rhythm.

## Layout

### Spacing System
- **Base unit:** 4px. Structural layout snaps to 8/12/16/20/24.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 24px · `{spacing.xxl}` 32px · `{spacing.section}` 40px.
- **Screen gutter:** 20px (`{spacing.lg}`) left/right on every screen.
- **Section rhythm:** 32–40px between sections; 12px between a section header and its content.
- **Card internals:** 12–16px padding; list rows 12px vertical.
- **Grid gap:** 12px between 2-column cards; 8px between chips.

### Grid & Container
- **Viewport:** mobile-first 480px max shell, centered on wider screens.
- **Column patterns:** 2-column card grid (home sections), single-column rows (explore list), full-bleed only for the map and the store-detail hero photo.
- **Fixed furniture:** top app bar 52px; bottom nav 72px (+safe area); cta-bar 76px above the nav on detail screens.

### Whitespace Philosophy
Whitespace separates *sections*, borders separate *items*. Inside a section the system is intentionally dense — rows touch via 1px dividers or 12px gaps — while 32–40px of air isolates one job (discover nearby) from the next (browse all). Nothing floats in a void: every block is anchored to a section header.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Screen background, section headers, text |
| Hairline card | 1px `{colors.hairline}` border | Cards, chips, inputs, stat/info strips |
| Floating | `0 4px 14px rgba(0,0,0,0.18)` | Black map FAB |
| Overlay card | `0 8px 24px rgba(0,0,0,0.12)` | Map bottom card, toasts |
| Sheet | `0 -8px 24px rgba(0,0,0,0.10)` + `{rounded.xl}` top corners | Bottom sheets over the map |

**Shadow philosophy.** Shadows mean "this surface floats above another surface" — FAB over list, card over map, sheet over map. Cards resting in the document flow never carry shadows; their edge is the 1px hairline. Never shadow text or badges.

### Decorative Depth
- **Tint steps** (Purple 10/20 behind purple content, Green 10 behind green text) create soft emphasis without elevation.
- **The promo banner** may contain its own illustrative art (coupon graphics, stickers) — decoration lives *inside* the slot, never on the chrome.
- **No backdrop blur.** Sticky surfaces are opaque white with a soft top border.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed hero photo, map canvas |
| `{rounded.xs}` | 4px | SNS badges |
| `{rounded.sm}` | 8px | Menu highlight rows, small thumbnails, inline chips |
| `{rounded.md}` | 12px | Cards, buttons, inputs, radio cards, list thumbnails — the workhorse radius |
| `{rounded.lg}` | 16px | Promo banner, stat strip, map bottom card, section cards |
| `{rounded.xl}` | 20px | Bottom sheet top corners |
| `{rounded.pill}` | 9999px | Category chips, keyword chips, link-state chips, map FAB, map marker pills |
| `{rounded.full}` | 9999px / 50% | Radio dots, step-timeline markers, icon buttons |

### Photography Geometry
- **Card imagery**: 4:3 crops on 2-column home cards, `{rounded.md}` (12px), object-cover.
- **List thumbnails**: square ~96px, `{rounded.md}`.
- **Store-detail hero**: full-bleed edge-to-edge, no rounding, ~4:3, single photo.
- **Map snippet** (store detail): full-width static map at `{rounded.md}` with address row below.
- In storyboard/schema mode all imagery renders the single placeholder thumb — geometry above still applies.

## Components

### Top Navigation

**`top-app-bar`** — White 52px bar. Home variant: left = location selector (`📍 {지역명} ⌄` in `{typography.title}` 18px/700, tap opens region picker); right = search + bell icon buttons (24px line icons, `{colors.ink}`). Detail variant: left = back chevron; title optional. No border — the bar and canvas share white; scrolled state may add `{colors.divider-soft}` bottom border.

**`segment-title`** — The explore header pattern: two `{typography.title-lg}` (20px/700) words side by side ("방문형 기자단"), active in `{colors.ink}`, inactive in `{colors.body-disabled}`. Tap swaps datasets in place. This *is* the screen title — no separate heading.

**`bottom-nav`** — Flat white 72px bar, 5 tabs: 홈 · 탐색 · 체험권 · 혜택 · 마이. Line icon (24px) + `{typography.nav-link}` label. Active tab: icon filled + label in `{colors.primary}`; inactive: `{colors.body-muted}`. Hairline top border `{colors.divider-soft}`.

### Buttons

**`button-primary`** — The purple commit action ("체험권 발급받기"). Background `{colors.primary}`, text white `{typography.button-large}` (16px/700), rounded `{rounded.md}` (12px — rounded-rect, *not* a pill), height 52px. Active: `{component.button-primary-active}` background `{colors.primary-strong}` + `transform: scale(0.97)`. Disabled: `{component.button-primary-disabled}` sunken gray bg + disabled text.

**`button-secondary`** — White bg, 1px `{colors.hairline}` border, `{typography.button-utility}` label, `{rounded.md}`, 44px. Neutral secondary actions (닫기, 복사).

**`button-text`** — Inline text action in `{colors.primary}` ("더 둘러보기 ›" uses `{colors.body-muted}` variant when it's a quiet nav link).

**`map-fab`** — Black pill floating at bottom-center of the explore list: `📍 지도 보기` in white `{typography.button-utility}`, height 44px, `{rounded.pill}`, shadow Floating. Swaps to `☰ 목록 보기` on the map.

**`icon-button`** — 40×40 tap target, 24px line icon, no background; used in app bars (search, bell, filter, copy).

### Cards & Containers

**`experience-card`** — 2-column home card. Stack: 4:3 photo (`{rounded.md}`) → SNS badge row (blog/insta/tiktok) → `🎫 {N} 남음` in `{typography.caption-strong}` → store name `{typography.body-strong}` 1-line ellipsis → `최대 ₩{N} 지원` in `{typography.price}`. No outer border — the image edge and text stack read as the card.

**`experience-row`** — Explore list row. Left: square 96px thumbnail (`{rounded.md}`). Right column: SNS badges · store name (`{typography.body-strong}`, up to 2 lines) · `{카테고리} · {거리}` in `{typography.caption}` muted · `최대 ₩{N} 지원` in `{typography.price}`. Top-right: `🎫 {N} 남음`. Rows separated by 16px gaps (no divider lines).

**`promo-banner`** — Marketing slot on home. `{colors.info}` blue fill, `{rounded.lg}`, ~110px tall, white headline + small white pill tag; may contain slot-owned art. Content is a CMS/marketing concern; the chrome is this component.

**`stat-strip`** — Home 3-stat card: white, hairline border, `{rounded.lg}`, three equal columns divided by `{colors.divider-soft}` rules. Column = caption label (`{colors.body-muted}`) over value (`{typography.headline}`); the personal-action column (참여 예정) renders its value in `{colors.primary}` with a 🎫 prefix.

**`info-strip`** — Store-detail meta card: white, hairline border, `{rounded.md}`, 2–3 columns (체험 마감일 / 리뷰 마감 기한 / 잔여). Label in `{typography.caption}` muted, value in `{typography.body-strong}`; the 잔여 value rides the 🎫 glyph in `{colors.primary}`.

**`notice-banner`** — Purple-tint advisory: bg `{colors.primary-tint-soft}`, `{rounded.md}`, leading 💬 icon, single line of `{typography.caption-strong}` in `{colors.primary}` ("체험권 발급 후 24시간 내로 사용하지 않으면 사라져요").

**`radio-select-card`** — The channel selection unit ("어느 SNS로 체험할까요?"). White, `{rounded.md}`, hairline border, 14–16px padding. Left: radio dot (selected = purple ring + dot) + `{채널} · {등급}등급` label + `link-state-chip`. Right: support amount `{typography.price}`. Selected: `{component.radio-select-card-selected}` — 1.5px `{colors.primary}` border. Disabled (미연동): `{component.radio-select-card-disabled}` — `{colors.canvas-soft}` bg, gray text, right side reads `확인불가`.

**`link-state-chip`** — Tiny pill after channel names: `연동 완료` (green border + `{colors.success-strong}` text) / `연동 필요` (hairline border + muted text).

**`menu-highlight-row`** — Required-menu rows: bg `{colors.primary-tint-soft}`, `{rounded.sm}`, menu name in `{colors.primary}` `{typography.body-strong}`, price right-aligned `{colors.ink}`. Stacked with 8px gaps under the "필수로 주문해야하는 메뉴가 있어요 (택 1)" section header.

**`keyword-chip`** — `#{키워드}` pills: `{colors.surface-sunken}` bg, `{colors.body-secondary}` text, `{rounded.pill}`.

**`step-timeline`** — "체험권 이용방법이 궁금해요" walkthrough: purple filled circles (24px, white number) connected by a 2px `{colors.primary-tint}` vertical rule; each step = `{typography.body-strong}` title + `{typography.caption}` muted description.

**`map-marker-pill`** — Map pin: white pill, `{colors.border-strong}` 1px border, two stacked lines (`{매장명}` caption-strong / `최대 {N}원` caption) with a small tail. Selected: `{component.map-marker-pill-selected}` — `{colors.primary}` 1.5px border + `{colors.primary-tint-soft}` fill.

**`map-bottom-card`** — Selected-pin summary floating above the bottom nav: white `{rounded.lg}` card, Overlay shadow, experience-row layout inside (thumbnail + badges + name + meta + price + 🎫 남음).

**`bottom-sheet`** — List sheet over the map: white, `{rounded.xl}` top corners, Sheet shadow, drag handle bar (36×4px `{colors.border-strong}`), containing the category chip row + result count + experience-rows.

**`cta-bar`** — Fixed purchase bar on detail screens: white, top border `{colors.divider-soft}`, left = label `지원 금액` (`{typography.caption}` muted) over `₩{N}` (`{typography.price}` 18px), right = `{component.button-primary}`.

### Inputs & Forms

**`text-field`** — 48px fixed height (library spec: "텍스트필드 높이 48 고정"), white bg, 1px `{colors.hairline}` border, `{rounded.md}`, `{typography.body}` at Md-16 (or Sm-14 compact), placeholder in `{colors.body-disabled}`. Focus: border → `{colors.primary}`. Error: border → `{colors.error}` + caption below in error text. TextArea: hug height with min-height 48 and vertical padding.

**`search-input`** — Sunken variant for in-list search: `{colors.surface-sunken}` bg, borderless, `{rounded.md}`, 44px, leading search glyph.

**`category-chip`** — Icon + label pill (전체/카페/식당/뷰티/헬스…). Default: white bg, hairline border. Selected: `{component.category-chip-selected}` — 1.5px `{colors.ink}` border (black marks *filter* selection; purple stays reserved for data selection). Horizontal scroll row with a trailing filter icon-button.

**Radio / Checkbox** — 20px circle/square, 1.5px `{colors.border-strong}` border; checked = `{colors.primary}` fill + white check/dot (library `Radio`/`Checkbox`/`CheckMark`).

### Footer

**`footer`** — `{colors.canvas-soft}` block above the bottom nav on long pages: business info and legal links in `{typography.caption}` `{colors.body-muted}`, links underlined. Padding 24px 20px.

## Do's and Don'ts

### Do
- Use `{colors.primary}` (#9333EA) for every *selected/interactive* signal — CTA fill, radio selection, active nav, selected marker — and nowhere else.
- Keep money bold and black: `최대 ₩N 지원` in `{typography.price}`; pair with the 🎫 glyph for remaining slots (`🎫 N 남음`).
- Put the three SNS badges (green/pink/cyan) on every campaign card in the same order (블로그 → 인스타 → 틱톡).
- Border cards with 1px `{colors.hairline}` and round them `{rounded.md}`/`{rounded.lg}`; reserve shadows for surfaces that float (FAB, map card, sheet).
- Use black for *filter* selection (category chips) and purple for *data* selection (channel radio cards) — the two selection grammars must not blend.
- Keep the promo banner's saturated blue confined to the marketing slot.
- Write section headers as friendly sentences with the 👀/! energy of the reference screens ("걸어서 갈 수 있어요👀", "근처 체험 N개 발견!").
- Render schema labels (STORYBOARD mode) in exactly the same components — placeholders inherit the real geometry.

### Don't
- Don't introduce dark section tiles or parchment alternation — the canvas is always white; rhythm comes from section spacing and hairline cards.
- Don't use purple for money, store names or informational text — purple always implies "selected/tappable".
- Don't repurpose the SNS badge colors (green/pink/cyan) for states or categories.
- Don't make the primary CTA a full pill — pills belong to chips and the map FAB; commit buttons are `{rounded.md}` rounded-rects.
- Don't exceed 22px type or drop below 11px; the compact ladder is the brand's density.
- Don't use gradients, backdrop blur, or decorative shadows on in-flow cards.
- Don't render any grade-gating UI (lock overlays, "등급 부족") — per policy P1, grade only changes the amount shown.
- Don't put borders and shadows on the same element (border *or* float, never both).

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Small phone | ≤ 359px | 2-column cards drop to 1.5-column peek scroll; chip row tightens |
| Phone | 360–479px | Reference layout: 2-column grids, 20px gutters |
| Shell max | 480px | Layout locks; the app renders as a centered 480px column |
| Tablet / Desktop | > 480px | Same 480px shell centered on `{colors.canvas-soft}`; no desktop-specific layout (admin console excepted) |

### Touch Targets
- Minimum 44×44px. Primary CTA is 52px tall; list rows ≥ 96px; bottom-nav tabs ≥ 56×72px.
- Icon buttons pad 24px glyphs to 40–44px targets.
- Map marker pills are small visually but carry a ≥ 44px invisible hit slop.

### Collapsing Strategy
- **Explore header**: segment title + icons persist; the category chip row is horizontally scrollable at every width.
- **Map mode**: list ↔ map swap in place via the FAB; the bottom sheet covers ~45% of the viewport and scrolls internally.
- **Detail cta-bar**: always fixed; page content gets bottom padding = cta-bar + nav heights.
- **Home grids**: fixed 2-column; cards shrink fluidly, image aspect stays 4:3.

### Image Behavior
- Card/list imagery uses `next/image` with `sizes` matched to the 2-col/96px slots; object-cover.
- Store hero loads eagerly; below-fold imagery lazy.
- Storyboard mode replaces all photos with the single schema placeholder — aspect boxes must not collapse.

## Iteration Guide

1. Focus on ONE component at a time. Reference its YAML key directly (`{component.radio-select-card}`, `{component.map-fab}`).
2. Variants live as separate entries (`-selected`, `-disabled`, `-active`) in `components:`.
3. Use `{token.refs}` everywhere — never inline hex.
4. Never document hover. Default and Active/Pressed (scale 0.97) states only — this is a touch product.
5. Purple = interaction, black = value, pastel = identity (SNS), blue = marketing. Check every new element against this sentence before shipping.
6. Section headers are sentences, not labels — keep the friendly voice.
7. When in doubt about emphasis: bump weight or add a tint background before adding size, color or elevation.

## Known Gaps

- The library's Pink/Mint (insta/tiktok badge) exact hexes were not present in the extracted variable scales; #EC4899/#0891B2 are matched from the reference screens and may be refined against the source file.
- Dark mode is not defined — the library ships light-only semantic tokens.
- The filter icon-button next to category chips opens a filter surface that has no reference screen yet (sheet assumed).
- Region picker (location selector ⌄ on home) interaction is not specified beyond the trigger.
- Empty/loading states are not drawn in the reference set; current implementation reuses dashed-border empty cards with muted text until specified.
- Owner (사장님) and admin surfaces have no reference screens; they inherit tokens and the card grammar but their layouts are extrapolated.
- The reference screens show some placeholder policy numbers (e.g. "72시간 내 사용", "이용 후 7일 이내") that conflict with shipped policy (24h use / 72h review); the implementation follows policy, the visuals follow this system.
