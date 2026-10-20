# 10 — Testing Strategy & Verification Matrix

**Product:** Nusa Matra · **Version:** 1.0 · **Updated:** 2026-10-19  
**Audience:** Claude Code, QA, engineering reviewers  
**Status:** Mandatory quality strategy; tooling names are `PROPOSED` until adopted

## 0. Goal and quality philosophy

> A feature is not done because the UI renders. It is done when behavior is correct, traceable, accessible, secure, responsive, maintainable, and demonstrably tested.

This document translates `01-PRODUCT-REQUIREMENTS.md`, `02-USER-FLOWS.md`, `03-UI-UX-DESIGN-SYSTEM.md`, `07-DECISION-ENGINE.md`, and `08-API-SPECIFICATION.md` into test obligations. Favor deterministic automated tests plus targeted human visual/accessibility checks. Test risk-sensitive algorithms more deeply than cosmetic details. **Clean Code is an evaluation criterion**, so quality gates apply to every pull request.

Classification: `LOCKED` React + TypeScript and transparent DEMO/LIVE distinction; `PROPOSED` Vitest, React Testing Library, MSW, Playwright, axe, test DB harness and visual-regression provider.

## 1. Test pyramid and ownership

| Layer             | Main responsibility                                                | Suggested tools                               | CI timing                        |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------------- |
| Static            | Formatting, TypeScript, lint, unused code, dependency policy       | TypeScript, ESLint, Prettier                  | Every PR                         |
| Pure unit         | Scoring, weights, normalization, ranking, comparison rules         | Vitest                                        | Every PR                         |
| Component         | React interaction semantics, loading and errors, visual mode, a11y | React Testing Library + user-event            | Every PR                         |
| API contract      | Schema, response envelopes, error codes, pagination, versioning    | JSON Schema / Zod + MSW + integration harness | Every PR                         |
| Persistence       | Constraints, migrations, snapshot immutability, lineage            | Disposable PostgreSQL when selected           | Every database PR                |
| End-to-end        | Real user journeys across routes, network modes, browser history   | Playwright                                    | PR critical subset; full nightly |
| Visual regression | Figma fidelity and component modes                                 | Screenshot baseline + human review            | PR for visual changes            |
| Performance       | Runtime, route payload, animation smoothness, 3D lifecycle         | Lighthouse, browser performance tools         | Release / scheduled              |
| Security          | Secret scanning, audit, auth and abuse tests                       | Secret scanners, SAST, integration checks     | Every PR + release               |

No arbitrary universal coverage percentage guarantees correctness. Suggested initial **coverage floor for high-risk pure domain modules: 90% branch coverage** (PROPOSED) plus mandatory edge-case matrix. Do not game coverage by testing trivial getters. Reassess thresholds with team.

## 2. Traceability model

Every requirement must be traceable to implementation, tests, and evidence.

```text
Requirement ID (PRD)
    -> user journey (02)
    -> feature / component or service
    -> data contract (06 / 07 / 08)
    -> automated test IDs
    -> acceptance criterion (13)
    -> proof (CI run, screenshot, logs)
```

Suggested convention:

- `UT-*` pure unit;
- `CT-*` React component;
- `IT-*` API/database integration;
- `E2E-*` end-to-end;
- `VR-*` visual regression;
- `A11Y-*` accessibility;
- `PERF-*` performance;
- `SEC-*` security.

Keep a small `docs/traceability.csv` or PR checklist; do not create redundant tracking software unless needed. Attach a PRD ID when the old document has one; never invent mappings to specific requirement IDs without verifying the PRD.

## 3. Required deterministic test fixtures

Store synthetic fixtures under `tests/fixtures/` or analogous existing directory. Mark every synthetic case as `DEMO` / `SYNTHETIC`, and never bundle fixture values as production analytics.

| Fixture                       | Must model                                                             |
| ----------------------------- | ---------------------------------------------------------------------- |
| `regions-basic`               | One province, several kabupaten and kota with stable IDs               |
| `observations-comparable`     | Same indicator/definition/period/unit across regions                   |
| `observations-different-year` | Comparisons allowed only with clearly disclosed caveat per rule        |
| `observations-incompatible`   | Identically named indicator but different unit/definition/methodology  |
| `observations-missing`        | `null`/explicit missing reason rather than zero                        |
| `observations-zero`           | Actual measured zero distinguishable from missing                      |
| `observations-source-pending` | Provider declared, but verification still pending                      |
| `weights-rounding`            | Integer basis point weights that sum exactly to 10000                  |
| `weights-boundary`            | All weight placed on one criterion, prohibited negative, none eligible |
| `rank-ties`                   | Equal numerical score with deterministic tie-break                     |
| `rank-cohort-change`          | Eligibility change affects denominator; ranking re-evaluated           |
| `snapshot-a/b`                | Same region, different data release; frozen snapshot identity          |
| `sensitivity-seeded`          | Stable seed and sample size produce identical results                  |
| `evidence-manifest`           | Export references exact run, model and dataset hashes                  |
| `map-unavailable`             | Missing geometry, unavailable tiles and no WebGL                       |
| `theme-persistence`           | Normal/Kaca preference retained after reload                           |

