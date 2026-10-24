# Captured Data Hub v2.2 responses (LIVE)

Raw responses from `https://api.orangkeren.me/api/v1`, captured 2026-10-24 (UTC, about 06:55Z) with
read-only requests (`GET`, and `POST composite-query`, which only computes). Every `.json` file is a
**captured, unmodified** response body. The `.headers.txt` files hold the `X-Nusamatra-*` response headers
of the same requests, and nothing else.

Active LIVE snapshot at capture time: `2026.10.0-live-62354dfad392d985`,
`content_sha256 = 62354dfad392d985168450ac670b6c647ab097e800ee023768d5858387a984b5`,
`is_immutable: true`, `is_reproducible: true`, methodology `v2.2-minmax-full-range`.

Every data request carried `X-Data-Mode: LIVE`, `?mode=live` and `&snapshot=2026.10.0-live-62354dfad392d985`.

| File | Request | Notes |
| --- | --- | --- |
| `snapshots.json` | `GET /snapshots?mode=live` | One snapshot only. The legacy `2026.10.0-official-live` is NOT listed. |
| `snapshot_detail.json` | `GET /snapshots/2026.10.0-live-62354dfad392d985?mode=live` | Full metadata: digest, counts, `source_manifest` (18 datasets). |
| `snapshot_404.json` | `GET /snapshots/does-not-exist?mode=live` | HTTP 404, `detail.code = SNAPSHOT_NOT_FOUND`. A request for the legacy `2026.10.0-official-live` got the same 404, although the backend notes say that row is kept: history did not survive the redeploy. |
| `coverage_conflict.json` | `GET /indicators/coverage?mode=live&snapshot=<id>&snapshot_id=x` | HTTP 422, `SNAPSHOT_PARAM_CONFLICT`. |
| `coverage.json` | `GET /indicators/coverage` (pinned) | 29 of 33 indicators; `meta.coverage.available = 514` is REGIONS; indicator counts in `meta.indicator_coverage`. |
| `catalog.json`, `presets.json`, `datasets.json` | `GET /indicators`, `/indicators/composite-presets`, `/datasets` (pinned) | All four presets `rankable: true`. BACKEND GAP: `/datasets` sends `meta.content_sha256: null` (and null immutability flags) although its `X-Nusamatra-Content-Sha256` header carries the digest (`datasets.headers.txt`). |
| `values_water.json` | `GET /indicators/inf_safe_water_pct/values` (pinned) | Region 9507: raw 32.89, norm 78.89, rank 7, `IMPUTED_PROVINCE`, `dataset_id bps_provincial_sdgs_2025`, `source_record_ref` present. |
| `values_soc_poverty_rate.json`, `values_hlt_stunting_prevalence.json`, `values_inf_safe_sanitation_pct.json` | `GET /indicators/{id}/values` (pinned) | The other weighted indicators of the kemiskinan + stunting scenario (514, 487 and 513 regions). |
| `region_9507.json` | `GET /regions/9507` (pinned) | Same observation through the region profile. |
| `composite_national_kms.json` | `POST /indicators/composite-query` (pinned) `{"weights":{"soc_poverty_rate":3000,"hlt_stunting_prevalence":3000,"inf_safe_water_pct":2000,"inf_safe_sanitation_pct":2000},"filter_province_id":null}` | 513 ranked; Lanny Jaya 9507 composite 80.18, rank 3. |
| `composite_jateng_kms.json` | same weights, `"filter_province_id":"33"` | 35 ranked; Wonosobo rank 1, national rank 80. |
| `composite_nonrankable.json` | same endpoint, `{"weights":{"dis_multihazard_index":5000,"edu_school_travel_time_p90":5000},"filter_province_id":null}` | `rankable: false`, 50% national weight coverage, `regions: []`. |
| `demo_snapshot_detail.json` | `GET /snapshots/2026.10.0-wia-demo?mode=demo` (`X-Data-Mode: DEMO`) | Active, `is_reproducible: false`, `metadata_checksum` is the `d3m0…` placeholder. |
| `demo_snapshots.json` | `GET /snapshots?mode=demo` (`X-Data-Mode: DEMO`) | DEMO snapshot `2026.10.0-wia-demo`: `content_sha256: null`, `is_reproducible: false`. |

Nothing in this folder is synthetic. Tests that need a changed copy (a different digest, a second
snapshot) build it in memory and say so; the files here are never edited.
