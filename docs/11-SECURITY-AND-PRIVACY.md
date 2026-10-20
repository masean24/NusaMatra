# 11 — Security, Privacy & Responsible Data Governance

**Product:** Nusa Matra · **Version:** 1.0 · **Updated:** 2026-10-19  
**Audience:** Claude Code, product owner, backend/frontend engineers, reviewers  
**Status:** Security baseline; deployment, retention, compliance details require owner verification

> **Hard rule:** Public government data does not make an entire application inherently safe. Protect provider credentials, user interactions, model results, application availability, and the integrity of every claim displayed as an official fact.

## 0. Related contracts and evidence language

Read `05-DATA-SOURCES.md` for licensing/access, `06-DATA-MODEL.md` for snapshots and provenance, `07-DECISION-ENGINE.md` for analytical safeguards, and `08-API-SPECIFICATION.md` for proposed backend contract. `LOCKED` = user decision, `PROPOSED` = safe engineering default, `TBD` = pending owner review, `LIVE-APPROVED` = source and method verification is complete and recorded.

Regulatory notes are **engineering planning considerations**, not legal advice. An appropriately qualified reviewer should confirm applicability and requirements of Indonesian law (including UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi), data-provider terms, and any cross-border service arrangements before production launch.

## 1. Security objectives

1. **Integrity:** no forged or misleading observations, scores, comparisons, confidence or source labels.
2. **Confidentiality:** external provider tokens, internal service credentials, secrets and nonpublic artifacts never leak to frontend bundles or public logs.
3. **Availability:** third-party failures, high-cost ranking requests and map layer calls cannot trivially degrade the entire service.
4. **Accountability:** results reference immutable dataset snapshot, model version and actor/run audit context where warranted.
5. **Privacy:** avoid collecting personal data unless it clearly serves a defined user benefit; limit retention and access.
6. **Auditability:** changes to published data/methodology/exported evidence remain identifiable and reproducible.
7. **Least privilege:** every system component gets only the credentials and data scope needed for its role.

## 2. Data inventory and privacy classification

| Data                                        | Example                                | Classification                           | Default handling                                          |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| Official public aggregate indicators        | Poverty rate by kabupaten and year     | Public with provenance obligations       | License/terms checked; provenance visible                 |
| Geographic boundaries                       | Kabupaten boundaries in vetted GeoJSON | Public _if authorized_                   | Source, version and redistribution rights recorded        |
| Synthetic demo fixtures                     | Sample ranking of Cianjur/Garut        | Public DEMO (never verified)             | Clearly labeled; isolated from LIVE publication           |
| Analytical weights and temporary selections | Chosen criteria/region                 | User preference / potentially usage data | Store locally or temporarily, not automatically on server |
| Exported Paspor Bukti                       | Run manifest, question and rankings    | User-created analytical record           | Respect owner sharing decision and access-control needs   |
| Operational logs                            | Timestamp, IP, request ID              | Potential personal data                  | Minimize, secure, rotate, retention TBD                   |
| Authentication data (future)                | Identity, session token                | Restricted                               | Do not implement until needed and approved                |
| API/provider secrets                        | BPS token, map provider secret         | Secret                                   | Server-side secret manager; never public bundle           |
| Story editorial assets                      | Illustrative 3D model, images, sound   | Licensed content                         | Track copyright, provenance, permitted redistribution     |

**Warning:** A geographic aggregate may still be privacy-sensitive if filtered into small cell sizes or combined with identifying datasets. Avoid person-level inference and suppress unsafe breakdowns according to reviewed policy.

## 3. Trust boundaries

```text
USER DEVICE / BROWSER                         SERVER TRUST ZONE
 ┌─────────────────────────────────────┐      ┌──────────────────────────┐
 │ React UI                            │      │ Nusa Matra API / BFF     │
 │ public code + public env only       │ <--> │ input/auth validation    │
 │ user input (untrusted)              │ HTTPS│ rate limit / policy     │
 │ local display mode preference       │      └────────────┬─────────────┘
 └─────────────────────────────────────┘                   │
                                                         │
                                            ┌────────────▼───────────┐
                                            │ Internal store / cache │
                                            │ published snapshots    │
                                            │ audit metadata         │
                                            └────────────┬───────────┘
                                                         │ controlled ingestion
                                            ┌────────────▼───────────┐
                                            │ Official external APIs │
                                            │ licensing / tokens     │
                                            │ untrusted payloads     │
                                            └────────────────────────┘
```

