# Lab Prioritas LIVE — kontrak Data Hub v2.1

Diperbarui: 2026-10-23 · Frontend: `feat/live-api-integration-gsl17t` · Host: `https://api.orangkeren.me` · Snapshot: `2026.10.0-official-live`

Dokumen ini menggantikan versi 2026-10-22 yang menganalisis respons v1. Temuan backend ada di [`backend-v2.1-issues.md`](./backend-v2.1-issues.md).

## Status verifikasi

| Sumber                                   | Status                                                                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API produksi `https://api.orangkeren.me` | **Diverifikasi 2026-10-23 (UTC 15:17–15:21)** dengan `GET` dan `POST composite-query` (hanya menghitung). Respons mentah tidak diubah ada di `src/services/api/__fixtures__/live-v2.1/` bersama URL, waktu, dan header.                 |
| Label `/health` (`version 0.1.0`)        | Usang. Kontrak dibaca dari payload, bukan dari label itu.                                                                                                                                                                               |
| Tes unit dan peramban                    | Memakai respons produksi yang ditangkap (diputar ulang tanpa diubah) atau simulator `src/test/labContractMock.ts` (**tiruan**). Tiruan diuji terhadap tangkapan di `labContract.test.ts`, tetapi tidak dihitung sebagai bukti produksi. |
| Bukti produksi langsung                  | `NUSAMATRA_LIVE_E2E=1 npx playwright test priority-lab --grep "deployed Data Hub"` (baca-saja, tanpa mock).                                                                                                                             |

## Arti skor dan peringkat

- `score_direction: higher_is_need`: skor 0–100 yang lebih tinggi berarti kebutuhan intervensi lebih tinggi. **Peringkat 1 = prioritas tertinggi**, di LIVE maupun DEMO. Nilai mentah yang lebih baik memberi skor kebutuhan lebih rendah (HDI naik, skor turun; kemiskinan naik, skor naik).
- `rank` adalah peringkat dalam daftar yang dikembalikan (terfilter). `national_rank` adalah posisi di antara semua wilayah layak nasional. Keduanya dipakai apa adanya dari server, termasuk peringkat sama untuk skor sama (1, 1, 3); frontend tidak menghitung ulang dan tidak memeringkat ulang subset.
- `total_regions` = jumlah wilayah berperingkat yang dikembalikan (Jateng: 35, bukan 514). `total_eligible_national` = jumlah layak nasional (Jateng: 513).

## Yang diperiksa frontend pada setiap hasil

Peringkat ditahan di LIVE bila salah satu gagal (`src/domain/prioritization/compositeIntegrity.ts`); alasan singkat tampil, rincian teknis ada di "Lihat alasan dan detail teknis".

1. Arah skor: `score_direction` harus `higher_is_need`; tanpa itu di LIVE (respons v1) hasil ditahan (`SCORE_DIRECTION_MISMATCH`, `SCORE_DIRECTION_UNREPORTED`).
2. Bobot permintaan dan bobot yang dikembalikan tepat 10.000 dan sama; bobot efektif global 10.000 dan sebanding.
3. Setiap wilayah berperingkat membawa `effective_weights_region` (10.000 bp) atas komponen yang ia punya. Skor direkonstruksi dengan bobot wilayah itu, bukan bobot global. `components_used` dan `missing_indicators` harus cocok dengan nilai `null` dan `null` tidak pernah dianggap 0. Nol hasil pengamatan adalah data yang sah.
4. Toleransi skor per wilayah = 0,01 + 0,005 × jumlah komponen (pembulatan skor 2 desimal ≤ 0,005, pembulatan komponen ≤ 0,005 total, pembulatan bobot ke bp ≤ 0,005 per komponen; 0,03 untuk empat komponen). Selisih terbesar pada ±1.500 baris produksi: 0,005.
5. `coverage_pct` per wilayah cocok dengan bobot komponen yang dipakai, dan wilayah berperingkat tidak di bawah `min_coverage_pct` (70) atau `min_components` (2).
6. Urutan peringkat mengikuti skor, `national_rank >= rank`, tidak menurun, dan sama dengan `rank` tanpa filter provinsi. `total_regions` = jumlah baris; `total_eligible_national >= total_regions`; `total_excluded` = panjang `insufficient_data`.
7. `insufficient_data` tidak membawa rank atau skor, tidak tumpang tindih dengan daftar berperingkat, dan memang di bawah ambang Data Hub sendiri.
8. Dengan `filter_province_id`, semua kode wilayah diawali kode provinsi itu. Cek registri membandingkan registri provinsi dengan baris berperingkat ditambah baris `insufficient_data`.
9. Arah per indikator: komponen sama dengan skor ternormalisasi terpublikasi, dan bergerak berlawanan dengan nilai mentah bila polaritas positif, searah bila negatif (`componentDirection.ts`). Pengamatan yang bukan estimasi (VERIFIED, DERIVED) divalidasi penuh. Nilai `IMPUTED_PROVINCE` diuji dengan meletakkannya di antara pengamatan independen terdekat; hanya yang tidak cocok disisihkan dan disebut (status "BELUM TERVERIFIKASI PENUH", dengan wilayah, nilai mentah, dan skornya) di baris status dan rincian teknis. Indikator tanpa cukup pengamatan independen berstatus "BELUM TERVERIFIKASI". Keduanya tidak memblokir peringkat tetapi tidak pernah lolos diam-diam. Lihat butir 2 di dokumen temuan.

