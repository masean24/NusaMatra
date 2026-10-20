import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import styles from './SiteFooter.module.css';

const FOOTER_GROUPS = [
  {
    title: 'Produk',
    links: [
      { label: 'Jelajahi peta', to: '/jelajahi' },
      { label: 'Bandingkan wilayah', to: '/bandingkan' },
      { label: 'Lab Prioritas', to: '/lab-prioritas' },
      { label: 'Paspor Bukti', to: '/paspor-bukti' },
    ],
  },
  {
    title: 'Transparansi',
    links: [
      { label: 'Sumber data', to: '/#sumber' },
      { label: 'Metodologi', to: '/metodologi' },
      { label: 'Batasan data', to: '/titik-buta-data' },
      { label: 'Aksesibilitas', to: '/aksesibilitas' },
    ],
  },
] as const;

/** Figma 41:433: dark band (cobalt-deep in Kaca), brand statement and two link groups. */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo size="footer" surface="dark" />
          <p className={`kk-small ${styles.statement}`}>
            Memahami Wilayah, Menentukan Arah. Platform eksplorasi dan analisis wilayah Indonesia berbasis
            data. Bukan aplikasi resmi pemerintah. Web In Action, Multimedia In Action 2026.
          </p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} className={styles.group} aria-labelledby={`footer-${group.title}`}>
            <h2 id={`footer-${group.title}`} className="kk-body-strong">
              {group.title}
            </h2>
            <ul role="list" className={styles.links}>
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={`kk-small ${styles.link}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
