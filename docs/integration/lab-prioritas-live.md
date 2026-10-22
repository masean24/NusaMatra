# Lab Prioritas LIVE — verifikasi kontrak Data Hub v2

Tanggal: 2026-10-22 · Frontend: `feat/live-api-integration-gsl17t` · Acuan: _Panduan Integrasi Frontend Produksi (v2)_

## Status verifikasi

| Sumber                                                                                             | Status                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| API produksi `https://api.orangkeren.me`                                                           | **Belum diverifikasi**: host diblokir dari lingkungan cloud pengembangan (proxy menolak koneksi).                    |
| `openapi.json` produksi                                                                            | **Belum dibaca** (host sama).                                                                                        |
| Respons LIVE v1 yang tertangkap 2026-10-21/22 (`src/services/api/__fixtures__/live/`)              | Dianalisis; temuan di bawah.                                                                                         |
| Kontrak v2 (`renormalized`, `unavailable_indicators`, `effective_weights`, `/indicators/coverage`) | Diimplementasikan sesuai panduan dan **diuji dengan tiruan** (`src/test/labContractMock.ts`), bukan respons v2 asli. |

## Apa yang diperiksa frontend pada setiap hasil LIVE

Peringkat ditahan bila salah satu gagal (`src/domain/prioritization/compositeIntegrity.ts`):

1. Bobot yang dikembalikan tepat 10.000 dan sama dengan bobot yang dikirim.
2. `effective_weights` berjumlah 10.000, hanya memuat indikator berdata, dan sebanding dengan bobot permintaan (toleransi 1 basis poin per indikator); `renormalized` konsisten dengan `unavailable_indicators`.
3. Skor gabungan dan skor komponen terbatas, angka, dan dalam 0–100.
4. Setiap skor gabungan = Σ komponen × bobot efektif (toleransi 0,05).
5. Tidak ada wilayah berskor yang komponen berbobotnya kosong (data kosong tidak boleh dihitung 0).
6. Peringkat 1..n mengikuti urutan skor (skor sama boleh berbagi peringkat), tidak ada peringkat > jumlah wilayah yang dihitung, tidak ada duplikat.
7. Dengan `filter_province_id`, semua kode wilayah diawali kode provinsi itu.
8. Arah skor: untuk setiap indikator berbobot, komponen bergerak sesuai `polarity` terhadap nilai mentah dari `/indicators/{id}/values`, dan (tanpa filter provinsi) sama dengan `norm` yang dipublikasikan.

Wilayah daftar snapshot yang tidak ikut dihitung **tidak** menahan peringkat, tetapi dicantumkan namanya ("tidak diberi skor, bukan diberi skor nol").

## Temuan pada data LIVE v1 yang tertangkap

- Aritmetika baris lengkap benar: 461 baris dengan keempat komponen cocok dengan jumlah berbobotnya (selisih maks 0,005).
- Arah skor benar: komponen `soc_poverty_rate` = min-maks terbalik dari nilai mentah (selisih maks 0,005), sama persis dengan `norm` di `/indicators/soc_poverty_rate/values`, korelasi peringkat −1,0.
- **Masalah (memblokir):** 26 wilayah tanpa nilai stunting tetap diberi skor, dan skornya hanya cocok bila data kosong dihitung 0. Contoh: **Kota Surakarta (3372)**, skor 74,57 = 99,71×30% + 91,67×30% + 85,76×20% + **0**×20%.
- 487 dari 514 wilayah dikembalikan; 27 tidak muncul tanpa penjelasan di respons.

## Temuan pada panduan v2

- Contoh respons di panduan tidak konsisten: komponen 72,1 / 61,5 / 70,3 dengan bobot efektif 4375 / 3125 / 2500 menghasilkan **68,32**, bukan 68,42 seperti tertulis (selisih 0,10 di atas pembulatan).
- Renormalisasi di panduan hanya menangani indikator yang **kosong secara nasional**. Panduan tidak menyatakan cara menangani wilayah yang kosong untuk sebagian indikator berdata (kasus Surakarta). Frontend menerima dua perilaku yang dapat dipertanggungjawabkan: wilayah tersebut tidak diikutkan (dan disebut di daftar wilayah yang tidak masuk peringkat), atau dikembalikan tanpa skor (`composite_score`/`rank` null). Skor dari data kosong yang dianggap 0 tetap ditahan.
- Bentuk respons `/indicators/composite-presets` tidak dijelaskan. Frontend menerima daftar (sebagai `data` atau `data.presets`) berisi `id|preset_id`, `name|label|title`, `description?`, dan `weights|weights_basis_points` (bilangan bulat, total 10.000); selain itu dibuang dan dihitung.
- Panduan menyebut preset sebagai "resmi WIA 2026"; antarmuka menyebutnya "skenario siap pakai dari Data Hub, bukan rekomendasi resmi" sampai ada bukti pengesahan penyelenggara.
- Panduan menyebut "skor prioritas", padahal pada data v1 skor tinggi = kondisi **lebih baik**. Antarmuka menjelaskan bahwa peringkat 1 adalah kondisi relatif terbaik dan menyediakan urutan "Kondisi paling berat dulu".

## Yang dibutuhkan dari tim backend

1. Izinkan `api.orangkeren.me` dari lingkungan pengembangan (atau berikan respons v2 asli yang ditangkap) agar kontrak bisa diverifikasi pada data produksi.
2. Nyatakan metode untuk wilayah dengan data sebagian, dan pastikan tidak ada skor yang memperlakukan data kosong sebagai 0.
3. Dokumentasikan payload `/indicators/composite-presets`.
4. Perbaiki contoh 68,42 di panduan.

## Cara memverifikasi setelah akses tersedia

```bash
NUSAMATRA_LIVE_E2E=1 npx playwright test live-api
```

Lalu buka Lab Prioritas, pilih LIVE: bila semua pemeriksaan lolos, peringkat tampil dengan catatan "Metodologi dan pemeriksaan" yang memuat hasil pemeriksaan arah per indikator; bila tidak, pesan "Peringkat ditahan" menyebut masalah dan contoh kode wilayahnya.
