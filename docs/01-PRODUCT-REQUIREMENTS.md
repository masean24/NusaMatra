# 01 — Product Requirements Document (PRD)

> **Product:** Nusa Matra  
> **Program:** WIA 2026  
> **Document:** `docs/01-PRODUCT-REQUIREMENTS.md`  
> **Version:** 1.0  
> **Date:** 19 Oktober 2026  
> **Status:** Baseline requirements untuk implementasi; beberapa keputusan data/metodologi masih terbuka  
> **Primary language:** Bahasa Indonesia (UI), English (code identifiers)  
> **Development framework:** React + TypeScript (wajib)

## 0. Cara menggunakan dokumen ini

Dokumen ini menjelaskan **apa yang harus dilakukan produk**, untuk siapa, dan bagaimana keberhasilannya diuji. Dokumen ini **bukan** desain database, kontrak endpoint, ataupun spesifikasi implementasi animasi yang lengkap. Detail tersebut akan dijelaskan di dokumen bernomor berikutnya.

**Claude Code wajib:**

1. Baca `CLAUDE.md`, `project_guidelines.md`, dan PRD ini sebelum mengimplementasikan fitur.
2. Inspeksi kode yang sudah tersedia dan frame Figma yang relevan sebelum menulis komponen.
3. Perlakukan desain Figma sebagai sumber kebenaran **visual**; PRD sebagai sumber kebenaran **kebutuhan dan perilaku produk**; dokumen arsitektur/data sebagai sumber kebenaran **kontrak teknis**.
4. Jangan menyimpulkan bahwa angka, peta ilustratif, jumlah wilayah, peringkat, sumber bertanda _direncanakan_, ataupun persentase eksperimen yang muncul dalam mockup Figma merupakan data produksi yang sudah tervalidasi.
5. Jika implementasi menemui keputusan yang belum ditetapkan, pilih solusi sementara yang aman dan reversible, beri label `PROPOSED` atau `DEMO`, lalu catat di _decision log_. Jangan berpura-pura keputusan sudah final.
6. Jangan menandai fitur sebagai selesai apabila masih memakai tombol mati, data dummy tanpa label, perhitungan palsu, atau visualisasi yang bertentangan dengan sumber datanya.

### 0.1 Klasifikasi keputusan

| Label              | Makna                                            | Perlakuan Claude Code                                       |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| **LOCKED**         | Sudah disepakati pemilik proyek                  | Implementasikan; jangan ubah sepihak                        |
| **FIGMA-VERIFIED** | Terlihat pada struktur/annotasi desain final     | Cocokkan pada Figma sebelum membuat UI                      |
| **PROPOSED**       | Usulan teknis/produk yang dapat berubah          | Jangan jadikan keputusan bisnis final tanpa dasar           |
| **TBD**            | Informasi belum diputuskan / belum terverifikasi | Dokumentasikan ketergantungan dan penanganan sementara      |
| **DEMO**           | Data, rangking, atau simulasi nonproduksi        | Beri label mencolok namun wajar; jangan klaim sebagai fakta |

### 0.2 Sumber acuan dan prioritas