- Browser is untrusted. A TypeScript interface is not runtime validation.
- External government data payloads are untrusted _inputs_, even from an official hostname; verify format, ranges, attribution, date, definition and publication suitability.
- Secrets live in the server zone, never in `VITE_*`, localStorage, source files or screenshots.
- User-supplied region identifiers, snapshot IDs, filters and weights require server-side validation even if the UI prevents invalid entry.

## 4. Threat model and primary mitigations

| Threat                         | Attack/failure scenario                                   | Mitigation                                                                    | Test / evidence |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------- |
| `TH-01` Exposed tokens         | Public JS bundle contains provider API token              | Backend proxy/BFF; secret scanner; artifact inspection                        | `SEC-01`        |
| `TH-02` XSS                    | Story content, indicator label or URL contains markup     | React escaped rendering, sanitized rich-text policy, CSP                      | `SEC-02`        |
| `TH-03` Injection              | Region/indicator query concatenated into SQL              | Parameterized queries, allowlist sorting, validation                          | `SEC-03`        |
| `TH-04` SSRF                   | Import/export service fetches arbitrary URL               | Restrict hosts/protocols, reject private ranges, no arbitrary fetch endpoints | `SEC-04`        |
| `TH-05` Resource exhaustion    | Repeated heavy sensitivity jobs                           | Rate limits, quotas, queue, concurrency cap, timeout                          | `SEC-05`        |
| `TH-06` Cache poisoning        | DEMO and LIVE share cache key                             | Partition by mode, snapshot, model and auth context                           | `SEC-06`        |
| `TH-07` Data spoofing          | Fake official-looking score                               | Origin seal, approval gate, immutable snapshot, explicit disclaimer           | `SEC-07`        |
| `TH-08` Evidence tampering     | Old passport silently rewritten                           | Append-only manifest/version/hash, verified export reference                  | `SEC-08`        |
| `TH-09` Unauthorized export    | Guessing evidence ID reveals private draft                | Owner-aware authorization, unguessable ID, no public-by-default shares        | `SEC-09`        |
| `TH-10` Broken redirect        | User controls post-login return URL                       | Relative-path allowlist and safe route resolution                             | `SEC-10`        |
| `TH-11` Compromised dependency | Malicious UI/3D package                                   | Lockfile, audit, pin/version review, license check, minimal permissions       | `SEC-11`        |
| `TH-12` Unsafe headers         | Page embeddable/clickjackable or weak transport           | HTTPS, CSP, HSTS where appropriate, frame policy                              | `SEC-12`        |
| `TH-13` Sensitive logs         | Raw token or identifying data logged                      | Redaction, structured logging, limited retention                              | `SEC-13`        |
| `TH-14` Impersonated source    | BPS/BNPB URL replaced by attacker                         | Provider registry, allowlisted hosts and manual verification                  | `SEC-14`        |
| `TH-15` Excess collection      | Analytics tracks detailed user decisions by default       | Consent/necessity review; privacy-friendly metrics                            | `SEC-15`        |
| `TH-16` Unsafe data merge      | Different indicators or regions combined under same label | Referential integrity, unit checks, snapshot and comparability validation     | `SEC-16`        |

## 5. Secrets and configuration

### Mandatory rules

- Keep **all provider tokens** (e.g., BPS) on a trusted server or ingestion worker.
- Use a secret manager or deployment platform secret configuration; do not commit `.env` or server secret files.
- `.env.example` contains _names and clearly fake placeholders_ only.
- No `VITE_BPS_TOKEN`, `VITE_SECRET_KEY`, `VITE_DATABASE_URL` containing credentials, or public provider token.
- Never store access tokens in localStorage; browser display-mode preference is non-sensitive and may be stored there.
- Rotate compromised tokens, revoke old values, and check Git history/cache/artifacts if a leak occurs.
- Fail closed if a required secret is absent; don't silently use a hardcoded demo secret.
- Restrict service accounts to least privilege and differentiate production from preview/sandbox.

Example **server-only** keys (names `PROPOSED`):

