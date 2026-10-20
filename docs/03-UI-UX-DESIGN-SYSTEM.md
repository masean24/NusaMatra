# 03 — UI/UX Design System & Figma Implementation Contract

> **Project:** Nusa Matra — WIA 2026  
> **Document:** `docs/03-UI-UX-DESIGN-SYSTEM.md`  
> **Version:** 1.0  
> **Updated:** 2026-10-19  
> **Audience:** Claude Code, frontend engineers, UX reviewers, QA  
> **Documentation language:** English; **user-facing UI language:** Bahasa Indonesia  
> **Frontend:** React + TypeScript (LOCKED)  
> **Status:** Design reference verified in part via Figma node metadata and variables; responsive/system decisions that lack Figma evidence are marked PROPOSED.

---

## 0. Purpose, instructions, and non-negotiables

This document provides an **implementation contract**, not a creative redesign brief, for the approved Nusa Matra interface. It translates Figma design evidence into reusable tokens, React component standards, interaction behavior, accessibility expectations, and acceptance checks.

**Claude Code MUST:**

1. Read `CLAUDE.md`, `project_guidelines.md`, `docs/01-PRODUCT-REQUIREMENTS.md`, and `docs/02-USER-FLOWS.md` before implementation.
2. Inspect the exact **Figma node being implemented** and available code before writing JSX/CSS.
3. Treat **Figma as the visual source of truth**, the PRD as the product-behavior source of truth, and this document as a consistent implementation and review checklist.
4. Build with React + TypeScript; preserve Clean Code standards as an assessed requirement of WIA 2026.
5. Use **Nusa Matra** as the public-facing name. The current Figma URL retains an earlier filename; do not restore that name in product copy.
6. Use **Bahasa Indonesia for all user-facing copy**, including buttons, navigation, legends, data labels, status messages, accessibility labels, and date formatting when applicable. Technical types, internal identifiers, comments, and documentation are in English.
7. Implement a working interaction for visible controls. Do not commit dead buttons, dummy click handlers, or inaccessible custom controls.
8. Distinguish **illustrations / prototype sample data** from real geospatial and regional statistics; never silently promote mock values into production claims.
9. Do not modify the approved Figma file unless the user explicitly requests a design edit.
10. If a design requirement cannot be implemented exactly, document the discrepancy, reason, accessible fallback, and plan to resolve it. Never silently substitute another design.

### 0.1 Evidence classification

| Status           | Meaning                                                    | Action                                                                      |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `LOCKED`         | Explicit owner decision                                    | Do not change without approval                                              |
| `FIGMA-VERIFIED` | Observed in actual Figma nodes, variables, or annotations  | Implement faithfully; inspect the relevant frame again for exact geometry   |
| `PROPOSED`       | Sensible engineering interpretation not confirmed by Figma | Adopt provisionally, keep reversible, seek approval if visually significant |
| `TBD`            | Not determined or not verifiable yet                       | Do not assert that a value or behavior is approved                          |
| `DEMO`           | Illustrative content or mock behavior                      | Label clearly and keep isolated from production data                        |

### 0.2 Source URLs

- **Primary Figma file:** <https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2>
- **Fuselab 3D reference:** <https://fuselabcreative.com/our-projects/cyberdefend/>
- **21st.dev React components / animation inspiration:** <https://21st.dev/>

Third-party references are **inspiration or implementation research**, not a replacement design system. Verify license, compatibility, security, dependencies, and attribution requirements for reused code or assets.

---

## 1. Figma inventory and authority map

The following frames and nodes were discovered in the supplied design file. Use these **node IDs** when inspecting designs, assets, variables, measurements, and motion. Names below reflect the source file; product UI branding remains Nusa Matra.

| Figma node           | Verified frame or reference                        | Implementation responsibility                       |
| -------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `25:2`               | `07 Kapur & Kobalt (Normal + Kaca)`                | Design reference canvas / parent grouping           |
| `26:38`              | Token Kapur & Kobalt                               | Brand colors, priority palette, glass specification |
| `26:14`              | `KK Tombol`                                        | Button families and interaction states              |
| `26:37`              | Sakelar Mode Tampilan                              | Normal ↔ Kaca segmented theme control               |
| `49:304`             | Item Navbar Melayang                               | Floating navigation item                            |
| `49:447`             | Navbar Melayang                                    | Full floating navigation composition                |
| `62:1291`            | Pil Halaman Melayang                               | Floating page chip / contextual navigation          |
| `27:2`               | Landing / Normal, 1440px width, full page          | Main landing layout                                 |
| `27:118`             | Landing / Kaca, 1440px width, full page            | Glass landing variant                               |
| `42:330`             | Landing / liquid transition Normal → Kaca          | Theme animation direction A                         |
| `42:780`             | Landing / liquid transition Kaca → Normal          | Theme animation direction B                         |
| `43:250`             | Landing / scroll animations and 3D zones annotated | Section-by-section motion map                       |
| `43:713`             | Legend for scroll animations and 3D elements       | G1–G11 and 3D concept annotations                   |
| `61:1183`            | Peta Utama (hub) / Normal                          | Primary map hub, normal mode                        |
| `61:1619`            | Peta Utama (hub) / Kaca                            | Primary map hub, glass mode                         |
| `63:858` / `63:1319` | Map hub transition in both directions              | Theme transitions on hub                            |
| `29:34`              | Jelajahi / Normal, 1440×900                        | Interactive map explorer                            |
| `29:485`             | Jelajahi / Kaca, 1440×900                          | Glass map explorer                                  |
| `30:479` / `30:955`  | Jelajahi liquid transition in both directions      | Theme transition on explorer                        |
| `30:1467`            | Glass mode & liquid transition specification       | Motion/accessibility/performance annotations        |
| `11:152`             | F03 Lab Prioritas                                  | Editable criteria weights and rankings              |
| `12:263`             | F04 Mengapa Diprioritaskan                         | Explain scoring/contribution                        |
| `12:840`             | F02 Bandingkan                                     | Two-region comparison                               |
| `13:854`             | F07 Uji Rekomendasi                                | Sensitivity / ranking-range visualization           |
| `13:446`             | F05 Paspor Bukti                                   | Evidence document view                              |
| `14:541`             | F06 Titik Buta Data                                | Data quality diagnostics                            |
| `14:927`             | F08 Cerita Wilayah                                 | Chapter-based immersive narrative                   |

**Do not use archived frames as active targets:** `74:886` and `74:1357` are explicitly marked `ARSIP` (older map hub versions).

**Important limitation:** The verified Figma examples include 1440px-wide desktop reference frames, but this alone is **not evidence of final mobile/tablet mockups or breakpoints**. Proposed responsive behavior appears in §8 and needs QA/approval.

### 1.1 Design handoff checklist for each screen

Before implementing a particular screen, Claude Code should record:

- [ ] Exact Figma frame ID and URL.
- [ ] Screenshot/current visual context and layer hierarchy.
- [ ] Layout regions, grid, constraints, content width, spacing, and alignments.
- [ ] Figma variables, local text/effect styles, and referenced assets.
- [ ] Typography hierarchy and text-wrapping behavior.
- [ ] Visible control states and expected behavior per `02-USER-FLOWS.md`.
- [ ] Normal/Kaca variants and transition where available.
- [ ] Relevant motion annotations and accessibility/fallback states.
- [ ] Responsive layout decisions that are verified versus proposed.
- [ ] Visual QA screenshot of the actual React rendering compared with Figma at the same viewport.

Do not transcribe thousands of pixels into arbitrary absolute positioning: use Figma measurements to construct **responsive CSS layout**, except for deliberately positioned visual overlays.

---

## 2. Brand identity and visual tone

### 2.1 Brand principles (`LOCKED` / `FIGMA-VERIFIED`)

- Public brand: **Nusa Matra**.
- Design theme: **Kapur & Kobalt** (chalk/land neutrals + bold cobalt sea).
- Action accent: **warm orange**.
- Typography: **Lexend**.
- Modes: **Normal** and **Kaca (Glass)**.
- Navigation includes a **floating navbar** and contextual floating page elements.
- Visualizations combine polished storytelling with clear numerical and source context.
- Some 3D / hexagon illustrations are **metaphors**, not authoritative geography.

### 2.2 Visual personality

Use high legibility, generous breathing room, layered but intentional depth, crisp affordances, controlled motion, and confident cobalt/orange contrast. Avoid decorative clutter, arbitrary gradients, excessive glow, noisy backgrounds, imprecise synthetic imagery, and generic template aesthetics. A restrained experience is preferable to an unmaintainable collection of effects.

### 2.3 Brand usage

- Render the supplied, approved Nusa Matra logo artwork at its intended aspect ratio; never recreate it with Unicode symbols or AI-generated substitutes.
- Use exported official logo SVG where available; PNG with proper transparent alpha only as fallback.
- Ensure reversed variants remain legible against cobalt and glass surfaces.
- Navbar icons must serve navigation semantics; **do not confuse icons with the brand logo**.
- Screen-reader text on decorative logo-only links must still name the destination, e.g. `aria-label="Nusa Matra — Beranda"`.

**TBD:** Final approved logo source asset/export path and icon inventory. Inspect the design assets and existing repository; do not invent them.

---

## 3. Color system and design tokens

This section separates **exact observed values** from safe usage rules. The hexadecimal colors below were obtained from Figma variable definitions attached to token, button, navigation, and screen nodes. Preserve these exact base values unless the approved Figma design changes.

### 3.1 Brand and surface tokens (`FIGMA-VERIFIED`)

| Semantic token   | Figma variable(s)                    | Hex       | Usage                                    |
| ---------------- | ------------------------------------ | --------- | ---------------------------------------- |
| `sea-deep`       | `laut/dalam`                         | `#1E3FD9` | Deep sea, dark cobalt                    |
| `sea`            | `laut/utama`                         | `#2F5BFF` | Primary sea/cobalt                       |
| `sea-shallow`    | `laut/dangkal`                       | `#5C7FFF` | Lighter sea                              |
| `land-1`         | `darat/1`                            | `#FBFAF6` | Very light land / cards                  |
| `land-2`         | `darat/2`                            | `#EDE9DF` | Muted land                               |
| `land-3`         | `darat/3`                            | `#D9D3C3` | Mid land / dividers                      |
| `land-4`         | `darat/4`                            | `#B8AF9A` | Darker land                              |
| `bg`             | `ui/latar`, `bg/kabut`               | `#F2F1EC` | Page background                          |
| `surface`        | `ui/permukaan`, `bg/permukaan`       | `#FBFAF6` | Main panel/surface                       |
| `text-primary`   | `ui/teks`, `teks/tinta`              | `#121826` | Body/headline text                       |
| `text-secondary` | `ui/teks-redup`, `teks/sekunder`     | `#5A6170` | Secondary text                           |
| `text-tertiary`  | `teks/tersier`                       | `#686E7C` | Tertiary annotation                      |
| `text-on-sea`    | `ui/teks-di-laut`                    | `#FFFFFF` | Text on sufficient-contrast sea surfaces |
| `accent`         | `aksen/utama`                        | `#FF8A3D` | Primary CTAs / emphasis                  |
| `accent-hover`   | `aksen/hover`                        | `#FF7420` | Verified accent hover                    |
| `accent-text`    | `aksen/teks`                         | `#121826` | Text inside light orange buttons         |
| `subtle-border`  | `garis/halus`                        | `#E3DED2` | Normal-mode subtle borders               |
| `strong-border`  | `garis/tegas`                        | `#B8AF9A` | Stronger borders                         |
| `info-soft`      | `info/laut-muda`, `merek/sawah-muda` | `#E3E9FF` | Muted cobalt information background      |
| `danger`         | `status/bahaya`                      | `#C0262D` | Danger / blocked warning                 |
| `danger-soft`    | `status/bahaya-muda`                 | `#FBE4E2` | Danger message surface                   |

**Naming note:** A few Figma frames carry alternate or legacy variable names (e.g. `merek/sawah`). Map these to the **same semantic color value**; do not propagate inconsistent aliases throughout React components.

### 3.2 Priority / choropleth scale (`FIGMA-VERIFIED`)

| Priority level | User-facing label | Exact color |
| -------------- | ----------------- | ----------- |
| `1`            | Sangat rendah     | `#FBFAF6`   |
| `2`            | Rendah            | `#FFD9BF`   |
| `3`            | Sedang            | `#FFB07A`   |
| `4`            | Tinggi            | `#FF8A3D`   |
| `5`            | Sangat tinggi     | `#D9581A`   |

This five-step system is visible in `26:38`, `29:34`, and `29:485`.

**Non-negotiable data-viz rules:**

- Never convey priority through color alone; pair with **text label, value, and legend**.
- Interpret colors only through a documented threshold/indicator logic supplied by data or the decision engine. The Figma palette **does not define scientific thresholds**.
- Mark no-data regions with a **distinct pattern**, not a sixth false priority level. `29:34` explicitly shows **blue dashed = data unavailable**.
- If a value is estimated, missing, not comparable, or simulated, show a visible qualifier.
- Compare categorical scale semantics with actual design and approved model; do not infer that a higher raw number always means greater priority.

### 3.3 Glass / Kaca tokens (`FIGMA-VERIFIED`)

From Figma variables and `30:1467` annotations:

| Token                  | Source value                 | Interpretation                                        |
| ---------------------- | ---------------------------- | ----------------------------------------------------- |
| Glass panel background | `#F2F1EC47`                  | Approx. 28% opacity neutral glass layer               |
| Glass border           | `#FFFFFF99`                  | 60% opacity white border                              |
| Glass muted text       | `#FFFFFFC7`                  | Semi-opaque white text in suitable dark glass context |
| Glass background blur  | `16px`                       | Figma background-blur style                           |
| Glass shadow           | `0 8px 32px #121E5A40`       | Figma effect style                                    |
| Normal-mode shadow     | `0 10px 28px -6px #121E5A1F` | Figma effect style                                    |

`#F2F1EC47` and `#FFFFFF99` are **8-digit hexadecimal colors** with alpha. Keep alpha meaningful when implementing, and test effective contrast against whatever lies behind the glass. A foreground with adequate contrast on one image may fail on another.

