# Nusa Matra — Project Guidelines

> **WIA 2026 · Official project development guidelines**  
> **Version:** 1.2  
> **Updated:** 19 October 2026  
> **Status:** Final UI/UX reference established; implementation in planning  
> **Website / product name:** **Nusa Matra**  
> **Required frontend framework:** **React + TypeScript**

## 1. Purpose and scope

**Nusa Matra** is a web platform for exploring and understanding Indonesian regional conditions, potential, development needs, and priorities through accessible, interactive, data-driven experiences. The goal is to make complex regional data understandable to general audiences while enabling meaningful comparisons across regions.

The platform should:

- Present regional data with clear, intuitive interactive visualizations.
- Make it easy to explore Indonesia geographically and select an area of interest.
- Support side-by-side regional comparisons using consistent indicators, units, and years.
- Explain potential development priorities transparently and avoid unsupported conclusions.
- Deliver a polished user experience **and** a maintainable engineering foundation.

**Naming rule:** Refer to the public-facing website and product as **Nusa Matra**, not PrioritasKita. The Figma source file currently retains “PrioritasKita” in its filename; treat this as an existing design-file label, **not** the final public brand. Do not rename or edit that Figma file without authorization. Update public UI copy, document titles, page metadata, and app labels to **Nusa Matra** when implementing.

## 2. Source of truth and design fidelity

**Final Figma UI/UX reference:**  
https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2

Figma is the **primary source of truth for visual implementation**. Follow its approved layout, component styling, visual hierarchy, spacing, typography, responsive behavior, navigation, interaction states, and display modes. Do not redesign screens arbitrarily. If an interaction is unspecified, implement an intuitive, accessible interpretation consistent with the design system.

Elements already identified in the Figma design include:

- **Kapur & Kobalt** visual palette.
- **Lexend** as primary typography.
- **Normal** and **Kaca (Glass)** display modes.
- Accent, glass, and outline button variants, each with default/hover states.
- Landing page and _Jelajahi_ (exploration) screen variants.
- A hexagon-style illustrative map and a five-level priority scale.

Do not mistake illustrative map geometry for a validated official geospatial dataset. Live regional mapping must use proper regional boundaries and verifiable data sources.

### Color tokens

```css
:root {
  /* Sea / Kobalt */
  --sea-deep: #1e3fd9;
  --sea: #2f5bff;
  --sea-shallow: #5c7fff;

  /* Land / Kapur */
  --land-1: #fbfaf6;
  --land-2: #ede9df;
  --land-3: #d9d3c3;
  --land-4: #b8af9a;

  /* Core UI */
  --bg: #f2f1ec;
  --accent: #ff8a3d;
  --text-primary: #121826;
}
```

Add remaining semantic, typography, shadow, border, motion, and spacing tokens **after inspecting the actual Figma variables/styles**. Avoid scattering hardcoded visual values throughout the application.

### UX and accessibility

- Keep interfaces clean, intuitive, and usable by nontechnical audiences.
- Make key data values and map legends understandable without specialist knowledge.
- Maintain sufficient contrast in both Normal and Glass modes.
- Support keyboard access, semantic HTML, visible focus indicators, and meaningful accessible labels.
- Preserve usability across desktop, tablet, and mobile.
- Always provide appropriate loading, empty, error, and unavailable-data states.

## 3. Required frontend stack

**React is mandatory** for the frontend. Use **TypeScript** with strict checking.

Recommended supporting technologies (choose only those truly needed):

| Concern         | Recommended approach                                              |
| --------------- | ----------------------------------------------------------------- |
| App framework   | React                                                             |
| Language        | TypeScript (`strict: true`)                                       |
| Build tool      | Vite (unless deployment requirements justify another React setup) |
| Styling         | Tailwind CSS and/or maintainable modular CSS                      |
| Animation       | CSS, Motion, or GSAP, selected per use case                       |
| Real 3D         | Three.js / React Three Fiber where justified                      |
| Mapping         | MapLibre GL JS with appropriate geographic data                   |
| Charts          | Recharts or Apache ECharts                                        |
| Quality tooling | ESLint, Prettier, TypeScript checks                               |
| Testing         | Vitest + React Testing Library                                    |

