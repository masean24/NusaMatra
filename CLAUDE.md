# CLAUDE.md — Nusa Matra Engineering Playbook

> **WIA 2026 · Instructions for Claude Code**  
> **Document version:** 1.0 · **Updated:** 2026-10-19  
> **Product name:** **Nusa Matra**  
> **Mandatory frontend:** React + TypeScript  
> **Status:** Implementation playbook; Figma approved, data/backend decisions pending

## 0. Read this before changing the code

This document is the **operational instruction file** for Claude Code. It complements, and does not replace, [`project_guidelines.md`](./project_guidelines.md). Read **both** files before implementing a feature. If a repository exists, inspect it before running scaffolding commands or selecting dependencies.

### Non-negotiable priorities

1. **Figma fidelity:** Match the approved screen, typography, interactions, and visual identity; do not redesign the product casually.
2. **Clean Code:** Clarity, component boundaries, maintainability, tests, and consistency are part of the WIA evaluation.
3. **Correctness and transparency:** Regional data, comparisons, rankings, and recommendations must be verifiable and explainable.
4. **Purposeful motion:** Implement polished, accessible animation and 3D. If no suitable external component exists, **create the animation yourself**.
5. **Real functionality:** Do not present mock UI, fabricated numbers, dead buttons, or static visual effects as completed live functionality.

### Authority and conflict order

When instructions conflict, follow this order:

1. Explicit instructions from the human project owner in the current task.
2. Approved **Figma** for visual layout, design details, and interaction specifications.
3. `project_guidelines.md` for established product and engineering requirements.
4. This `CLAUDE.md` for execution workflow, implementation patterns, and implementation-stage recommendations.
5. Existing repository conventions, unless they violate the above.
6. Third-party component demos, examples, libraries, and personal preferences.

**Design source:** [Nusa Matra / prior Figma filename](https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2). The URL's old filename is not the public product name; brand the implementation **Nusa Matra**. Do not modify the source Figma without explicit authorization.

**Important classification:** Figma can contain examples, sample rankings, illustrative map shapes, or _planned_ data-source labels. These are **design examples, not verified live statistics or approved scientific models**.

---

## 1. Product understanding

**Nusa Matra** helps users explore Indonesian regions, understand development indicators, compare places, examine possible priorities, inspect supporting evidence, and see where underlying data may be incomplete or incomparable. The product should make complex regional data understandable to non-specialists.

### Users and outcomes

| User                   | Need                    | The interface should enable                                       |
| ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| General public         | Understand their region | Find location, see indicators and plain-language explanations     |
| Student/researcher     | Evaluate data           | Inspect sources, years, units, gaps, comparison constraints       |
| Community/organization | Explore priorities      | Adjust assumptions, interpret rankings, see limitations           |
| Decision-support user  | Check robustness        | Understand scores, evidence passport, sensitivity and blind spots |

Never imply the website issues binding policy decisions. Rankings are conditional analyses, not objective judgments about the value of a community.

### Language and labeling

- Public-facing UI: **Bahasa Indonesia**, unless an existing Figma label specifies otherwise.
- Source code symbols, type names, filenames, and technical comments: clear **English** by default.
- Use **Nusa Matra** in page titles, logo alt text, headers, metadata, download filenames, and product references.
- Use localized numbers and dates consistently; display units explicitly. Avoid ambiguous comma/period formatting.

---

## 2. Verified Figma inventory (inspection on 2026-10-19)

These frames were identified in the provided Figma design. The IDs are useful anchors for subsequent visual inspection. **Inspect the actual screen, components, and interaction details before implementing it.** A frame's existence does not mean its functionality has been implemented.

| Area / feature                  | Figma node                                                             | Observed design intent                                     | Suggested stage           |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------- |
| Design tokens / components      | `26:38`, `26:14`, `26:37`                                              | Kapur & Kobalt tokens; button variants; Normal/Kaca switch | Foundation                |
| Peta Utama hub (Normal/Kaca)    | `61:1183`, `61:1619`                                                   | Main map-oriented entry / hub                              | MVP / confirm flow        |
| Landing Normal / Kaca           | `27:2`, `27:118`                                                       | Long-form home page; different display modes               | MVP                       |
| Landing motion / 3D annotations | `43:250`, `43:713`                                                     | Scrolling motion, diorama, animated scenes                 | Foundation + polish       |
| Jelajahi Normal / Kaca          | `29:34`, `29:485`                                                      | Map exploration and regional interaction                   | MVP                       |
| Bandingkan                      | `12:840`                                                               | Two-region comparison and contextual explanation           | MVP                       |
| Lab Prioritas                   | `11:152`                                                               | User-adjustable criteria weights and re-ranked regions     | Phase 2                   |
| Mengapa Diprioritaskan          | `12:263`                                                               | Explain score contributions and alternate assumptions      | Phase 2                   |
| Uji Rekomendasi                 | `13:854`                                                               | Sensitivity / robustness testing of recommendations        | Phase 3                   |
| Paspor Bukti                    | `13:446`                                                               | Traceable report of assumptions, result, sources, limits   | Phase 3                   |
| Titik Buta Data                 | `14:541`                                                               | Missing data, mismatched years, blocked comparisons        | Data foundation + Phase 3 |
| Cerita Wilayah                  | `14:927`                                                               | Scroll-driven narrative with diorama and chapter progress  | Phase 3 / polish          |
| Liquid theme transitions        | `30:1467`, `30:479`, `30:955`, `42:330`, `42:780`, `63:858`, `63:1319` | Specific Normal ↔ Kaca animation design                    | After theme foundation    |
| Floating navigation             | `49:304`, `49:447`, `62:1291`                                          | Floating navbar and page-pill components                   | Foundation                |