### 3.4 Proposed CSS custom property foundation

`PROPOSED` implementation shape; values above are Figma-verified. Adapt names to the existing codebase once inspected.

```css
:root {
  color-scheme: light;

  --nm-sea-deep: #1e3fd9;
  --nm-sea: #2f5bff;
  --nm-sea-shallow: #5c7fff;

  --nm-land-1: #fbfaf6;
  --nm-land-2: #ede9df;
  --nm-land-3: #d9d3c3;
  --nm-land-4: #b8af9a;

  --nm-bg: #f2f1ec;
  --nm-surface: #fbfaf6;
  --nm-text: #121826;
  --nm-text-muted: #5a6170;
  --nm-text-tertiary: #686e7c;
  --nm-text-on-sea: #ffffff;
  --nm-accent: #ff8a3d;
  --nm-accent-hover: #ff7420;
  --nm-accent-text: #121826;
  --nm-border-subtle: #e3ded2;
  --nm-border-strong: #b8af9a;
  --nm-danger: #c0262d;
  --nm-danger-soft: #fbe4e2;

  --nm-priority-1: #fbfaf6;
  --nm-priority-2: #ffd9bf;
  --nm-priority-3: #ffb07a;
  --nm-priority-4: #ff8a3d;
  --nm-priority-5: #d9581a;

  --nm-glass-bg: #f2f1ec47;
  --nm-glass-border: #ffffff99;
  --nm-glass-muted-text: #ffffffc7;
  --nm-glass-blur: 16px;
  --nm-glass-shadow: 0 8px 32px #121e5a40;
  --nm-normal-shadow: 0 10px 28px -6px #121e5a1f;

  --nm-font-sans: 'Lexend', system-ui, sans-serif;
}
```

Theme-specific _semantic_ tokens (for example `--panel-bg`, `--panel-border`, `--panel-text`) should be derived from these primitives to prevent component code from repeatedly branching on `isGlass`.

**Do not** simply apply a `.glass` class to the whole page: scoped components and transitions must preserve contrast, stacking order, and cost controls.

### 3.5 Additional statuses / chart colors

Do **not** invent arbitrary meaning for green/yellow/red chart categories. Figma has verified `danger` color for some comparison warnings, but the full success/warning/info token set requires further audit. Until approved:

- Use a clear icon + text label + neutral panel for new states.
- Obtain chart series semantics from Figma or the data-visualization specification.
- Validate color distinction with non-color encodings (line styles, symbols, direct labels).

---

## 4. Typography

### 4.1 Primary font (`FIGMA-VERIFIED`)

**Lexend** is the typeface used across the Kapur & Kobalt design. Load the required approved weight files or licensed webfont resources; ensure `font-display: swap` or a similarly robust strategy. Do not distribute proprietary font files unless licensing permits.

### 4.2 Verified type styles

Values listed here were read from Figma variable definitions. A **second set** of text styles exists on several analytical frames; keep distinctions rather than overwriting one style family with the other.

| Style                           | Size | Weight       | Line height | Letter spacing | Evidence |
| ------------------------------- | ---- | ------------ | ----------- | -------------- | -------- |
| `KK/Display`                    | 68px | 600 SemiBold | 1.04        | -2px           | `26:38`  |
| `KK/Lead`                       | 19px | 300 Light    | 1.55        | 0px            | `26:38`  |
| `KK/H2`                         | 26px | 500 Medium   | 1.24        | -0.4px         | `29:34`  |
| `KK/H3`                         | 19px | 500 Medium   | 1.32        | -0.1px         | `26:38`  |
| `KK/Body`                       | 16px | 400 Regular  | 1.55        | 0px            | `29:34`  |
| `KK/Body Tebal`                 | 16px | 500 Medium   | 1.5         | 0px            | `29:34`  |
| `KK/Tombol`                     | 15px | 500 Medium   | 1.2         | 0px            | `26:14`  |
| `KK/Kecil`                      | 14px | 400 Regular  | 1.45        | 0px            | `26:38`  |
| `KK/Keterangan`                 | 12px | 400 Regular  | 1.4         | +0.2px         | `26:38`  |
| `Judul/H1` (analytical pages)   | 33px | 600 SemiBold | 1.16        | -1px           | `11:152` |
| `Teks/Body` (analytical pages)  | 15px | 400 Regular  | 1.55        | 0px            | `11:152` |
| `Teks/Lead` (analytical pages)  | 18px | 300 Light    | 1.55        | 0px            | `12:840` |
| `Data/Angka` (analytical pages) | 17px | 600 SemiBold | 1.2         | 0px            | `11:152` |

**Implementation guidance:**

- Implement **named typography recipes** as CSS classes or design tokens, not scattered `font-size` values.
- Use `clamp()` only where needed for responsive display type; keep Figma desktop measurement as the reference at its documented viewport.
- Prefer real document hierarchy: one meaningful `<h1>` per screen, then `<h2>`/`<h3>` as appropriate.
- Numerical values should use `font-variant-numeric: tabular-nums` in ranked lists, comparisons, and tables when visual alignment is helpful; **PROPOSED** enhancement, not a Figma-mandated variable.
- Preserve Indonesian readability; allow multi-line headings and table cells to wrap without clipping.
- Never reduce body text to unreadably small sizes to force an exact screenshot match.
- Test that Lexend fallback loads gracefully and avoids large layout shift.

---

## 5. Layout, grid, spacing, and elevation

### 5.1 Desktop reference (`FIGMA-VERIFIED`)

Several approved frames use **1440px canvas width**:

- Landing: `1440 × 5080` (`27:2` / `27:118`)
- Jelajahi: `1440 × 900` (`29:34` / `29:485`)
- Peta Utama: `1440 × 900` (`61:1183` / `61:1619`)
- Lab Prioritas: `1440 × 1086` (`11:152`)
- Bandingkan: `1440 × 998` (`12:840`)

Observed standalone analytical screens often contain a 1200px-wide central content container at `x=120px` on a 1440px frame (e.g., `11:152` and `12:840`). This is **a recurring observed layout**, not proof that every screen uses the same `max-width`.

### 5.2 Responsive layout approach (`PROPOSED`, pending mobile Figma)

- Use fluid containers with `width: min(100% - 2rem, 75rem)` as an **initial engineering approximation**, adjusting by exact screen evidence.
- Adopt breakpoints based on _content failure_ and measured component needs, not device brand names.
- Initial **proposed**, revisable checkpoints: compact `<640px`, medium `640–1023px`, wide `>=1024px`.
- For the map explorer, prioritize available map viewport and keep essential controls reachable; allow bottom sheets or collapsible panels on narrow screens.
- For comparison, keep both regions identifiable; allow stacked cards, horizontally scrollable accessible tables, or a responsive comparison list where necessary.
- For the Lab, controls and ranked results may stack at narrow widths; avoid losing context while adjusting weights.
- Floating navigation must not cover content, trap focus, or make a primary CTA unreachable.
- 3D hero elements must never force horizontal page overflow.
- Respect browser zoom up to 200% and text scaling; **do not pin component height when text needs to wrap**.

