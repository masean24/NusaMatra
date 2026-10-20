# 13 — Acceptance Criteria, Definition of Done & Release Sign-off

**Product:** Nusa Matra · **Version:** 1.0 · **Updated:** 2026-10-19  
**Audience:** Claude Code, reviewers, product owner, QA  
**Status:** Executable acceptance contract; release scope and approvers are `TBD`

> **One principle governs release:** Only claim that a feature or data mode is complete when its implementation has been exercised and supported by verifiable evidence. A matching screenshot, mock API or AI-generated report is insufficient on its own.

## 0. How to use this file

1. Determine the feature priority (`P0`, `P1`, `P2`) using `01-PRODUCT-REQUIREMENTS.md`.
2. Select matching `AC-*` criteria below.
3. Link each criterion to a requirement ID, test(s), Figma node and actual implementation.
4. Implement the smallest tested vertical slice.
5. Record `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` or `N/A` with evidence and ownership.
6. Never convert `BLOCKED` or `NOT_RUN` to `PASS` without running/observing the test.
7. A DEMO-only acceptance does **not** authorize LIVE language or policy recommendations.

### Status vocabulary

| Status    | Meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| `PASS`    | Implemented and actually verified with evidence                   |
| `FAIL`    | Expected behavior observed not to work                            |
| `BLOCKED` | Cannot be assessed due to missing prerequisite/decision/source    |
| `NOT_RUN` | Test has not been executed                                        |
| `N/A`     | Explicitly not applicable to agreed release scope, with rationale |

### Evidence format

```text
Criterion: AC-MAP-03
Requirement: FR-MAP-07
Environment: dev | staging | release
Data origin: DEMO | LIVE-APPROVED
Revision: <commit SHA>
Test: <test ID / manual procedure>
Result: PASS | FAIL | BLOCKED | NOT_RUN | N/A
Artifact: <CI link / screenshot path / test report>
Reviewer: <role or identifier>
Notes: <caveats and deviations>
```

Do not invent actual commit hashes or CI links.

## 1. Global release invariants (`AC-GLOB-*`)

| ID           | Priority | Acceptance criterion                                                                              | Evidence                         |
| ------------ | -------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| `AC-GLOB-01` | P0       | All public visible brand labels use **Nusa Matra**, except historical Figma/source names          | Text and metadata audit          |
| `AC-GLOB-02` | P0       | Frontend uses React and strict TypeScript                                                         | Repo inspection and typecheck    |
| `AC-GLOB-03` | P0       | No repeated god components or copied domain algorithms across features; quality review documented | PR review and lint/static checks |
| `AC-GLOB-04` | P0       | Navigable UI works using keyboard with visible focus                                              | Keyboard walkthrough             |
| `AC-GLOB-05` | P0       | Loading, empty, missing, error and retry states are distinguishable                               | Component/E2E tests              |
| `AC-GLOB-06` | P0       | DEMO/fixture outputs have persistent visible simulation disclaimer                                | E2E screenshot and content audit |
| `AC-GLOB-07` | P0       | No fabricated official data, indicators, boundaries, quotes or user statistics                    | Source and snapshot audit        |
| `AC-GLOB-08` | P0       | Browser refresh and route navigation do not corrupt selected state or chosen theme                | E2E back/reload                  |
| `AC-GLOB-09` | P0       | Typecheck, lint, build and mandatory tests complete with passing results                          | CI logs                          |
| `AC-GLOB-10` | P0       | Sensitive tokens absent from public bundle and committed files                                    | Secret scan/build inspection     |
| `AC-GLOB-11` | P0       | Mobile/tablet/desktop tasks remain usable, with no critical overlap or clipping                   | Responsive review                |
| `AC-GLOB-12` | P0       | Major screens and component variants visually reviewed against identified Figma nodes             | Screenshot comparison            |
| `AC-GLOB-13` | P0       | Data units, years, definitions and source provenance displayed where numbers imply measured fact  | Data contract tests              |
| `AC-GLOB-14` | P0       | Nonexistent values never silently mapped to numeric zero                                          | Pure and UI tests                |
| `AC-GLOB-15` | P0       | Screen text and UI feedback are understandable in Bahasa Indonesia                                | Content review                   |
| `AC-GLOB-16` | P0       | No critical/high unresolved release-risk defects                                                  | Issue tracker review             |

