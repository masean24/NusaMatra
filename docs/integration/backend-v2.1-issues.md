# Temuan pada backend Data Hub v2.1 (diamati dari frontend Lab Prioritas)

Tanggal verifikasi: 2026-10-23 (UTC) · Host: `https://api.orangkeren.me` · Snapshot LIVE: `2026.10.0-official-live`
Metode: permintaan baca-saja (`GET`, dan `POST /api/v1/indicators/composite-query` yang hanya menghitung). Respons mentah yang tidak diubah ada di `src/services/api/__fixtures__/live-v2.1/` (lihat README di folder itu untuk URL, waktu, dan header).
Label `version: 0.1.0` pada `/health` masih usang; kontrak dibaca dari payload, bukan dari label itu.

Setiap butir memuat: endpoint, isi permintaan, waktu (UTC), yang teramati, yang diharapkan, dan mitigasi frontend. Mitigasi frontend tidak mengubah atau mengarang skor.

## 1. Preset `pendidikan_daerah_3t` rankable=false, tetapi composite-query tetap memberi peringkat

**Status: teramati pada 2026-10-23T15:17–15:18Z; TIDAK lagi dapat direproduksi pada 2026-10-23T20:17:15Z.** Pada pembacaan 20:17Z (GET baca-saja, `X-Data-Mode: LIVE`) preset ini `rankable: true`, `coverage_weight_pct: 100`, `unavailable_indicators: []`, bobot efektif 3000/2500/2500/2000, dengan `snapshot_id` yang tetap `2026.10.0-official-live` (lihat butir 4). Butir ini dipertahankan sebagai catatan tentang perilaku `composite-query` terhadap preset yang pernah tidak rankable: server tetap mengembalikan peringkat, dan hanya frontend yang menahannya. Rekaman asli ada di `__fixtures__/live-v2.1/` (`composite_presets.json`, `composite_national_pendidikan_3t.json`).

- Endpoint presets: `GET /api/v1/indicators/composite-presets?mode=live` · 2026-10-23T15:18:07Z
  - `availability.rankable: false`, `coverage_weight_pct: 45.0`, `unavailable_indicators: [edu_damaged_classrooms_pct, edu_student_teacher_ratio_sd]`, `effective_weights: {edu_mean_years_schooling: 5556, inf_internet_household_pct: 4444}`.
- Endpoint komposit: `POST /api/v1/indicators/composite-query?mode=live` · 2026-10-23T15:18:39Z
  - Header: `X-Data-Mode: LIVE`
  - Body: `{"weights":{"edu_damaged_classrooms_pct":3000,"edu_mean_years_schooling":2500,"edu_student_teacher_ratio_sd":2500,"inf_internet_household_pct":2000},"filter_province_id":null}`
- Teramati: HTTP 200, `total_regions: 514`, `total_excluded: 0`, `renormalized: true`, 514 baris berperingkat, `coverage_pct: 100.0` di semua baris, dan `quality_flags.inf_internet_household_pct = IMPUTED_PROVINCE` di semua 514 baris. Peringkat 1 (Kabupaten Nduga) bernilai 100.0 dari dua komponen saja.
- Diharapkan: preset yang ditandai tidak dapat diperingkat tidak menghasilkan peringkat yang tampak sah; atau `composite-query` menolak/menandai hasilnya (mis. `rankable: false` pada respons komposit), atau minimal membawa penanda ketersediaan bobot nasional pada tiap respons.
- Mitigasi frontend: bila bobot sama persis dengan preset yang `rankable=false`, hasil ditahan (`PRESET_NOT_RANKABLE`, blok) dan tidak ada peringkat, grafik, atau penjelasan skor yang ditampilkan. Skor tidak diubah dan tidak diganti. Untuk bobot kustom berlaku kebijakan produk frontend terpisah (butir 3). Dicakup tes dengan respons produksi asli (`compositeCheck.test.ts`, `PriorityLab.test.tsx`).

## 2. Skor ternormalisasi satu nilai `IMPUTED_PROVINCE` tidak diturunkan dari nilai mentah yang ditampilkan (cacat normalisasi backend)