### 5.3 Spacing, radius and grid token rules

**TBD / extract from Figma:** An authoritative global numeric spacing and corner-radius scale has not yet been validated. Claude Code must inspect exact frames before choosing fixed values. If repeated measurements support a design token scale, centralize it; do not invent a large arbitrary scale and claim it is from Figma.

**PROPOSED** organizational example:

```css
:root {
  /* Values illustrative until measured against Figma. */
  --nm-space-1: 4px;
  --nm-space-2: 8px;
  --nm-space-3: 12px;
  --nm-space-4: 16px;
  --nm-space-6: 24px;
  --nm-space-8: 32px;
}
```

Use shared primitives for repeated layouts, but avoid abstracting unique editorial compositions until repetition is demonstrated.

### 5.4 Elevation and layers

Use a small, intentional stacking strategy (`PROPOSED` naming):

1. Regular content and cards.
2. Map annotations / visual overlays.
3. Floating navbar and active contextual controls.
4. Popovers, menus, and dialogs.
5. Theme liquid-transition mask / temporary overlay.
6. Global critical feedback (only if necessary).

Define `z-index` tokens rather than arbitrary values scattered throughout components. Important: the liquid transition must be non-interactive while covering the screen (`pointer-events: none`), and focus must remain meaningful.

---

## 6. Interaction and component specifications

### 6.1 Component hierarchy (`PROPOSED` implementation organization)

**Primitives:**

- `Button`, `IconButton`, `Link`, `Input`, `Select`, `Slider`, `Switch`, `Badge`, `Tooltip`, `Popover`, `Dialog`, `Skeleton`, `Spinner`, `StatusMessage`.

**Domain composites:**

- `FloatingNavbar`, `PagePill`, `DisplayModeSwitch`, `RegionSearch`, `IndicatorFilter`, `MapLegend`, `RegionDetailPanel`, `ComparisonRow`, `PrioritySlider`, `RankedRegionList`, `DataQualityNotice`, `SourceCitation`, `EvidencePreview`, `StoryChapterNav`.

**Visual effects:**

- `RevealOnScroll`, `LiquidThemeTransition`, `DioramaScene`, `LayeredIsland`, `FloatingEvidencePassport`, `DataColumnsScene`.

Reuse existing project primitives where appropriate. Do not create duplicate `Button` implementations inside feature folders. All interactive UI must have visible keyboard focus and accessible labels.

### 6.2 Buttons (`FIGMA-VERIFIED`)

Node `26:14` defines these component variants:

| Figma variant | Default | Hover   | Behavioral rule                                     |
| ------------- | ------- | ------- | --------------------------------------------------- |
| `Tipe=Aksen`  | `26:2`  | `26:4`  | Primary action; use approved orange and accent text |
| `Tipe=Kaca`   | `26:6`  | `26:8`  | Glass action on compatible background               |
| `Tipe=Garis`  | `26:10` | `26:12` | Outline/secondary action                            |

**Verified reference:** the Accent component uses `#FF8A3D` with a separate `#FF7420` hover variable; `KK/Tombol` typography is Lexend Medium 15px. Other exact button geometry, radii, padding, and border widths must be read from Figma before claiming pixel fidelity.

All button variants must support these **engineering-required** states, even if Figma only shows default/hover:

- `default`, `hover`, `focus-visible`, `pressed`, `disabled`, `loading` (where relevant).
- Use actual `<button>` for actions and `<a>` / router `<Link>` for navigation.
- Disabled means truly disabled; expose reason when appropriate.
- A loading button prevents accidental duplicate actions and announces progress when needed.
- Keyboard `Enter`/`Space` must activate actions consistently.
- Use touch targets around **44×44 CSS pixels** wherever practical (`PROPOSED` accessibility target); visually small icons may have larger interactive hit areas.

Suggested TypeScript variant contract (`PROPOSED`):

```ts
type ButtonVariant = 'accent' | 'glass' | 'outline';
type ButtonSize = 'small' | 'medium' | 'large';

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};
```

### 6.3 Navigation (`FIGMA-VERIFIED`)

- Floating navigation components exist at `49:304` and `49:447`.
- Contextual floating page pill exists at `62:1291`.
- Prefer semantically grouped links and active route state (`aria-current="page"`).
- Long and narrow viewport behavior is **TBD**; inspect Figma and then implement a discoverable collapsed mobile equivalent (`PROPOSED`).
- Ensure the current section's visual emphasis is not color-only.
- Every route change should preserve meaningful context per `02-USER-FLOWS.md`.
- Keep mode switching separate from business filtering; changing visual theme must not reset selected regions or analysis criteria.

### 6.4 Inputs, selects, search

- Search must have an actual text label/accessible name, not placeholder alone.
- Use a distinguishable search-clear control, no-results feedback, keyboard result navigation, and proper focus management.
- Avoid firing uncontrolled network requests on every keystroke; debounce or cancel as appropriate (architecture details in `04-TECH-STACK-ARCHITECTURE.md`).
- Region names can be non-unique; internal selection uses a stable **region code**, not display string.
- Filters must expose selected state and allow reversal/reset.
- Data loading, no results, service failure, and no comparable data are **different states**.

### 6.5 Priority weight sliders

On `11:152`, sliders control criteria weights; design annotation states total **100%** and other weights adjust automatically. Implement with:

- Visible criterion label, current numeric percentage, meaningful accessible slider name.
- Keyboard arrows and direct value display.
- A stable normalization policy supplied by `07-DECISION-ENGINE.md`, not a UI-only approximation.
- Reset to documented default weights.
- Honest loading/calculation feedback and deterministic ranked results.
- Source/period/methodology disclosures and downstream continuity with explanation and sensitivity features.
- Guard against floating-point drift and unintuitive reallocation.

### 6.6 Regions and map interactions

`29:34` shows:

- Search placeholder / label: **Cari kabupaten/kota**.
- Filtering concepts such as **Semua risiko**, **Banjir**, **Longsor**.
- Five-tier **Tingkat prioritas** legend.
- Explicit **data not available** representation using blue dashed mark.
- Clicked-region detail example with region name, province/year, priority, ranking, and indicator breakdown.

The hexagon imagery shown in some frames is **illustrative**, not a valid polygon boundary source. For live geography, use vetted geospatial data and avoid equating decorative hexagon position with authoritative coordinates or district boundaries.

The map must:

1. Expose selection through both pointer and keyboard-accessible alternative controls.
2. Announce selected region and important new information to assistive technology.
3. Maintain readable zoom controls, legend, filters, and data/source attribution.
4. Show empty/unavailable data differently from zero values.
5. Never use decorative priority colors to claim real risk classification without an approved indicator/method.
6. Offer a usable list/search alternative when canvas/WebGL interaction is not accessible.

### 6.7 Region comparison

On `12:840`, comparison uses two region identities and a **Tukar posisi** swap control. The design includes:

- Two-side headers and a side-by-side indicator table.
- **Cobalt solid** for one region versus **orange dashed** for the other, a non-color distinction.
- Values accompanied by years, difference explanations, and contextual caveats.
- At least one example where comparison is **blocked because measurement definitions differ**.
- An example with different years that is **shown with an explicit warning**.