## Cakupan: tiga hal yang berbeda

- **Cakupan per wilayah** (`coverage_pct`): 100% = lengkap (Tier 1); 70% hingga di bawah 100% = parsial/bobot dialihkan (Tier 2), diberi lencana "Data sebagian" dan kriteria yang tidak ikut disebut; di bawah ambang atau kurang dari dua komponen = hanya muncul di `insufficient_data`, tidak pernah diperingkat.
- **Kualitas data** (`quality_flags`): `IMPUTED_PROVINCE` ditampilkan terpisah dari kelengkapan. Cakupan 100% tidak berarti pengukuran tingkat kabupaten/kota.
- **Ketersediaan data nasional atas bobot yang diminta** (`availability.coverage_weight_pct` pada preset; diturunkan dari `unavailable_indicators` pada hasil). Dua aturan terpisah:
  - Skenario Data Hub dengan `availability.rankable = false` (mis. Pendidikan Daerah 3T, 45%): peringkat ditahan walau server tetap mengirim skor (`PRESET_NOT_RANKABLE`).
  - Skenario kustom dengan kurang dari 70% bobot permintaan punya data nasional: peringkat ditahan sebagai **kebijakan antarmuka Nusa Matra**, bukan aturan Data Hub (`REQUESTED_WEIGHT_AVAILABILITY_LOW`, `FRONTEND_MIN_REQUESTED_WEIGHT_PCT`). Teks di antarmuka menyebut itu secara eksplisit.

## Presets

`GET /api/v1/indicators/composite-presets` mengembalikan `data` sebagai array langsung: `preset_id`, `title`, `category`, `description`, `target_focus`, `weights`, `availability` (`available_indicators`, `unavailable_indicators`, `indicator_coverage_pct`, `effective_weights`, `coverage_weight_pct`, `rankable`). Adapter (`labContract.ts`) menolak preset yang bobotnya tidak tepat 10.000 atau `availability`-nya bertentangan dengan dirinya (daftar indikator, persentase, bobot efektif) dan menghitungnya sebagai ditolak. Metadata renormalisasi nasional dipertahankan. Preset ditampilkan sebagai "skenario siap pakai dari Data Hub, bukan rekomendasi resmi".

## Skenario penerimaan yang diverifikasi (respons produksi 2026-10-23)

| Skenario                                                           | Hasil                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jateng, kemiskinan 3000 / stunting 3000 / air 2000 / sanitasi 2000 | 35 berperingkat, 513 layak nasional. Kabupaten Wonosobo 35,06, peringkat 1 (nasional 80), cakupan 100%. Kota Surakarta 9,57, peringkat 35, cakupan 70%, stunting `null`, bobot wilayah 4286/2857/2857. |
| Sumut, bencana 3500 / 1500 / 2500 / 2500                           | 32 berperingkat, `renormalized`, Kota Padangsidimpuan (33,3%) di `insufficient_data`, tanpa peringkat.                                                                                                 |
| Nasional kemiskinan-stunting                                       | 513 berperingkat, 1 `insufficient_data` (Kab. Puncak, 50%), peringkat sama 145 ×3, nol teramati, satu flag `IMPUTED_PROVINCE` (9507).                                                                  |
| Pendidikan 3T                                                      | `rankable=false` (45%); server tetap mengirim 514 baris; frontend menahannya.                                                                                                                          |

## Cara memverifikasi

```bash
npx vitest run src/features/priority-lab src/domain/prioritization src/services/api
npx playwright test priority-lab                                   # mock (v2.1)
NUSAMATRA_LIVE_E2E=1 npx playwright test priority-lab --grep "deployed Data Hub"   # produksi, baca-saja
```