> **Status 2026-10-24:** diperbaiki di Data Hub v2.2. Snapshot produksi `2026.10.0-live-62354dfad392d985` memberi 78,89. Komposit Lanny Jaya kini 80,18, peringkat 3. Guard di bawah TETAP terpasang dan kini meloloskan data ini; capture v2.1 tetap ditahan dalam tes. Lihat [`backend-v2.2-integration.md`](./backend-v2.2-integration.md).

- Indikator: `inf_safe_water_pct` (Persentase Rumah Tangga Akses Air Minum Layak, polaritas `positive`, tahun 2025, BPS `bps_susenas_sakernas_2025`). Wilayah: Kabupaten Lanny Jaya (`9507`, Provinsi Papua Pegunungan).
- Endpoint dan waktu: `GET /api/v1/indicators/inf_safe_water_pct/values?mode=live`, `X-Data-Mode: LIVE`. Rekaman 2026-10-23T15:19:09Z (`__fixtures__/live-v2.1/values_inf_safe_water_pct.json`) dan **dibaca ulang 2026-10-23T20:41:12Z: persis sama, masih terjadi**. Juga `GET /api/v1/regions/9507?mode=live` pada 20:41:13Z.
- Teramati (`raw` → `norm`, `rank`, `flag`), diurutkan menurut nilai mentah:

  | Wilayah | raw | norm | rank | flag |
  | --- | --- | --- | --- | --- |
  | 2105 | 30,77 | 81,38 | | VERIFIED |
  | 9207 | 30,81 | 81,33 | | VERIFIED |
  | 9506 | 31,88 | 80,08 | 6 | VERIFIED |
  | **9507** | **32,89** | **100,00** | **1** | **IMPUTED_PROVINCE** |
  | 9405 | 32,97 | 78,79 | | VERIFIED |
  | 9303 | 39,50 | 71,12 | | VERIFIED |

  Untuk polaritas `positive` di bawah `higher_is_need`, skor kebutuhan harus turun (atau tetap) saat nilai mentah naik. Nilai 32,89 mendapat skor 100 (peringkat 1, persentil 100), lebih tinggi dari 31,88 (80,08), padahal nilai mentah terendah di seluruh negeri (14,93, wilayah 9508) juga hanya mendapat 100.
