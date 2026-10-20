import { ButtonLink } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import styles from './StaticPage.module.css';

/** States what this build actually supports; no conformance claim beyond what was implemented. */
const SUPPORTED = [
  'Semua tautan dan tombol dapat digunakan dengan papan ketik, dengan penanda fokus yang terlihat.',
  'Tautan “Lewati ke konten utama” di awal halaman.',
  'Mode Normal dan Kaca. Mode Kaca otomatis dimatikan bila perangkat meminta kontras tinggi atau transparansi rendah.',
  'Animasi dan efek 3D berhenti bila perangkat meminta gerak dikurangi; isinya tetap utuh.',
  'Ilustrasi 3D mempunyai gambar diam pengganti di ponsel dan pada perangkat tanpa WebGL.',
  'Warna tidak pernah menjadi satu-satunya penanda status; setiap status juga punya ikon dan teks.',
];

export function AccessibilityPage() {
  return (
    <div className={styles.page}>
      <title>Aksesibilitas — Nusa Matra</title>
      <h1 className="kk-h1">Aksesibilitas</h1>
      <p className={`kk-lead ${styles.muted}`}>
        Nusa Matra dirancang agar dapat digunakan oleh sebanyak mungkin orang. Berikut yang sudah didukung
        pada versi prototipe ini.
      </p>
      <Surface radius="card" className={styles.panel}>
        <ul className={styles.list}>
          {SUPPORTED.map((item) => (
            <li key={item} className="kk-body">
              {item}
            </li>
          ))}
        </ul>
      </Surface>
      <p className={`kk-small ${styles.muted}`}>
        Audit aksesibilitas menyeluruh belum dilakukan. Temuan dan perbaikan akan dicatat di halaman ini.
      </p>
      <ButtonLink to="/">Kembali ke beranda</ButtonLink>
    </div>
  );
}
