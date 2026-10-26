# Nusa Matra

**WIA 2026 · Interactive Indonesian Regional Exploration and Decision-Support Platform**

Nusa Matra helps users explore Indonesian regions, understand regional indicators, compare two locations, and—when the underlying data and methods have been reviewed—investigate regional priority scores with transparent evidence. The user-facing experience is in **Bahasa Indonesia**; technical instructions and specifications are written in **English**.

> **Project status:** The React foundation and the full landing page (Normal and Kaca) are implemented. Feature pages are honest "in development" shells. This repository is the frontend only; backend, database and official data integrations belong to the separate Data Hub and are not implemented here. All numbers on the landing are labelled DEMO.

## Identity and visual direction

- **Product name:** Nusa Matra. The Figma file may retain its historical **PrioritasKita** title; that name is not the public website brand.
- **Frontend choice (agreed):** React + TypeScript.
- **Design system:** Kapur & Kobalt; primary font Lexend; Normal and Kaca display modes.
- **Primary Figma:** https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2
- **Animation references:** https://21st.dev/ and https://fuselabcreative.com/our-projects/cyberdefend/ (inspiration; individual component/asset licenses require verification).

## Document authority

**Start with [`project_guidelines.md`](./project_guidelines.md)** for product-wide engineering values. Use docs `01–13` for feature-specific implementation contracts.

| File                                                                         | Purpose                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`project_guidelines.md`](./project_guidelines.md)                           | Branding, React, Clean Code and original animation requirements  |
| [`docs/01-PRODUCT-REQUIREMENTS.md`](./docs/01-PRODUCT-REQUIREMENTS.md)       | Requirements, prioritization and non-goals                       |
| [`docs/02-USER-FLOWS.md`](./docs/02-USER-FLOWS.md)                           | Navigation, interactions, states and user journeys               |
| [`docs/03-UI-UX-DESIGN-SYSTEM.md`](./docs/03-UI-UX-DESIGN-SYSTEM.md)         | Figma nodes, colors, typography, UI components and responsive UX |
| [`docs/04-TECH-STACK-ARCHITECTURE.md`](./docs/04-TECH-STACK-ARCHITECTURE.md) | React architecture and provisional library choices               |
| [`docs/05-DATA-SOURCES.md`](./docs/05-DATA-SOURCES.md)                       | Official Indonesian data providers, licensing and provenance     |
| [`docs/06-DATA-MODEL.md`](./docs/06-DATA-MODEL.md)                           | Entity relationships, persistence and snapshot design            |
| [`docs/07-DECISION-ENGINE.md`](./docs/07-DECISION-ENGINE.md)                 | Weights, normalization, ranking, explainability and sensitivity  |
| [`docs/08-API-SPECIFICATION.md`](./docs/08-API-SPECIFICATION.md)             | Proposed Nusa Matra API endpoints and contracts                  |
| [`docs/09-ANIMATION-GUIDELINES.md`](./docs/09-ANIMATION-GUIDELINES.md)       | Figma G1–G11, 3D-1–3D-4, theme transitions and performance       |
| [`docs/10-TESTING-STRATEGY.md`](./docs/10-TESTING-STRATEGY.md)               | Test pyramid, fixtures, QA and continuous integration            |
| [`docs/11-SECURITY-AND-PRIVACY.md`](./docs/11-SECURITY-AND-PRIVACY.md)       | Threat model, secrets, privacy, licensing and protection         |
| [`docs/12-IMPLEMENTATION-ROADMAP.md`](./docs/12-IMPLEMENTATION-ROADMAP.md)   | Milestones, dependencies, releases and ownership                 |
| [`docs/13-ACCEPTANCE-CRITERIA.md`](./docs/13-ACCEPTANCE-CRITERIA.md)         | Testable criteria, release gates and sign-off                    |

## Feature map

