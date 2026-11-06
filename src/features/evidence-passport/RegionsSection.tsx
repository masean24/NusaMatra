import { EVIDENCE_CLASS_ORDER, evidenceClassLabel } from './evidenceClass';
import type { EvidenceRecord, EvidenceRegion, RegionCoverage } from './evidenceTypes';
import { Disclosure } from './Disclosure';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';
import { t } from '@/lib/i18n';

function classComposition(coverage: RegionCoverage): string {
  const parts = EVIDENCE_CLASS_ORDER.flatMap((evidenceClass) => {
    const count = coverage.byClass[evidenceClass] ?? 0;
    return count > 0 ? [`${evidenceClassLabel(evidenceClass, null)} ${String(count)}`] : [];
  });
  return parts.length > 0 ? parts.join(', ') : t('tidak ada nilai untuk digolongkan');
}

function RegionCard({
  region,
  coverage,
}: {
  readonly region: EvidenceRegion;
  readonly coverage: RegionCoverage | undefined;
}) {
  const level = region.levelLabel.toLowerCase();
  return (
    <article className={styles.regionCard} aria-label={region.name}>
      <h3 className="kk-body-strong">{region.name}</h3>
      <p className={`kk-small ${styles.muted}`}>
        {t('{0} di {1}', region.levelLabel, region.provinceName ?? t('provinsi belum tersedia'))}
        {region.codes.length > 0 &&
          t(', kode {0}', region.codes.map(({ system, code }) => `${system} ${code}`).join(', '))}
      </p>
      {region.isSyntheticDemoName && (
        <p>
          <span className={`${styles.tag} ${styles.tagWarn}`}>
            {t('Nama sintetis (DEMO), bukan nama resmi')}
          </span>
        </p>
      )}

      {coverage && (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>{t('Kelengkapan indikator')}</dt>
              <dd>
                {t(
                  '{0} indikator bernilai{1}; {2} tanpa nilai.',
                  coverage.indicatorsWithValue,
                  coverage.catalogIndicatorCount === null
                    ? t(' (jumlah indikator di katalog belum tersedia)')
                    : t(
                        ' dari {0} indikator di katalog versi data ini',
                        String(coverage.catalogIndicatorCount),
                      ),
                  coverage.indicatorsWithoutValue,
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Granularitas geografis (terpisah dari kelengkapan)')}</dt>
              <dd>
                {t(
                  'Tingkat {0}. {1}',
                  level,
                  coverage.imputedCount > 0
                    ? t(
                        '{0} nilai diperkirakan dari provinsi, bukan pengukuran tingkat {1}.',
                        String(coverage.imputedCount),
                        level,
                      )
                    : t('Tidak ada nilai yang diperkirakan dari provinsi.'),
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Kelas bukti nilai')}</dt>
              <dd>{classComposition(coverage)}</dd>
            </div>
          </dl>
          {coverage.missing.length > 0 && (
            <Disclosure
              title={t('Indikator tanpa nilai ({0})', String(coverage.missing.length))}
              helper={t('Nama indikator dan alasan nilainya kosong')}
              level={4}
            >
              <ul role="list" className={`${styles.list} ${styles.missingList}`}>
                {coverage.missing.map((item) => (
                  <li key={item.indicatorId}>
                    <strong>{item.label}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </>
      )}
    </article>
  );
}

export function RegionsSection({ record }: { readonly record: EvidenceRecord }) {
  return (
    <Section
      id="paspor-wilayah"
      title={t('Wilayah, kelengkapan, dan granularitas')}
      mode={record.source.dataMode}
    >
      <div className={styles.regionGrid}>
        {record.regions.map((region) => (
          <RegionCard
            key={region.regionId}
            region={region}
            coverage={record.coverage.find((entry) => entry.regionId === region.regionId)}
          />
        ))}
      </div>
    </Section>
  );
}