Mandatory engineering behavior:

- Never compare incompatible definitions simply because values are numeric.
- Validate unit, temporal scope, geographic level, direction, and methodology.
- Swap both regions without changing values incorrectly or dropping context.
- Numbers and derived prose must use the same verified data (not hardcoded narrative).
- Do not render a ratio when the denominator is invalid/zero or the comparison is prohibited.
- On mobile, preserve indicator label and both region values in an accessible representation.

### 6.8 Data integrity and evidence components

Dedicated UI references:

| Screen                 | Figma node | Presentation duty                                                     |
| ---------------------- | ---------- | --------------------------------------------------------------------- |
| Mengapa Diprioritaskan | `12:263`   | Explain scoring via per-indicator contributions                       |
| Titik Buta Data        | `14:541`   | Show incompatible definitions, stale periods, missing data            |
| Uji Rekomendasi        | `13:854`   | Ranking ranges and assumption sensitivity                             |
| Paspor Bukti           | `13:446`   | Present reproducible results, sources, model assumptions, limitations |
| Cerita Wilayah         | `14:927`   | Chapter-based narrative with factual grounding                        |

These should share design primitives (`StatusMessage`, `SourceCitation`, `MetadataRow`, `DataQualityNotice`) without pretending the same information structure fits all screens.

### 6.9 Empty, loading, error, and blocked states

A user must understand **what happened and what to do next**:

| State               | Indonesian copy example                                          | Required behavior                              |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Loading             | `Memuat data wilayah…`                                           | Skeleton/progress; no false final value        |
| Empty search        | `Wilayah tidak ditemukan.`                                       | Clear query / offer retry                      |
| Missing observation | `Data belum tersedia untuk indikator ini.`                       | Neutral unavailable notation, show scope       |
| Incomparable        | `Indikator tidak dapat dibandingkan karena definisinya berbeda.` | Disable misleading delta; explain reason       |
| Network error       | `Data gagal dimuat. Coba lagi.`                                  | Retry action and preserved selection           |
| Demo content        | `Data simulasi — bukan hasil resmi.`                             | Visible at point of interpretation, not buried |
| Model unavailable   | `Analisis belum tersedia untuk kombinasi ini.`                   | Show valid alternative or explanation          |

**Examples, not necessarily verbatim copy:** Review final on-screen microcopy against Figma and product requirements before shipping.

---

## 7. Normal and Kaca modes

### 7.1 Theme behavior (`LOCKED` and `FIGMA-VERIFIED`)

There are **two approved visual modes**:

- **Normal:** Standard opaque cards/surfaces with quieter shadows.
- **Kaca:** Glass panels with translucency, stronger layered depth, and verified blur/shadow tokens.

Both modes share **the same data, application state, focus order, navigation meaning, and functional availability**. Do not fork business logic to implement the visual variants.

### 7.2 Toggle and animation specification (from Figma `30:1467`)

The annotated sequence is:

1. Switch droplet moves toward selected segment with a spring effect, **420ms**.
2. Destination-colored organic liquid spreads from the switch and shows droplets, **420ms**, easing `cubic-bezier(.65, 0, .35, 1)`.
3. Liquid fills the screen and dissipates to reveal the destination mode, **520ms**, easing `cubic-bezier(.16, 1, .3, 1)`.
4. **Total visual sequence:** approximately **0.95 seconds** with overlapping phases; **do not sum durations mechanically**.

Figma proposes layered themes with animated SVG `clip-path`, optional gooey SVG filters, or a justified Three.js shader alternative. Use the simplest implementation that achieves the visual reference with acceptable performance. This is a recommendation from Figma, not a mandate to introduce multiple animation engines.

### 7.3 Accessibility and performance notes directly from Figma

- Theme control: a switch with accessible name **`Mode tampilan kaca`** and correct checked/pressed semantics. Prefer a real control with `role="switch"` and `aria-checked` or a properly implemented equivalent.
- `prefers-reduced-motion`: replace the liquid effect with a simple **200ms crossfade**; for users requesting essentially no motion, an instant switch is also acceptable if needed for comfort.
- Higher contrast or reduced transparency preference: prioritize legibility and automatically avoid inappropriate glass transparency.
- Glass text contrast target: **at least 4.5:1 for normal-size text**, testing the **composited** background.
- Figma annotation suggests raising glass opacity to **0.45** in brighter areas when needed.
- `backdrop-filter` budget: **maximum six glass panels per screen** in the annotated implementation guidance.
- On weaker devices, fall back to approximately **8px blur**, or opaque cards if necessary.
- Persist user preference locally and initialize it before first visual paint where feasible, avoiding flash of incorrect mode.

**Compatibility note:** `prefers-reduced-transparency` browser support varies. Treat it as progressive enhancement and provide a deterministic manual/contrast fallback rather than relying on one CSS media query.

### 7.4 Safe mode state machine (`PROPOSED`)

```text
normal --USER_TOGGLE--> transitioning-to-glass --> glass
  ^                                               |
  |                                               |
  +---- transitioning-to-normal <--USER_TOGGLE----+

Any mode --REDUCED_MOTION--> same content, simple/instant visual switch
Any mode --CONTRAST_REQUIRED--> readable opaque/fallback surfaces
```

Implementation considerations:

- Keep the source of truth to a single `displayMode` state, with derived semantic CSS tokens.
- Lock or coalesce repeated toggles _during_ the transition to avoid mismatched visual state.
- Cleanup/cancel active animations on unmount and rapid navigation.
- Avoid remounting the entire application or rerunning data queries during a theme change.
- Preserve focus on the same control after toggling.
- Transition overlay must never intercept user input after completion.
- Store only benign UI preferences, not private analytics or user identifiers.

### 7.5 Example styling architecture (`PROPOSED`)

```css
[data-display-mode='normal'] {
  --nm-panel-bg: var(--nm-surface);
  --nm-panel-border: var(--nm-border-subtle);
  --nm-panel-shadow: var(--nm-normal-shadow);
}

[data-display-mode='glass'] {
  --nm-panel-bg: var(--nm-glass-bg);
  --nm-panel-border: var(--nm-glass-border);
  --nm-panel-shadow: var(--nm-glass-shadow);
}

.nm-panel {
  background: var(--nm-panel-bg);
  border: 1px solid var(--nm-panel-border);
  box-shadow: var(--nm-panel-shadow);
}

[data-display-mode='glass'] .nm-panel {
  -webkit-backdrop-filter: blur(var(--nm-glass-blur));
  backdrop-filter: blur(var(--nm-glass-blur));
}

@supports not (backdrop-filter: blur(1px)) {
  [data-display-mode='glass'] .nm-panel {
    background: var(--nm-surface);
    color: var(--nm-text);
  }
}
```

The sample does **not** implement all contrast safeguards; tune each panel context against the Figma design.

---

## 8. Accessibility, inclusivity, and responsive interaction

These engineering obligations apply even where no alternative artboard exists.

### 8.1 Semantic & keyboard rules

