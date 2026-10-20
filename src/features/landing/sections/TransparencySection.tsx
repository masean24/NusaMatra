import { ButtonLink } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Icon, type IconName } from '@/components/ui/Icon/Icon';
import { Surface } from '@/components/ui/Surface/Surface';
import { DEMO_DATA_STATUSES, DEMO_PASSPORT_PREVIEW, type DataStatusKind } from '@/data/fixtures/landingDemo';
import { Reveal } from '@/features/motion';
import { EvidencePassport3D } from '../components/EvidencePassport3D';
import styles from './TransparencySection.module.css';

/** Each status has its own icon and wording; colour is never the only signal. */
const STATUS_ICON: Record<DataStatusKind, IconName> = {
  complete: 'check',
  yearMismatch: 'warning',
  blocked: 'close',
};

/* G7: three status cards enter left to right, 100ms apart; icons "stamp" in from 0.8 to 1. */
const G7_STAGGER_MS = 100;

export function TransparencySection() {
  return (
    <section id="transparansi" className={styles.section} aria-labelledby="transparansi-title">
      <div className={styles.copy}>
        <Reveal distance={24} duration={600}>
          <h2 id="transparansi-title" className={`kk-h1 ${styles.title}`}>
            Kami juga menunjukkan yang belum kami ketahui
          </h2>
        </Reveal>
        <Reveal distance={24} duration={600} delay={80}>
          <p className={`kk-body ${styles.lead}`}>
            Data kosong, tahun yang berbeda, atau metode yang tidak sebanding tidak disembunyikan. Bila
            perbandingan bisa menyesatkan, Nusa Matra menahannya.
          </p>
        </Reveal>
        <ul role="list" className={styles.statuses}>
          {DEMO_DATA_STATUSES.map((status, index) => (
            <li key={status.kind}>
              <Reveal distance={0} fromX={-16} duration={600} delay={160 + index * G7_STAGGER_MS}>
                <Surface radius="control" className={styles.status}>
                  <span className={styles.statusIcon} data-kind={status.kind}>
                    <Icon name={STATUS_ICON[status.kind]} size={24} />
                  </span>
                  <span className={styles.statusText}>
                    <span className="kk-body-strong">{status.title}</span>
                    <span className={`kk-small ${styles.muted}`}>{status.description}</span>
                  </span>
                </Surface>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className={`kk-caption ${styles.muted}`}>
          Contoh temuan pada data simulasi, bukan diagnosis data nyata.
        </p>
      </div>

      <div className={styles.passport}>
        <EvidencePassport3D />
        <Reveal distance={24} duration={600} delay={200} threshold={0.3}>
          <Surface radius="card" className={styles.preview}>
            <p className={`kk-h3 ${styles.previewTitle}`}>Paspor Bukti · {DEMO_PASSPORT_PREVIEW.id}</p>
            <dl className={styles.rows}>
              {DEMO_PASSPORT_PREVIEW.rows.map((row) => (
                <div key={row.label} className={styles.rowItem}>
                  <dt className={`kk-caption ${styles.muted}`}>{row.label}</dt>
                  <dd className="kk-small">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.previewFooter}>
              <ButtonLink to="/paspor-bukti">Lihat contoh paspor</ButtonLink>
              <Chip>Contoh · data simulasi</Chip>
            </div>
          </Surface>
        </Reveal>
      </div>
    </section>
  );
}
