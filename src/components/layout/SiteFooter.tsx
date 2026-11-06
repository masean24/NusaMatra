import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import styles from './SiteFooter.module.css';
import { localized, t } from '@/lib/i18n';

const FOOTER_GROUPS = localized(
  () =>
    [
      {
        title: t('Produk'),
        links: [
          { label: t('Jelajahi peta'), to: '/jelajahi' },
          { label: t('Bandingkan wilayah'), to: '/bandingkan' },
          { label: t('Lab Prioritas'), to: '/lab-prioritas' },
          { label: t('Paspor Bukti'), to: '/paspor-bukti' },
        ],
      },
      {
        title: t('Transparansi'),
        links: [
          { label: t('Sumber data'), to: '/#sumber' },
          { label: t('Cara skor dihitung'), to: '/metodologi' },
          { label: t('Batasan data'), to: '/titik-buta-data' },
          { label: t('Aksesibilitas'), to: '/aksesibilitas' },
        ],
      },
    ] as const,
);

/** The team that built Nusa Matra for Web In Action 2026. */
const TEAM = localized(
  () =>
    ({
      name: t('Sedang Mengetik...'),
      members: [t('Mgs. M. Fahim Rahmatullah'), t('Khalil Amin Adillah'), t('Raihan Daris Ramadhan')],
    }) as const,
);

/** Figma 41:433: dark band (cobalt-deep in Kaca), brand statement, two link groups and the team. */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo size="footer" surface="dark" />
          <p className={`kk-small ${styles.statement}`}>
            {t(
              'Memahami Wilayah, Menentukan Arah. Platform eksplorasi dan analisis wilayah Indonesia berbasis data. Bukan aplikasi resmi pemerintah. Web In Action, Multimedia In Action 2026.',
            )}
          </p>
        </div>
        {FOOTER_GROUPS().map((group) => (
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
        <section className={styles.group} aria-labelledby="footer-tim">
          <h2 id="footer-tim" className="kk-body-strong">
            {t('Tim {0}', TEAM().name)}
          </h2>
          <ul role="list" className={styles.links}>
            {TEAM().members.map((member) => (
              <li key={member} className={`kk-small ${styles.member}`}>
                {member}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </footer>
  );
}
