# Captured Data Hub v2.1 responses (LIVE)

Raw responses from `https://api.orangkeren.me/api/v1`, snapshot `2026.10.0-official-live`, captured
2026-10-23 (UTC) by the `lab-prioritas-v21` agent with read-only requests (`GET`, and `POST
composite-query`, which only computes). Every file is **captured, unmodified** (byte-for-byte copy of
the response body). `/health` still reports the stale label `version 0.1.0`; the contract is read from
the payloads, not from that label.

All requests carried `X-Data-Mode: LIVE` and `?mode=live`. All responses: HTTP 200,
`Content-Type: application/json`, `X-Nusamatra-Mode: LIVE`, `X-Data-Fallback: NONE`,
`X-Nusamatra-Snapshot: 2026.10.0-official-live`, `Cache-Control: public, max-age=3600,
stale-while-revalidate=86400`.

| File | Request | Captured (UTC) | Notes |
| --- | --- | --- | --- |
| `composite_presets.json` | `GET /indicators/composite-presets?mode=live` | 2026-10-23T15:18:07Z | `data` is a direct array of 4 presets with `availability`; `pendidikan_daerah_3t` has `rankable: false` (45%) |
| `composite_jateng_kemiskinan_stunting.json` | `POST /indicators/composite-query?mode=live` `{"weights":{"soc_poverty_rate":3000,"hlt_stunting_prevalence":3000,"inf_safe_water_pct":2000,"inf_safe_sanitation_pct":2000},"filter_province_id":"33"}` | 2026-10-23T15:18:17Z | 35 ranked, 513 eligible nationally; Wonosobo 35.06 rank 1; Surakarta 9.57 rank 35, coverage 70, stunting `null` |
| `composite_sumut_bencana.json` | same endpoint, `{"weights":{"dis_multihazard_index":3500,"dis_flood_hazard_idx":1500,"inf_asphalt_road_village_pct":2500,"inf_electrification_pct":2500},"filter_province_id":"12"}` | 2026-10-23T15:18:26Z | 32 ranked, 1 `insufficient_data` (Kota Padangsidimpuan, 33.3%); `renormalized: true` |
| `composite_national_kemiskinan_stunting.json` | same weights as Jateng, `"filter_province_id":null` | 2026-10-23T15:18:39Z | 513 ranked, 1 insufficient (Kabupaten Puncak, 50%); tie ranks; observed true zeros; one `IMPUTED_PROVINCE` flag (region 9507) |
| `composite_national_pendidikan_3t.json` | same endpoint, `{"weights":{"edu_damaged_classrooms_pct":3000,"edu_mean_years_schooling":2500,"edu_student_teacher_ratio_sd":2500,"inf_internet_household_pct":2000},"filter_province_id":null}` | 2026-10-23T15:18:39Z | BACKEND ANOMALY: ranks 514 regions although the preset is `rankable: false`; every row has `IMPUTED_PROVINCE` for `inf_internet_household_pct` |
| `composite_national_hdi.json` | same endpoint, `{"weights":{"soc_hdi":2500,"dis_multihazard_index":2500,"edu_expected_years_schooling":2500,"hlt_life_expectancy":2500},"filter_province_id":null}` | 2026-10-23T15:18:39Z | 514 ranked; 3 regions at 75% coverage |
| `indicators_coverage.json` | `GET /indicators/coverage?mode=live` | 2026-10-23T15:19:09Z | 25 of 33 indicators have data |
| `indicators_catalog.json` | `GET /indicators?mode=live` | 2026-10-23T15:19:09Z | |
| `values_soc_poverty_rate.json`, `values_soc_hdi.json`, `values_inf_safe_water_pct.json` | `GET /indicators/{id}/values?mode=live` | 2026-10-23T15:19:09Z | Published `norm` is need-oriented: rises with raw for `negative` polarity (poverty), falls with raw for `positive` polarity (HDI, safe water) |

**These files record the production state of 2026-10-23T15:17-15:19Z and are kept as they are.** A read-only
GET at 2026-10-23T20:17:15Z showed the SAME `snapshot_id` (`2026.10.0-official-live`) with different content:
29 of 33 indicators had data (here 25), and `pendidikan_daerah_3t` was `rankable: true` at 100 % (here
`rankable: false` at 45 %). Jateng, Sumut and `bencana_infrastruktur` were unchanged. So the snapshot id does
not identify the content (docs/integration/backend-v2.1-issues.md, item 4), and the mocked tests built on these
files assert the 15:17Z state, not today's production. The live browser test asserts invariants only.

Nothing in this folder is synthetic. Tests that derive a modified copy of a capture (to prove a guard
fails closed) say so in the test, and build it in memory; the files here are never edited. Do not edit
or hand-write replacements: they are evidence. The older v1 captures in `../live/` are kept as
evidence of the response the API gave before v2.1 and are NOT the current contract.
