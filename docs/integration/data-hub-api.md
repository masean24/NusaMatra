# Data Hub API integration

The reviewed Data Hub adapter is integrated and wired into Jelajahi and Lab Prioritas. Status on 2026-10-21: **DEMO flows work against the real API (`https://api.orangkeren.me`); LIVE is blocked by the backend and shows a blocked state without fallback.** The Data Hub itself (backend, database, ingestion) stays in its own repository; this repo only reads it.

## Where things live

| Path                             | Role                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/api/`              | The adapter: `httpClient` (transport), `apiError`, `wireTypes`, `domainMappers` (wire → domain, runtime-validated), `repositories`. No React, no environment access. |
| `src/services/api/__fixtures__/` | The captured responses the adapter is verified against (`README.md` there lists each one).                                                                           |
| `src/features/data-hub/`         | `DataHubProvider` (repository + DEMO/LIVE choice), `useDataHubResource` (abortable, mode-keyed loading), banner, mode switch, error and loading states, formatters.  |
| `src/features/exploration/`      | `RegionExplorer` (search), `RegionDetailPanel`, `IndicatorPanel`, `BoundaryNotice`; the illustrative 3D map is unchanged.                                            |
| `src/features/priority-lab/`     | `PriorityLab`: weight sliders over the exploratory composite query. `redistributeWeights` lives in `src/domain/prioritization`.                                      |
| `src/app/pages/`                 | `ExplorePage` (`/jelajahi`) and `PriorityLabPage` (`/lab-prioritas`). Every other route is still an honest "under development" shell.                                |

Configuration: `VITE_DATA_MODE` (`demo`) and `VITE_API_BASE_URL` (`https://api.orangkeren.me`, public) in `.env.development` / `.env.production`. The adapter takes the URL from `publicConfig`; it never reads `import.meta.env` itself.

## Verification (2026-10-21, this repository)