```dotenv
# Never prefix private keys with VITE_ when Vite is in use.
BPS_API_TOKEN=REPLACE_IN_SERVER_SECRET_MANAGER
DATABASE_URL=REPLACE_IN_SERVER_SECRET_MANAGER
EVIDENCE_SIGNING_KEY=REPLACE_IN_SERVER_SECRET_MANAGER
```

These are illustrative and **must not** be populated with working values in a committed file.

## 6. Input validation and safe output

At the API trust boundary, validate:

- Region IDs, geographic scope, indicator IDs, snapshot/model IDs, and allowed filters.
- Arrays: maximum length, uniqueness, known members.
- Numeric weights: integers in basis points, range, and exact sum = 10000.
- Pagination size and cursor format; bounded sort keys.
- Export format and evidence ID.
- User text lengths, Unicode handling and meaningful error states.

Use schema validation (Zod/JSON Schema or established equivalent) on **every** external payload, not only at compile time. Return localized safe messages to clients while logging a correlation ID server-side. Never echo stack traces, SQL errors, tokens, connection strings or internal hostnames.

### Safe rendering

- Render external data as escaped React text by default.
- Reject/transform unsupported HTML; don't use `dangerouslySetInnerHTML` on provider/story data without approved sanitizer and tests.
- Check provider URLs and image sources against protocol/hostname restrictions.
- Use restrictive `rel="noopener noreferrer"` for external links opened in new tabs.
- Sanitize CSV formula-injection hazards if enabling CSV exports, or treat output as plain data after escaping risky leading characters.

## 7. Authentication and authorization (`TBD`)

Current product specification does not require users to create accounts for core exploration; **do not introduce authentication just to satisfy a generic security template**.

If accounts or saved private analyses become necessary:

- Choose identity provider and session mechanism through an ADR.
- Prefer short-lived server-managed sessions with `HttpOnly`, `Secure`, appropriate `SameSite` cookies when architecture supports them.
- Enforce CSRF protection for cookie-authenticated mutations as applicable.
- Validate authorization at resource level for evidence, scenario and administrative data (`IDOR` prevention).
- Separate read-public from publish-admin and ingestion-worker permissions.
- Require abuse monitoring and account recovery design before production rollout.

Public DEMO examples may be accessible without login. Publishing **verified LIVE** snapshots must be a privileged administrative operation.

## 8. Availability and abuse prevention

- Rate limit expensive endpoints by caller/IP/key and consider organization quotas where appropriate.
- Queue sensitivity analysis rather than tying up API workers indefinitely.
- Enforce CPU/memory/job time and request-body limits.
- Use bounded retries, backoff + jitter and circuit breakers for upstream providers.
- Distinguish provider outage, missing data, revoked data and app error in response codes and user copy.
- Cache public immutable snapshot results with content/version-aware keys.
- Avoid cache sharing across access boundaries or data mode.
- Guarantee cancellation and disposal of abandoned WebGL/worker resources.
- Prepare read-only degraded mode for maps/metrics when upstream sources are temporarily unavailable.

## 9. Provenance and analytical safety

### DEMO versus LIVE (`LOCKED` invariant)

The labels are a security-and-integrity boundary, not merely a badge:

- DEMO data may support interaction and UI development; it **must** have visible `dataOrigin=DEMO` or equivalent.
- `LIVE` is allowed only after source authentication/access, licensing, geographical coverage, schema, comparability and model methodology are reviewed.
- Demo records must never be persisted into LIVE publications without an explicit and audited ingestion process.
- Cache keys, artifacts and exported evidence must carry origin and source snapshot identifiers.
- A derived number is not automatically an official government recommendation.

### Decision-engine integrity controls

- Pin a _published_ dataset snapshot ID, model version, normalization references and selected weights for every run.
- Preserve source metadata, quality caveats, missing-value policy and ineligible counts.
- Do not recalculate saved passports silently against updated data.
- Prevent explanations or labels not backed by model outputs.
- Provide provenance and limitations when showing confidence/stability metrics; avoid implying policy certainty.
- Be explicit about sample universe (eligible regions) and reference dates in ranks.

## 10. Immutable evidence, audit and exports

The Paspor Bukti workflow must:

