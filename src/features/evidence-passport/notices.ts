/**
 * Wording the passport must always carry. Kept in one place so the page, the printout, the citation
 * and the exported file all say the same thing about what this record is, and is not.
 */

/** The short statement of what a Paspor Bukti is. It heads the page, the print header and the file. */
export const BROWSER_ASSEMBLED_LABEL = 'Dirangkai di peramban, bukan arsip/sertifikat resmi.';

export const BROWSER_ASSEMBLED_NOTICE =
  'Paspor Bukti ini dirangkai di peramban Anda dari respons Data Hub yang diterima saat halaman dibuka. Ini bukan arsip resmi dari server dan bukan sertifikat. Catatan ini belum memiliki nomor laporan, tanda waktu dari server, ataupun checksum yang diverifikasi. Membuka tautan yang sama lagi akan mengambil data ulang dari snapshot yang aktif pada saat itu.';

/**
 * A snapshot id names a publication, not its content: production re-published the same id with
 * different data (indicator availability 25/33 to 29/33 without a new id). So an id never proves
 * that two records hold the same data.
 */
export const SNAPSHOT_MUTABILITY_NOTE =
  'ID snapshot dapat dipublikasikan ulang dengan isi berbeda; ID ini bukan bukti bahwa data sama.';

/** Data Hub requests cannot name a snapshot, so no export can honestly claim to pin its inputs. */
export const NOT_PINNED_STATEMENT =
  'Permintaan ke Data Hub belum dapat mengunci snapshot, dan satu ID snapshot dapat dipublikasikan ulang dengan isi berbeda. Karena itu berkas ini tidak mengunci masukan dan tidak menjamin hasil yang sama di kemudian hari; ia hanya merekam apa yang diterima peramban pada saat itu (lihat "fetched" untuk permintaan dan waktu terima).';

/**
 * The manifest checksum stayed identical while the data behind the same snapshot id changed
 * (observed 2026-10-23), so it identifies nothing about content and is never shown as integrity proof.
 */
export const MANIFEST_CHECKSUM_LABEL =
  'checksum dari server; tidak berubah saat isi data berubah (teramati 2026-10-23), jadi bukan sidik isi data';

/** The snapshot's own completeness figure is a server claim; it can disagree with `/indicators/coverage`. */
export const COMPLETENESS_CLAIM_NOTE =
  'Angka kelengkapan snapshot adalah klaim server dan dapat tidak sejalan dengan cakupan indikator dari /indicators/coverage; paspor tidak menghitung angka pengganti.';

export const NOT_AVAILABLE_TEXT = 'belum tersedia';