**Do not introduce multiple libraries that do essentially the same job** without a specific technical justification. Avoid dependencies that add complexity without substantial value.

The backend, database, deployment approach, and final data integrations remain to be selected after requirements and API availability are verified. Candidate solutions may include a structured API, PostgreSQL/PostGIS, caching, and an explicit data-ingestion pipeline; these are **proposals, not locked decisions**.

## 4. Core functional modules

### 4.1 Regional exploration map

- Interactive Indonesia map with geographical navigation.
- Search, select, and inspect supported administrative regions.
- Indicator-based map layers and readable legends.
- Selected-region detail panels.
- Clear data-source, unit, and period metadata.
- Optimized rendering and fallback behavior on less powerful devices.

### 4.2 Regional comparator

- Compare exactly two supported regions in the MVP (owner decision 2026-10-20); more than two is a possible later extension.
- Side-by-side indicator values with the same definitions, units, and periods.
- Understandable charts and comparisons.
- Explicit handling of missing data and differences in reporting periods.
- Source attribution and explanation of methodology.

### 4.3 Dashboard (future feature, not an MVP module)

> Owner decision 2026-10-20: the dashboard is not in the approved Figma or the PRD feature list. Keep it as a potential future feature; it is not a required MVP module.

- Summary indicators and interactive visualizations.
- Region, category, and period filters.
- Data freshness and provenance information.
- Proper loading, error, and empty states.

### 4.4 Priority analysis (planned)

- Highlight indicators potentially requiring attention.
- Explain prioritization assumptions and calculations.
- Distinguish observed facts from interpretations or recommendations.
- Do not present a ranking as objective truth without transparent methodology.

## 5. Animation, 3D, and external design inspiration

**Approved reference sources:**

1. **Final Figma:** authoritative UI/UX appearance and interaction direction.  
   https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2
2. **Fuselab Creative — Cyberdefend:** immersive 3D/motion inspiration.  
   https://fuselabcreative.com/our-projects/cyberdefend/
3. **21st.dev:** reference for React UI components, transitions, animated patterns, and other suitable visual effects.  
   https://21st.dev/

### Mandatory instructions for Claude

- Check the approved Figma first, then consider existing reusable patterns and reference components.
- Evaluate suitability, accessibility, performance, maintainability, and **license/usage rights** before incorporating third-party code or assets.
- Adapt compatible examples to the **Nusa Matra** identity and Kapur & Kobalt palette; avoid mismatched visual styles.
- **If a required animation or 3D interaction cannot be found in an external library or website, design and implement an original custom animation.** Do not drop an important design requirement simply because no ready-made snippet exists.
- Use CSS for simple motion, an animation library for sequenced/scroll-driven effects, and a 3D engine only when a real 3D scene is warranted.
- Encapsulate animation behavior in reusable components/hooks. Clean up event listeners, animation timelines, animation frames, WebGL resources, and observers correctly.
- Respect `prefers-reduced-motion`, offer non-animated alternatives, and ensure animation never obscures data or controls.
- Prefer a smooth, stable experience over visual complexity. Optimize initial load and interaction responsiveness, especially on mobile.

## 6. Clean Code is a mandatory evaluation criterion

> **CRITICAL:** Code structure, cleanliness, readability, and maintainability are **part of the WIA evaluation**. Beautiful visuals do not compensate for disorganized code. Treat code quality as a first-class deliverable from the beginning, not a cleanup task postponed until the end.

### Engineering principles

- Apply **KISS, DRY, YAGNI, and Separation of Concerns** consistently.
- Use **SOLID** principles when they genuinely improve the design; do not create abstractions for their own sake.
- Prefer small, cohesive, understandable components and functions.
- Name variables, functions, components, files, and types descriptively.
- Avoid unused code, dead exports, unnecessary dependencies, and duplication.
- Use comments to explain **why**, not to narrate obvious code.
- Keep complex business logic independent from presentation and animation layers.
- Refactor when a feature grows beyond clear responsibility boundaries.