## 2. Brand, navigation and landing (`P0`)

| ID           | PRD trace    | Given / When / Then                                                                                                                       |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-CORE-01` | `FR-CORE-01` | **Given** the app launches, **then** page title, shell, logo alternative and navigation identify Nusa Matra consistently                  |
| `AC-CORE-02` | `FR-CORE-02` | **Given** desktop 1440px viewport, **then** landing's hierarchy and verified tokens match `27:2` / `27:118` with documented deviations    |
| `AC-CORE-03` | `FR-CORE-03` | **When** a navbar item/CTA is activated by mouse or keyboard, **then** it reaches a valid destination or action and reflects current page |
| `AC-CORE-04` | `FR-CORE-04` | **When** user toggles Normal ↔ Kaca, **then** mode changes without losing selected region/weights and remains legible                     |
| `AC-CORE-05` | `FR-CORE-04` | **Given** a stored mode, **when** user reloads, **then** chosen mode is applied before noticeable flash                                   |
| `AC-CORE-06` | `FR-CORE-05` | **When** a service fails, **then** meaningful Indonesian error and retry/recovery action are presented                                    |
| `AC-CORE-07` | `FR-CORE-06` | **When** user searches from landing and opens a region, **then** stable region ID—not ambiguous text—is carried to the selected route     |
| `AC-CORE-08` | `FR-CORE-07` | **Given** reduced motion, **then** all primary content and CTA remain visible and usable without fancy animation                          |

## 3. Peta Utama and Jelajahi (`P0`)

Figma references `61:1183`, `61:1619`, `29:34`, `29:485`.

| ID          | PRD trace                | Given / When / Then                                                                                                                                  |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-MAP-01` | `FR-MAP-01`, `FR-MAP-08` | **Given** a displayed region layer, **then** a real administrative geometry uses vetted source metadata; decorative hexagon stays illustrative       |
| `AC-MAP-02` | `FR-MAP-02`              | **When** a user types an official region/alias, **then** search returns correctly identified options; no-results and ambiguity are handled           |
| `AC-MAP-03` | `FR-MAP-03`, `FR-MAP-04` | **When** a region is selected via pointer **or accessible list**, **then** same region ID, name, parent and detail appear                            |
| `AC-MAP-04` | `FR-MAP-05`              | **When** indicator/filter/period changes, **then** map color, legend and detail metadata correspond to same selection, without mixing requests       |
| `AC-MAP-05` | `FR-MAP-06`              | **Given** a measured value, **then** value, unit, period, definition and source can be inspected                                                     |
| `AC-MAP-06` | `FR-MAP-07`              | **Given** missing observation, **then** UI shows unavailable state (e.g. blue dashed) and never fake zero                                            |
| `AC-MAP-07` | `FR-MAP-07`              | **When** tiles/provider fail, **then** fallback region search/list remains usable with appropriate service/error label                               |
| `AC-MAP-08` | `FR-MAP-08`              | **Given** Figma decorative diorama/hexagon, **then** UI never claims exact geolocation, authoritative geography or official risk based solely on art |
| `AC-MAP-09` | `FR-MAP-10`              | **When** repeatedly entering/leaving map, **then** listeners, canvas instances and observers are cleaned up                                          |
| `AC-MAP-10` | `FR-MAP-09`              | **When** multiple supported filters combine, **then** selected controls and resulting dataset agree deterministically                                |

## 4. Bandingkan (`P0`)

Figma `12:840`.

