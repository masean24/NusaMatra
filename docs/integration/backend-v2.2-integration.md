# Data Hub v2.2: integrasi frontend

Status: **terpasang di branch `feat/live-api-integration-gsl17t`, belum di-commit.** Ditulis 2026-10-24 (UTC).
Dasar: dokumen tim backend `FRONTEND_HANDOFF_V2_2.md`, `SNAPSHOT_VERSIONING_V2_2.md`, dan `INTEGRITY_FIX_V2_2.md`
(tidak ada di repositori ini; diterima di luar repo). Semua klaim produksi di bawah ini diperiksa dengan
permintaan read-only ke `https://api.orangkeren.me/api/v1`. Rekaman utuhnya ada di
`src/services/api/__fixtures__/live-v2.2/` (lihat README di sana). Dokumen terkait:
[`backend-v2.1-issues.md`](./backend-v2.1-issues.md) dan [`snapshot-immutability.md`](./snapshot-immutability.md).

## Keadaan produksi yang diperiksa (2026-10-24)

| Hal                                                                                   | Teramati                                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot LIVE aktif                                                                   | `2026.10.0-live-62354dfad392d985`, `content_sha256 62354dfa…84b5`, `is_immutable` dan `is_reproducible` bernilai true              |
| Snapshot lama `2026.10.0-official-live`                                               | **HTTP 404** pada `/snapshots/{id}` dan tidak ada di daftar. Dokumen backend menyebutnya tetap disimpan, tetapi itu tidak terjadi. |
| `?snapshot=does-not-exist`                                                            | 404 `SNAPSHOT_NOT_FOUND` di semua endpoint data (coverage, indicators, values, regions, datasets, presets, composite-query)        |
| `snapshot` dan `snapshot_id` berbeda                                                  | 422 `SNAPSHOT_PARAM_CONFLICT`                                                                                                      |
| Snapshot LIVE pada `?mode=demo`                                                       | 422                                                                                                                                |
| Cakupan                                                                               | 29 dari 33 indikator (87,9%). `meta.coverage.available = 514` adalah jumlah WILAYAH.                                               |
| Lanny Jaya `9507` / `inf_safe_water_pct`                                              | raw 32,89; norm **78,89**; `IMPUTED_PROVINCE`; `dataset_id bps_provincial_sdgs_2025`; `source_record_ref` tersedia                 |
| Kemiskinan + stunting nasional                                                        | Lanny Jaya 80,18, peringkat 3 (sebelumnya 84,40, peringkat 2). Nduga 88,98 #1, Tolikara 80,27 #2.                                  |
| Komposit tak dapat diperingkat (multihazard 5000 + `edu_school_travel_time_p90` 5000) | `rankable: false`, 50%, `regions: []`                                                                                              |
| DEMO                                                                                  | `2026.10.0-wia-demo`, `content_sha256: null`, `is_reproducible: false`                                                             |

## Perilaku frontend

### Snapshot (adapter, `src/services/api`)

- `meta.content_sha256`, `snapshot_immutable`, `snapshot_reproducible` dan `methodology_version` dibaca ke `AdaptedResponseMeta`.
- Bila header `X-NusaMatra-Snapshot` atau `X-NusaMatra-Content-SHA256` bertentangan dengan `meta`, respons ditolak (`SNAPSHOT_MISMATCH` / `SNAPSHOT_DIGEST_MISMATCH`). Bila `meta` kosong, header mengisinya.
- Setiap metode repositori data menerima `snapshot` (`SnapshotPin`). Bila diisi, metode mengirim `?snapshot=<id>`, dan respons wajib membawa id dan digest yang sama (`assertPinned`).
- `GET /snapshots/{id}` (`getSnapshotDetail`) memeriksa bahwa yang kembali adalah snapshot yang diminta.
- Snapshot berstatus reproducible tanpa digest dianggap kontradiksi dan ditolak.
- `getSnapshots` dan `getSnapshotDetail` memakai `cache: 'no-cache'`, karena snapshot aktif berganti saat deploy.
- Tidak ada ID snapshot, digest, atau angka 29/33 yang ditulis di kode aplikasi. E2E produksi mencocokkan bentuk ID yang terdokumentasi, bukan satu nilai.

### Paspor Bukti

Snapshot ditentukan **sebelum** permintaan data apa pun (`snapshotResolution.ts`):

1. **Tautan menyebut `snap`:** frontend meminta `GET /snapshots/{snap}`.
   - 404 → Paspor gagal dengan pesan "Snapshot pada tautan tidak tersedia". Tidak ada data lain yang diminta, dan tidak ada peralihan ke snapshot terbaru.
   - Snapshot reproducible → dikunci (`origin: LINK`).
   - Snapshot tidak reproducible:
     - masih aktif (DEMO) → tidak dikunci;
     - tidak aktif lagi → Paspor ditolak (`SNAPSHOT_NOT_REPRODUCIBLE`).