**Additional note:** The Figma file contains archived visual versions. Do **not** build from nodes prefixed `ARSIP` when newer variants exist.

### What is known vs. what must still be inspected

**Known:** screen/feature names, basic content, some interactions and motion annotation text, palette, font family.  
**Still inspect in Figma:** exact hierarchy, component behavior, responsive variants, all spacing and type scale, static assets, navigation flow, interactions between screens, and detailed geometry. Never hallucinate this information based on node names.

---

## 3. Approved visual direction and tokens

### Identity

- Palette: **Kapur & Kobalt** (limestone/land + cobalt/sea), with orange action accents.
- Primary typeface: **Lexend**.
- Presentation modes: **Normal** and **Kaca (Glass)**.
- Buttons: **Aksen**, **Kaca**, **Garis** with default/hover states; implement keyboard focus, pressed, loading, and disabled behavior as needed.

Seed color tokens (complete semantic tokens only after inspecting Figma):

```css
:root {
  --sea-deep: #1e3fd9;
  --sea: #2f5bff;
  --sea-shallow: #5c7fff;
  --land-1: #fbfaf6;
  --land-2: #ede9df;
  --land-3: #d9d3c3;
  --land-4: #b8af9a;
  --bg: #f2f1ec;
  --accent: #ff8a3d;
  --text-primary: #121826;
}
```

**Do not** interpret these as a complete token system. Create semantic aliases after inspecting design variables: `--color-surface`, `--color-border`, `--color-text-muted`, `--color-focus-ring`, etc. Centralize radius, shadows, spacing, z-index, and motion durations. Do not generate dozens of unused CSS variables.

### Priority legend

The design includes a five-level scale:

1. Sangat rendah
2. Rendah
3. Sedang
4. Tinggi
5. Sangat tinggi

The scale visually transitions from lighter limestone to orange over cobalt. **Always show textual labels and numerical context; color alone cannot convey meaning.** Clarify whether the level represents _priority_, _hazard_, or _an underlying indicator_, because these are not interchangeable.

### Glass mode

Figma's glass example describes a translucent light surface, backdrop blur around `16px`, elevated saturation, a light border, and a subdued blue shadow. Use actual inspected component values as authoritative rather than applying one generic `backdrop-filter` everywhere.

### Responsive behavior

- Build desktop layouts with the supplied 1440px Figma artboards as starting references, **not** as fixed-width-only pages.
- Adapt interaction to touch and narrow screens: cards stack, tables may scroll with sticky labels, controls remain reachable, maps and 3D remain usable.
- Never create horizontal overflow for the whole page unintentionally.
- Support zoomed text, keyboard use, contrast preferences, and reduced motion.

---

## 4. React stack and architecture decisions

### Locked decisions

- **React** is mandatory.
- **TypeScript** with `strict: true` is mandatory.
- Follow repository package-manager and build conventions if they already exist.
- Component modularity, type safety, accessible interactions, and automated code-quality checks are mandatory.

### Recommendations, not yet locked

- **Vite** for an initially client-rendered React application.
- React Router for client-side navigation (if routes are genuinely needed).
- Tailwind CSS or CSS Modules for maintainable styling; align with the existing codebase.
- One principal animation library (e.g., Motion **or** GSAP) in addition to CSS; justify overlap.
- React Three Fiber/Three.js for 3D diorama scenes, if 3D genuinely requires WebGL.
- MapLibre GL JS for verified interactive geospatial boundaries.
- Recharts or ECharts for charts, selected based on required accessibility and interactivity.
- Vitest and React Testing Library for unit/integration tests.

**Do not add every recommended dependency immediately.** Add the smallest justified set per implementation slice. Ask for a decision only when a genuine architectural blocker cannot be resolved from the repo, Figma, or requirements. Keep proposed choices labeled as proposals until confirmed.

### Repository inspection checklist — always first

1. Read `package.json`, lockfile, TypeScript config, linter/formatter config, environment files, routing configuration, and existing source folders.
2. Identify existing design-system components, tokens, icon package, maps, charts, fonts, animations, and tests.
3. Confirm build scripts and actual package manager. Do not overwrite existing setup.
4. List code relevant to the requested feature; reuse suitable existing modules.
5. Create a concise implementation plan with impacted files, states, data dependencies, and test strategy.

### Recommended project shape

Adapt to the existing repository; these are boundaries, not mandatory empty directories.

