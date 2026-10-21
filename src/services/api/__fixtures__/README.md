# Captured Data Hub responses (DEMO)

Raw responses from `https://api.orangkeren.me/api/v1` (Data Hub v0.1.0, snapshot `2026.10.0-wia-demo`),
captured on 2026-10-20 by the project owner's PowerShell scripts. `capturedSamples.test.ts` decodes every
file through the adapter, so a backend change that breaks the contract fails the tests.

| File | Request | HTTP |
| --- | --- | --- |
| `health` | `GET /health` | 200 |
| `regions_search` | `GET /regions?level=kabupaten_kota&q=bogor` | 200, empty |
| `regions_nonempty` | `GET /regions?level=kabupaten_kota` (514 regions) | 200 |
| `region_detail` | `GET /regions/3201` | 200 |
| `indicators` | `GET /indicators` | 200 |
| `indicator_values` | `GET /indicators/soc_poverty_rate/values` | 200 |
| `snapshots` | `GET /snapshots` | 200 |
| `datasets` | `GET /datasets` (13 datasets) | 200 |
| `boundaries_kabupaten` | `GET /boundaries/kabupaten?...&province_id=32` | 200, Point features only |
| `composite_valid` / `composite_invalid` | `POST /indicators/composite-query` | 200 / 422 |
| `regions_live` | `GET /regions` with LIVE mode | 503 `LIVE_UNAVAILABLE` |

`*.headers.txt` hold the response headers of the same capture.

Do not edit these files and do not hand-write replacements: they are evidence. The region names in them are
synthetic (`Kabupaten Demo Jabar 1`), every indicator value is `DEMO_EXAMPLE`, and the manifest and dataset
checksums are placeholders. None of it is official data.

Not covered by any capture: a measured `0` or a missing value inside `indicator_values`, a `LIVE` 200 response,
and a browser CORS preflight (checked separately against the live API, see the integration notes).