- **LOCKED:** Nama publik website: **Nusa Matra**. Jangan mengganti kembali menjadi PrioritasKita. Nama lama hanya muncul pada tautan sumber desain.
- **LOCKED:** React + TypeScript; _Clean Code_ adalah kriteria evaluasi penting.
- **LOCKED:** Desain final: [Figma — Nusa Matra (nama file lama PrioritasKita)](https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2).
- **LOCKED:** Animasi merupakan bagian pengalaman utama. Referensi: [Fuselab / Cyberdefend](https://fuselabcreative.com/our-projects/cyberdefend/) dan [21st.dev](https://21st.dev/). Jika komponen yang tepat tidak ada, Claude perlu membuat animasi sendiri dengan kode yang tetap bersih.
- **FIGMA-VERIFIED:** Kapur & Kobalt, font Lexend, mode Normal/Kaca, landing, peta hub, Jelajahi, Bandingkan, Lab Prioritas, Mengapa Diprioritaskan, Uji Rekomendasi, Paspor Bukti, Titik Buta Data, dan Cerita Wilayah.
- **TBD:** Dataset dan API live, cakupan provinsi/kabupaten/kota yang bisa dianalisis, versi batas administratif, skema scoring final, target deployment, dan kebijakan ekspor laporan.

---

## 1. Ringkasan eksekutif

**Nusa Matra** adalah aplikasi web eksplorasi dan analisis wilayah Indonesia yang menyajikan kondisi wilayah, indikator pembangunan, serta penilaian prioritas **secara transparan dan dapat ditelusuri**. Pengguna dapat mencari wilayah, membaca data dalam bahasa sehari-hari, membandingkan dua wilayah, dan—pada fase lanjutan—mengubah asumsi/bobot analisis untuk memahami mengapa hasil prioritas berubah.

Produk bertujuan mengurangi kesenjangan antara **data mentah yang sulit dipahami** dan **pemahaman masyarakat atas kondisi serta kebutuhan wilayah**. Nusa Matra adalah **alat bantu eksplorasi dan pertimbangan**, bukan keputusan kebijakan resmi maupun sistem yang otomatis menetapkan wilayah mana yang “pantas” mendapatkan bantuan.

### 1.1 Pernyataan masalah (_problem statement_)

Calon pengguna menghadapi hambatan berikut:

- Data wilayah tersebar di berbagai portal, memakai definisi, unit, dan periode berbeda.
- Tabel statistik tidak langsung menunjukkan lokasi dan konteks wilayah.
- Perbandingan sederhana berpotensi menyesatkan jika dua angka tidak metodologis setara.
- Hasil pemeringkatan sering tidak menjelaskan bobot, sumber, arah indikator, dan ketidakpastiannya.
- Antarmuka kompleks dan istilah teknis menghalangi masyarakat nonteknis untuk mengeksplorasi sendiri.

### 1.2 Proposisi nilai

**Jelajahi → Bandingkan → Pahami alasan → Periksa kualitas data → Evaluasi asumsi → Catat bukti.**

Pengguna harus dapat bergerak dari melihat sebuah wilayah hingga memahami sumber dan keterbatasan datanya, tanpa dipaksa mengerti statistik atau pemrograman terlebih dahulu.

### 1.3 Batas klaim produk

- Semua narasi faktual terkait wilayah harus dapat dilacak ke nilai, periode, definisi, dan sumber.
- Indeks atau skor prioritas adalah **hasil model dengan asumsi**, bukan kebenaran mutlak.
- Ilustrasi 3D/heksagon bukan bukti ketepatan geospasial.
- Desain Figma dapat memperlihatkan contoh seperti Cianjur, Garut, Semarang, “514 kabupaten/kota”, “500 uji”, atau “92% stabil”; semuanya **contoh desain** sampai benar-benar diperoleh/diolah dari data dan model yang sah.

---

## 2. Pengguna sasaran dan kebutuhan

| Persona                       | Masalah utama                          | Jobs to be Done                                                        | Tanda berhasil                                                               |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Warga umum                    | Sulit memahami kondisi daerah          | “Saya ingin melihat kondisi wilayah saya dengan penjelasan sederhana.” | Bisa mencari wilayah dan memahami ≥1 indikator, satuan, tahun, dan sumbernya |
| Mahasiswa / peneliti          | Data tersebar dan tidak selalu setara  | “Saya ingin mengecek serta membandingkan indikator dengan benar.”      | Bisa membandingkan dua wilayah dan melihat alasan blokir/peringatan          |
| Komunitas / organisasi sosial | Sulit membaca kebutuhan relatif        | “Saya ingin menjelajahi daerah yang membutuhkan perhatian.”            | Bisa memahami faktor yang memengaruhi hasil, bukan hanya angka ranking       |
| Pengguna pendukung kebijakan  | Butuh transparansi asumsi dan kualitas | “Saya ingin tahu apakah hasil bertahan ketika asumsi berubah.”         | Bisa memeriksa kontribusi, sensitivitas, asal data, dan batasan              |

**Akses awal (PROPOSED):** Pengguna dapat menjelajah tanpa login. Akun, kolaborasi, penyimpanan cloud, dan personalisasi permanen berada di luar ruang lingkup MVP kecuali pemilik proyek menugaskannya secara eksplisit.

### 2.1 Prinsip keterbacaan

- UI dan microcopy publik menggunakan Bahasa Indonesia yang sederhana.
- Pertama tampilkan kesimpulan singkat; detail metodologi dapat dibuka sesuai kebutuhan.
- Setiap grafik memiliki label, angka, satuan, tahun, dan alternatif teks.
- Hindari mencampur arti **nilai lebih tinggi**, **kondisi lebih baik**, dan **prioritas lebih tinggi**.
- Gunakan label yang jelas: _data belum tersedia_, _tidak dapat dibandingkan_, _simulasi_, _tahun berbeda_, atau _contoh_.

---

## 3. Tujuan, non-tujuan, dan indikator keberhasilan

### 3.1 Product goals

| ID        | Tujuan                              | Bukti yang diharapkan                                                       |
| --------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `GOAL-01` | Aksesibilitas informasi wilayah     | Pengguna dapat mencari dan memilih wilayah tanpa instruksi panjang          |
| `GOAL-02` | Transparansi data                   | Nilai indikator selalu menyertakan tahun, unit, sumber, dan status kualitas |
| `GOAL-03` | Perbandingan yang bertanggung jawab | Ketidakcocokan definisi/metode diblokir, perbedaan tahun diberi penjelasan  |
| `GOAL-04` | Analisis dapat dijelaskan           | Bobot, normalisasi, kontribusi, dan batasan terlihat dan konsisten          |
| `GOAL-05` | Pengalaman visual yang unggul       | Navigasi dan motion sesuai Figma, tetap responsif dan aksesibel             |
| `GOAL-06` | Kualitas engineering                | Kode React modular, tervalidasi TypeScript, terlint, dan teruji             |

### 3.2 Non-goals (_tidak dijanjikan sebagai fitur awal_)

- Mengambil keputusan alokasi APBN/APBD atau mengklaim otoritas pemerintah.
- Memproyeksikan hasil kebijakan tanpa metode yang disetujui.
- Menghasilkan “rekomendasi terbaik” dari angka yang tidak setara atau tidak lengkap.
- Menggunakan generative AI untuk mengarang narasi fakta atau mengisi data kosong.
- Mendukung seluruh wilayah/indikator secara otomatis sebelum sumbernya tersedia.
- Login, profil pengguna, pembayaran, forum, atau administrasi konten (belum disepakati).

### 3.3 KPI pengujian produk (PROPOSED, bukan angka hasil aktual)

| Ukuran                           | Cara ukur                                                    | Target keputusan                                               |
| -------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **Task completion**              | Uji pengguna: cari wilayah dan temukan satu sumber indikator | Ambang numerik ditetapkan saat rencana uji pengguna            |
| **Compare success**              | Uji alur pilih A/B, tukar, baca peringatan                   | Tidak ada kasus ketidakcocokan yang keliru dihitung            |
| **Data provenance completeness** | Audit kartu, grafik, tabel, dan laporan                      | 100% nilai publik yang diklaim nyata punya metadata wajib      |
| **Core interaction correctness** | Tes otomatis dan uji manual                                  | Seluruh _critical paths_ lulus sebelum rilis                   |
| **Accessibility**                | Keyboard, kontras, pembaca layar, reduced motion             | Tidak ada blocker kritis pada rilis                            |
| **Code quality**                 | Typecheck, lint, test, review                                | Seluruh pipeline kualitas lulus                                |
| **Performance**                  | Pengukuran perangkat desktop/mobile representatif            | Angka anggaran performa ditentukan dan dibuktikan saat fase QA |

Jangan membuat angka kesuksesan atau laporan pengujian yang belum diukur.

---

## 4. Hirarki fitur, prioritas, dan rilis

Definisi prioritas:

- **P0 / MVP:** Tanpa ini alur inti eksplorasi/perbandingan belum utuh.
- **P1 / Analytic release:** Menambahkan analisis prioritas dan kemampuan menjelaskan hasil setelah metodologi tervalidasi.
- **P2 / Advanced:** Bukti, sensitivitas, storytelling, dan penyempurnaan pengalaman setelah fondasi data stabil.

| Modul                              | Prioritas                        | Status desain                          | Kriteria untuk membuka implementasi produksi                 |
| ---------------------------------- | -------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Branding + shell + navbar + footer | P0                               | FIGMA-VERIFIED                         | Design tokens dan navigasi diaudit                           |
| Landing page & Peta Utama (hub)    | P0                               | FIGMA-VERIFIED                         | Konten dan semua CTA mempunyai tujuan nyata                  |
| Mode Normal/Kaca                   | P0 (mode dasar), polish menyusul | FIGMA-VERIFIED                         | Tema aksesibel; transisi premium progresif                   |
| Jelajahi Wilayah                   | P0                               | FIGMA-VERIFIED                         | Geografi dan observasi valid tersedia atau demo diberi label |
| Detail indikator wilayah           | P0                               | FIGMA-VERIFIED / UI flow perlu diaudit | Data minimal, sumber, tahun, satuan tersedia                 |
| Bandingkan dua wilayah             | P0                               | FIGMA-VERIFIED                         | Aturan keterbandingan ditetapkan                             |
| Kualitas data dasar & peringatan   | P0 (di dalam fitur)              | FIGMA-VERIFIED                         | Mesin validasi tersedia                                      |
| Lab Prioritas                      | P1                               | FIGMA-VERIFIED                         | Normalisasi, bobot, indikator, dan cakupan disetujui         |
| Mengapa Diprioritaskan             | P1                               | FIGMA-VERIFIED                         | Penjelasan membaca output model yang sama                    |
| Titik Buta Data (halaman khusus)   | P1/P2                            | FIGMA-VERIFIED                         | Temuan terhubung ke validator sebenarnya                     |
| Uji Rekomendasi                    | P2                               | FIGMA-VERIFIED                         | Algoritme analisis sensitivitas dapat diulang                |
| Paspor Bukti                       | P2                               | FIGMA-VERIFIED                         | Provenans dan snapshot versi data/model konsisten            |
| Cerita Wilayah                     | P2                               | FIGMA-VERIFIED                         | Narasi data tervalidasi; fallback aksesibel tersedia         |
| 3D lanjutan & liquid transition    | Bertahap                         | FIGMA-VERIFIED                         | Core flows bekerja tanpa WebGL                               |

**Catatan:** P0 mencakup interaksi dan data yang benar. Visual P1/P2 boleh dipratinjau sebagai demo berlabel, tetapi tidak boleh ditampilkan seolah-olah terhubung ke data hidup.

---

## 5. Peta layar dan navigasi

**Route berikut PROPOSED**, bukan kontrak URL final. Cocokkan dengan navigasi Figma, lalu putuskan bersama arsitektur routing pada `docs/04-TECH-STACK-ARCHITECTURE.md`.

| View                   | Route kandidat     | Tujuan                                      | Figma node           |
| ---------------------- | ------------------ | ------------------------------------------- | -------------------- |
| Landing                | `/`                | Pengenalan, ajakan eksplorasi, storytelling | `27:2`, `27:118`     |
| Peta Utama / Hub       | `/peta`            | Memilih alur eksplorasi                     | `61:1183`, `61:1619` |
| Jelajahi               | `/jelajahi`        | Eksplorasi data berbasis peta               | `29:34`, `29:485`    |
| Bandingkan             | `/bandingkan`      | Komparasi dua wilayah                       | `12:840`             |
| Lab Prioritas          | `/lab-prioritas`   | Ubah bobot dan lihat peringkat              | `11:152`             |
| Mengapa Diprioritaskan | `/mengapa`         | Penjelasan skor wilayah                     | `12:263`             |
| Uji Rekomendasi        | `/uji-rekomendasi` | Analisis sensitivitas model                 | `13:854`             |
| Paspor Bukti           | `/paspor-bukti`    | Rekam hasil/sumber/asumsi                   | `13:446`             |
| Titik Buta Data        | `/titik-buta-data` | Audit kualitas dan batasan                  | `14:541`             |
| Cerita Wilayah         | `/cerita-wilayah`  | Narasi bab interaktif                       | `14:927`             |

Komponen navigasi melayang ada pada node `49:304`, `49:447`, dan `62:1291`. Implementasikan **arah perpindahan nyata** untuk setiap tautan/CTA aktif. Jika suatu fitur belum tersedia, tampilkan status yang jelas dan konsisten; jangan memakai tautan `#` atau event handler kosong.

### 5.1 Kesinambungan konteks antarhalaman

Ketika berpindah dari satu fitur ke fitur lain, pertahankan konteks yang relevan:

- Identitas wilayah (`regionCode`, bukan nama yang ambigu).
- Indikator dan tahun saat sedang dibahas.
- Mode visual Normal/Kaca (preferensi tampilan, bukan data bisnis).
- Bobot/kriteria skenario hanya jika pengguna memang memulai analisis.
- Status DEMO vs data terverifikasi.

**PROPOSED:** Simpan pilihan layar yang aman di URL query parameters untuk halaman yang perlu dibagikan; simpan preferensi tampilan di penyimpanan lokal bila diizinkan. Jangan otomatis memasukkan data sensitif ke URL.

---

## 6. Persyaratan fungsional (_functional requirements_)

Setiap requirement mempunyai ID permanen untuk digunakan ulang di user flows, tes, API, dan acceptance criteria. Ketika mengubah requirement, perbarui `docs/13-ACCEPTANCE-CRITERIA.md` dan dokumen turunannya.

### 6.1 `CORE` — shell, landing, navigasi, preferensi

| ID           | Prioritas | Requirement                                                                                                         | Contoh pembuktian                         |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `FR-CORE-01` | P0        | Tampilkan identitas **Nusa Matra** secara konsisten di judul halaman, navigasi, metadata, dan teks alternatif logo. | Tidak ada brand lama pada UI publik       |
| `FR-CORE-02` | P0        | Landing mengikuti hierarki konten dan visual Figma final.                                                           | Audit visual desktop 1440px + mobile      |
| `FR-CORE-03` | P0        | Navbar dan CTA menuju rute/aksi valid dengan state fokus/hover/aktif.                                               | Keyboard + mouse + touch                  |
| `FR-CORE-04` | P0        | Sediakan mode tampilan Normal dan Kaca sesuai desain.                                                               | Kontras, keterbacaan, persistensi pilihan |
| `FR-CORE-05` | P0        | Jika fitur/data gagal, tampilkan empty/error/retry yang dapat dipahami.                                             | Simulasi offline/error API                |
| `FR-CORE-06` | P0        | Navigasi ke wilayah yang dipilih mempertahankan ID yang benar.                                                      | Query/search → Jelajahi                   |
| `FR-CORE-07` | P1        | Animasi masuk, diorama, dan transisi tema mengikuti anotasi Figma; tidak menghalangi fungsi.                        | Uji reduced motion + fallback             |

**Perilaku penting:** mode Kaca adalah preferensi visual; jangan pernah mengubah nilai analitik karena pengguna mengganti mode.

### 6.2 `MAP` — Peta Utama dan Jelajahi Wilayah

| ID          | Prioritas | Requirement                                                                                                     | Contoh pembuktian                       |
| ----------- | --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `FR-MAP-01` | P0        | Tampilkan peta/visual geografi Indonesia sesuai konteks desain dan dataset yang dipilih.                        | Data sumber geometri terlacak           |
| `FR-MAP-02` | P0        | Cari wilayah berdasarkan nama resmi dan alias yang didukung.                                                    | Pencarian berhasil/no-result/ambigu     |
| `FR-MAP-03` | P0        | Pilih wilayah dengan pointer atau kontrol alternatif keyboard.                                                  | State wilayah/panel sama                |
| `FR-MAP-04` | P0        | Tampilkan nama wilayah, kode, administrasi induk bila relevan.                                                  | Region ID konsisten                     |
| `FR-MAP-05` | P0        | Ubah indikator dan tahun/periode (jika tersedia); peta, legenda, nilai, dan panel harus sinkron.                | UI tidak menampilkan campuran indikator |
| `FR-MAP-06` | P0        | Detail indikator menyebutkan nilai, satuan, periode, definisi singkat, dan sumber.                              | Audit metadata nilai                    |
| `FR-MAP-07` | P0        | Nilai kosong, cakupan belum tersedia, dan error sumber ditunjukkan secara eksplisit.                            | Null bukan nol                          |
| `FR-MAP-08` | P0        | Batas wilayah presisi tidak diambil dari ilustrasi heksagon; layer resmi harus terpisah dari diorama/ilustrasi. | Peta dengan metadata geospasial sah     |
| `FR-MAP-09` | P1        | Filter indikator, kategori, dan hierarki wilayah dapat dikombinasikan bila data mendukung.                      | Filter deterministik                    |
| `FR-MAP-10` | P1        | Perubahan layar peta tidak menyebabkan resource/event listener bocor.                                           | Tes navigasi dan cleanup                |

**Figma:** peta heksagon adalah _ilustratif_. Ketika memakai bentuk visual yang tidak akurat secara geometri, berikan label yang menyatakan itu bukan peta presisi.

### 6.3 `CMP` — Bandingkan Wilayah

| ID          | Prioritas | Requirement                                                                                                    | Contoh pembuktian               |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `FR-CMP-01` | P0        | Pilih tepat dua wilayah A dan B pada MVP.                                                                      | Dua selector berfungsi          |
| `FR-CMP-02` | P0        | Tombol _Tukar posisi_ menukar seluruh konteks A/B tanpa salah pasangan data.                                   | Angka + label ikut tertukar     |
| `FR-CMP-03` | P0        | Bandingkan indikator berdasarkan ID stabil, bukan hanya nama tampilan.                                         | Unit/metode cocok               |
| `FR-CMP-04` | P0        | Bila definisi, denominator, metode, atau unit tidak kompatibel, blokir rasio/selisih dengan alasan yang jelas. | Tidak ada kalkulasi menyesatkan |
| `FR-CMP-05` | P0        | Jika tahun A/B berbeda, tampilkan kedua tahun beserta catatan relevansi.                                       | Warning terlihat pada baris     |
| `FR-CMP-06` | P0        | Gunakan narasi “lebih tinggi/rendah” dengan hati-hati; “lebih baik/buruk” hanya bila arah indikator diketahui. | Tidak menyalahartikan indikator |
| `FR-CMP-07` | P0        | Grafik disertai angka, satuan, label A/B, tahun, sumber, dan ringkasan teks.                                   | Akses pembaca layar             |
| `FR-CMP-08` | P0        | Hindari pembagian nol, hasil tak hingga, pembulatan menyesatkan, dan angka nol palsu.                          | Tes kasus batas                 |
| `FR-CMP-09` | P1        | Jika sumber memiliki keterbatasan, tautkan baris ke detail/titik buta data.                                    | Alur bisa ditelusuri            |

**Contoh Figma:** Kab. Cianjur dan Kota Semarang adalah data desain. Klaim perbandingan harus dihitung ulang dari sumber nyata sebelum tampil sebagai fakta.

### 6.4 `LAB` — Lab Prioritas (setelah model disetujui)

| ID          | Prioritas | Requirement                                                                                        | Contoh pembuktian                              |
| ----------- | --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `FR-LAB-01` | P1        | Pengguna dapat mengatur bobot masing-masing kriteria dengan slider/kontrol yang aksesibel.         | Mouse, keyboard, touch                         |
| `FR-LAB-02` | P1        | Total bobot = 100% menurut aturan redistribusi yang terdokumentasi.                                | Tidak ada total 99%/101% setelah pembulatan UI |
| `FR-LAB-03` | P1        | Perubahan bobot menghitung ulang skor/ranking secara deterministik, tanpa perhitungan palsu di UI. | Pure function diuji                            |
| `FR-LAB-04` | P1        | Tombol _Atur ulang_ mengembalikan bobot ke baseline yang didefinisikan.                            | Input/ranking kembali konsisten                |
| `FR-LAB-05` | P1        | Tampilkan versi model, himpunan wilayah, tahun, kriteria, dan status kelengkapan data.             | Setiap ranking dapat ditelusuri                |
| `FR-LAB-06` | P1        | Hasil ranking yang berdasar data DEMO diberi label simulasi/nonproduksi.                           | Tidak disalahartikan sebagai hasil resmi       |
| `FR-LAB-07` | P1        | Jika input tidak layak/scoring tidak terdefinisi, berhenti secara aman dan jelaskan penyebabnya.   | Tidak ada NaN/Infinity                         |
| `FR-LAB-08` | P1        | Pengguna dapat masuk ke penjelasan _Mengapa Diprioritaskan_ untuk satu hasil.                      | Bobot dan skor terbawa                         |

**Model visual Figma:** “v0.1 · rata-rata berbobot” adalah rancangan yang **belum otomatis disetujui untuk analisis produksi**. Kebijakan normalisasi, orientasi indikator, missing values, tie-breaker, dan cakupan dijabarkan pada `docs/07-DECISION-ENGINE.md`.

### 6.5 `WHY` — Mengapa Diprioritaskan

| ID          | Prioritas | Requirement                                                                                                | Contoh pembuktian              |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `FR-WHY-01` | P1        | Tampilkan ringkasan alasan utama sebuah wilayah menempati suatu posisi.                                    | Sumber klaim terlihat          |
| `FR-WHY-02` | P1        | Pecah skor berdasarkan setiap indikator: nilai, normalisasi, bobot, dan kontribusi.                        | Jumlah kontribusi = total skor |
| `FR-WHY-03` | P1        | Skenario alternatif menghitung ulang dari model/input yang sama.                                           | Nilai tidak di-hardcode        |
| `FR-WHY-04` | P1        | Jika data kosong, kontribusi tidak tersedia, atau metodologi berubah, jelaskan batasannya.                 | Penanganan konsisten           |
| `FR-WHY-05` | P1        | Narasi counterfactual seperti “tanpa bobot ini peringkat menjadi X” harus berasal dari perhitungan aktual. | Test skenario menguatkan klaim |

### 6.6 `DQ` — Titik Buta Data

| ID         | Prioritas           | Requirement                                                                                                                                | Contoh pembuktian               |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `FR-DQ-01` | P0 (warning inline) | Tandai input tidak tersedia, tidak sebanding, atau berkualitas rendah pada lokasi penggunaan.                                              | Warning muncul di Map/Compare   |
| `FR-DQ-02` | P1/P2 (halaman)     | Tampilkan daftar masalah kualitas data beserta wilayah/indikator terdampak.                                                                | Temuan berasal dari validator   |
| `FR-DQ-03` | P1/P2               | Klasifikasikan kasus: data kosong, metode/definisi tidak setara, unit berbeda, periode berbeda, cakupan lemah, sumber belum terverifikasi. | Kategori konsisten lintas layar |
| `FR-DQ-04` | P1/P2               | Setiap masalah mempunyai tingkat dampak: blokir, peringatan, atau informasi.                                                               | Kebijakan yang jelas            |
| `FR-DQ-05` | P1/P2               | Masalah kualitas yang relevan tercatat pada Paspor Bukti.                                                                                  | Snapshot konsisten              |

**Figma:** contoh “air minum layak tidak bisa dibandingkan”, “tahun data berbeda”, dan “data kosong” adalah contoh skenario, bukan diagnosis nyata atas database masa depan.

### 6.7 `SENS` — Uji Rekomendasi

| ID           | Prioritas | Requirement                                                                                            | Contoh pembuktian               |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `FR-SENS-01` | P2        | Pengguna dapat mengaktifkan varian pengujian asumsi yang tersedia.                                     | Kontrol berfungsi               |
| `FR-SENS-02` | P2        | Eksperimen acak memiliki seed, jumlah percobaan, aturan perturbasi, dan versi model.                   | Re-run menghasilkan output sama |
| `FR-SENS-03` | P2        | Laporkan rentang ranking, perubahan dan metrik stabilitas sesuai hasil aktual.                         | Grafik cocok dengan perhitungan |
| `FR-SENS-04` | P2        | Jika data tahun sebelumnya tidak tersedia, opsi historis tidak bisa dijalankan dan alasannya jelas.    | Tidak mengarang history         |
| `FR-SENS-05` | P2        | Komputasi panjang tidak membekukan interaksi; menyediakan loading/progress atau strategi non-blocking. | UI tetap responsif              |

**Figma:** contoh perturbasi ±10%, menghilangkan satu indikator, 500 percobaan, dan persentase kestabilan harus dianggap parameter/hasil ilustratif hingga diuji dan diputuskan.

### 6.8 `EVID` — Paspor Bukti

| ID           | Prioritas           | Requirement                                                                                   | Contoh pembuktian                 |
| ------------ | ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------- |
| `FR-EVID-01` | P2                  | Laporan berisi pertanyaan/scope, parameter, peringkat, versi model, dan waktu pembuatan.      | Snapshot utuh                     |
| `FR-EVID-02` | P2                  | Sertakan definisi/sumber/tahun indikator, keterbatasan, dan masalah kualitas.                 | Semua klaim dapat ditelusuri      |
| `FR-EVID-03` | P2                  | Laporan mencerminkan **satu** konfigurasi dan versi dataset, tidak tercampur state terbaru.   | Nilai tetap stabil setelah dibuat |
| `FR-EVID-04` | P2                  | Nomor laporan nyata harus unik; contoh pada Figma tidak digunakan mentah sebagai ID produksi. | ID benar-benar dihasilkan         |
| `FR-EVID-05` | P2 (jika disetujui) | Download/ekspor hanya ditawarkan bila benar-benar tersedia dan telah diuji.                   | File valid dan lengkap            |

### 6.9 `STORY` — Cerita Wilayah

| ID            | Prioritas | Requirement                                                                 | Contoh pembuktian                |
| ------------- | --------- | --------------------------------------------------------------------------- | -------------------------------- |
| `FR-STORY-01` | P2        | Sajikan narasi per bab dengan indikator progres dan navigasi yang jelas.    | Next/back/scroll sesuai state    |
| `FR-STORY-02` | P2        | Tampilkan visual dinamis (misal diorama, kamera) tanpa _scroll hijacking_.  | Dapat dibaca normal              |
| `FR-STORY-03` | P2        | Seluruh bab mempunyai ringkasan teks dan alternatif aksesibel jika 3D mati. | Uji pembaca layar/reduced motion |
| `FR-STORY-04` | P2        | Statistik dalam narasi harus berasal dari data yang sama dengan visual.     | Provenance tersedia              |
| `FR-STORY-05` | P2        | Ilustrasi nonpresisi diberi label “ilustrasi, bukan peta akurat”.           | Tidak menyesatkan                |

---

## 7. Prinsip UI/UX yang wajib dipenuhi

### 7.1 Kesetiaan pada desain final

**FIGMA-VERIFIED:**

- Identitas **Kapur & Kobalt**, aksen oranye, tipografi **Lexend**.
- Normal Mode dan Kaca/Glass Mode.
- Tombol Aksen, Kaca, Garis berikut state default/hover.
- Floating navigation dan komponen pil halaman.
- Landing, peta hub, Jelajahi, Bandingkan, modul lanjutan, dan anotasi 3D.
- Skala lima tingkat `Sangat rendah → Rendah → Sedang → Tinggi → Sangat tinggi`; selalu sertakan legenda teks dan konteks angka.

Referensi warna awal (seluruh token semantik harus diekstrak/dituntaskan dalam `docs/03-UI-UX-DESIGN-SYSTEM.md`):

```css
:root {
  --sea-deep: #1e3fd9;
  --sea: #2f5bff;
  --sea-shallow: #5c7fff;
  --land-1: #fbfaf6;
  --land-2: #ede9df;
  --land-3: #d9d3c3;
  --land-4: #b8af9a;
  --bg: #f2f1ec;
  --accent: #ff8a3d;
  --text-primary: #121826;
}
```

### 7.2 Animasi dan 3D sebagai _progressive enhancement_

- Implementasi kualitas utama adalah **alur interaksi**; animasi tidak boleh menghalangi CTA, isi data, atau navigasi.
- Anotasi scroll dan zona 3D Figma tersedia pada node `43:713` dan `43:250`; detail wajib diturunkan ke `docs/09-ANIMATION-GUIDELINES.md`.
- Spesifikasi transisi cair Normal ↔ Kaca ada di node `30:1467`. Peralihan tema harus tetap bekerja jika efek cairan tidak bisa dijalankan.
- Referensi komponen eksternal: 21st.dev, Fuselab. Cek kesesuaian, kualitas, lisensi, dan ukuran bundle sebelum memakai kode pihak ketiga.
- Jika efek sesuai desain tidak tersedia: **Claude Code wajib merancang serta mengimplementasikan animasi custom sendiri**, menggunakan CSS/Motion/GSAP/Three.js sesuai tingkat kompleksitas dan kebutuhan yang nyata.
- `prefers-reduced-motion`, kontras, mode transparansi rendah, perangkat tanpa WebGL, dan keyboard navigation wajib dipikirkan sejak awal.

### 7.3 Responsivitas minimum

- Acuan visual desktop: artboard 1440px dari Figma.
- Adaptasi tablet/mobile wajib dirancang tanpa memangkas fungsionalitas inti.
- Tabel panjang boleh menggulir secara horizontal di **kontainer tabel**, bukan pada keseluruhan viewport.
- Peta dan grafik harus memiliki penjelasan yang tetap terbaca di layar kecil.
- Kontrol sentuh harus cukup besar dan tidak bergantung pada hover.

---

## 8. Persyaratan data dan kepercayaan (_data trust requirements_)

Setiap _observation_ yang ditampilkan publik sebagai data nyata **harus** mendukung atribut minimal berikut:

| Field konseptual                            | Fungsi                                           |
| ------------------------------------------- | ------------------------------------------------ |
| `regionCode` + `regionLevel`                | Identitas administrasi wilayah yang tidak ambigu |
| `indicatorId` + `definition`                | Identitas dan makna indikator                    |
| `value` / `null`                            | Nilai numerik atau tidak tersedia                |
| `unit` + `denominator` (bila ada)           | Konteks pengukuran                               |
| `period`                                    | Tahun/tanggal/interval observasi                 |
| `source` + `sourceUrl`                      | Asal data yang dapat diperiksa                   |
| `methodology` / `methodologyId`             | Dasar keterbandingan                             |
| `geographyVersion` (bila relevan)           | Versi pembagian administrasi/batas peta          |
| `qualityStatus` / `flags`                   | Kelengkapan, peringatan, atau blokir             |
| `retrievedAt` / `updatedAt` (jika tersedia) | Freshness metadata                               |

### 8.1 Aturan keterbandingan (P0)

- Dua angka **tidak otomatis dapat dibandingkan** karena memiliki nama indikator yang sama.
- Bandingkan hanya jika definisi, unit, denominator, metode, cakupan, dan referensi waktunya memenuhi aturan yang telah ditentukan.
- Tahun berbeda harus terlihat; kebijakan mengizinkan atau memblokir selisih kuantitatif bergantung pada indikator.
- Jika `value === null`, UI menampilkan _data belum tersedia_, bukan `0`.
- Pertahankan nilai observasi asli tanpa membulatkan di lapisan perhitungan.
- Catat perubahan batas administratif dan sumber statistik lintas waktu agar tidak menyiratkan kompatibilitas yang salah.

### 8.2 Perhitungan model prioritas (P1)

Figma memperlihatkan model contoh `v0.1` berbasis rata-rata berbobot. Kontrak perilaku yang diinginkan:

```text
score(region) = Σ (normalizedValue(region, criterion_i) × weight_i)
Σ weight_i = 1
weight_i ≥ 0
```

**Ini rumus awal DEMO, bukan metodologi final yang disahkan.** Keputusan penting pada dokumen `07-DECISION-ENGINE.md`:

- Skor tinggi berarti kebutuhan/risiko/prioritas apa?
- Arah setiap indikator (tinggi = perlu perhatian / rendah = perlu perhatian).
- Populasi acuan normalisasi, rentang, dan _outlier_.
- Perlakuan input kosong, ketidaksetaraan metode, dan bobot redistribusi.
- Nilai imbang, sensitivitas, ketidakpastian, dan stabilitas.
- Keputusan menggunakan istilah “rekomendasi” versus “eksplorasi skenario”.

**Jangan membuat teks rekomendasi yang melebihi daya dukung model.**

### 8.3 DEMO vs LIVE

- Jika integrasi data resmi belum tersedia, gunakan fixture dengan label jelas **“Contoh / Data simulasi”**.
- Sumber yang bertanda _direncanakan_ pada Figma bukan berarti API/izin aksesnya sudah tersedia.
- Jangan menyatukan hasil demo dan hasil live dalam satu skor tanpa penandaan serta kebijakan yang eksplisit.
- Jangan mengarang sumber, API key, indeks, jumlah kabupaten/kota, atau persentase ketahanan model.
- Skema data dan katalog sumber akan dijelaskan secara spesifik dalam dokumen `05`, `06`, dan `08`.

---

## 9. Persyaratan nonfungsional

| ID       | Area                     | Kebutuhan wajib                                                                   | Pembuktian                           |
| -------- | ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------ |
| `NFR-01` | Clean Code               | Modular, konsisten, tidak ada komponen monolitik/dead code/duplikasi tak perlu    | Lint, review, refactor               |
| `NFR-02` | Type safety              | TypeScript strict; validasi runtime untuk semua data eksternal                    | Typecheck + validation tests         |
| `NFR-03` | Reliability              | Request errors, retry, timeout/cancellation, race conditions ditangani            | Integration tests                    |
| `NFR-04` | Accessibility            | Keyboard, focus, semantik, teks alternatif, kontras, reduced motion               | Audit a11y                           |
| `NFR-05` | Performance              | Lazy loading scene 3D/map berat, asset optimization, cleanup WebGL                | Profiling di perangkat representatif |
| `NFR-06` | Maintainability          | Business rules dipisahkan dari JSX/animasi dan dapat diuji sebagai pure functions | Unit tests                           |
| `NFR-07` | Security                 | No secrets di frontend; input validation; aman saat merender data                 | Security review                      |
| `NFR-08` | Observability            | Errors dapat didiagnosis tanpa membocorkan informasi sensitif                     | Logging terstruktur                  |
| `NFR-09` | Responsiveness           | Semua alur penting bekerja di desktop, tablet, ponsel                             | Cross-device tests                   |
| `NFR-10` | Traceability             | Nilai/sumber/model/period/status DEMO terlihat                                    | Audit provenance                     |
| `NFR-11` | International formatting | `id-ID` untuk angka, tanggal, persen, satuan; nilai tetap numerik secara internal | Snapshot tests                       |
| `NFR-12` | Testability              | Semua calculation/validation/comparison logic teruji otomatis                     | Unit/integration suite               |

**Target angka performa dan cakupan tes** adalah TBD hingga baseline perangkat/dataset diketahui. Hindari KPI palsu dan janji tanpa benchmark.

### 9.1 Konvensi engineering lintas modul

- React **functional components** dengan tanggung jawab terbatas.
- TypeScript `strict`; hindari `any`, pengabaian error, dan type assertion sembarangan.
- Buat custom hooks hanya ketika benar-benar menyederhanakan lifecycle/logika reuse.
- Pisahkan `features`, `components/ui`, `services/repositories`, `domain/model`, dan `data/validation` sesuai kebutuhan sebenarnya.
- Tidak ada logika algoritme scoring atau aturan kompatibilitas dalam JSX.
- Gunakan sumber data terstruktur; jangan menempel dataset panjang di komponen.
- Semua listeners, animation timelines, event handlers, AbortControllers, serta resource WebGL dibersihkan.
- Jangan memasang pustaka hanya untuk satu efek sederhana yang bisa dibuat dengan CSS.
- Command CI minimum: `typecheck`, `lint`, `test`, `build`; jalankan yang relevan dan laporkan hasilnya secara jujur.

File `CLAUDE.md` adalah instruksi operasi; detail arsitektur ada pada dokumen `04`, pengujian `10`, keamanan `11`, dan acceptance `13`.

---

## 10. Alur end-to-end produk

### 10.1 Journey MVP: pengguna memahami satu wilayah

```text
Landing / Hub
  -> Cari wilayah
  -> Pilih hasil yang tepat
  -> Jelajahi menyoroti wilayah
  -> Pilih indikator dan periode
  -> Baca nilai + sumber + kualitas
  -> (opsional) Bandingkan dengan wilayah kedua
```

**Selesai bila:** Data, legenda, status, dan sumber selalu konsisten dengan wilayah, indikator, dan periode yang sedang dipilih.

### 10.2 Journey MVP: membandingkan dua wilayah

```text
Jelajahi / Bandingkan
  -> Pilih A dan B
  -> Sistem mencari indikator bersama
  -> Validator menentukan comparable / warning / blocked
  -> Tampilkan tabel/grafik dan alasan
  -> Pengguna menukar A/B atau memilih indikator lain
```

**Selesai bila:** Tidak ada perhitungan rasio/selisih untuk pasangan yang ditandai `blocked`.

### 10.3 Journey analitik lanjutan (P1–P2)

```text
Jelajahi / Bandingkan
  -> Lab Prioritas: atur bobot
  -> Recalculate ranking (data/model terverifikasi)
  -> Mengapa Diprioritaskan: lihat kontribusi
  -> Titik Buta: tinjau keterbatasan
  -> Uji Rekomendasi: cek sensitivitas
  -> Paspor Bukti: catat satu snapshot hasil
```

**Selesai bila:** Model, input, provenance, dan output konsisten di seluruh layar; pengguna tidak bisa menganggap hasil demo sebagai rekomendasi resmi.

### 10.4 Journey Cerita Wilayah (P2)

```text
Landing / Hub
  -> Buka Cerita Wilayah
  -> Navigasi bab (scroll/next/back)
  -> Diorama/visual berjalan bila memungkinkan
  -> Teks dan sumber selalu tersedia
  -> Kurangi gerak / fallback non-3D tetap berfungsi
```

Alur terperinci, keadaan setiap tombol, validasi input, serta skenario edge akan dijabarkan pada `docs/02-USER-FLOWS.md`.

---

## 11. Skenario tepi dan kegagalan yang harus dirancang sejak awal

| Kasus                                    | Perilaku wajib                                               | Dilarang                                    |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Wilayah tidak ditemukan                  | Tampilkan “Tidak ada hasil”, pilihan cari ulang              | Memilih wilayah lain diam-diam              |
| Nama wilayah ambigu                      | Tampilkan konteks provinsi/kode administratif                | Mengasumsikan salah satu tanpa petunjuk     |
| API offline/timeout                      | Tampilkan error dan retry, pertahankan pilihan               | Mengganti nilai dengan angka demo diam-diam |
| Data indikator kosong                    | “Data belum tersedia” + konteks                              | Menampilkan `0`                             |
| Periode berbeda                          | Tahun kedua sisi jelas; warning/policy                       | Menyajikan seolah satu tahun                |
| Definisi/metode berbeda                  | Blokir kalkulasi, jelaskan alasan                            | Menampilkan selisih/rasio tidak valid       |
| Input scoring incomplete                 | Disabled/run blocked atau kebijakan eksplisit yang disetujui | Menormalisasi asal atau mengarang angka     |
| Bobot tidak valid                        | Koreksi dengan algoritme deterministik dan tampilkan total   | NaN, bobot negatif, total kacau             |
| 3D/WebGL tidak tersedia                  | Gambar/statis atau DOM fallback yang lengkap                 | Halaman kosong/crash                        |
| Reduced motion aktif                     | Nonaktifkan gerak dekoratif; konten tetap dapat diakses      | Menghilangkan informasi                     |
| Glass contrast tidak cukup               | Tingkatkan opasitas atau fallback Normal                     | Teks sulit dibaca                           |
| Peralihan route saat request berlangsung | Abort/ignore hasil lama                                      | Menampilkan state wilayah yang salah        |
| Paspor Bukti tanpa data/provenance       | Jelaskan mengapa belum dapat dibuat                          | Membuat laporan seolah valid                |

---

## 12. Acceptance skenario tingkat produk

Acceptance final per komponen akan diperdalam dalam `docs/13-ACCEPTANCE-CRITERIA.md`. PRD ini menetapkan batas minimum:

**`AC-PRD-01` — Branding**  
**Given** pengguna membuka halaman aktif, **when** header/metadata/CTA dirender, **then** nama brand adalah **Nusa Matra**, bukan PrioritasKita.

**`AC-PRD-02` — Eksplorasi**  
**Given** data indikator tersedia, **when** pengguna memilih wilayah dan indikator, **then** peta, detail, legenda, periode, dan sumber menunjukkan entitas yang sama.

**`AC-PRD-03` — Perbandingan tertahan**  
**Given** dua observasi memiliki definisi berbeda, **when** pengguna membuka Bandingkan, **then** selisih/rasio tidak dihitung dan alasan ketidaksetaraan ditampilkan.

**`AC-PRD-04` — Data kosong**  
**Given** observasi bernilai `null`, **when** layar memuatnya, **then** UI menyatakan _data tidak tersedia_ dan tidak menampilkan angka nol fiktif.

**`AC-PRD-05` — Data demo**  
**Given** halaman memakai fixture/mock, **when** pengguna membaca angka/ranking, **then** UI menampilkan label **Data simulasi** yang tidak ambigu.

**`AC-PRD-06` — Lab Prioritas**  
**Given** model dan data valid, **when** bobot berubah, **then** total bobot tetap 100% dan skor serta ranking dihitung ulang dari input aktual.

**`AC-PRD-07` — Explainability**  
**Given** hasil scoring yang valid, **when** pengguna melihat Mengapa Diprioritaskan, **then** penjumlahan kontribusi cocok dengan skor dalam toleransi numerik yang terdokumentasi.

**`AC-PRD-08` — Sensitivitas**  
**Given** seed dan parameter identik, **when** eksperimen Uji Rekomendasi dijalankan ulang, **then** hasil deterministik yang sama diperoleh.

**`AC-PRD-09` — Visual preferences**  
**Given** user mengaktifkan reduced motion atau WebGL gagal, **when** navigasi dan tema digunakan, **then** seluruh informasi dan CTA inti tetap tersedia.

**`AC-PRD-10` — Engineering gate**  
**Given** sebuah fitur dilaporkan selesai, **when** pipeline kualitas dijalankan, **then** typecheck, lint, test yang relevan, dan build berhasil; hambatan diberitahukan secara transparan.

---

## 13. Risiko, dependensi, dan strategi mitigasi

| Risiko                              | Dampak                                             | Mitigasi minimum                                                     | Owner pengambilan keputusan |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| API/data resmi tidak tersedia       | Fitur terlihat lengkap tetapi tidak bisa dipercaya | Verifikasi akses, lisensi, cakupan; gunakan fixtures DEMO terisolasi | Product/Data                |
| Batas administratif berbeda tahun   | Map dan observasi tidak cocok                      | Versioning geografi + mapping kode                                   | Data                        |
| Metodologi indikator tidak setara   | Perbandingan menyesatkan                           | Validator comparability + blokir otomatis                            | Data/Product                |
| Scoring belum tervalidasi           | Ranking disalahtafsirkan sebagai keputusan         | P1 gated + label simulasi + formula transparan                       | Product/Data                |
| WebGL/perangkat lemah               | UX buruk atau crash                                | Lazy-load, fallback DOM, reduced motion                              | Frontend                    |
| Banyak animasi memperbesar bundle   | Lambat di mobile                                   | Pilih library selektif, performance budgets, profiling               | Frontend                    |
| Figma hanya punya referensi desktop | Responsif tidak konsisten                          | Desain aturan breakpoint + uji perangkat                             | Design/Frontend             |
| Deadline WIA 2026                   | Scope melebar, code quality menurun                | Prioritas P0 lebih dulu; quality gates tidak ditawar                 | Product/Engineering         |
| Nama file Figma masih PrioritasKita | Branding publik inkonsisten                        | Brand override **Nusa Matra** dalam UI publik                        | Design/Frontend             |

---

## 14. Dependencies antar dokumen

Dokumentasi project menggunakan urutan berikut agar Claude Code dapat bekerja tanpa mengarang kontrak:

| Urutan | Dokumen                          | Wewenang utama                              |
| ------ | -------------------------------- | ------------------------------------------- |
| Root   | `CLAUDE.md`                      | Instruksi eksekusi Claude Code              |
| Root   | `project_guidelines.md`          | Prinsip proyek, desain, Clean Code          |
| Root   | `README.md`                      | Instalasi, ringkasan, penggunaan repository |
| `01`   | **`01-PRODUCT-REQUIREMENTS.md`** | Ruang lingkup, prioritas, _apa dan mengapa_ |
| `02`   | `02-USER-FLOWS.md`               | Alur, state, navigasi, kondisi error        |
| `03`   | `03-UI-UX-DESIGN-SYSTEM.md`      | Design tokens, komponen, visual fidelity    |
| `04`   | `04-TECH-STACK-ARCHITECTURE.md`  | Keputusan arsitektur React/TypeScript       |
| `05`   | `05-DATA-SOURCES.md`             | Katalog sumber resmi, izin, pembaruan       |
| `06`   | `06-DATA-MODEL.md`               | Entitas, struktur data, versi geografi      |
| `07`   | `07-DECISION-ENGINE.md`          | Normalisasi, bobot, skoring, sensitivitas   |
| `08`   | `08-API-SPECIFICATION.md`        | Kontrak endpoint, error, cache, auth        |
| `09`   | `09-ANIMATION-GUIDELINES.md`     | 3D, timing, fallback, transisi cair         |
| `10`   | `10-TESTING-STRATEGY.md`         | Test pyramid dan quality gates              |
| `11`   | `11-SECURITY-AND-PRIVACY.md`     | Perlindungan data, secrets, abuse cases     |
| `12`   | `12-IMPLEMENTATION-ROADMAP.md`   | Milestone, dependensi, urutan pekerjaan     |
| `13`   | `13-ACCEPTANCE-CRITERIA.md`      | DoD per fitur dan tes terukur               |
| Root   | `.env.example`                   | Nama env vars tanpa secret                  |

**Aturan penting:** PRD dapat mengidentifikasi kebutuhan yang dokumen berikutnya harus pecahkan, tetapi **tidak** otomatis menetapkan pilihan teknis sebelum verifikasi data dan arsitektur.

---

## 15. Open questions & keputusan yang perlu dicatat

| ID       | Pertanyaan                                                        | Dampak jika belum dijawab     | Sikap sementara                                          |
| -------- | ----------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `DEC-01` | Level wilayah MVP provinsi saja, kabupaten/kota, atau keduanya?   | Dataset, routing, peta, biaya | Implementasi berbasis `regionLevel` dan feature flag     |
| `DEC-02` | Indikator MVP apa saja?                                           | UI, API, data completeness    | Gunakan katalog terkonfigurasi, bukan hardcode           |
| `DEC-03` | Sumber resmi mana yang terverifikasi dan legal untuk ditampilkan? | Keandalan & lisensi           | Jangan klaim LIVE tanpa validasi                         |
| `DEC-04` | Versi geometri/kode administratif apa yang digunakan?             | Kesesuaian spasial            | Pisahkan kode dan geometri berdasarkan vintage           |
| `DEC-05` | Kapan model prioritas dapat dinyatakan valid untuk produksi?      | Lab dan ranking               | Label DEMO hingga ada persetujuan                        |
| `DEC-06` | Bagaimana menangani missing indicator dalam scoring?              | Keadilan dan skor             | Block secara default sampai ada policy jelas             |
| `DEC-07` | Apa baseline bobot dan normalisasi?                               | Hasil peringkat               | Skenario contoh saja selama DEMO                         |
| `DEC-08` | Apakah pengguna bisa ekspor/share Paspor Bukti?                   | Scope dan keamanan            | P2, jangan pasang tombol palsu                           |
| `DEC-09` | Apakah fitur memerlukan akun/login?                               | Arsitektur dan privasi        | Tidak untuk MVP                                          |
| `DEC-10` | Backend, hosting, database final?                                 | Implementasi API              | Diputuskan pada dokumen 04–08                            |
| `DEC-11` | Deadline demonstrasi WIA dan target perangkat?                    | Roadmap & QA                  | Menunggu keputusan, tetap prioritaskan P0                |
| `DEC-12` | Apakah ada mobile-specific frame Figma?                           | Pola navigasi mobile          | Adaptasi responsif tanpa mengklaim desain final tersedia |

Claude Code **harus** menyatakan _blocked/dependent on DEC-X_ jika suatu pekerjaan memerlukan keputusan tersebut. Jangan membekukan pengembangan UI dasar akibat data akhir belum dipilih: gunakan adapter dan fixture berlabel.

---

## 16. Instruksi handoff untuk Claude Code

Ketika diminta mengimplementasikan suatu fitur, lakukan urutan berikut:

1. **Temukan FR IDs** terkait pada dokumen ini dan tahap P0/P1/P2-nya.
2. **Baca user flow** dan kondisi error yang diperlukan dari `02-USER-FLOWS.md` (jika sudah dibuat).
3. **Inspeksi frame Figma** sesuai tabel pada §5; jangan menebak pixel, aset, dan interaksi.
4. **Inspeksi repository**: struktur, komponen, tokens, test suites, dan dependensi yang sudah ada; jangan mengulang scaffold.
5. **Periksa dependensi data** dan putuskan mode LIVE yang terverifikasi vs DEMO yang diberi label.
6. **Susun unit kerja kecil** dengan komponen presentasi, domain logic, data adapter, error state, dan tes.
7. **Implementasikan secara bertahap** sesuai standar React + TypeScript + Clean Code.
8. **Implementasikan motion** sesuai Figma; gunakan referensi eksternal hanya bila cocok. Buat animasi custom jika diperlukan tanpa mengorbankan maintainability.
9. **Jalankan pemeriksaan** typecheck, lint, tes relevan, build, serta audit UI/responsif/aksesibilitas.
10. **Laporkan hasil**: FR yang selesai, file berubah, mode data, verifikasi yang benar-benar dijalankan, limitasi, dan DEC yang masih terbuka.

### Template ringkas completion report

```markdown
### Completed

- Feature: ...
- Requirements: FR-..., FR-...
- Data mode: LIVE verified / DEMO labeled / not yet integrated

### Changes

- src/features/...
- src/components/...

### Verification

- typecheck: PASS/FAIL/NOT RUN
- lint: PASS/FAIL/NOT RUN
- tests: PASS/FAIL/NOT RUN
- build: PASS/FAIL/NOT RUN
- Figma visual check: PASS/FAIL/NOT RUN
- accessibility/responsive check: PASS/FAIL/NOT RUN

### Known limitations / decisions

- DEC-...: ...
```

---

## 17. Definition of Done (PRD level)

Sebuah fitur baru dapat dinyatakan **DONE** jika:

1. Seluruh FR P0 yang relevan telah dipenuhi atau pengecualiannya disetujui secara eksplisit.
2. Interaksi dapat digunakan tanpa tombol/tautan palsu.
3. Desain mengikuti Figma final pada view dan breakpoint yang diuji.
4. Data nyata terverifikasi atau fixture DEMO diberi label yang tidak ambigu.
5. Aturan sumber, tahun, unit, geografi, missing data, dan perbandingan ditangani.
6. Perhitungan analitik—bila ada—dihasilkan dari domain logic yang diuji.
7. Error, loading, empty, accessibility, mobile, dan reduced motion dipertimbangkan.
8. TypeScript check, lint, tes yang relevan, dan build dinyatakan lulus berdasarkan eksekusi nyata.
9. Tidak ada kompleksitas yang tidak perlu, duplikasi serius, resource leak, atau fitur belum bekerja yang diklaim selesai.
10. Claude melaporkan status/risiko dan menautkan FR IDs yang dipenuhi.

**Prinsip akhir:** Nusa Matra harus **mudah dipahami oleh masyarakat**, **cantik dan interaktif**, **jujur terhadap kualitas data**, dan **rapi secara engineering**. Semua dimensi ini dinilai sebagai satu kualitas produk.