Golden vectors for scoring, normalization and sensitivity MUST match `07-DECISION-ENGINE.md`; don't create a competing test formula.

## 4. Unit test contracts: data math (`P0/P1`)

| ID      | Input / action                | Required assertion                                                       |
| ------- | ----------------------------- | ------------------------------------------------------------------------ |
| `UT-01` | Min/max distinct data         | Normalized values in [0,1] with configured direction                     |
| `UT-02` | Reverse-direction indicator   | High raw value produces inverse normalized priority after policy applied |
| `UT-03` | Equal min and max             | Explicit deterministic constant-value policy; no divide by zero          |
| `UT-04` | Missing observation           | Not interpreted as 0 or silently imputed                                 |
| `UT-05` | Invalid NaN/Infinity          | Rejected by runtime validation                                           |
| `UT-06` | New weight slider change      | Weights reallocated with total exactly 10000 basis points                |
| `UT-07` | Boundary weight 0 or 10000    | Valid within documented rules; other weights nonnegative                 |
| `UT-08` | Repeated update sequence      | No cumulative floating point drift                                       |
| `UT-09` | Same input + model + snapshot | Same score and contribution ledger                                       |
| `UT-10` | Sum contributions             | Equals aggregate score within documented numeric tolerance               |
| `UT-11` | Tied scores                   | Stable rank/tie convention and secondary sort                            |
| `UT-12` | Ineligible record             | Excluded or explicitly unranked with reason                              |
| `UT-13` | Changed cohort                | Rank denominator and membership updated honestly                         |
| `UT-14` | Counterfactual weights        | Explanation recalculated from same engine, not hand-written              |
| `UT-15` | Sensitivity fixed seed        | Repeated run yields equivalent rank ranges and stability                 |
| `UT-16` | Leave-one-indicator-out       | Properly renormalized policy and exception handling                      |
| `UT-17` | New dataset snapshot          | Run identity changes; old result remains immutable                       |
| `UT-18` | Mismatched model version      | Explicit compatibility error                                             |
| `UT-19` | Synthetic data engine         | Output carries DEMO provenance across layers                             |
| `UT-20` | Numeric format                | Display rounding does not leak into subsequent computation               |

### Unit test example (`PROPOSED`, API illustration)

```ts
import { describe, expect, it } from 'vitest';
import { redistributeWeights } from '@/features/priority/domain/weights';

describe('redistributeWeights', () => {
  it('conserves 10000 basis points after each user edit', () => {
    const next = redistributeWeights({
      previous: { flood: 3000, social: 3000, services: 2500, landslide: 1500 },
      changedId: 'flood',
      nextBasisPoints: 4500,
    });
    expect(Object.values(next).reduce((sum, value) => sum + value, 0)).toBe(10000);
    expect(Object.values(next).every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
  });
});
```

The function signature above is illustrative, **not a claim of existing source code**. Adapt only to the actual approved algorithm and module organization.

## 5. Comparability, data quality and origin tests

| ID      | Case                                               | Expected result                                                           |
| ------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `IT-01` | Same normalized definition, year, population scope | Comparison outcome according to policy                                    |
| `IT-02` | Different methodology                              | `blocked` verdict; values may be shown separately but no misleading delta |
| `IT-03` | Different years but otherwise compatible           | `warning` with specific years, if allowed by rules                        |
| `IT-04` | Different unit without approved conversion         | Not silently compared                                                     |
| `IT-05` | Missing source URL                                 | Publication blocked or explicit provenance issue                          |
| `IT-06` | Stale or revoked source                            | Health state/caveat shown; not disguised as current                       |
| `IT-07` | Demo observation in live response                  | Rejected / quarantined; origin contract enforced                          |
| `IT-08` | Snapshot content changed                           | Creates a new immutable published snapshot                                |
| `IT-09` | Ingestion duplicate source record                  | Idempotency prevents duplicated observations                              |
| `IT-10` | Invalid region identifier                          | Validation error; never guess nearby region                               |
| `IT-11` | Boundary year mismatch                             | Reported and assessed independently of score                              |
| `IT-12` | Data quality dashboard                             | Findings match observation and comparability rules                        |

