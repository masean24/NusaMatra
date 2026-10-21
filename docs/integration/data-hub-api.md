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

Found while integrating; the first two change what the frontend can do.

1. **The LIVE 503 has no CORS headers**, preflight included (`OPTIONS …?mode=live` → 503 without `Access-Control-Allow-Origin`). A browser cannot read the `LIVE_UNAVAILABLE` body; it reports a network failure. The app treats a failed request in LIVE mode as blocked ("LIVE Tidak Dapat Dimuat") without claiming to know why. Error responses must carry the same CORS headers as successful ones.
2. **Responses vary by `X-Data-Mode` but caches are not told**: `Cache-Control: public, max-age=3600` with `Vary: Origin` only. A browser answered a LIVE request from a cached DEMO response (observed). The frontend now adds `?mode=` to every URL (the API honours it on every endpoint and lets it win over the header), which keeps caches apart. The API should add `X-Data-Mode` to `Vary` or stop caching mode-dependent responses.
3. **An unknown `mode` value silently returns DEMO** (`?mode=garbage` → 200, `X-Nusamatra-Mode: DEMO`). It should be a 422.
4. **Response headers are not exposed to browsers** (`Access-Control-Expose-Headers` absent), so `X-Nusamatra-Mode`, `X-Data-Fallback` and `X-Nusamatra-Snapshot` are invisible to the frontend. The adapter falls back to `meta.mode` and the error body.
5. **Region names are synthetic** (`Kabupaten Demo Jabar 1` for 3201) and **boundaries are 514 label `Point`s**, so there is no real search, no choropleth and no 3D extrusion until vetted names and `Polygon`/`MultiPolygon` geometry exist.
6. **`GET /regions` is unpaginated** (all 514 at once, ~195 kB). Search and the kabupaten/kota split run on the client (`level` only accepts `kabupaten_kota | provinsi | all`).
7. **`manifest_checksum` and `raw_sha256` are placeholders**; nothing can be verified yet. The `POST /indicators/composite-query` preview has no run id, no persisted run, no weighted contributions and no `/analysis/runs/{id}/explanations/{regionId}`, so Paspor Bukti, Uji Rekomendasi and "Mengapa Diprioritaskan" cannot be built yet.
8. **Indicator values carry no `reference_year` per cell and no methodology or comparability group**, so the adapter marks methodology `UNVERIFIED_DEMO_METHOD:*` and comparability `null`. Bandingkan must keep blocking numeric comparison.
9. **The production origin must be allowed by CORS** (only `http://localhost:5173` was checked).

## Not done and not verified

- Production-origin CORS and the real LIVE path (blocked by 1 and 9 above).
- Provincial filter in Lab Prioritas (`filter_province_id` is supported by the adapter, not exposed in the UI).
- Snapshot-pinned requests: the API does not accept a snapshot id, so `DataHubCacheKeys` accepts one but the app has no query cache yet; each mount refetches and relies on the browser cache.
- The new pages are in the main bundle (+33 kB gzip); route-level `lazy()` would move them out if needed.
- No keyboard/screen-reader audit of the new panels beyond the existing component tests and e2e.

## Found along the way

- `README.md` ends with a stray UTF-16 fragment (`#   N u s a M a t r a`, from line 126), which is why `format:check` fails. It is not part of this work and was left untouched.
- `FloatingNavbar.test.tsx` raced under a full-suite run (`findByRole` resolved before the history pop rendered); it now waits for the state.