### React and TypeScript rules

- Use functional React components and strongly typed props.
- Separate fetching/services, data transformation, state orchestration, and UI rendering.
- Extract custom hooks for truly reusable stateful behavior.
- Avoid giant components, deeply nested conditional JSX, unnecessary state duplication, and excessive prop drilling.
- Manage asynchronous side effects with correct cleanup and error handling.
- Use stable keys in lists; avoid premature or ritualistic memoization.
- Enable strict TypeScript; avoid `any` and unsafe assertions where practical.
- Validate API payloads at data boundaries; TypeScript alone does not validate runtime input.
- Use semantic markup, accessible controls, and proper loading/error boundaries.
- Keep styling consistent through centralized tokens and shared components.

### Suggested folder structure

Adapt this structure to the actual scale of the app. Do not create placeholder files or abstractions solely to fill folders.

> The canonical source tree is `docs/04-TECH-STACK-ARCHITECTURE.md` §3 (owner decision 2026-10-20). The tree below is an early sketch kept for history.

```text
src/
├── app/
│   ├── App.tsx
│   ├── routes/
│   └── providers/
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
├── features/
│   ├── landing/
│   ├── exploration/
│   ├── comparison/
│   ├── dashboard/
│   └── priority-analysis/
├── hooks/
├── services/
├── types/
├── utils/
├── constants/
├── styles/
└── assets/
```

Examples of focused components: `RegionMap`, `RegionSelector`, `IndicatorCard`, `ComparisonChart`, `DataFilter`, `GlassPanel`, `AnimatedSection`, and `PriorityLegend`.

### Naming conventions

- React components and types: `PascalCase`.
- Variables, functions, and hooks: `camelCase` (`useSomething` for hooks).
- Feature directories: consistent lowercase names.
- Constants: clear naming; `UPPER_SNAKE_CASE` where appropriate for true constants.
- Prefer names that reflect domain meaning rather than technical implementation details.

### Anti-patterns — do not do these

- Put the entire application into `App.tsx`.
- Fetch data ad hoc in every display component.
- Hardcode large regional datasets into JSX.
- Duplicate a card/chart/map implementation instead of sharing a sensible abstraction.
- Hide TypeScript errors with `any`, `@ts-ignore`, or unjustified assertions.
- Suppress errors or silently fail API requests.
- Leave incomplete placeholder interactions as though they were working.
- Add animation/3D dependencies without performance review.
- Use unlicensed third-party assets or copy proprietary implementation without permission.
- Make a codebase difficult to read purely to shorten it.

## 7. Data correctness and traceability

Potential official Indonesian data sources:

- Badan Pusat Statistik (BPS).
- Satu Data Indonesia.
- Badan Informasi Geospasial (BIG).
- Relevant ministries and regional-government open-data portals.

Candidate indicators include poverty, unemployment, education, healthcare, infrastructure, population, and environmental conditions. **Availability, API access, licensing, geographic granularity, and comparability must be verified before these become committed product requirements.**

Every displayed indicator should include, as available:

- Indicator name and definition.
- Value and unit.
- Area identifier and geographic level.
- Observation year or reporting period.
- Source and source URL.
- Update date and relevant methodology.
- Explicit handling of unavailable or noncomparable values.

Never fabricate a missing value, period, map region, or analytic conclusion. State when data is not available.

## 8. Development stages and priorities

### Phase 1 — React foundation

- Set up React + TypeScript and lint/format/type-check workflows.
- Establish a clear folder architecture and shared design tokens.
- Inspect Figma components, pages, and interaction states.
- Build reusable foundational components and navigation.

### Phase 2 — Faithful UI implementation

- Implement the landing page and navigation using the **Nusa Matra** name.
- Implement approved Normal and Glass display modes.
- Ensure responsive behavior and accessible interactions.
- Add purposeful motion and original animations when needed.

### Phase 3 — Data foundation