## 6. Component tests: React UI

| ID      | Feature              | Assertion                                                                   |
| ------- | -------------------- | --------------------------------------------------------------------------- |
| `CT-01` | Navbar               | Active route has `aria-current`, keyboard navigation works                  |
| `CT-02` | Region search        | Debounce/cancellation, empty and no-result states, keyboard selection       |
| `CT-03` | Map select           | Selected region rendered and announced; fallback list works                 |
| `CT-04` | Indicator filters    | Displayed layer and legend change together                                  |
| `CT-05` | Comparison           | Swap action swaps headers, data series and associated labels                |
| `CT-06` | Comparison           | Incompatible metric displays blocked explanation, not calculated difference |
| `CT-07` | Priority slider      | Keyboard accessible, percentages add to 100%                                |
| `CT-08` | Priority ranking     | Loading/stale result never mislabeled as latest run                         |
| `CT-09` | Explanation          | Contributions tie to current run and criterion set                          |
| `CT-10` | Sensitivity          | Progress/completion/failure UI and summary labels accurate                  |
| `CT-11` | Evidence passport    | Download unavailable until persisted snapshot ready                         |
| `CT-12` | Data health          | Warning, blocked and unknown have distinct copy                             |
| `CT-13` | Story                | Chapter change updates semantic heading and progress                        |
| `CT-14` | Theme toggle         | Switch state/label reflects Normal/Kaca; no domain reset                    |
| `CT-15` | Responsive UI        | Primary actions reachable at mobile viewport                                |
| `CT-16` | Localized copy       | Indonesian labels and numbers/period units are intelligible                 |
| `CT-17` | Loading/error states | Retry and safe navigation remain functional                                 |
| `CT-18` | Source citation      | User can access provider and year details                                   |

Test with real `userEvent` interactions rather than dispatching implementation-private state actions.

## 7. API and persistence contract tests

Refer to `08-API-SPECIFICATION.md`; its paths are proposed **Nusa Matra** API endpoints, not real third-party provider URLs.

| ID         | Endpoint family          | Required checks                                             |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| `API-T-01` | `/meta`                  | Capabilities, supported data modes and versions             |
| `API-T-02` | `/snapshots`             | Immutable publication snapshots, correct origin and id      |
| `API-T-03` | `/regions`               | Stable IDs, pagination, explicit geographic level           |
| `API-T-04` | `/indicators`            | Unit, definition, direction and availability metadata       |
| `API-T-05` | `/observations`          | No implicit zero for missing; valid provenance              |
| `API-T-06` | `/geography/manifests`   | Geometry manifests verified and cache-safe                  |
| `API-T-07` | `/comparisons/evaluate`  | Verdict `comparable/warning/blocked` per policy             |
| `API-T-08` | `/analysis/runs`         | Input validation, idempotency, model version pinning        |
| `API-T-09` | `/analysis/runs/{runId}` | State machine and consistent results                        |
| `API-T-10` | `/sensitivity-runs`      | Progress, seeded reproducibility, known failure handling    |
| `API-T-11` | `/evidence`              | Manifest binding, immutability, authorization when needed   |
| `API-T-12` | `/quality`               | Issues match published observations                         |
| `API-T-13` | `/stories`               | Editorial content references correct data versions          |
| `API-T-14` | All write endpoints      | Limits, schema rejection, body size, timeout, abuse control |
| `API-T-15` | All endpoints            | Problem JSON, safe error messages, request correlation ID   |

Database-specific checks: foreign keys, unique keys, transaction rollback, migrations up/down policy, immutable published data, audit metadata, safe query behavior, backup/restore. Run them only once a DB implementation has been selected; don't claim SQL migrations pass before database exists.

## 8. End-to-end journeys (`P0` then `P1/P2`)

### `E2E-01` Landing → Jelajahi → region detail

1. Open landing on desktop; verify branded content and navigation.
2. Activate “Mulai jelajahi”.
3. Open Jelajahi / Peta Utama as per current user-flow routing.
4. Search for a known synthetic kabupaten, select it.
5. Assert displayed name, indicator, year and origin are correct.
6. Reload or navigate Back; verify documented state restoration policy.

### `E2E-02` Jelajahi missing data