| Priority | Module                 | Key outcome                                                         |
| -------- | ---------------------- | ------------------------------------------------------------------- |
| P0       | Landing + Peta Utama   | Brand story and navigable starting point                            |
| P0       | Jelajahi               | Region selection, map visualization, indicator metadata             |
| P0       | Bandingkan             | Defensible two-region comparison; blocked/incompatible data handled |
| P0       | Normal / Kaca          | Accessible display modes and persisted preference                   |
| P1       | Lab Prioritas          | Editable weights, deterministic scoring and ranking                 |
| P1       | Mengapa Diprioritaskan | Explanation of contributions and counterfactual choices             |
| P1/P2    | Titik Buta Data        | Visible missing, stale and incomparable measurement issues          |
| P2       | Uji Rekomendasi        | Seeded sensitivity and rank robustness analysis                     |
| P2       | Paspor Bukti           | Immutable evidence manifest and export                              |
| P2       | Cerita Wilayah         | Narrative chapters with accessible 3D-free alternatives             |

## Fundamental data integrity rules

1. **DEMO is not LIVE.** Synthetic ranking/examples must show a prominent simulation label.
2. Every measured value needs a stable region/indicator ID, unit, period, definition and source metadata.
3. Missing data is **not** numeric zero.
4. Measurements with incompatible definitions cannot be compared with a calculated delta.
5. Analytical results must pin dataset snapshot, cohort, model and input parameters.
6. Production policy guidance requires reviewed methodology; a weighted demo model is not official recommendation.
7. Official provider API/terms/licensing must be verified independently.

## Development approach

1. Inspect existing repository and read `project_guidelines.md`.
2. Implement foundational design tokens, app shell and React primitives.
3. Deliver DEMO-safe Landing, Jelajahi and Bandingkan vertical slices.
4. Introduce verified-data ingestion only when source permissions and schemas are reviewed.
5. Build decision engine and advanced modules against versioned, testable contracts.
6. Add polish (motion and 3D) progressively, with user-accessible fallback.
7. Pass acceptance criteria and quality gates before release.

Recommended supporting tools (not all formally adopted): Vite, React Router, Tailwind or modular CSS, TanStack Query, MapLibre, Motion or GSAP, Three.js/React Three Fiber, Vitest and Playwright. Add a dependency only when needed and document why.

## Coding standards

**Clean Code and maintainability are part of the WIA evaluation.** Use strict TypeScript, semantic React components, feature-based modules, single sources of truth for scoring, and consistent design tokens. Test API boundaries, pure calculations, interactions and reduced motion. Never pass off screenshots, mocks or speculative provider data as complete production features.

## Getting started

Requires Node.js 24 LTS (see `.nvmrc`) and npm.

```bash
npm install
npm run dev                  # http://localhost:5173, LIVE data from the public Data Hub
```

Quality gate:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test        # Vitest + Testing Library
npm run build       # type-checks, then builds to dist/
npm run test:e2e    # Playwright smoke tests against the production preview (uses local Chrome)
```

Deployment (provisional VPS/Coolify target): serve `dist/` as static files with a history fallback to `index.html`, so deep links such as `/bandingkan` load directly.

Source layout: `src/app` (router, layout), `src/components` (shared UI), `src/features/*` (landing, navigation, theme, motion, feature shells), `src/domain` (pure scoring rules), `src/data/fixtures` (DEMO data only), `src/styles` (Figma tokens). See `docs/adr/` and `docs/implementation-notes/landing.md` for the decisions behind this slice.

## Open owner decisions

- Backend/server hosting and persistent database.
- Final geographic scope and official source access agreements.
- Production indicator/methodology approval.
- Auth/sharing and evidence retention if introduced.
- CI/deployment and measured performance thresholds.
- Exact mobile Figma requirements if further frames become available.

## Contributor / Claude Code checklist

- [ ] Read feature requirements and relevant Figma nodes.
- [ ] Distinguish locked decisions from proposed solutions.
- [ ] Implement a single coherent slice with correct DEMO/LIVE labeling.
- [ ] Add type-safe contracts and meaningful tests.
- [ ] Check keyboard, mobile, contrast, reduced motion and WebGL fallback.
- [ ] Run quality checks and report actual results.
- [ ] Update docs and ADRs for changed contracts or decisions.

**Documentation status:** All 13 planned specification documents are present. This statement describes **documentation coverage**, not completed product implementation.