```text
nusa-matra/
├── CLAUDE.md
├── project_guidelines.md
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes/
│   │   └── providers/
│   ├── components/
│   │   ├── ui/                 # buttons, inputs, cards, modal, badge
│   │   ├── layout/             # shell, floating nav, page header
│   │   └── feedback/           # empty/error/loading/unavailable states
│   ├── features/
│   │   ├── landing/
│   │   ├── map-hub/
│   │   ├── exploration/
│   │   ├── comparison/
│   │   ├── priority-lab/
│   │   ├── explanation/
│   │   ├── recommendation-test/
│   │   ├── evidence-passport/
│   │   ├── data-blindspots/
│   │   └── region-stories/
│   ├── data/
│   │   ├── adapters/          # API -> validated domain models
│   │   ├── fixtures/          # transparently labeled demo data
│   │   └── schemas/           # runtime validation at boundaries
│   ├── domain/
│   │   ├── geography/
│   │   ├── indicators/
│   │   ├── comparability/
│   │   └── prioritization/    # pure testable calculations
│   ├── hooks/
│   ├── services/              # HTTP or repository interfaces
│   ├── lib/                   # small general-purpose utilities
│   ├── styles/
│   ├── assets/
│   └── test/
└── docs/                      # optional decision records/contracts
```

### Architectural dependency direction

```text
Screen / feature UI
       ↓
Feature hooks / orchestration
       ↓
Application services / repository interfaces
       ↓
Adapters + validation + external APIs

Pure domain logic (comparisons, ranking, normalization)
  ↑ used by feature orchestration and tested independently

Animation / 3D primitives
  ↑ used by visual layers, never as source of business truth
```

Rules:

- UI must not implement geospatial calculations or ranking math inline.
- Data adapters must not contain JSX.
- Visual animation must not determine analytical results.
- Do not scatter direct `fetch()` calls across presentation components.
- Keep remote schema validation and domain normalization at explicit boundaries.
- Prefer composition to clever inheritance or speculative abstraction.

---

## 5. Page model and feature contracts

Proposed route slugs below are **implementation suggestions**. First inspect Figma navigation and repository routing; preserve any established route scheme. Every visible navigation element must lead somewhere meaningful or be clearly disabled as an upcoming feature.

| Feature                | Candidate route    | Core user action                               | Success condition                                   |
| ---------------------- | ------------------ | ---------------------------------------------- | --------------------------------------------------- |
| Landing                | `/`                | Learn purpose, search, enter experience        | Valid navigation into the main hub/exploration      |
| Peta Utama / hub       | `/peta`            | View overview and select an exploration path   | Selected state reflected in UI                      |
| Jelajahi               | `/jelajahi`        | Search/select region, indicator, and map layer | Map, legend, and details stay synchronized          |
| Bandingkan             | `/bandingkan`      | Choose region A/B and see differences          | Comparable indicators rendered with sources         |
| Lab Prioritas          | `/lab-prioritas`   | Adjust criteria weights and view ranking       | Score/rank recompute consistently                   |
| Mengapa Diprioritaskan | `/mengapa`         | Inspect score breakdown                        | Contributions sum to displayed score                |
| Uji Rekomendasi        | `/uji-rekomendasi` | Change assumptions, test stability             | Reproducible results and clear interpretation       |
| Paspor Bukti           | `/paspor-bukti`    | Inspect traceable result document              | Snapshot includes data/model/provenance/limitations |
| Titik Buta Data        | `/titik-buta-data` | Examine data-quality issues                    | Missing/blocked items clearly identified            |
| Cerita Wilayah         | `/cerita-wilayah`  | Navigate chapters with visual narrative        | Text and accessible alternative both work           |

### 5.1 Landing and main hub

- Reproduce Figma hero, interactive entry points, floating navigation, Kapur & Kobalt design, and Normal/Kaca variants.
- Maintain legible content even if 3D fails to load or reduced motion is enabled.
- Search should navigate to a valid result or present a useful no-result message; do not provide a dead search field.
- Match the designed page sections; use motion annotations in §7.

### 5.2 Jelajahi — geographic exploration

State model should be explicit: selected geography, administrative level, selected indicator, year, map mode/layer, map viewport, and panel visibility.

Expected behaviors:

1. Search a supported region by canonical name or aliases.
2. Select a map feature (mouse, touch, or keyboard-accessible alternative).
3. Highlight it and update detail panel without inconsistent state.
4. Change indicator/year and update both legend and mapped values.
5. Expose metadata: value, unit, year, source, method, and availability.
6. Provide loading/error/no-data and no-match states.
7. Clean up listeners, layer resources, and pending requests.

**Critical:** Figma's hexagonal Indonesia map is explicitly illustrative. Do not treat the artwork as a geographic boundary dataset. Use a valid geographic source for precise map interaction, and label illustrative/cartographic experiences appropriately.

### 5.3 Bandingkan — two regions

Figma shows two area selectors and a swap control; use two-region comparison as the MVP. The example compares Kabupaten Cianjur and Kota Semarang, but **these are design examples, not fixed inputs**.

Required rules:

- Allow selecting supported A and B regions and swapping them.
- Match indicators by stable ID and compatible definition, measurement method, unit, denominator, and relevant spatial coverage.
- If incompatible: **block numeric comparison** and explain why, while optionally showing separate values.
- If years differ: explicitly show both years and a caveat; whether to show a calculated difference depends on indicator policy.
- Avoid misleading ratios on zero, near-zero, negative, incompatible or missing values.
- Distinguish higher/lower from better/worse. For protective indicators, higher may be desirable.
- Distinguish observed difference from inferred causation.
- Preserve accessible textual summaries for charts/bars.

### 5.4 Lab Prioritas — interactive weighting

Figma shows a proof-of-concept _model v0.1_ labeled **rata-rata berbobot**: adjustable criteria sliders, a visible 100% total, auto-adjustment of other weights, reset button, and a ranking that reacts to changes. The **scoring model is not approved as a production methodology solely because it appears in the design**.

For a controlled DEMO implementation:

- Canonical weights are nonnegative **integer basis points summing to exactly 10000** (owner decision 2026-10-20; see `docs/07-DECISION-ENGINE.md`). UI percentages are a display projection only.
- On one slider change, redistribute remaining weights using a clearly specified deterministic rule; if all others are zero, fall back to a safe documented policy.
- Treat indicator orientation explicitly: risk/need indicators vs. service/protective indicators.
- Use domain-pure functions; do not calculate scores in JSX or CSS animations.
- Keep rankings stable on ties using documented secondary sort (e.g., canonical region code).
- Show model version, active criteria, weights, geographic scope, data period, and data completeness.
- Label demo rankings as _contoh/simulasi_ until the model and real dataset are validated.

Do not imply a universe of 514 kabupaten/kota is covered unless the actual ingested dataset proves it; that number appears as a Figma sample.

### 5.5 Mengapa Diprioritaskan — explainability

Figma expresses a score as a sum of weighted contributions: `nilai ternormalisasi (0–1) × bobot`. It also shows alternate weight scenarios.

Implement:

- Human-readable reason with transparent caveats.
- Criterion-level raw value (when available), normalized value, weight, contribution, and source.
- Contributions whose sum matches the displayed unrounded score within numerical tolerance.
- Alternative scenarios recalculated from the **same underlying model**.
- Explicit note that changed weights may change ranks; do not state rank counterfactuals without computing them.
- Visible handling of missing/unusable criteria.

### 5.6 Uji Rekomendasi — robustness

Figma illustrates random perturbations of weights (±10%), one-indicator-out analysis, and prior-year analysis where available. The “500 percobaan” and 92% stability are **illustrative sample results**.

Implement after scoring has been validated:

- Expose exactly which assumptions are being tested.
- Use reproducible seeded random experiments; store seed, run count, perturbation rule, scope, and model version.
- Re-normalize perturbed weights and enforce bounds.
- Use deterministic ranking/tie handling.
- Report rank ranges, top-k retention, and sample size honestly.
- Disable tests requiring missing historical data and state why.
- Avoid the words “stable”, “robust”, or percentages without an actual computed result.
- Use a worker or non-blocking execution if experiment cost risks freezing interactions.

### 5.7 Paspor Bukti — traceable evidence snapshot

Figma portrays a report-like artifact including question, ranked output, indicators/sources, model assumptions, robustness, and limitations.

A passport must contain a **single consistent snapshot** of:

- User's analytical question / geographic scope.
- Timestamp and generated report identifier (unique per actual report; demo IDs clearly marked).
- Selected region set and indicator definitions.
- Exact weights and selected model version.
- Data sources, periods, retrieval/last-updated metadata, and permissible links.
- Results and relevant explanation.
- Missing or noncomparable data and other limitations.
- Robustness assessment only if an assessment was actually run.

If PDF/download/export is not implemented, do not render an apparently working export button; implement it in a separately agreed scope.

### 5.8 Titik Buta Data — data-quality review

Figma contains distinct cases: incompatible methodology, mismatched observation years, missing values, and unaffected/complete records. Each needs a severity and an actionable explanation.

Required issue taxonomy (adjust after data-contract validation):

- `MISSING_VALUE`
- `INCOMPATIBLE_DEFINITION`
- `INCOMPATIBLE_UNIT`
- `YEAR_MISMATCH`
- `LOW_COVERAGE`
- `UNVERIFIED_SOURCE`

Each issue includes affected regions/indicators, reason, severity, recommended action, and whether it **blocks comparison** or merely warns. This feature must be driven by **actual validation output**, not a static list that pretends to diagnose the current dataset.

### 5.9 Cerita Wilayah — accessible storytelling

Figma includes a progress indicator (e.g., chapter 2/4), sticky diorama, animated camera, narrative column, and a **Kurangi gerak** switch.

- Implement chapter state and next/back/scroll navigation without scroll hijacking.
- Maintain equivalent textual narrative and data context for users without WebGL.
- Provide an explicit text summary accessible to screen readers for each chapter.
- Illustrations labeled “bukan peta akurat” must **not** imply precise geography.
- Ensure motion toggles immediately stop unnecessary camera/parallax effects.
- Keep statistic statements tied to their source and observed period.

---

## 6. Data contracts, safety rails, and numerical correctness

### Example domain types — adapt to the real API

These illustrate the necessary semantic fields; they are not a ready-made backend contract.

