# Bundled geographic data

## `indonesia-coastline.json`

The coastline of Indonesia, used by the landing hero diorama (`HeroDiorama`).

| Field | Value |
| --- | --- |
| Source | [Natural Earth](https://www.naturalearthdata.com/) 1:10m Cultural Vectors, Admin 0 – Countries, **v5.1.2**. The `ADM0_A3 = IDN` feature. |
| Download | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson` |
| Licence | Public domain ([Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/)). No attribution is required; the hero credits it anyway. |
| Processing | Douglas–Peucker simplification at 0.02° (about 2 km). Islands under 0.0015 deg² (about 18 km²) removed. Coordinates rounded to 3 decimals. 241 polygons, 4,349 vertices, 73 KB (25 KB gzip). |
| Version | Recorded in the file's `metadata.version`. |
| Rebuild | `node scripts/geo/build-indonesia-coastline.mjs <path to the downloaded GeoJSON>` |

### What it is not

- **Not administrative boundaries.** It has no provinces or kabupaten/kota and no official codes. It must never be shown as LIVE regional data. The Explore map's selectable regions remain the DEMO dataset, and LIVE geometry comes from the Data Hub.
- **Not an elevation model.** The hero's relief is generated procedurally from distance to the coast plus noise (`terrain/heightField.ts`), and the hero labels it "Relief ilustratif, bukan data elevasi". No peak sits where a real one does.
- **Indonesia only.** Neighbouring land (Malaysian Borneo, Timor-Leste, Papua New Guinea) is not drawn.