- Use semantic `header`, `nav`, `main`, `section`, `aside`, `footer`, `form`, and headings where appropriate.
- Provide a **skip-to-content** link (`Lewati ke konten utama`).
- Focus indicators must remain visible on orange, pale, cobalt, and glass backgrounds.
- Custom map and chart interactions must have accessible text/table alternatives.
- Dialogs and popovers need correct focus entry, dismissal, and focus return.
- Avoid auto-playing content that blocks reading; respect user preferences.
- Dynamically updated ranking/result announcements should be **throttled** and non-disruptive, not live-announced on every animation frame.

### 8.2 Contrast and color

- Aim for WCAG 2.2 AA; test text against **actual composited** surfaces.
- Target minimum **4.5:1** normal text, **3:1** large text and non-text UI indicators where applicable.
- Do not assume cobalt-on-orange or white-on-orange is valid without measurement.
- Status and chart series need a second encoding beyond hue.
- In Kaca mode, disable/simplify translucent effects if reliable contrast is impossible.

### 8.3 Motion sensitivity

- Honor OS/user `prefers-reduced-motion` and the UI's own reduced-motion control where implemented.
- Stop 3D camera movement and hover parallax when reduced motion is requested.
- Keep the same core information and navigation available without animations.
- Provide text summaries for storytelling chapters, as annotated on `14:927`.

### 8.4 Device behavior (`PROPOSED` until mobile designs verified)

| Viewport/context        | Expected adaptation                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Wide desktop            | Reproduce 1440px reference faithfully; preserve intended main columns and 3D compositions                       |
| Mid-size / tablet       | Reflow columns; reduce offscreen decorative motion; preserve panel access                                       |
| Compact / mobile        | Stack analytical panels; use safe overlays or bottom sheets for map selection; collapse navigation if necessary |
| Slow device / low-power | Reduce WebGL resolution, blur budget, and animation work; preserve controls                                     |
| Keyboard/screen reader  | Offer list/search and concise data summaries for map/charts                                                     |
| 200% zoom               | Maintain readable labels and controls without cut-off/overlap                                                   |

**Do not** infer mobile designs from desktop screenshots as if they were approved frames. Document significant interpretation decisions for visual approval.

---

## 9. Motion and 3D overview

Detailed implementation recipes, motion choreography, GPU budgets, cleanup strategy, and testing belong in `docs/09-ANIMATION-GUIDELINES.md`. This document defines the visual **contract** and source references.

### 9.1 Figma-verified global reveal rule

Node `43:713` describes an appear-on-scroll pattern:

- Trigger once when approximately **20% of an element enters the viewport**.
- Translate upward **16–32px**, fade in over **600–700ms**.
- Timing curve: **`cubic-bezier(0.16, 1, 0.3, 1)`**.
- Sibling stagger: **80–100ms**.
- For reduced motion, show elements immediately without movement.

Apply this pattern only where annotated. Avoid blanket animation of every paragraph, row, or source citation.

### 9.2 G1–G11 annotation index (from `43:713`)

| ID    | Surface                | Verified visual intent                                                               |
| ----- | ---------------------- | ------------------------------------------------------------------------------------ |
| `G1`  | Hero introduction      | Heading, description, search and CTA rise ~28px, stagger ~90ms, ~700ms               |
| `G2`  | Diorama hero           | Diorama rises ~60px (~1.1s), floating cards follow; cursor parallax ±6°              |
| `G3`  | Process steps          | Heading rises ~24px; five steps follow staggered from left                           |
| `G4`  | Layered island         | Three layers separate gradually with native scroll progress, **no scroll hijacking** |
| `G5`  | Weighted visualization | Surface scales 0.96→1; bars fill sequentially                                        |
| `G6`  | Rankings               | One demo FLIP-style reordering (~320ms), single pulse for change chip                |
| `G7`  | Data status cards      | Staggered cards and small status stamp-style icon entrance                           |
| `G8`  | Evidence passport      | 3D document rotates ~20°→8°; orange stamp and preview appear                         |
| `G9`  | Storytelling           | Diorama camera focuses on island, water moves subtly, story card appears             |
| `G10` | Sources                | Three source cards enter in sequence                                                 |
| `G11` | Closing CTA            | Panel rises ~32px; single search field shimmer accent                                |

For exact choreography, inspect each actual artboard/annotation and motion tracks where present. These descriptions are not a substitute for design context.

### 9.3 Verified 3D concepts

From node `43:713`:

1. **`3D-1` Diorama Nusantara:** cobalt sea base, five tiered chalk islands, orange markers; cursor parallax, CTA can transition viewpoint toward the hexagon map.
2. **`3D-2` Layered data island:** one raised island separates into three transparent layers for risk, social, and services; driven by scroll progress.
3. **`3D-3` Data columns:** three glass/orange columns whose height follows Lab Prioritas weight sliders.
4. **`3D-4` Floating evidence passport:** rotating document with orange stamp, related to Paspor Bukti.

These are **visual metaphors**, not precise topography. When used next to real data, clearly distinguish the illustration from factual map boundaries and computed values.

### 9.4 Animation implementation hierarchy

1. Use lightweight CSS/transforms for small states and standard reveals.
2. Use a **single selected motion engine** (e.g., Motion or GSAP, per final tech stack) for complex timelines.
3. Use Three.js / React Three Fiber only for scenes requiring actual 3D.
4. Review existing suitable implementation patterns from 21st.dev and Fuselab.
5. **If no suitable external implementation exists, Claude Code must implement a clean, original animation**, with readable components/hooks, lifecycle cleanup, and graceful fallbacks.

A third-party animation is not automatically acceptable. Adapt it to the actual Figma composition and test on target devices. Do not import heavyweight effects solely for a minor hover animation.

---

## 10. Screen-specific visual and UX requirements

### 10.1 Landing (`27:2`, `27:118`)

- Implement the **approved complete scrolling composition**, not only the hero.
- Respect the normal/glass mode pair and approved 3D zones.
- Keep introductory content, CTA, search, and narrative in **Indonesian**.
- Motion G1–G11 only at applicable sections; avoid scroll hijacking.
- Hero should remain useful if 3D cannot load.
- Public brand must be **Nusa Matra** regardless of old Figma file title.

### 10.2 Peta Utama hub (`61:1183`, `61:1619`)

- The hub is a distinct screen from Jelajahi; do not collapse them without product authorization.
- Preserve exploration entry points and the floating navigation structure.
- Support theme toggling without changing context or routes unexpectedly.
- Use current frames, not archived versions.

### 10.3 Jelajahi (`29:34`, `29:485`)

- Fit interactive map, search, indicator filter, legend, and selected-region panel into a coherent responsive workspace.
- Use the five verified priority colors and unavailable-data pattern.
- Provide source/year/context on selected-region values.
- Make selection via list/search available independently of map graphics.
- Do not confuse demonstration ranking numbers with production values.

### 10.4 Bandingkan (`12:840`)

- Reproduce region headers, swap control, indicator rows, values, and contextual difference narrative.
- Preserve cobalt solid versus orange dashed series distinction.
- Render incomparable-data blocks exactly as a **disabled analytical comparison**, not a missing CSS style.
- Every displayed year and number must come from a validated data record, not hardcoded layout values.