```ts
export type GeographicLevel = 'province' | 'regency' | 'city';

export interface Region {
  code: string; // Official code system: document which one
  name: string;
  level: GeographicLevel;
  parentCode?: string;
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  direction: 'higher_is_better' | 'higher_is_worse' | 'contextual';
  methodologyId: string;
  category: string;
}

export interface Observation {
  regionCode: string;
  indicatorId: string;
  period: string; // e.g., '2023'; preserve source period semantics
  value: number | null; // null means unavailable, NEVER silently zero
  sourceId: string;
  sourceUrl?: string;
  retrievedAt?: string;
  qualityFlags: string[];
}

export interface ComparisonAssessment {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}
```

### Trust and normalization rules

1. Prefer verified official statistics and geospatial sources. Candidate sources: BPS, Satu Data Indonesia, BIG, relevant ministries. Check real availability, access restrictions, licensing, and update frequency before integration.
2. Record geographic code system, boundary vintage, administrative hierarchy, and temporal coverage.
3. Runtime-validate data from any HTTP/API boundary. TypeScript interfaces alone do not make remote JSON safe.
4. **Never interpolate or fabricate missing data silently.** `null` is not `0`.
5. Normalize only with documented direction, reference group, min/max parameters, and clipping strategy.
6. If all reference values are equal, avoid division by zero; use an explicit approved neutral/unrankable policy.
7. Do not compare two figures simply because both share an indicator label.
8. Keep raw measurement separate from derived index/score and display which one is shown.
9. Keep scoring formulas and model parameters versioned and testable independently of UI.
10. Store provenance for any generated statement; never present speculative policy claims as facts.

### Demo scoring formula — NOT automatically approved for live decisions

If the owner explicitly authorizes using the Figma model v0.1 as a demo and all input values have been normalized consistently:

```text
score(region) = Σ [normalized_value(region, criterion_i) × weight_i]
Σ weight_i = 1
0 ≤ weight_i ≤ 1
```

- Flip orientation / transform protective indicators as needed and document the transformation.
- State reference population and period for normalization.
- Define how to handle incomplete criterion vectors **before** ranking. The Figma examples show redistribution with disclosure; that is a policy choice, not a universally safe default.
- Explain whether higher scores represent greater **need/priority**, not greater prosperity.
- Never run scoring from incomplete input without an explicit missing-data policy.

### API architecture

Use a repository interface that permits swapping demo fixtures for actual API responses without changing presentational components:

```ts
export interface RegionRepository {
  search(query: string): Promise<Region[]>;
  getByCode(code: string): Promise<Region | null>;
}

export interface IndicatorRepository {
  listDefinitions(): Promise<IndicatorDefinition[]>;
  listObservations(input: {
    regionCodes: string[];
    indicatorIds: string[];
    periods?: string[];
  }): Promise<Observation[]>;
}
```

Implement live adapters only after verifying the actual API and its authentication, CORS, usage rights, pagination, units, and rate limits. If live data is unavailable, use **clearly branded DEMO fixtures**, with every demo-derived result visibly marked as non-live.

### Privacy and security

- Never commit API keys, credentials, access tokens, `.env.local`, or private data.
- Use environment variables for public configuration; do not assume a `VITE_`-prefixed variable is secret (it is included in the browser bundle).
- Route credentials and restricted calls through a controlled backend where required.
- Validate external URLs and sanitize/safely render untrusted content; never inject raw HTML from external datasets.
- Avoid collecting personal user data unless required and approved.

---

## 7. Motion, 3D, and visual engineering specification

### Source order for animation