1. Choose synthetic region with no observation.
2. Verify the dashed unavailable state and explanation.
3. Verify the UI does not display `0` as a substitute.
4. Map remains operable with a keyboard-accessible list fallback.

### `E2E-03` Bandingkan with incompatible metadata

1. Pick regions A and B.
2. Select indicator whose definitions differ.
3. Expect `blocked` verdict with Indonesian explanation.
4. Swap sides; blocked status persists, headings switch properly.

### `E2E-04` Lab → Explain → Sensitivity → Evidence (`P1/P2`)

1. Load pinned synthetic DEMO snapshot and model version.
2. Change weight and verify total remains 100%.
3. Await recalculation; ranking, score, explanation have same `runId`.
4. Start seeded robustness test; observe status transitions and results.
5. Create evidence snapshot; inspect manifest and export.
6. Verify DEMO disclaimer, sources, versions, inputs and limitations.
7. Change weights; previous evidence remains immutable.

### `E2E-05` Normal ↔ Kaca under reduced motion

1. Emulate reduced motion and high contrast as supported.
2. Toggle mode; no liquid expansion; focus stays reachable.
3. Reload; mode preference persists without flash.
4. Change route; region selection and filter state follow defined navigation policy.

### `E2E-06` Story chapters

Use Next/Previous and keyboard controls on `Cerita Wilayah`; verify progress, text equivalents, non-blocking scroll, graceful 3D fallback and chapter labels.

## 9. Accessibility verification (`WCAG 2.2 AA` target, `PROPOSED`)

| ID        | Check                                                                    |
| --------- | ------------------------------------------------------------------------ |
| `A11Y-01` | All interactive elements reachable by keyboard                           |
| `A11Y-02` | Visible focus indication and meaningful activation controls              |
| `A11Y-03` | Search, sliders, filters, switch, dialogs have semantic names and roles  |
| `A11Y-04` | Screens show hierarchical headings/landmarks and logical reading order   |
| `A11Y-05` | Theme variants retain readable contrast, including glass backgrounds     |
| `A11Y-06` | Map and chart results available as accessible lists/tables               |
| `A11Y-07` | Data statuses distinguishable without color                              |
| `A11Y-08` | Reduced-motion preference disables parallax/liquid/camera-flight effects |
| `A11Y-09` | Zoom to 200%, responsive reflow and text resize without clipped content  |
| `A11Y-10` | Error and success announcements readable by assistive technology         |
| `A11Y-11` | Story offers equivalent textual narrative and chapter navigation         |
| `A11Y-12` | Modal focus trap and return behavior are correct when modals exist       |

Automated axe checks are a baseline, not a replacement for keyboard and screen-reader manual testing.

## 10. Visual-regression and Figma parity

Baseline candidates (desktop Figma 1440-wide):

- Landing Normal `27:2`, Kaca `27:118`.
- Peta Utama Normal `61:1183`, Kaca `61:1619`.
- Jelajahi Normal `29:34`, Kaca `29:485`.
- Lab `11:152`, Why `12:263`, Compare `12:840`.
- Sensitivity `13:854`, Evidence `13:446`, Data Health `14:541`, Story `14:927`.

For each: screenshot at comparable viewport, inspect spacing, tokens, typography, nav placement, interactions, focus and content clipping. If the Figma design is a static example with placeholder values, compare **layout and semantics**, not literal numbers from real data. Keep stable fixture data for reproducible tests.

Visual QA report shape:

```text
Node: 29:34
Route: /jelajahi
Viewport: 1440×900 (verified Figma desktop reference)
Mode: normal
Fixture: synthetic/dataset-v1
Result: pass | fail | intentional-deviation
Evidence: screenshot path / CI artifact
Deviations: exact reason, reviewer decision
```

## 11. Performance testing (`PROPOSED` thresholds)

The team must select measurable budgets before release. Suggested starter targets for mobile lab testing (not guaranteed achievements):

- LCP ≤2.5 s on agreed environment;
- INP ≤200 ms and CLS ≤0.1 on representative real-use sampling (when available);
- no repeatedly leaked 3D contexts or event listeners after route changes;
- no page-blocking hero 3D when fallback would suffice;
- chart and map interactions remain usable on a throttled device profile;
- bundle budgets set from measured baseline, not arbitrary magic sizes.

Report device/browser, network throttle, build hash, date, exact conditions and observed values. Never describe a proposed threshold as a measured result.

## 12. Security and resilience tests