| Check                       | Result                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | pass (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)                           |
| `npm run lint`              | pass                                                                                              |
| `npm run test` (Vitest)     | **181 passed**, 28 files (the pack's 17 adapter tests, 23 new adapter tests, UI and domain tests) |
| `npm run build`             | pass; main chunk 403.9 → 501.1 kB (125 → 158 kB gzip)                                             |
| `npm run test:e2e` (Chrome) | **26 passed**, 2 skipped by design (mobile-only skips)                                            |
| `npm run format:check`      | fails only on `README.md`, which was already failing: see "Found along the way"                   |

The pack's own `verify-samples.mjs` was not run (it needs a hard-coded `/mnt/data` path); `capturedSamples.test.ts` replaces it and covers more.

### Adapter against the captured runtime JSON

`src/services/api/capturedSamples.test.ts` decodes the real responses, including the two files that were missing from the first capture:

- **`regions_nonempty.json`**: 514 regions, unique ids, 415 kabupaten + 99 kota, every name synthetic (`Kabupaten Demo …`) and flagged, never a "Bogor", codes, anchor points and bboxes present. The same payload decoded as LIVE fails with `MODE_MISMATCH`.
- **`datasets.json`**: 13 datasets, five agencies, every `raw_sha256` a `demo_placeholder_…` string: all `isChecksumPlaceholder`, none `verifiedSha256`. The `internal://` portal URL is kept as data; the UI only links `http(s)`.
- `health`, `regions_search` (empty), `region_detail`, `indicators` (6 categories, 33), `indicator_values` (514 cells), `composite_valid` (514 ranked, no run id, no contributions), `composite_invalid` (422), `boundaries_kabupaten` (27 `Point` features, not extrudable), `snapshots` (placeholder checksum), `regions_live` (503).

Not covered by any capture: a measured `0` or a missing value inside `indicator_values`, and a LIVE 200. Those paths are tested with hand-edited copies, marked as such in the tests.

### Against the real API, in Chrome (headless, dev server)

Search `?cari=jabar` (27 results), the empty `bogor` search, region 3201 profile (31 indicators, 32 `DEMO_EXAMPLE` badges), the indicator panel, the boundary notice, the LIVE switch and Lab Prioritas with a slider change (a second composite query, total exactly 10 000 bp), with no console errors in DEMO. Preflight for `X-Data-Mode` from `http://localhost:5173` succeeds.

## What the UI does with the data

- **DEMO and LIVE never mix.** The mode is part of every request's identity: requests carry `X-Data-Mode` **and** `?mode=`, resources are keyed by mode, and a mode switch shows "loading" at once, so DEMO numbers cannot sit under LIVE. A DEMO envelope answering a LIVE request fails closed (`MODE_MISMATCH`). The mode switch is separate from Normal/Kaca.
- **LIVE HTTP 503** → "LIVE Belum Tersedia", no rows, no numbers, and no request for DEMO data. Returning to DEMO is a button the user presses.
- **Synthetic names stay synthetic**: "Nama sintetis (DEMO), bukan nama resmi" on lists and profiles; `q=bogor` gets "Tidak ada wilayah yang cocok pada dataset DEMO saat ini".
- **`DEMO_EXAMPLE`** badge on every DEMO value, with the agency code. A measured `0` shows `0`; a missing value shows "Data belum tersedia".
- **Point-only boundaries** are described as such by `BoundaryNotice` and never reach Three.js: the map is labelled "Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)" and still gets `geography={null}`.
- **Placeholder checksums** are called placeholders in the banner; no digest is shown as verified.
- **Lab Prioritas** badges the ranking "Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)", shows the component scores as unweighted normalized values, and keeps "Mengapa Diprioritaskan" gated. If a starting criterion is missing from the catalog it stops instead of substituting another.

## Backend findings (to report to the Data Hub owner)

Found while integrating; the first two change what the frontend can do. Findings 1 and 4 were fixed by the 2026-10-22 redeploy (503 now carries CORS; the mode, snapshot and fallback headers are exposed); the rest still apply.

1. **The LIVE 503 has no CORS headers**, preflight included (`OPTIONS …?mode=live` → 503 without `Access-Control-Allow-Origin`). A browser cannot read the `LIVE_UNAVAILABLE` body; it reports a network failure. The app treats a failed request in LIVE mode as blocked ("LIVE Tidak Dapat Dimuat") without claiming to know why. Error responses must carry the same CORS headers as successful ones.
2. **Responses vary by `X-Data-Mode` but caches are not told**: `Cache-Control: public, max-age=3600` with `Vary: Origin` only. A browser answered a LIVE request from a cached DEMO response (observed). The frontend now adds `?mode=` to every URL (the API honours it on every endpoint and lets it win over the header), which keeps caches apart. The API should add `X-Data-Mode` to `Vary` or stop caching mode-dependent responses.
3. **An unknown `mode` value silently returns DEMO** (`?mode=garbage` → 200, `X-Nusamatra-Mode: DEMO`). It should be a 422.
4. **Response headers are not exposed to browsers** (`Access-Control-Expose-Headers` absent), so `X-Nusamatra-Mode`, `X-Data-Fallback` and `X-Nusamatra-Snapshot` are invisible to the frontend. The adapter falls back to `meta.mode` and the error body.
5. **Region names are synthetic** (`Kabupaten Demo Jabar 1` for 3201) and **boundaries are 514 label `Point`s**, so there is no real search, no choropleth and no 3D extrusion until vetted names and `Polygon`/`MultiPolygon` geometry exist.
6. **`GET /regions` is unpaginated** (all 514 at once, ~195 kB). Search and the kabupaten/kota split run on the client (`level` only accepts `kabupaten_kota | provinsi | all`).
7. **`manifest_checksum` and `raw_sha256` are placeholders**; nothing can be verified yet. The `POST /indicators/composite-query` preview has no run id, no persisted run, no weighted contributions and no `/analysis/runs/{id}/explanations/{regionId}`, so Paspor Bukti, Uji Rekomendasi and "Mengapa Diprioritaskan" cannot be built yet.
8. **Indicator values carry no `reference_year` per cell and no methodology or comparability group**, so the adapter marks methodology `UNVERIFIED_DEMO_METHOD:*` and comparability `null`. Bandingkan must keep blocking numeric comparison.
9. **The production origin must be allowed by CORS** (only `http://localhost:5173` was checked).

## LIVE retest (2026-10-22)

After the backend redeploy, the same script (`node scripts/verify-live-api.mjs`, now with the checks below) and a real-browser run (`NUSAMATRA_LIVE_E2E=1 npx playwright test live-api`, desktop and mobile, no mocks) were run against `https://api.orangkeren.me`. Captured responses are in `src/services/api/__fixtures__/live/`.

**Endpoints.** Every endpoint now answers `200` with `X-NusaMatra-Mode: LIVE`, `X-NusaMatra-Snapshot: 2026.10.0-official-live`, `X-Data-Fallback: NONE`, and the CORS headers (`Access-Control-Expose-Headers` now lists all three). Checked: snapshots, datasets, regions (`provinsi` 38 and `kabupaten_kota` 514), `/regions/1101`, `/indicators` (33), indicator values, `/boundaries/kabupaten`, and `POST /indicators/composite-query`. `GET /regions` is still unpaginated (186 kB).

**What is real.**

- 514 kabupaten/kota; the registry and the BIG boundaries (514 `Polygon`/`MultiPolygon`, edition `BIG-Kepmendagri-300.2.2-2430-2025`, 5.4 MB) share exactly the same region ids, names and BPS/Kemendagri codes (0 differences).
- Indicator values carry `reference_year` (on the indicator) and source agency. Seen: BPS (2024/2025), BNPB (2024), Kemenkes (2023).
- Region profiles list only 16 of 33 indicators. 17 cataloged indicators have no values at all (e.g. `edu_damaged_classrooms_pct`, `hlt_doctors_per_10k`, `inf_internet_household_pct`), so the snapshot's own `indicator_completeness_pct` of 51.6 is accurate while its notes say "100% verified".
- 27 of 514 regions have no indicator data at all (e.g. Kabupaten Bogor 3201, Kota Makassar 7371, Kabupaten Solok 1302, Kabupaten Sorong 9601). Some values carry `IMPUTED_PROVINCE` (province value copied to the regency), e.g. `inf_electrification_pct` and `inf_safe_water_pct` for 1101.

**Composite, requested weights `soc_hdi` 3000, `dis_multihazard_index` 3000, `soc_poverty_rate` 2000, `hlt_stunting_prevalence` 2000.** Recomputed independently from the returned component scores:

| Check                                   | Result                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Weights                                 | echoed, sum 10000 bp                                                                                                       |
| Score = Σ component × weight (461 rows) | holds on every row with all four components; largest error 0.005 (2-decimal rounding)                                      |
| Rank order                              | positions 1..487 and scores non-increasing on every row                                                                    |
| Rows                                    | 487, not 514: the 27 missing regions are exactly those with no data at all (not a complete-case rule)                      |
| Missing components                      | 26 regions have no `hlt_stunting_prevalence` (one of them also lacks `dis_multihazard_index`) and are still scored         |
| How they are scored                     | their score only reproduces when the empty component counts as 0 (26 of 26): "no data" is treated as 0 and drags them down |
| Polarity                                | all components are polarity-aligned, 100 = best (low hazard, low poverty, low stunting, high HDI)                          |

So the arithmetic and the ranking are internally consistent, but the composite is **not** a like-for-like average: the exclusion rule is inconsistent (no-data regions dropped, partial regions zero-filled), and a weighted criterion with no data anywhere (the DEMO Lab default `edu_damaged_classrooms_pct`) is silently ignored while the response still echoes its weight. The score means "relatively better conditions", so rank 1 (Jakarta Selatan) is the least burdened region, not the highest intervention priority.

`assessCompositeIntegrity` flags all of this on the captured response (`REGISTRY_COUNT_MISMATCH` 27, `MISSING_COMPONENT` 26 with the zero-fill evidence, `CRITERION_WITHOUT_DATA`). The frontend does not correct any value.

### Frontend state

| Feature          | LIVE status                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jelajahi         | Connected: real regions and search, profiles, indicator values with agency and year, quality notes (`IMPUTED_PROVINCE`), BIG polygons in the 3D map (map click selects the same region as the list). |
| Bandingkan (new) | Connected: two regions from the profile endpoint; blocks missing, imputed, unit- or dataset-mismatched values; warns on different years; says "higher", never "better".                              |
| Lab Prioritas    | Runs the real query with LIVE starting criteria; the ranking is **withheld** because the integrity check fails (see above). It re-enables itself if a LIVE response passes.                          |
| Uji Rekomendasi  | Not built; also needs run ids/seeded experiments the API does not offer.                                                                                                                             |
| Paspor Bukti     | Not built; the API has no run id, no persisted analysis and no explanation endpoint, so there is nothing to snapshot.                                                                                |

Region-profile summary scores (`composite_scores`, "Indeks prioritas keseluruhan") are hidden in LIVE because their method and direction are undocumented.

### Backend blockers (from the retest)

1. Composite must treat "no data" as missing, not 0: score only complete cases (and say so) or return `null`; reject weights on indicators with no values (422) instead of echoing them.
2. State the coverage rule for the 27 regions without data (Bogor, Makassar, …) or load their data; list them in the response.
3. `area_km2` is `0.0` for all 514 regions; send `null` or the real area (BIG polygons are available).
4. 17 of 33 cataloged indicators have no values; mark them `availability_status: UNAVAILABLE` or hide them. Remove "100% verified" from the snapshot notes.
5. Indicator catalog and region profile lack per-cell `reference_year`/methodology; profile returns 16 indicators of 33.
6. `dis_*_hazard_idx` units say `index (0.0-1.0)` but values are like 21.6 and 36 (1101).
7. `IMPUTED_PROVINCE` values must be documented (method, share of values).
8. CORS reflects any `Origin` with `Access-Control-Allow-Credentials: true`; for a public read-only API prefer an allowlist and drop credentials. The production web origin could not be tested.
9. Still open from before: `Cache-Control` without `Vary: X-Data-Mode`, an unknown `mode` returns DEMO silently, `GET /regions` unpaginated, `manifest_checksum` not independently verifiable.

### Gate for trusting LIVE rankings

`node scripts/verify-live-api.mjs` must exit 0 (currently 4 failures: area, empty indicators, coverage, zero-fill). The Lab needs no code change: its integrity check lets a passing LIVE ranking through.

## LIVE verification (2026-10-21, superseded by the retest above)

The backend reports a LIVE snapshot `2026.10.0-official-live`. That claim was tested directly against `https://api.orangkeren.me`, from outside, with `node scripts/verify-live-api.mjs` (read-only; exits non-zero until every check passes). The backend's own smoke-test report was not used as evidence.

**Result: nothing in LIVE is reachable.** All eight GET endpoints and the composite POST answered `503 LIVE_UNAVAILABLE` with `X-Data-Fallback: UNAVAILABLE` and no snapshot header:

| Endpoint (`?mode=live`)                                                        | Result |
| ------------------------------------------------------------------------------ | ------ |
| `/snapshots`, `/datasets`                                                      | 503    |
| `/regions?level=provinsi`, `/regions/1101`                                     | 503    |
| `/indicators`                                                                  | 503    |
| `/indicators/{soc_hdi, dis_multihazard_index, hlt_stunting_prevalence}/values` | 503    |
| `POST /indicators/composite-query`                                             | 503    |

DEMO endpoints on the same host answer 200, so the service is up; only LIVE is not served. Because LIVE answers 503, schemas, pagination, `X-Data-Fallback: NONE`, per-cell source agency and reference year could **not** be checked, and the reported concerns about the composite (487 regions instead of 514, area values of 0.0, inconsistent arithmetic) are **unverified**, not refuted. The 503 now carries CORS headers (finding 1 above is fixed); `Access-Control-Expose-Headers` still needs `X-Data-Fallback`.

### What the frontend does about it

- LIVE is opt-in per feature. Every LIVE request that fails shows the single "LIVE Tidak Dapat Dimuat" banner; there is no silent fall back to DEMO and no DEMO number is shown in LIVE.
- `assessCompositeIntegrity` (`src/domain/prioritization/compositeIntegrity.ts`) detects, and never repairs: weights not summing to 10000 bp, `total_regions` not matching the rows, rows not matching the region registry, duplicate regions, a composite score that differs from the weighted sum of its components by more than 0.05, rank order that does not follow the scores, and missing components. It passes the captured DEMO response (514 of 514, consistent).
- (Superseded: the Lab now sends the LIVE request and withholds the ranking only when the integrity check fails.) In DEMO, a failing check shows a warning above the unmodified list.
- A region area of `0` is shown as "luas wilayah dari sumber tidak valid (0 km²)", never as a real area.

## Not done and not verified

- Production-origin CORS (the production web origin is unknown; the API reflects any origin).
- Uji Rekomendasi and Paspor Bukti (see the retest table); Bandingkan does not yet copy the Figma extras (summary sentence, "Masukkan ke Lab", "Simpan ke Paspor Bukti") because those targets do not exist.
- The 3D map with 514 BIG polygons was only checked visually in one browser; no frame-rate measurement.
- Provincial filter in Lab Prioritas (`filter_province_id` is supported by the adapter, not exposed in the UI).
- Snapshot-pinned requests: the API does not accept a snapshot id, so `DataHubCacheKeys` accepts one but the app has no query cache yet; each mount refetches and relies on the browser cache.
- The new pages are in the main bundle (+33 kB gzip); route-level `lazy()` would move them out if needed.
- No keyboard/screen-reader audit of the new panels beyond the existing component tests and e2e.

## Found along the way

- `README.md` ends with a stray UTF-16 fragment (`#   N u s a M a t r a`, from line 126), which is why `format:check` fails. It is not part of this work and was left untouched.
- `FloatingNavbar.test.tsx` raced under a full-suite run (`findByRole` resolved before the history pop rendered); it now waits for the state.