1. Exact motion annotations and interactive design in Figma.
2. Existing clean components/animations in the repository.
3. Carefully assessed references from [21st.dev](https://21st.dev/) and [Fuselab Cyberdefend](https://fuselabcreative.com/our-projects/cyberdefend/).
4. **Original custom implementation** by Claude Code if no suitable implementation exists.

21st.dev is a component registry with code contributed by different authors. **Inspect the individual component code, dependencies, quality, compatibility, and license**; do not copy blindly. Never let third-party styling replace Kapur & Kobalt identity.

### Scrolling motion from Figma annotations

General rule in the design:

- Reveal once when roughly **20% of an element** enters the viewport.
- Translate **16–32px** with an opacity entrance over **600–700ms**.
- Use `cubic-bezier(0.16, 1, 0.3, 1)` where the design specifies the **Tenang** easing.
- Stagger related elements by **80–100ms** where specified.
- `prefers-reduced-motion` or user setting: display content without motion; do not just shorten it to a distracting blink.

| Figma annotation | Desired behavior                                                                      |
| ---------------- | ------------------------------------------------------------------------------------- |
| G1               | Hero title, description, search, buttons reveal in a short stagger                    |
| G2               | Diorama enters, cards follow; subtle cursor parallax up to about ±6°                  |
| G3               | Section heading plus five-step stagger                                                |
| G4               | 3D island rises/splits into three layers as user scrolls **without scroll hijacking** |
| G5               | Background scales `0.96 → 1`; weight bars fill sequentially                           |
| G6               | Example ranking rows reorder once with FLIP-like transition; change chip pulses once  |
| G7               | Three data-state cards stagger; icons stamp in                                        |
| G8               | Evidence passport rotates gently and orange stamp lands; preview follows              |
| G9               | Diorama camera moves to island, water rises, narrative card enters                    |
| G10              | Three source cards stagger in                                                         |
| G11              | CTA reveal and one-time search field highlight                                        |

**Do not animate fake analytical outcomes:** G6 ranking choreography is an illustrative landing demo. The actual Lab ranking must respond to valid data and weight changes.

### Figma 3D zones

- **3D-1:** Nusantara diorama in hero: cobalt sea plate, layered limestone islands, orange data markers; parallax; transition toward exploration.
- **3D-2:** Layered data island split into risk/social/services layers, based on scroll progress.
- **3D-3:** Animated translucent orange data columns changing with weight sliders.
- **3D-4:** Floating Paspor Bukti / orange stamp as a transparency visual.

Use high-quality 2D/SVG/CSS alternatives when real WebGL adds cost without meaningful depth, and provide static fallback on unsupported devices. If building genuine 3D, abstract renderer/camera from page data, clean up geometries/materials/listeners, control DPR, and avoid expensive continuous rerenders when static.

### Normal ↔ Kaca liquid theme transition (Figma `30:1467`)

Figma annotates approximately **0.95 seconds** overall:

1. Toggle droplet moves with spring-like motion (~`420ms`).
2. New theme color expands organically from toggle (~`420ms`, easing `cubic-bezier(.65,0,.35,1)`), with small droplet effects.
3. Liquid fills viewport and fades into new theme (~`520ms`, easing `cubic-bezier(.16,1,.3,1)`).

Timing phases may overlap; do not sum their durations mechanically. Figma suggests stacked theme layers with animated SVG/blob `clip-path`, a restrained gooey SVG filter, or an appropriate shader solution. **Implement the easiest maintainable version that faithfully matches the intended visual result.**

Mandatory behaviors:

- Toggle is accessible (`role="switch"` or semantically equivalent; label **“Mode tampilan kaca”**; `aria-checked`).
- Persist the preference to `localStorage` after client capability checks; apply it **before first visible render** to avoid flicker.
- Do not cause duplicate screens to be interactable during the transition.
- Reduced motion: approximately `200ms` simple crossfade or no motion per user preference.
- When `prefers-reduced-transparency` is recognized or `prefers-contrast: more` is active, prefer solid surfaces / disable Glass presentation according to design intent.
- Ensure readable text (the Figma spec targets at least 4.5:1 contrast).
- Limit excessive `backdrop-filter` usage (Figma suggests no more than roughly six active glass panels per view; lower blur on weaker devices).
- Cancel/reconcile interrupted transitions on rapid repeated toggles.
- Test first load, reloading with saved setting, keyboard toggle, and route changes.

### Animation quality gate

- No inaccessible animation-only information.
- No infinite decorative GPU load while offscreen.
- Proper cleanup of observers, timelines, RAF, WebGL resources.
- No CLS caused by entrance animations.
- Text remains legible against 3D/glass layers.
- Interactive charts/map labels respond without severe input latency.
- Reduced-motion and static fallback verified.

---

## 8. Clean Code and implementation conventions — grading critical

### Rules

- Follow KISS, DRY, YAGNI, explicit naming, separation of concerns, and relevant SOLID principles **without overengineering**.
- A component should have an understandable responsibility; extract only when doing so clarifies behavior or enables reuse.
- Keep domain math as pure functions and deterministic where possible.
- Use strict TypeScript and explicit API boundary validation; avoid `any`, `@ts-ignore`, and unjustified type assertions.
- Do not use `useEffect` for derivations that can be computed from props/state; use effects for external-system synchronization and clean up correctly.
- Keep server state, transient UI state, filters, derived values, and persisted preferences conceptually separate.
- Minimize boolean-prop explosions, giant switch statements, nested ternaries, global state, and direct DOM mutation.
- Preserve semantic HTML, visible focus, keyboard control, meaningful labels, and accessible error messages.
- Replace magic numbers with descriptive constants only when they encode domain or repeated design concepts; avoid constant files full of one-off values.
- Comments explain reasoning, algorithms, assumptions, or tradeoffs—not obvious syntax.
- Do not leave dead buttons, dummy external links, silent catches, unused imports, or unverified analytics.

### Suggested naming and import patterns

```text
RegionMap.tsx                 React component
RegionMap.module.css          Component-local CSS (if CSS Modules chosen)
useRegionSelection.ts         Hook only when it truly coordinates behavior
regionRepository.ts           Data-source interface/adapter
computePriorityScore.ts       Pure domain function
computePriorityScore.test.ts  Domain test beside implementation
```

Use a consistent import strategy (project aliases only if already configured), avoid circular dependencies, and make public feature exports explicit. Do not generate a barrel (`index.ts`) for every folder without need.

### Dependency discipline

Before adding a package:

1. Check whether the repo already has an appropriate capability.
2. Confirm that the dependency solves a concrete issue and supports the chosen React setup.
3. Assess package size, security/maintenance, accessibility, and license.
4. Document unusual tradeoffs.
5. Remove unused packages and generated scaffolding.

### Skill use in Claude environment

When **available and relevant**, apply Matt Pocock/TypeScript guidance, Taste Skill, and UI UX Pro Max. These are aids, not authority to override Figma or user requirements. Do not claim a skill was executed if it is unavailable.

---

## 9. Error/loading/accessibility checklist for each feature

Every asynchronous or data-driven screen needs clearly designed states:

| State             | Expected behavior                                                 |
| ----------------- | ----------------------------------------------------------------- |
| Initial           | No blank screen or uninitialized flicker                          |
| Loading           | Skeleton/progress appropriate to layout, not fake statistics      |
| Success           | Values with units, periods, and source context                    |
| No results        | Helpful Indonesian message and recovery action                    |
| Missing data      | Explicit `Data tidak tersedia` with reason when known             |
| Incomparable      | Block numeric comparison with explanation                         |
| Request error     | Accessible error, retry option, no misleading stale success state |
| Offline/slow      | Graceful recoverable behavior                                     |
| Reduced motion    | Equally functional static experience                              |
| Unsupported WebGL | Useful 2D/static fallback                                         |

Use proper headings and landmarks, focus placement after navigation/modals, keyboard reachable map alternatives, semantic table headers, text equivalents for charts, and touch-friendly controls.

---

## 10. Testing and verification strategy

### Mandatory automated categories

**Domain unit tests**

- Normalization and indicator orientation.
- Score calculations and contribution sums.
- Slider redistribution preserving total weight.
- Stable rank tie-breaking.
- Zero denominators and invalid ratios.
- Missing values and incompatible comparability assessments.
- Sensitivity simulation reproducibility (same input + seed = same output).

**Component/interaction tests**

- Navigation, responsive menu, and floating nav state.
- Theme toggle, saved mode initialization, reduced-motion behavior.
- Region search/select/swap.
- Empty, error, retry, missing, and blocked states.
- Weight controls, reset, and ranking recalculation.
- Evidence passport snapshot consistency.

**End-to-end smoke flow** (tool permitting)

1. Home → Jelajahi → select region → inspect indicator metadata.
2. Jelajahi → Bandingkan → select two regions → swap → inspect differences.
3. Lab (when enabled) → edit weights → inspect explanation → return.
4. Verify theme state across navigation/reload.
5. Verify reduced motion and keyboard-only basic navigation.

### Quality scripts

Prefer consistent scripts in `package.json` when creating a new project:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "test": "vitest run"
  }
}
```

These are **examples only**, not guaranteed commands for an existing repository. Adjust TypeScript project references, Vite config, and test runner to the actual workspace. Do not blindly overwrite existing scripts. Report exactly which commands ran and their results.

### Visual verification

- Inspect the relevant Figma frame and compare the implemented screen at the same viewport.
- Check typography, color, spacing, visual hierarchy, buttons, cards, controls, header/nav, map, animations, and glass states.
- Validate desktop and at least representative tablet/mobile widths (for example, 1440, 768, 390 CSS px), with actual layout-driven responsive decisions.
- Check real device/performance constraints for 3D where feasible.
- Document intentional deviations rather than silently changing the design.

### Performance measurement

Track rendering/interactivity using appropriate tools, rather than declaring performance “good” based on appearance alone. Lazy-load heavy routes/scenes, reduce GeoJSON detail where appropriate, avoid animation-induced main-thread stalls, and use bounded WebGL frame work. Do not invent benchmark results.

---

## 11. Recommended implementation order and handoff gates

Implement **vertical slices**: each milestone should produce working, testable behavior with no hidden fake functionality. The phase boundaries are flexible; depend on approved data and design scope.

### Milestone 0 — Repository and Figma audit

**Deliverables**

- Existing repo assessment: stack, dependencies, lint/test status, assets, build workflow.
- Figma screen/asset/token inventory, prioritized by source of truth.
- Feature list with explicit MVP / later flags and outstanding API decisions.
- Confirmed approach to maps, animation, and demo/live data distinction.

**Gate:** Can state accurately what is confirmed, unknown, and proposed; no unnecessary file rewrite.

### Milestone 1 — Foundation and branded shell

**Deliverables**

- React + TypeScript application baseline (only scaffold if needed).
- Shared tokens, Lexend, base typography, theme provider, accessibility foundation.
- Floating navigation and reusable Aksen/Kaca/Garis buttons.
- Static but functional app shell, core routes, loading/error components.
- Clean Code tooling and baseline tests.

**Gate:** Build, typecheck, lint, format and relevant tests pass; responsive shell and theme mode function.

### Milestone 2 — Landing / hub / faithful motion

**Deliverables**

- Landing Normal/Kaca versions aligned with Figma.
- Peta Utama hub flow and navigation.
- Meaningful entry search and CTA.
- Figma G1–G11 animations incrementally, prioritizing high-impact patterns; custom 3D where needed.

**Gate:** Real UI interactions, reduced motion, static fallback, and visual review completed. Animation may be layered without delaying core function.

### Milestone 3 — Data and Jelajahi MVP

**Deliverables**

- Approved region/indicator contracts and runtime validation.
- Verified geographic boundary source and normalized region IDs.
- Live API integration if access is verified, otherwise labeled demo adapter.
- Search, select, map layer, legend, region detail, data provenance.

**Gate:** Selection works end-to-end; data provenance and error states are visible; no illustrative hex map masquerading as official geometry.

### Milestone 4 — Bandingkan MVP

**Deliverables**

- Two-region selectors and swap.
- Comparison assessment and explainable blocking rules.
- Side-by-side indicator views and accessible summaries.
- Unit, year, source, direction, and mismatch caveats.

**Gate:** Incompatible values never produce a misleading computed difference; unit tests validate comparability.

### Milestone 5 — Lab and explanation

**Deliverables**

- Approved/demo scoring model, sliders, recomputation and deterministic ranking.
- Explainable weighted contributions and scenario alternatives.
- Explicit warnings for missing criteria and unapproved production claims.

**Gate:** Score/rank math is independently tested and explanations reproduce calculated results.

### Milestone 6 — Trust and advanced experiences

**Deliverables**

- Uji Rekomendasi robustness simulation.
- Paspor Bukti evidence snapshot.
- Titik Buta Data issue reports.
- Cerita Wilayah immersive but accessible narrative.

**Gate:** Generated claims/summaries are grounded in actual source/model data; motion never blocks reading/navigation.

### Milestone 7 — Release hardening

**Deliverables**

- Clean Code/refactor review, security and secrets review, accessibility and responsiveness.
- Test coverage on high-risk domain functions and key flows.
- Asset optimization, bundle analysis, reduced-motion and 3D fallbacks.
- Documentation of limitations, supported geographies, data freshness, and deployment steps.

**Gate:** No knowingly fake functionality remains mislabeled as live; verification results are reported honestly.

---

## 12. How Claude Code must execute every request

Follow this sequence for **each task**:

1. **Read context** — `CLAUDE.md`, `project_guidelines.md`, relevant Figma frames, and impacted repository modules.
2. **Restate target** — one-paragraph scope, in/out boundaries, confirmed constraints, and assumptions.
3. **Make a short file-level plan** — which existing files to modify, whether any new files/dependencies are justified, expected behavior and tests.
4. **Implement the smallest coherent vertical slice** — no unrelated refactor or dependency sprawl.
5. **Handle full states** — success, loading, missing, blocked, error, responsive, keyboard, reduced motion as relevant.
6. **Verify** — run available commands, inspect UI visually, and test the actual feature.
7. **Refactor** — remove duplication, type escapes, unused workarounds, and overly complex logic.
8. **Report** — describe changed files, interaction behavior, tests actually run, deviations, blockers, and next recommended slice.

### Suggested completion report

```text
Feature:
Implemented:
Modified / added files:
Design reference (Figma node):
Data source: LIVE / DEMO / NOT YET CONNECTED
Validation performed:
- Typecheck:
- Lint:
- Tests:
- Build:
- Visual / accessibility check:
Known gaps or limitations:
Next suggested slice:
```

**Never claim tests passed if they were not run. Never silently replace an unavailable live dataset with unmarked fixtures. Never tell the user a missing animation is impossible without first considering a maintainable custom implementation.**

---

## 13. Decision log — intentionally open

**Locked by the owner on 2026-10-20** (details: `docs/adr/0001-frontend-foundation.md`): npm + current Node LTS; Vite + React Router; CSS Modules + CSS custom properties (no Tailwind); this repository is the **frontend only**, and backend/database/ingestion live in the separate **Data Hub** repository, with `docs/08-API-SPECIFICATION.md` as the initial proposed contract; kabupaten/kota is the MVP geographic level; weights are integer basis points; the comparator supports exactly two regions; provisional hosting is a VPS via Coolify.

Unless a newer user decision explicitly locks them, the following remain **TBD**:

- Actual repository package manager and build tooling (Vite is a recommendation).
- Router, state/data-fetching solution, styling approach, and animation library.
- Backend, database, deployment, and hosting.
- Official data APIs, authentication, CORS, rate limits, costs, and licenses.
- Exact administrative scope and reference boundary year.
- Approved indicator set, normalizations, scoring/missing-data policies.
- Production model validation and sensitivity thresholds.
- Public account/login requirements.
- Which advanced features ship in MVP vs. later stages.

**Document each meaningful decision briefly** (what was chosen, why, alternatives, impact) when confirmed. Do not pretend a recommended technology is already mandated.

## 14. Key references

- [Project guidelines](./project_guidelines.md) — overarching requirements and Clean Code rules.
- [Final Figma](https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2) — visual source of truth.
- [21st.dev](https://21st.dev/) — React components, inspiration, author-level license checks.
- [Fuselab / Cyberdefend](https://fuselabcreative.com/our-projects/cyberdefend/) — 3D visual inspiration, not permission to copy proprietary assets.
- [React documentation](https://react.dev/reference/react) — components, hooks, core rules.
- [Vite guide](https://vite.dev/guide/) — only if Vite is selected.

---

**FINAL DIRECTIVE:** Build **Nusa Matra** with the polish of the approved Figma, the clarity of excellent React/TypeScript engineering, and the integrity of traceable data. Code quality is a scored deliverable. Never sacrifice truthful data, accessibility, or maintainability for visual spectacle.