- Validate all public query parameters and mutation payloads at server boundary.
- Reject invalid region IDs and huge filter arrays.
- Ensure private provider tokens are absent from source, bundles, response bodies and logs.
- Test rate limiting, retry bounds, request timeouts and abort signals.
- Ensure export endpoints do not accept arbitrary file paths or unrestricted external URLs.
- Test CSP headers against WebGL, maps, font assets and app functionality.
- Test dependence on unavailable provider/tiles via deterministic simulated outages.
- Test third-party component licenses and dependency vulnerabilities.
- For any later authentication, test authorization per resource and IDOR protections.

See `11-SECURITY-AND-PRIVACY.md` for threat model and release gates.

## 13. Test commands and CI contract (`PROPOSED`)

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "format:check": "prettier --check .",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "build": "vite build"
  }
}
```

**Illustrative commands only.** Match package scripts, configuration, test paths and build tooling actually installed; do not copy as if tests exist.

Suggested CI stage ordering:

1. Dependency installation with frozen lockfile, secret scan.
2. Formatting/lint/typecheck.
3. Unit and component tests.
4. API contracts and database integration (when relevant).
5. Build and bundle analysis.
6. Focused E2E/a11y smoke tests.
7. Visual regression and performance checks, gated as appropriate.
8. Publish test evidence and block merge for required failures.

## 14. Test-data safety and environment discipline

- Synthetic test data is committed under clearly labeled fixtures.
- Live official data belongs to verified snapshot ingestion, not unit test mocks.
- Never allow a local DEMO stub to silently satisfy a required LIVE integration test.
- Use isolated test databases, deterministic clock and controlled random seed.
- Test retries with bounded exponential backoff, not nondeterministic `setTimeout` loops in assertions.
- Mock source APIs at boundary; separately verify real provider integration with approved sandbox/live data when accessible.
- Avoid screenshots of personal data in CI artifacts; scrub logs.

## 15. Release quality gates (`QG-*`)

| Gate    | Requirement                                                          | Blocker                           |
| ------- | -------------------------------------------------------------------- | --------------------------------- |
| `QG-01` | No TypeScript or lint failures                                       | Must fix                          |
| `QG-02` | All relevant pure-domain golden vectors pass                         | Must fix                          |
| `QG-03` | No DEMO presented as verified LIVE data                              | Must fix                          |
| `QG-04` | Missing data and comparability safeguards verified                   | Must fix                          |
| `QG-05` | Primary journeys pass across agreed browser/viewport matrix          | Must fix                          |
| `QG-06` | Keyboard and reduced-motion workflows pass                           | Must fix                          |
| `QG-07` | No high-severity open security issues without documented resolution  | Must fix                          |
| `QG-08` | Snapshot/source lineage and model version are visible and persistent | Must fix for LIVE analysis        |
| `QG-09` | Figma discrepancies classified with evidence                         | Review required                   |
| `QG-10` | Dependency/asset attribution and license evidence saved              | Review required                   |
| `QG-11` | Release and rollback path validated                                  | Required before public deployment |
| `QG-12` | Performance meets agreed budgets or explicit approved exception      | Review required                   |

## 16. Bug triage and regression policy

| Severity | Example                                                                 | Response                                                      |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Critical | False official claim, wrong region score, data leak, corrupted evidence | Block release; investigate root cause and add regression test |
| High     | Incompatible comparison marked valid, unusable keyboard route           | Block release for affected feature                            |
| Medium   | Screen partially clipped on common viewport, flaky animation            | Fix before release unless documented approval                 |
| Low      | Minor cosmetic differences without usability impact                     | Record and prioritize with designer                           |

A regression fix includes failing repro test, focused patch, passing test, and explanation of the root cause. Don't mark a bug resolved just because a refresh hides it.

## 17. Claude Code execution protocol

Before implementing a story:

1. Inspect source and accepted architecture choices.
2. Identify user-flow and acceptance IDs.
3. Determine fixture and verification plan.
4. Write tests near domain logic; ensure tests are meaningful and deterministic.
5. Implement without duplicating scoring/quality policy inside components.
6. Run affected checks first; then broader checks.
7. Capture proof and disclose unavailable tooling/test coverage.
8. Report files changed, tests run, observed results, open risks and whether DEMO/LIVE conditions were exercised.

**Do not claim tests passed without actually running them. Do not fabricate screenshots, coverage, Lighthouse results, or API validations.**

---

Related: [`07 Decision Engine`](./07-DECISION-ENGINE.md) · [`08 API Specification`](./08-API-SPECIFICATION.md) · [`11 Security`](./11-SECURITY-AND-PRIVACY.md) · [`13 Acceptance`](./13-ACCEPTANCE-CRITERIA.md).