### 10.5 Lab Prioritas (`11:152`)

- Preserve the visual relationship between editable weights and responsive ranked outcomes.
- Show total weight = 100%, reset action, and named model/methodology.
- Recalculate with the **single shared decision engine**; avoid parallel UI-only calculations.
- Provide responsive and keyboard-usable sliders; 3D data-column visualization is progressive enhancement.

### 10.6 Mengapa Diprioritaskan (`12:263`)

- Lead with plain-language explanation, then contribution details.
- Explain each score using the same active weights and normalized values as the Lab.
- Present alternative weight scenarios without misleading claims.
- Source/year and assumptions must be inspectable.

### 10.7 Uji Rekomendasi (`13:854`)

- Show toggled assumptions and rank-range visualization.
- Explain sensitivity/instability in understandable language.
- Do not display hardcoded percentage stability as a real empirical result.
- Provide non-chart text summaries and clearly identified active scenario.

### 10.8 Paspor Bukti (`13:446`)

- Treat the evidence sheet as structured, auditable content, not a decorative poster.
- Preserve question, result, data sources, model assumptions, limitations, and generation context.
- Prototype identifiers/dates in Figma are example values; do not mistake them for authentic report IDs.
- A print/export layout must preserve source disclosure and readability if export is approved later.

### 10.9 Titik Buta Data (`14:541`)

- Distinguish blockers, warnings, and informational notices through text, symbols, and appropriate semantic styling.
- Show definition mismatch, stale year, and missing data separately.
- Never suppress an important block solely to make the UI look cleaner.
- Link warnings to relevant regions/indicators and their provenance when possible.

### 10.10 Cerita Wilayah (`14:927`)

- Use chapter indicator, controlled story progression, narrative text, and illustrative visual together.
- Figma notes that the diorama is an **illustration, not an accurate map**; preserve a similar clarification.
- Reduced-motion control is visible in the story UI.
- Provide screen-reader text summaries and a standard non-animated chapter navigation path.

---

## 11. Implementation patterns and Clean Code contract

### 11.1 Source architecture (`PROPOSED`)

```text
src/
  app/
    App.tsx
    providers/
  components/
    ui/
      Button/
      Input/
      Panel/
      StatusMessage/
    navigation/
      FloatingNavbar/
      DisplayModeSwitch/
  features/
    landing/
    map-hub/
    explore/
    comparison/
    priority-lab/
    explanations/
    sensitivity/
    evidence/
    data-quality/
    stories/
  design-system/
    tokens.css
    typography.css
    theme.css
  hooks/
  services/
  assets/
  types/
```

Adapt this to existing repository conventions; don't mass-create empty folders merely to imitate a tree.

### 11.2 Recommended implementation boundaries

| Concern                  | Owns                                              | Must not own                         |
| ------------------------ | ------------------------------------------------- | ------------------------------------ |
| `design-system/`         | Tokens, utilities, shared visual rules            | Domain calculations                  |
| `components/ui/`         | Accessible reusable primitives                    | HTTP requests, domain ranking logic  |
| `components/navigation/` | Shell, menu, route links, mode control            | Scoring and dataset transformation   |
| `features/*`             | Domain presentation, feature-specific state/hooks | Duplicated global design tokens      |
| `services/`              | API clients and adapters                          | JSX and animated DOM                 |
| `decision engine`        | Deterministic scoring and diagnostics             | Visual layout specifics              |
| `effects / 3D`           | Renderer, scene lifecycle, effects                | Source-of-truth for analytic numbers |

### 11.3 Coding rules (assessment critical)

- Use strict TypeScript, semantic React components, clear prop interfaces, and intentional state ownership.
- Keep design values in tokens; do not scatter raw hex literals in feature JSX.
- Build composable component variants; avoid duplicate components for Normal and Kaca.
- Abstract reused logic when it improves clarity, not simply to minimize line count.
- Centralize data formatting (Indonesian number/date conventions) and error vocabulary.
- Cancel stale async requests and clean up observers/timelines/WebGL resources.
- Avoid untested imperative DOM mutation by global selectors inside React features.
- Avoid ignoring eslint/types to force builds green.
- Add a regression test whenever fixing a recurring interaction or state bug.
- Do not mark nonfunctional visuals as complete simply because they resemble Figma.

### 11.4 Suggested semantic token usage

```tsx
// PROPOSED illustration only: use existing project UI primitives if available.

type PriorityLevel = 1 | 2 | 3 | 4 | 5;

const priorityLabels: Record<PriorityLevel, string> = {
  1: 'Sangat rendah',
  2: 'Rendah',
  3: 'Sedang',
  4: 'Tinggi',
  5: 'Sangat tinggi',
};

function PriorityLabel({ level }: { level: PriorityLevel }) {
  return <span data-priority-level={level}>{priorityLabels[level]}</span>;
}
```

Avoid a single generalized `MagicPanel` that tries to handle every feature, every visualization, and every interaction. Reuse basic primitives while retaining domain-specific composition.

---

## 12. UI copy and localization

### 12.1 Language rule (`LOCKED` implementation preference)

All public UI language is **Bahasa Indonesia**; technical documentation, source identifiers, and developer contracts are **English**. This ensures user familiarity while keeping implementation terminology aligned with React/TypeScript documentation.

### 12.2 Terminology conventions

| Concept                | Preferred Indonesian UI wording |
| ---------------------- | ------------------------------- |
| Explore                | `Jelajahi`                      |
| Compare                | `Bandingkan`                    |
| Priority lab           | `Lab Prioritas`                 |
| Why prioritized        | `Mengapa Diprioritaskan`        |
| Recommendation testing | `Uji Rekomendasi`               |
| Evidence passport      | `Paspor Bukti`                  |
| Data blind spots       | `Titik Buta Data`               |
| Regional story         | `Cerita Wilayah`                |
| Normal mode            | `Normal`                        |
| Glass mode             | `Kaca`                          |
| Data unavailable       | `Data belum tersedia`           |
| Not comparable         | `Tidak dapat dibandingkan`      |
| Sample/demo data       | `Data simulasi`                 |

- Format human-readable numbers using `Intl.NumberFormat("id-ID")`.
- Dates should use clear Indonesian conventions with time zones as needed.
- Avoid English marketing filler or mixed-language navigation labels.
- Ensure explanation prose is short, non-paternalistic, and backed by actual data.
- Do not hardcode dynamically generated explanations independently from the data snapshot.

---

## 13. Asset and dependency policy

1. Inspect Figma and repository assets before generating or importing replacements.
2. Use the exact approved logo, SVGs, illustrations, and media in their corresponding layout slots.
3. Store production assets under versioned repository paths; do not depend on expiring Figma URLs.
4. Maintain aspect ratio, intrinsic SVG viewBox/dimensions, meaningful alt text where appropriate, and correct decorative image semantics.
5. Third-party assets/components must pass licensing and accessibility checks.
6. Avoid importing an entire UI or animation framework for one cosmetic effect.
7. Prefer optimized raster sizes/formats and lazy-loading for below-the-fold media.
8. If a custom illustration or 3D object is required, create it using a documented, maintainable workflow and preserve source/editable files when feasible.
9. No generated imagery should be misrepresented as an official administrative map or real-world regional measurement.