| ID          | PRD trace                | Given / When / Then                                                                                                  |
| ----------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `AC-CMP-01` | `FR-CMP-01`              | **When** two regions are selected, **then** both appear with stable identity and correctly labeled A/B               |
| `AC-CMP-02` | `FR-CMP-02`              | **When** “Tukar posisi” is pressed, **then** all values, labels, legend styles and context swap consistently         |
| `AC-CMP-03` | `FR-CMP-03`, `FR-CMP-04` | **Given** incompatible units/definitions/methods, **then** calculated ratio/difference is blocked with explanation   |
| `AC-CMP-04` | `FR-CMP-05`              | **Given** compatible but different years, **then** both years and caution are visible if comparison policy allows it |
| `AC-CMP-05` | `FR-CMP-06`              | **Given** unknown indicator direction, **then** prose says higher/lower rather than misleading better/worse          |
| `AC-CMP-06` | `FR-CMP-07`              | **Given** chart, **then** readable text/table, numeric values, units, year and sources are accessible                |
| `AC-CMP-07` | `FR-CMP-08`              | **Given** zero denominator/missing/out-of-range data, **then** no invalid Infinity/NaN is shown                      |
| `AC-CMP-08` | `FR-CMP-09`              | **Given** a data caveat, **then** user can inspect supporting data-health/source metadata                            |

## 5. Lab Prioritas (`P1`; no unreviewed LIVE conclusions)

Figma `11:152`.

| ID          | PRD trace   | Given / When / Then                                                                                                     |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AC-LAB-01` | `FR-LAB-01` | **When** slider is changed with keyboard/mouse/touch, **then** numeric value and accessible name update                 |
| `AC-LAB-02` | `FR-LAB-02` | **After** every valid edit, **then** all canonical weights are nonnegative integer basis points summing to 10000        |
| `AC-LAB-03` | `FR-LAB-03` | **When** weights change, **then** score and ranking originate from one deterministic engine run                         |
| `AC-LAB-04` | `FR-LAB-04` | **When** “Atur ulang” is activated, **then** baseline weights and ranking return consistently                           |
| `AC-LAB-05` | `FR-LAB-05` | **Given** result, **then** model version, data snapshot, cohort, indicators, source years and eligibility are available |
| `AC-LAB-06` | `FR-LAB-06` | **Given** demo fixture run, **then** the ranking is unmistakably labeled as a simulation                                |
| `AC-LAB-07` | `FR-LAB-07` | **Given** invalid/ineligible input, **then** no ranking is fabricated and a useful reason appears                       |
| `AC-LAB-08` | `FR-LAB-08` | **Given** tied scores, **then** rank/tie policy and sort order are deterministic and denominator is disclosed           |
| `AC-LAB-09` | `FR-LAB-03` | **When** API request A finishes after request B, **then** stale A cannot overwrite latest selected weights/run          |

## 6. Mengapa Diprioritaskan (`P1`)

Figma `12:263`.

| ID          | PRD trace   | Given / When / Then                                                                                                                    |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-WHY-01` | `FR-WHY-01` | **Given** selected region and run, **then** explanation identifies precisely that region/run                                           |
| `AC-WHY-02` | `FR-WHY-02` | **Given** contribution bars, **then** their values sum to engine score within documented precision                                     |
| `AC-WHY-03` | `FR-WHY-03` | **When** an alternative weighting scenario is chosen, **then** score and counterfactual rank are recalculated from same model/snapshot |
| `AC-WHY-04` | `FR-WHY-04` | **Given** explanation, **then** sources, methods, limits and periods are inspectable                                                   |
| `AC-WHY-05` | `FR-WHY-05` | **Given** an associative score, **then** prose avoids unsupported causal interpretations or definitive policy instructions             |

## 7. Titik Buta Data (`P1/P2`, safeguards required in P0)

Figma `14:541`.