2. **Tautan tanpa `snap`:** frontend memakai tepat satu snapshot yang `is_active_default` dan `is_reproducible` serta punya digest. Detailnya harus sama digest dengan daftar. Hasilnya dikunci (`origin: ACTIVE`). Bila tidak ada kandidat, atau ada lebih dari satu, Paspor tidak dikunci dan alasannya dinyatakan.
3. Semua permintaan data Paspor (profil, komposit, preset, katalog, dataset, cakupan, registri, nilai indikator) dikunci ke snapshot itu.
   - Respons dari snapshot atau digest lain menggagalkan seluruh Paspor. Ini termasuk permintaan pendukung: kegagalan snapshot tidak pernah dicatat sekadar sebagai "celah".

Isi rekaman:

- `source.reproducibility.status`:
  - `REPRODUCIBLE_SNAPSHOT` hanya bila tiga syarat terpenuhi: rekaman dikunci, snapshot immutable, dan semua respons sepakat pada mode, ID, dan digest.
  - Selain itu `NOT_REPRODUCIBLE`, dengan alasannya.
- Paspor membedakan **data yang dapat direproduksi** dari **laporan yang diarsipkan**. Paspor tetap dirangkai di peramban. Tidak ada nomor laporan, tanda waktu, atau arsip dari server. Digest dikutip dari Data Hub dan tidak dihitung ulang.
- Teksnya menyatakan bahwa ketersediaan snapshot lama tidak dijamin. Buktinya: snapshot lama sudah 404.
- Tautan Salin dan Bagikan, sitasi, dan JSON menyebut snapshot yang dikunci, termasuk bila halaman dibuka tanpa `snap`. Membukanya lagi meminta data yang sama, atau gagal bila snapshot sudah dihapus.
- `fetched` mencatat parameter `snapshot` dan `contentSha256` setiap respons.
- Detail snapshot ditampilkan: spesifikasi hash, metodologi, serta jumlah observasi, indikator, wilayah, dan dataset.
- Cakupan wilayah ("wilayah yang punya observasi") ditampilkan terpisah dari jumlah indikator berdata.
- Provenans per observasi: `dataset_id` dan `source_record_ref` dari `/indicators/{id}/values` disimpan untuk setiap komponen pada rekaman Lab. Pada halaman, keduanya ditampilkan bila dataset observasi berbeda dari dataset katalog indikator.
- Paspor wilayah memakai `provenance.dataset_id` per observasi dari profil wilayah. `source_record_ref` hanya tersedia lewat `/values` (lihat Batasan).

### Komposit dan cakupan

- `rankable`, `not_rankable_reason`, `national_coverage_pct`, `available_weight_basis_points` dan `available_indicators` dibaca ke `ExploratoryCompositeResultDTO`.
- `rankable: false` yang masih membawa baris dianggap kontradiksi dan ditolak.
- `rankable: false` memicu isu pemblokir `COMPOSITE_NOT_RANKABLE` dengan alasan Data Hub dikutip apa adanya. Akibatnya tidak ada peringkat, grafik, atau tautan Paspor.
- `/indicators/coverage` dibaca ke `indicatorCounts`, yang berisi jumlah dan persen INDIKATOR, dan `regionCoveragePct` (persen WILAYAH).
  - Jumlah yang bertentangan dengan entri per indikator ditolak.
  - Lab tetap membaca ketersediaan per indikator dari `byIndicator`, bukan dari jumlah ringkasan.

### Integritas Lab (P0 tetap utuh)

- Guard P0 (`assessDirectionImpact`) tidak diubah atau dilemahkan.
- Data v2.2 lolos dengan sendirinya: verdict air minum `consistent` (nilai IMPUTED_PROVINCE 78,89 berada di kurva yang teramati). Hasilnya `clear`, dan peringkat tampil.
- Capture v2.1 (skor 100) tetap ditahan (tes regresi).
- Nilai indikator dari snapshot lain daripada peringkat tidak dipakai sebagai bukti. Hasilnya `unverifiable`, yaitu peringatan saja.
- Lab sendiri tidak mengunci permintaannya ke snapshot; pengecekan antar-snapshot inilah pelindungnya.

## Batasan yang tersisa

1. **Backend:** `/datasets` mengirim `meta.content_sha256: null` dan flag immutability null, sedangkan headernya membawa digest. Frontend memakai header itu.
2. **Backend:** retensi snapshot historis tidak terjamin lintas deployment. Snapshot lama 404 meski dinyatakan tetap disimpan. Tautan Paspor yang dikunci akan gagal bila snapshotnya hilang, dan tidak beralih diam-diam.
3. Digest tidak dapat diverifikasi di peramban, karena butuh seluruh isi kanonik. Paspor menyebutnya sebagai pernyataan Data Hub.
4. Lab Prioritas, Jelajahi, dan Bandingkan belum mengunci permintaan mereka sendiri. Tautan Paspor yang dibuat dari sana memuat `snap` dari respons yang dilihat; Paspor kemudian menguncinya.
5. `source_record_ref` hanya ada di `/indicators/{id}/values`. Paspor wilayah dan perbandingan tidak memuat endpoint itu (akan butuh satu permintaan per indikator), jadi hanya menampilkan `dataset_id` per observasi.
6. Mock E2E dan mock Lab (`tests/e2e/liveLabMock.ts`, `src/test/labContractMock.ts`) masih memodelkan kontrak v2.1 tanpa digest. Pinning dan `rankable` diuji dengan capture v2.2 asli di Vitest dan E2E produksi.
