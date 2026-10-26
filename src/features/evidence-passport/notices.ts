/**
 * Wording the passport must always carry. Kept in one place so the page, the printout, the citation
 * and the exported file all say the same thing about what this record is, and is not.
 */

/** The short statement of what a Paspor Bukti is. It heads the page, the print header and the file. */
export const BROWSER_ASSEMBLED_LABEL = 'Dirangkai di peramban, bukan arsip/sertifikat resmi.';

export const BROWSER_ASSEMBLED_NOTICE =
  'Paspor Bukti ini dirangkai di peramban Anda dari respons Data Hub yang diterima saat halaman dibuka. Ini bukan arsip resmi dari server dan bukan sertifikat: tidak ada nomor laporan dan tanda waktu dari server, dan laporan ini sendiri tidak disimpan di mana pun. Sidik isi data (SHA-256), bila ada, adalah pernyataan Data Hub dan tidak dihitung ulang di peramban.';

/**
 * Without a pin, a snapshot id names a publication, not its content: production re-published the
 * legacy id `2026.10.0-official-live` with different data (25/33 to 29/33 indicators, 2026-10-23).
 */
export const SNAPSHOT_MUTABILITY_NOTE =
  'ID snapshot dapat dipublikasikan ulang dengan isi berbeda; ID ini bukan bukti bahwa data sama.';

/** What an unpinned record cannot promise. Follows the reason it is unpinned. */
export const NOT_PINNED_CONSEQUENCE =
  'Data diambil dari snapshot yang aktif saat halaman dibuka, tanpa penguncian; membuka tautan yang sama lagi dapat memberi data berbeda.';

/** Exported with an unpinned record. */
export const NOT_PINNED_STATEMENT =
  'Data pada berkas ini tidak dikunci ke snapshot yang dapat direproduksi, jadi berkas ini tidak menjamin hasil yang sama di kemudian hari; ia hanya merekam apa yang diterima peramban pada saat itu (lihat "fetched" untuk permintaan dan waktu terima).';

/**
 * A reproducible DATA snapshot is not an archived REPORT, and immutable is not retained: the legacy
 * snapshot's row was announced as kept, but production answered 404 for it after the v2.2 deploy
 * (observed 2026-10-24). So a pinned link can stop working; it never switches to newer data.
 */
export const REPRODUCIBLE_SNAPSHOT_STATEMENT =
  'Data dapat direproduksi: setiap respons dikunci ke snapshot ini dan membawa sidik isi SHA-256 yang sama, dan Data Hub menyatakan snapshot ini immutable. Tautan Paspor ini (Salin tautan, Bagikan, berkas JSON) menyebut snapshot tersebut, jadi membukanya lagi meminta snapshot yang sama. Ini menyangkut data, bukan laporan: Paspor ini tidak diarsipkan, dan Data Hub tidak menjamin snapshot lama tetap tersedia setelah pembaruan server (snapshot lama sudah pernah hilang, teramati 2026-10-24). Bila snapshot tidak lagi tersedia, tautan akan gagal dan tidak beralih ke data terbaru.';

/**
 * The one sentence about snapshot identity a record carries (limitations, citation, export notes):
 * the digest-backed claim when reproducible, otherwise the reason it is not and the mutability caveat.
 */
export function snapshotIdentityNote(reproducibility: {
  readonly status: 'REPRODUCIBLE_SNAPSHOT' | 'NOT_REPRODUCIBLE';
  readonly contentSha256: string | null;
  readonly statement: string;
}): string {
  return reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
    ? `Sidik isi data (SHA-256, menurut Data Hub): ${reproducibility.contentSha256 ?? ''}. ${reproducibility.statement}`
    : `${SNAPSHOT_MUTABILITY_NOTE} ${reproducibility.statement}`;
}

/** Exported with a pinned, reproducible record. */
export const PINNED_STATEMENT =
  'Semua permintaan pada berkas ini dikunci ke satu snapshot (parameter "snapshot" pada "fetched") dengan sidik isi SHA-256 yang sama menurut Data Hub. Sidik itu tidak dihitung ulang di peramban, dan ketersediaan snapshot di kemudian hari tidak dijamin.';

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