| ID         | PRD trace  | Given / When / Then                                                                                                |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `AC-DQ-01` | `FR-DQ-01` | **Given** an observation set, **then** data-health counts derive from actual validated findings, not static labels |
| `AC-DQ-02` | `FR-DQ-02` | **Given** incompatible definition, **then** issue is classified `blocked` with concrete reason                     |
| `AC-DQ-03` | `FR-DQ-03` | **Given** mixed periods/stale source, **then** warning displays year/source and likely consequence                 |
| `AC-DQ-04` | `FR-DQ-04` | **Given** missing value, **then** null state/reason is visible and eligibility handled per model policy            |
| `AC-DQ-05` | `FR-DQ-05` | **When** evidence is exported, **then** all relevant limitations follow into Paspor Bukti                          |

## 8. Uji Rekomendasi (`P2`)

Figma `13:854`.

| ID           | PRD trace    | Given / When / Then                                                                                                          |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `AC-SENS-01` | `FR-SENS-01` | **When** sensitivity run starts, **then** test configuration, model, seed, trial count and snapshot are pinned               |
| `AC-SENS-02` | `FR-SENS-02` | **Given** same inputs and seed, **then** rerun generates same summary within defined deterministic arithmetic                |
| `AC-SENS-03` | `FR-SENS-03` | **Given** rank ranges, **then** min/max/current positions and caveats are computed from actual trials                        |
| `AC-SENS-04` | `FR-SENS-04` | **Given** unsupported historical data, **then** previous-year test is disabled or labeled unavailable rather than fabricated |
| `AC-SENS-05` | `FR-SENS-05` | **When** job fails/times out/cancels, **then** clear status and safe retry appear, without partial result mislabeling        |

## 9. Paspor Bukti (`P2`)

Figma `13:446`.

| ID           | PRD trace    | Given / When / Then                                                                                                 |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `AC-EVID-01` | `FR-EVID-01` | **When** evidence is created, **then** manifest pins run, model, snapshot, user parameters and data sources         |
| `AC-EVID-02` | `FR-EVID-02` | **Given** ranking, **then** score, contribution, caveats and covered regions match the pinned run                   |
| `AC-EVID-03` | `FR-EVID-03` | **When** data later changes, **then** previously issued evidence remains immutable and reproducible                 |
| `AC-EVID-04` | `FR-EVID-04` | **When** exporting, **then** actual file contains version/origin/method/citation/disclaimer, not just a mock button |
| `AC-EVID-05` | `FR-EVID-05` | **Given** flagged missing/incompatible data, **then** limitations remain visible in rendered/exported evidence      |
| `AC-EVID-06` | `FR-EVID-01` | **Given** a private evidence record, **then** callers without permission cannot retrieve it                         |

## 10. Cerita Wilayah (`P2`)

Figma `14:927`.