1. Accept only validated analytical run IDs.
2. Bind snapshot, model, source manifest and parameter hash.
3. Store generated evidence atomically; expose `draft`, `ready`, `failed` with documented transition rules.
4. Generate files only from stored immutable evidence, not a new computation at download time.
5. Preserve origin label, year, indicator definition, source links, limitations and caveats.
6. Include a stable identifier and optionally content hash/checksum.
7. Verify download links and sharing permissions; never assume that an opaque ID is authorization.
8. Have a documented correction/withdrawal path that creates a new record, not overwrites history.

Audit records should identify what changed, when, via which authorized action, and against what published version without leaking unnecessary personal data.

## 11. Privacy-by-design user flows

| Flow            | Minimum data needed                     | Default privacy policy (`PROPOSED`)                                       |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| Map exploration | Region ID and indicators                | No personal account needed; avoid persistent browsing history             |
| Comparison      | Two region IDs and indicator IDs        | URL/local state only where appropriate                                    |
| Lab Priority    | Criteria weights + snapshot             | Ephemeral server run / local session, retention TBD                       |
| Theme mode      | `normal` or `kaca`                      | Store locally; no backend needed                                          |
| Story           | Chapter ID                              | Local/URL state; optional anonymous aggregate analytics only after review |
| Evidence export | Immutable analysis run, chosen question | User-controlled sharing; evaluate retention and visibility                |

Don't collect precise geolocation by default; the user selects a geographic **analysis region**, which is not necessarily the user's current physical location. No requirement currently calls for analytics SDKs, advertising identifiers, cross-site tracking, social login or invasive telemetry.

## 12. Retention and deletion policy (`TBD` owner approval)

Decide and document _before public deployment_:

- Log retention duration and secure access.
- How long abandoned/temporary analysis runs remain.
- Retention for immutable publicly shared evidence and procedures to withdraw or correct mistaken publication.
- Backup lifecycle and how deletion/withdrawal propagates.
- Handling subject-rights requests if personal data is introduced.
- External service agreements and data transfer locations.

**Do not invent precise retention periods** or silently retain data indefinitely. Public aggregate official data may be retained for provenance subject to terms. Any genuinely personal data follows a separate, reviewed retention schedule.

## 13. Third-party dependencies and asset licensing

Before integrating 21st.dev component code, GSAP plugins, a commercial map tile service, Fuselab-inspired patterns, fonts or 3D assets:

- Verify source authenticity and the **license of each concrete asset/library**, not merely the site's homepage.
- Record URL, author, package/version, license, attribution, modifications and review date.
- Avoid direct copying of proprietary designs, exact source code or copyrighted visual assets without permission.
- Inspect npm transitive packages and version restrictions; pin tested versions.
- Use Content Security Policy compatible with selected packages rather than disabling it broadly.
- Never allow untrusted WebGL shaders or dynamic external scripts to bypass application integrity requirements.

## 14. HTTP/API headers and browser security (`PROPOSED`)

| Control                 | Baseline rule                                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| HTTPS                   | Enforce TLS in production; redirect insecure requests                            |
| Content-Security-Policy | Explicit script/style/connect/img/font/worker policy; audit necessary allowances |
| HSTS                    | Add when HTTPS deployment/domain policy is ready                                 |
| X-Content-Type-Options  | `nosniff`                                                                        |
| Framing                 | Restrict via `frame-ancestors` / hosting needs                                   |
| CORS                    | Explicit approved origins; don't blindly wildcard credentialed requests          |
| Referrer-Policy         | Minimize leaked query parameters                                                 |
| Permissions-Policy      | Restrict unnecessary browser capabilities                                        |
| Cache-Control           | Public immutable assets vs private/transient responses separately                |

Do not copy literal CSP directives before checking map tiles, wasm/workers, SVG effects, fonts and other actual resources. Add tests for deployed headers.

## 15. Security testing checklist (`SEC-*`)