- Bukti bahwa ini bukan kurva yang berbeda, melainkan satu pengecualian: untuk 22 indikator yang punya nilai mentah dan skor (dibaca 20:41:41–20:42:32Z), SEMUA pengamatan, baik VERIFIED, DERIVED, maupun IMPUTED_PROVINCE, cocok dengan min–maks dari nilai mentah yang ditampilkan (`100·(maks−raw)/(maks−min)` untuk polaritas positif, `100·(raw−min)/(maks−min)` untuk negatif), galat maksimum 0,005. Satu-satunya pengecualian dari ±11.000 pengamatan adalah `9507` / `inf_safe_water_pct`: rumus memberi 78,89, terpublikasi 100,00. Empat indikator seluruhnya `IMPUTED_PROVINCE` untuk 514 wilayah (`dis_affected_pop_per_10k`, `hlt_jkn_coverage_pct`, `inf_electrification_pct`, `inf_internet_household_pct`) dan tiga seluruhnya `DERIVED` (`meta_freshness_lag_years`, `meta_indicator_completeness`, `soc_dependency_ratio`) juga cocok dengan rumus itu.
- Granularitas dan asal estimasi: `GET /regions/9507` menandai enam indikatornya `IMPUTED_PROVINCE` (`dis_affected_pop_per_10k`, `hlt_doctors_per_10k`, `hlt_jkn_coverage_pct`, `inf_electrification_pct`, `inf_internet_household_pct`, `inf_safe_water_pct`). API **tidak** menampilkan nilai provinsi asalnya atau cara estimasinya; `raw_value` 32,89 hanya ditampilkan sebagai nilai wilayah. Maka tidak dapat diketahui dari respons apakah skor 100 dihitung dari nilai mentah lain (misalnya nilai kabupaten sebelum imputasi, atau nilai provinsi) daripada 32,89.
- Dampak: Lanny Jaya masuk peringkat nasional 2 (84,4) pada skenario kemiskinan-stunting karena komponen air minum 100.
- Diharapkan: skor ternormalisasi turun dari nilai mentah yang ditampilkan (78,89), atau nilai yang dipakai untuk menormalisasi ditampilkan, atau observasi estimasi dikecualikan dari peringkat utama atau diberi keterangan.
- Mitigasi frontend (dan batasnya):
  - Pengecualian lama yang menyisihkan semua nilai estimasi dari uji urutan DIHAPUS. Kini pengamatan yang bukan estimasi (VERIFIED, DERIVED, dst.) selalu divalidasi penuh: satu saja di luar urutan membuat indikator `inconsistent` dan peringkat LIVE ditahan.
  - Nilai `IMPUTED_PROVINCE` ikut diuji dengan meletakkannya di antara pengamatan independen terdekat. Yang cocok dihitung sebagai terverifikasi (tercatat `imputedChecked`). Hanya nilai estimasi yang **tidak cocok** disisihkan, dan itu disebut dengan nama wilayah, nilai mentah, dan skornya (status `partial`, "BELUM TERVERIFIKASI PENUH") di baris status dan rincian teknis. Tidak ada yang lolos diam-diam.
  - Indikator yang tidak punya cukup pengamatan independen (kurang dari dua yang bukan estimasi) berstatus `unverified`, bukan `consistent`.
  - Rekomputasi skor gabungan dan seluruh pemeriksaan integritas (bobot wilayah, komponen, cakupan, peringkat) tetap berlaku penuh untuk komponen estimasi; skor komponen dibandingkan dengan skor terpublikasi untuk semua wilayah.
  - **Sejak 2026-10-24 (P0 integritas peringkat), status `partial` adalah inkonsistensi yang diketahui dan gagal tertutup** (`assessDirectionImpact`, `src/domain/prioritization/directionImpact.ts`), tanpa ambang top-N dan tanpa mengoreksi, menghapus, atau menomori ulang apa pun:
    - wilayah anomali ada di daftar peringkat dan indikatornya berbobot efektif > 0 untuk wilayah itu (`effective_weights_region`; bila tidak dilaporkan, bobot skenario) → **seluruh peringkat ditahan** di Lab dan Paspor (`withheldReason: 'DIRECTION_ANOMALY'`), tanpa tautan Paspor;
    - daftar dibatasi provinsi dan wilayah anomali berada di luar daftar → urutan provinsi tetap ditampilkan (skornya tidak memakai wilayah itu), tetapi **`national_rank` tidak ditampilkan**, karena peringkat nasional dihitung bersama wilayah itu. Pemeriksaan ini memakai skor terpublikasi seluruh wilayah (verdict nasional);
    - indikator itu berbobot 0, atau skenario tidak memakainya → tidak terpengaruh, peringkat tampil normal.
  - `unverified`/`unverifiable` (bukti tidak cukup, atau nilai sumber gagal dimuat) tetap peringatan, bukan penahanan; Paspor mencatatnya sebagai "belum terverifikasi penuh". `inconsistent` (pengamatan VERIFIED/DERIVED di luar urutan) tetap memblokir seperti sebelumnya. DEMO tidak pernah memuat nilai LIVE untuk pemeriksaan ini.
  - Ketergantungan backend: penahanan berakhir hanya bila Data Hub memperbaiki skor `9507` (atau menampilkan nilai yang dipakai untuk menormalisasi). Frontend tidak menghitung ulang skor komposit.
- Tes: `compositeCheck.test.ts` (data produksi asli), `componentDirection.test.ts` (sintetis kecil), `directionImpact.test.ts`, `PriorityLab.test.tsx`, `buildCompositeRecord.test.ts`, `CompositePassport.test.tsx`.

## 3. Ambang `rankable` tidak terdokumentasi; ada dua ukuran "cakupan"

- Teramati: preset 45% bobot punya data nasional → `rankable: false`; 75% → `rankable: true`; `min_coverage_pct: 70` pada respons komposit adalah ambang per wilayah, bukan per permintaan.
- Dibutuhkan: dokumentasi ambang `rankable` dan apakah ia sama dengan 70.
- Dua ukuran yang dipisah frontend: (a) `coverage_pct` per wilayah = bagian bobot efektif nasional yang punya data di wilayah itu; (b) ketersediaan bobot yang diminta = bagian bobot permintaan pada indikator yang punya data nasional (`availability.coverage_weight_pct` pada preset; diturunkan dari `unavailable_indicators` pada respons komposit).
- Mitigasi frontend: syarat minimal 70% ketersediaan bobot permintaan untuk skenario kustom adalah KEBIJAKAN PRODUK Nusa Matra (`FRONTEND_MIN_REQUESTED_WEIGHT_PCT`), diberi label demikian pada antarmuka dan bukan atas nama Data Hub.