| ID            | PRD trace     | Given / When / Then                                                                                                        |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AC-STORY-01` | `FR-STORY-01` | **Given** chapter navigation, **then** progress labels, heading and text change consistently                               |
| `AC-STORY-02` | `FR-STORY-02` | **When** scrolling, **then** narrative moves without hijacking or locking normal page scroll                               |
| `AC-STORY-03` | `FR-STORY-03` | **Given** a 3D illustration, **then** the accessible text equivalent remains complete                                      |
| `AC-STORY-04` | `FR-STORY-04` | **Given** reduced motion / no WebGL, **then** chapters and controls work with a static visual                              |
| `AC-STORY-05` | `FR-STORY-05` | **Given** a numerical story claim, **then** source/snapshot/year are verified; decorative elements labeled as illustration |

## 11. Animation, theme, and 3D (`P0 baseline, enhanced P1/P2`)

| ID          | Figma / related test    | Acceptance                                                                                          |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `AC-MOT-01` | `43:713` / `AN-01..04`  | G1–G11 sequences implemented where in-scope, with no content hidden indefinitely                    |
| `AC-MOT-02` | `30:1467` / `AN-05..07` | Normal/Kaca liquid sequence respects approved timeline and no overlapping rapid-toggle race         |
| `AC-MOT-03` | `30:1467` / `AN-08..09` | Reduced-motion fallback and high-contrast/low-transparency presentation remain legible              |
| `AC-MOT-04` | `43:713` / `AN-10..11`  | WebGL failure degrades to static poster; resources dispose on route changes                         |
| `AC-MOT-05` | `43:713` / `AN-12`      | 3D Lab columns mirror canonical data rather than separate visual arithmetic                         |
| `AC-MOT-06` | `43:713` / `AN-13`      | Story 3D does not block chapter text/controls                                                       |
| `AC-MOT-07` | external reference      | Each copied/adapted component and asset has verified license/attribution                            |
| `AC-MOT-08` | custom motion           | When reference unavailable, original effect exists or an explicitly reviewed fallback is documented |

## 12. API, data and source contracts

| ID          | Related document | Acceptance                                                                                                |
| ----------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `AC-API-01` | `08`             | API route and schema contract validated; malformed requests return safe structured errors                 |
| `AC-API-02` | `08`             | Every region/indicator/observation uses stable ID and source metadata                                     |
| `AC-API-03` | `05`, `08`       | Third-party provider endpoints/permissions verified independently, not confused with Nusa Matra `/api/v1` |
| `AC-API-04` | `06`, `08`       | Caching partitions by data mode/snapshot/model as required                                                |
| `AC-API-05` | `06`             | Published snapshots immutable, traceable, referentially valid                                             |
| `AC-API-06` | `07`             | Input validation forbids invalid weights, undefined normalization and unapproved cohort                   |
| `AC-API-07` | `07`, `08`       | Analytical run exposes consistent result state/ID and cancellation or timeouts where applicable           |
| `AC-API-08` | `05`             | LIVE sources have approved license, date, completeness and comparability review                           |
| `AC-API-09` | `06`             | DEMO and LIVE never silently merge in the same public output                                              |
| `AC-API-10` | `08`             | API client handles loading, aborted, stale, error and successful responses without race corruption        |

## 13. Security, privacy and responsible-use acceptance

| ID          | Related test       | Acceptance                                                                               |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `AC-SEC-01` | `SEC-01`           | No provider/DB/admin secrets shipped to browser or repo                                  |
| `AC-SEC-02` | `SEC-02..04`       | Injection/XSS/SSRF defenses verified where relevant                                      |
| `AC-SEC-03` | `SEC-05`           | Heavy computation is bounded by quotas, timeouts and concurrency control                 |
| `AC-SEC-04` | `SEC-06..08`       | Origin/cache and evidence integrity boundaries tested                                    |
| `AC-SEC-05` | `SEC-09`, `SEC-18` | Protected evidence/admin endpoints enforce authorization when deployed                   |
| `AC-SEC-06` | `SEC-12..13`       | HTTPS/header/CORS and sanitized logs checked on deployment                               |
| `AC-SEC-07` | `SEC-11`           | Dependencies and third-party visual assets reviewed for licensing/security               |
| `AC-SEC-08` | `SEC-15`           | Privacy/retention decisions approved for personal/operational data before public release |
| `AC-SEC-09` | `SEC-16`           | Data provenance and comparability policies cannot be bypassed from UI or API             |

## 14. Accessibility and responsive acceptance

| ID           | Related tests | Acceptance                                                                                         |
| ------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| `AC-A11Y-01` | `A11Y-01..03` | All interactive controls have keyboard support and appropriate names/roles                         |
| `AC-A11Y-02` | `A11Y-04..05` | Semantic heading/landmark order and legible colors in both themes                                  |
| `AC-A11Y-03` | `A11Y-06..07` | Maps/charts include text/table alternatives; status not color-only                                 |
| `AC-A11Y-04` | `A11Y-08`     | Reduced-motion setting disables potentially discomforting animation                                |
| `AC-A11Y-05` | `A11Y-09..10` | 200% zoom/reflow and dynamic errors/status messages usable                                         |
| `AC-A11Y-06` | `A11Y-11`     | Story chapter experience available without 3D or scroll animation                                  |
| `AC-RESP-01` | `03`          | At 1440px desktop Figma reference, no unintended clipping/overlap                                  |
| `AC-RESP-02` | `03`          | At team-approved tablet/mobile widths, nav/actions/filters operate without horizontal content loss |
| `AC-RESP-03` | `03`          | Touch targets and input focus are practical on mobile; no hover-only critical feature              |
| `AC-RESP-04` | `09`          | Device/browser without WebGL still supports core analysis and navigation                           |

Responsive widths beyond inspected Figma desktop targets are engineering proposals pending design review; do not claim unverified mobile pixel fidelity.

## 15. Clean Code assessment-specific gate

**Every feature, including 3D animation, must satisfy:**

- [ ] React components have one clear responsibility and are named predictably.
- [ ] Domain transformations (weighting, comparability, provenance) live outside JSX.
- [ ] TypeScript strict checks pass and runtime boundaries validate external payloads.
- [ ] No needless `any`, duplicated data formulas or unused imports.
- [ ] Shared tokens/primitives reused; no random hardcoded palette values in components.
- [ ] Side effects are bounded, abortable, and cleaned up.
- [ ] Errors are modeled explicitly rather than swallowed.
- [ ] Clear tests cover critical behavior and regression risks.
- [ ] New dependencies have rationale and license/security review.
- [ ] Existing repository conventions maintained unless an ADR authorizes change.
- [ ] Implementation is understandable to a reviewer without reading AI chat history.
- [ ] Lint, typecheck, tests and build status actually verified and reported.

Prefer simple code with meaningful abstractions over patterns added solely to look sophisticated.

## 16. Release decision matrix

| Gate                             | DEMO MVP (Release A)                   | Verified Data Preview (Release B)   | Decision/Evidence Release (Release C) |
| -------------------------------- | -------------------------------------- | ----------------------------------- | ------------------------------------- |
| `P0` visual/functional           | Required                               | Required                            | Required                              |
| Source metadata and origin       | DEMO disclosed                         | LIVE approved                       | LIVE approved if making LIVE claims   |
| Comparison safeguards            | Required                               | Required                            | Required                              |
| Methodology governance           | DEMO-safe                              | No LIVE rankings without approval   | Required for LIVE recommendation      |
| Lab and explanations             | Optional/in-scope only                 | Optional, no unapproved live claims | Required                              |
| Sensitivity and evidence         | Optional                               | Optional                            | Required if enabled                   |
| Theme and accessibility baseline | Required                               | Required                            | Required                              |
| Fancy 3D                         | Progressive enhancement; can fall back | Progressive enhancement             | In-scope scenes reviewed              |
| Security/CI/quality              | Required for deployed features         | Required                            | Required                              |
| Privacy/retention/legal review   | Deployment appropriate                 | Production appropriate              | Production appropriate                |

### Release-specific sign-off checklist

**Release A (DEMO):**

- [ ] All P0 tasks demonstrate meaningful outcomes on synthetic fixtures.
- [ ] Every synthetic numerical claim is labeled **“Data simulasi untuk demonstrasi”** or equivalent.
- [ ] Core journeys pass across agreed browser/viewport matrix.
- [ ] No stale API-result races, misattributed source links, or missing-as-zero bugs.
- [ ] Relevant security/accessibility/code quality gates pass.

**Release B (verified data):**

- [ ] Source terms/access reviewed and linked in dataset registry.
- [ ] Published data snapshots are immutable and exposed with year and provenance.
- [ ] Geographic codes and geometry are reconciled.
- [ ] Definition/method/unit comparability policy approved and tested.
- [ ] LIVE label only enabled on approved data surfaces; policy ranking remains gated.

**Release C (analysis and evidence):**

- [ ] Domain reviewer approves indicator direction, reference bounds and scoring semantics.
- [ ] Golden vectors, tie handling, eligibility, weights and sensitivity reproducibility pass.
- [ ] Lab, Why, Data Health and Passport refer to same immutable analytical run.
- [ ] Exported Paspor Bukti reproduces displayed facts without recomputing under new data.
- [ ] Privacy, security and operational safeguards match the deployed capabilities.

## 17. UAT scripts: full narrative checks

### `UAT-01`: newcomer discovers a region (`P0`)

**Given** a new visitor opens Nusa Matra on a laptop, **when** they choose “Mulai jelajahi”, search a kabupaten and select it, **then** the selected region and indicator detail appear; unavailable entries have explicit reasons and every measured number shows a period and source. **Verify** on keyboard and mouse.

### `UAT-02`: public comparison does not mislead (`P0`)

**Given** two regions with incompatible measurement definitions, **when** they are placed side by side, **then** no ratio/difference is computed for that metric. If compatible years differ, the system only shows a comparison according to documented warning policy and names both years. **Verify** swap operation preserves correct pairing.

### `UAT-03`: analyst explores an alternative weighting (`P1`)

**Given** the canonical DEMO dataset/model, **when** the analyst changes flood weight from baseline to another valid value, **then** total weights remain 100%, new ranks match golden computations, the explanation references the same run, and a DEMO disclaimer remains present. **Verify** reset and stale-response protection.

### `UAT-04`: reviewer checks stability and evidence (`P2`)

**Given** a pinned completed analysis, **when** the reviewer runs seeded sensitivity tests and generates an evidence manifest, **then** ranges and warnings come from recorded trials and the exported record identifies the same snapshot, method, params and data limitations even after a later new run.

### `UAT-05`: motion-limited user accesses equivalent product (`P0/P2`)

**Given** reduced-motion preference and a browser without WebGL, **when** user navigates landing, toggles theme, reads the story and inspects the map, **then** all core features, sources and accessible controls remain available. **Verify** no scroll hijacking or invisible pending content.

## 18. Known blocked approvals and explicit non-claims

Do **not** mark these complete without external verification:

- Backend/storage technology choice, hosting architecture and production URL.
- API access and redistribution permission for each source; official portal URL alone is not an approved dataset.
- Final Indonesian geographic administrative level and associated data completeness.
- Reviewed production ranking methodology and allowed policy messaging.
- Legal/privacy retention and data-sharing approval (when relevant).
- Exact mobile Figma variants and performance measured on target hardware.
- Working API/DB deployments, successful build, CI tests or coverage not actually executed.

When blocked, choose an honest DEMO-only feature and record unresolved dependency.

## 19. Final verification record template

```markdown
## Release Candidate — Nusa Matra