- Verify data sources and APIs.
- Define geographical identifiers and indicator schemas.
- Build data services, validation, and error handling.
- Display clear source and reporting-period metadata.

### Phase 4 — Map exploration

- Integrate the geographic visualization.
- Implement search, selection, thematic layers, legends, and detail panels.
- Optimize data fetching and map rendering.

### Phase 5 — Regional comparator

- Build multi-region selection and comparison interfaces.
- Implement consistent indicators, visualizations, and missing-data handling.
- Validate data interpretation and source attribution.

### Phase 6 — Dashboard and priority analysis

- Build charts, filters, and summary indicators.
- Define and validate transparent priority-analysis methodology.
- Clearly distinguish evidence from interpretation.

### Phase 7 — QA, refactoring, and release

- Run automated checks and relevant tests.
- Review architecture and remove avoidable duplication.
- Verify design fidelity, responsiveness, accessibility, and performance.
- Check animation cleanup, bundle weight, and production stability.

### Recommended MVP

First deliver a reliable **Nusa Matra** landing page, navigation, interactive Indonesian map, region search/selection, basic indicators, two-region comparison, and clear data attribution. Advanced ranking and heavy 3D should not delay a stable, accurate core experience.

## 9. Claude's required implementation workflow

For **every feature**:

1. Inspect the corresponding Figma screen and existing project code before editing.
2. Identify existing components, design tokens, and dependencies that can be reused.
3. Plan component responsibilities, data requirements, and interaction states.
4. Implement with **React + TypeScript**, following the Clean Code standards in this file.
5. Implement motion in line with Figma; reference 21st.dev or Fuselab when suitable, and create original animation when needed.
6. Check accessibility, responsive behavior, error states, and performance.
7. Run formatting, linting, TypeScript checks, and relevant tests.
8. Refactor code that is unnecessarily complex or duplicated.
9. Verify the result against Figma, explain any intentional deviations, and summarize completed work.

Where available in the development environment, apply relevant **Matt Pocock TypeScript practices**, **Taste Skill**, and **UI UX Pro Max** guidance. These may enhance implementation quality but do not supersede the final Figma or this document.

**Never claim a verification check has passed unless it was actually run.** If a tool or integration is unavailable, state the limitation and the alternative used.

## 10. Definition of Done

A feature is complete only if the applicable items below are satisfied:

- [ ] UI implementation aligns with final Figma.
- [ ] User-visible branding says **Nusa Matra**.
- [ ] Functionality works, not just the static appearance.
- [ ] React components are cohesive and maintainable.
- [ ] TypeScript strict checks pass.
- [ ] ESLint passes and formatting is consistent.
- [ ] Relevant tests pass or untested areas are transparently noted.
- [ ] No unnecessary duplication, unused imports, or dead code remains.
- [ ] Loading, empty, error, and unavailable-data states are handled.
- [ ] Navigation, keyboard access, focus, and responsive layouts work.
- [ ] Animations are performant and respect reduced-motion settings.
- [ ] Dataset sources, periods, and units are disclosed when relevant.
- [ ] Browser/runtime errors are resolved or explicitly documented.

## 11. Pending decisions

These are **not** locked yet:

- Backend stack, database, and hosting/deployment architecture.
- Exact APIs, permitted usage, and geographic scope of data.
- Province versus regency/city depth for the first release.
- Final indicator selection and historical coverage.
- Priority scoring methodology.
- Whether user accounts or authentication are necessary.
- Which motion/map/chart libraries fit best after implementation profiling.

## 12. Final engineering directive

**Build Nusa Matra as an intuitive, visually polished, data-driven React application whose code quality is demonstrably excellent.**

The three equally important standards are:

1. **UI/UX fidelity:** faithfully implement the final Figma design.
2. **Clean Code and architecture:** create readable, modular, testable, maintainable code.
3. **Interactive experience:** implement purposeful, performant, accessible motion and 3D, including custom animations whenever suitable existing solutions are unavailable.

Do not trade away engineering quality to achieve visual spectacle. Do not sacrifice usability for animation, or correctness for superficial polish.