**TBD:** The definitive list of approved icon assets, favicon, and logo variants must be extracted from the actual design/repository.

---

## 14. Visual regression and QA protocol

### 14.1 Required review sizes

- **1440px desktop** for every screen with a matching Figma artboard (`FIGMA-VERIFIED`).
- **PROPOSED** QA checkpoints: 1280px, 1024px, 768px, 390px, 360px, plus content zoom 200%.
- Test on actual supported browsers/devices chosen in `10-TESTING-STRATEGY.md`.

### 14.2 Screenshots and inspection

For each in-scope screen:

1. Capture/reference the approved Figma artboard at its documented width.
2. Render the React implementation with identical viewport dimensions and correct theme.
3. Compare hierarchy, text wraps, contrast, spacing, typography, icon geometry, navigation placement, cards, chart layout, and responsive behavior.
4. Fix concrete mismatches in-scope rather than rewriting the entire component tree.
5. Repeat for both Normal and Kaca when both are defined in Figma.
6. Verify the actual **interactive** states, not just a static screenshot.
7. Record unresolved differences with impact and reason; do not claim 1:1 parity without evidence.

### 14.3 Suggested QA matrix

| Test ID  | Visual/interaction check | Expected result                                                               |
| -------- | ------------------------ | ----------------------------------------------------------------------------- |
| `DS-001` | Brand naming             | All public-facing brand text says **Nusa Matra**                              |
| `DS-002` | Color tokens             | Base brand, surface, accent, and priority colors match verified Figma values  |
| `DS-003` | Typography               | Lexend and correct named recipes used; content readable                       |
| `DS-004` | Primary buttons          | Accent/Glass/Outline variants reproduce design with usable states             |
| `DS-005` | Floating navigation      | Position and active states consistent with design; no content obstruction     |
| `DS-006` | Mode switch              | Normal↔Kaca changes appearance, preserves route and data context              |
| `DS-007` | Reduced motion           | No mandatory liquid/3D movement; same information remains available           |
| `DS-008` | Glass legibility         | Foreground contrast remains sufficient over all backgrounds                   |
| `DS-009` | Explorer legend          | Five priority classes + unavailable-data pattern have clear labels            |
| `DS-010` | Data source integrity    | Facts show year, unit, source, and relevant limitations                       |
| `DS-011` | Comparison semantics     | Different definitions block comparison; different years show explicit warning |
| `DS-012` | Region selection         | Selection visible, keyboard alternative usable, detail content coherent       |
| `DS-013` | Priority lab sliders     | Labels and 100%-total interaction work with keyboard                          |
| `DS-014` | Feedback states          | Loading, error, empty, blocked, and demo distinct and understandable          |
| `DS-015` | Responsive               | No blocked controls, missing content, or unintended horizontal overflow       |
| `DS-016` | Accessibility            | Heading order, focus, aria labels, screen reader alternatives verified        |
| `DS-017` | 3D fallback              | All core journeys work when 3D/WebGL fails                                    |
| `DS-018` | Code quality             | Typecheck, lint, formatter, and relevant tests pass                           |
| `DS-019` | Asset integrity          | Approved logos/icons/illustrations used; no unrelated substitutes             |
| `DS-020` | Visual regression        | In-scope desktop result reviewed against correct Figma frame                  |

**No fabricated passing results:** A test is complete only if it was actually executed and its outcome recorded.

---

## 15. Definition of Done (per screen)

A UI feature may be marked **DONE** only when all applicable items pass:

- [ ] Matches the **current** approved Figma frame for intended viewport(s).
- [ ] Public product name is **Nusa Matra**.
- [ ] Uses correct palette, Lexend typography, component variants, and semantic tokens.
- [ ] Reuses shared React components without duplicating entire mode-specific screens.
- [ ] All controls work with pointer and keyboard; loading/errors/empty states handled.
- [ ] Handles Normal/Kaca theme correctly, without resetting business state.
- [ ] Is responsive, readable, zoom-compatible, and screen-reader appropriate.
- [ ] Includes reduced-motion and low-performance fallback for costly animation/3D.
- [ ] Any data visualization includes labels, metadata, meaningful uncertainty/caveats.
- [ ] No prototype number is presented as verified live data.
- [ ] No dead buttons, fabricated data claims, empty handlers, or ignored errors.
- [ ] TypeScript typecheck, lint, and applicable tests pass.
- [ ] A screenshot/visual review and any discrepancies are documented.

---

## 16. Cross-document integration and unresolved decisions

### 16.1 Related documents

| File                                 | Relationship                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `CLAUDE.md`                          | AI execution behavior, repo workflow, coding constraints       |
| `project_guidelines.md`              | High-level brand, engineering, motion and product principles   |
| `docs/01-PRODUCT-REQUIREMENTS.md`    | Requirements, scope, priority, definitions                     |
| `docs/02-USER-FLOWS.md`              | Navigation, actions, state transitions, errors                 |
| `docs/04-TECH-STACK-ARCHITECTURE.md` | Library decisions, providers, router, performance architecture |
| `docs/05-DATA-SOURCES.md`            | Data origin and licenses                                       |
| `docs/06-DATA-MODEL.md`              | Region identifiers and observation metadata                    |
| `docs/07-DECISION-ENGINE.md`         | Scoring, normalization, thresholds, sensitivity                |
| `docs/09-ANIMATION-GUIDELINES.md`    | Exact animation engineering recipes                            |
| `docs/10-TESTING-STRATEGY.md`        | Automated test tooling and CI strategy                         |
| `docs/13-ACCEPTANCE-CRITERIA.md`     | Traceable verification by requirement IDs                      |

### 16.2 Open decisions (`TBD`)

- Exact canonical logo/icon exports and their repository locations.
- Complete spacing, radius, breakpoints, and mobile/tablet behavior from approved artboards (if any).
- Full responsive Figma specifications beyond the verified desktop nodes.
- The authoritative UI success/warning token set for all domain data states.
- Final selected React animation/3D dependencies and bundle budgets.
- Whether both modes are available on every feature screen or only on annotated screens.
- Exact map implementation and geographic source; illustrative 3D/hexagon elements are not authoritative geography.
- Data sourcing, availability, threshold definitions, analytics and methodological approval.

For each unresolved choice, Claude Code should make the safest reversible proposal and record the decision rather than silently declaring it `LOCKED`.

---

## 17. Final Claude Code instruction

> **Implement Nusa Matra from the current Figma, not from generic templates.** The implementation must faithfully reflect Kapur & Kobalt, Lexend, Normal/Kaca modes, floating navigation, domain-specific data views, and purposeful motion. Keep all public copy in Indonesian and all engineering contracts in English. Use React + strict TypeScript. Write clean, modular, testable code. Build original animations if needed, but never sacrifice accessibility, performance, or data integrity for visual polish. Never claim a feature is complete until its behavior, code quality, and visual parity have been verified.

**Next planned document:** `docs/04-TECH-STACK-ARCHITECTURE.md`.