| ID       | Scenario                                     | Evidence required                                              |
| -------- | -------------------------------------------- | -------------------------------------------------------------- |
| `SEC-01` | Build and repo scanned for secrets           | No exposed provider tokens or unapproved private URLs          |
| `SEC-02` | HTML/JS in source indicator/story label      | Rendered safely as text or sanitized through reviewed renderer |
| `SEC-03` | Query input with SQL metacharacters          | Parameterized query, no injection                              |
| `SEC-04` | Arbitrary URL passed into export/fetch       | SSRF denied                                                    |
| `SEC-05` | Repeated heavy sensitivity jobs              | Quota/timeout/concurrency controls effective                   |
| `SEC-06` | DEMO and LIVE same indicator ID              | Separate responses/cache entries, correct origin               |
| `SEC-07` | Synthetic priority record                    | Never receives official LIVE label                             |
| `SEC-08` | Modify old analysis after saving passport    | Existing passport unchanged                                    |
| `SEC-09` | Guess private evidence ID without permission | Access denied as policy requires                               |
| `SEC-10` | Malicious redirect parameter                 | Open redirect prevented                                        |
| `SEC-11` | Third-party package update                   | Lockfile/license/security review documented                    |
| `SEC-12` | Deploy header scan                           | HTTPS/CSP/CORS/frame policy verified                           |
| `SEC-13` | Error paths                                  | Logs and client errors contain no tokens or PII leakage        |
| `SEC-14` | Source import hostname spoof                 | Reject unexpected source host/protocol                         |
| `SEC-15` | Analytics path                               | Minimal/approved collection; disclosure where required         |
| `SEC-16` | Cross-region incompatible measurements       | No misleading comparison or score laundering                   |
| `SEC-17` | Large request arrays / malformed IDs         | Validation and body limits enforced                            |
| `SEC-18` | Admin publication workflow                   | Unauthorized public caller cannot publish LIVE data            |
| `SEC-19` | Remove 3D capability                         | No loss of core decision data or safe interaction              |
| `SEC-20` | Dependency/provider outage                   | Degraded mode; safe message; no internal details leaked        |

## 16. Incident response (`PROPOSED`)

**Detect → contain → assess → recover → learn.** Maintain an owner contact, incident log and timestamped actions. Examples:

- Credential leak: revoke/rotate, search history and build artifacts, determine exposure scope, rotate dependent credentials.
- Wrong published score: freeze publication, mark affected snapshot, prevent stale exports, publish correction with linked evidence.
- Provider data withdrawn: stop affected ingestion, remove/flag availability according to license, preserve audit without republishing forbidden payloads.
- DDoS/abuse: scale back expensive functionality, rate-limit, triage logs while protecting user privacy.

For legally required notifications, determine relevant obligations and timelines with qualified local counsel; the engineering file alone does not establish legal deadlines.

## 17. Deployment security checklist

- [ ] All real credentials provided via secret manager and access-restricted.
- [ ] Public environment variables contain no secrets.
- [ ] Source, model and data publication approval recorded.
- [ ] Provider permissions and license/redistribution rules confirmed.
- [ ] Runtime schemas for every API boundary enabled.
- [ ] Rate limits/queues for expensive operations configured.
- [ ] HTTPS, CORS, CSP and relevant security headers verified on deployed domain.
- [ ] No high-severity unresolved exposures or insecure dependencies.
- [ ] Backups and restoration (if using DB) tested.
- [ ] Evidence storage access and immutability verified.
- [ ] Logs sanitized, retention and access policies documented.
- [ ] User-facing DEMO and analytics disclaimers inspected.
- [ ] Incident owner and rollback procedure known.
- [ ] Privacy notice and any compliance obligations reviewed before production.

## 18. Claude Code implementation directive

1. Read current repository, hosting and actual auth state; do not assume a user system exists.
2. Threat-model every new external input or side effect.
3. Isolate secrets server-side and enforce runtime schemas.
4. Follow exact DEMO/LIVE source and snapshot boundaries.
5. Keep security functions testable and composed, not scattered in UI callbacks.
6. Write integration tests for misuse cases and authorization changes.
7. Fail safely, use bounded resources, add correlation without revealing internals.
8. Report measured/tested security evidence; flag any unresolved owner/compliance decisions.
9. Never call the product “secure” solely because it uses React, TypeScript, HTTPS or official data.

---

Related: [`05 Data Sources`](./05-DATA-SOURCES.md) · [`06 Data Model`](./06-DATA-MODEL.md) · [`08 API`](./08-API-SPECIFICATION.md) · [`10 Testing`](./10-TESTING-STRATEGY.md) · [`13 Acceptance`](./13-ACCEPTANCE-CRITERIA.md).