- Release type: A (DEMO) / B (verified-data preview) / C (decision + evidence)
- Commit / build: TBD
- Figma handoff version and reviewed nodes: TBD
- Data snapshot / origin / model: TBD
- CI / typecheck / lint / build: PASS | FAIL | NOT_RUN
- Unit + contract + E2E: PASS | FAIL | NOT_RUN
- Accessibility / responsive / reduced motion: PASS | FAIL | NOT_RUN
- Security review: PASS | FAIL | BLOCKED
- Source permission / methodology: PASS | FAIL | BLOCKED | N/A
- Critical defects remaining: TBD
- Evidence links: TBD
- Reviewer / date / decision: TBD
- Outcome: APPROVED_FOR_SCOPE | REJECTED | BLOCKED
```

**Final rule:** Unverified assertions must remain unverified, even if the page is visually complete or a reviewer is in a hurry.

---

Related: [`01 Requirements`](./01-PRODUCT-REQUIREMENTS.md) · [`02 User Flows`](./02-USER-FLOWS.md) · [`09 Animations`](./09-ANIMATION-GUIDELINES.md) · [`10 Testing`](./10-TESTING-STRATEGY.md) · [`11 Security`](./11-SECURITY-AND-PRIVACY.md) · [`12 Roadmap`](./12-IMPLEMENTATION-ROADMAP.md).