## 4. Isi dataset berubah tanpa perubahan `snapshot_id`

> **Status 2026-10-24:** v2.2 memakai ID snapshot berbasis isi (`…-live-<16 hex digest>`) dengan `content_sha256`, dan Paspor kini menguncinya. Retensi snapshot lama belum terjamin: ID lama kini 404. Lihat [`backend-v2.2-integration.md`](./backend-v2.2-integration.md).

- Endpoint: `GET /api/v1/indicators/composite-presets?mode=live`, `X-Data-Mode: LIVE`; dan `GET /api/v1/indicators/coverage?mode=live`.
- 2026-10-23T15:17–15:19Z: `snapshot_id: 2026.10.0-official-live`; 25 dari 33 indikator punya data; `pendidikan_daerah_3t` `rankable: false` (45%, dua indikator kosong).
- 2026-10-23T20:17:15Z (dibaca lead): `snapshot_id` masih `2026.10.0-official-live`; antarmuka melaporkan 29 dari 33 indikator punya data; `pendidikan_daerah_3t` `rankable: true` (100%, tanpa indikator kosong). `bencana_infrastruktur` tidak berubah (75%, rankable true). Jateng tetap memberi Wonosobo 35,06 peringkat 1 dan Surakarta 9,57 peringkat 35 pada cakupan 70% (bobot wilayah 4286/2857/2857); Sumut tetap menampilkan Padangsidimpuan (33,3%) hanya di `insufficient_data`.
- Diharapkan: snapshot yang dipublikasikan tidak berubah isinya; perubahan ketersediaan indikator atau `rankable` mendapat `snapshot_id` baru (atau versi/checksum yang terlihat di respons).
- Dampak: `snapshot_id` bukan pengenal isi yang tak berubah. Provenance dan Paspor Bukti yang menyematkan snapshot hanya dari id itu tidak dapat membuktikan bahwa data yang sama dapat diambil ulang. Paspor perlu menyimpan waktu pengambilan dan ringkasan isi yang dipakai (indikator tersedia, bobot efektif, `rankable`), bukan hanya id.
- Mitigasi frontend: tidak ada tebakan; Lab selalu membaca ketersediaan dan `rankable` dari respons yang diambil saat itu, dan guard integritas dijalankan pada setiap hasil. Fixture `__fixtures__/live-v2.1/` tetap menjadi rekaman keadaan 15:17Z dan tidak diubah. Tes browser terhadap produksi (`--grep "deployed Data Hub"`) tidak lagi menegaskan fakta data yang dapat berubah (lihat README fixture), melainkan invarian: server `rankable:false` berarti tanpa peringkat dan tanpa tautan Paspor; `rankable:true` berarti peringkat tampil hanya setelah pemeriksaan integritas lolos.

## 5. Catatan kecil

- `GET /api/v1/indicators/coverage`: jumlah wilayah (514) hanya ada di `meta.coverage.total_regions`, tidak di `data`. Adapter frontend hanya melihat `data`, sehingga teks "N dari 514 wilayah" jatuh ke "N wilayah (X%)". Tidak berbahaya.
- `total_excluded` bersifat per cakupan yang diminta (Sumut: 1) sedangkan `total_eligible_national` per nasional (Sumut: 511). Frontend hanya mewajibkan `total_regions <= total_eligible_national`, kesamaan keduanya tanpa filter provinsi, dan `total_excluded == panjang insufficient_data`. Mohon konfirmasi definisi.
- Baris `insufficient_data` tidak membawa `quality_flags`, `rank`, `composite_score` (benar menurut kontrak). Frontend menolak baris `insufficient_data` yang membawa rank atau skor.
- `GET /health` masih `version: 0.1.0` dan `mode: DEMO` (tanpa header LIVE); tidak dipakai sebagai bukti kontrak.
