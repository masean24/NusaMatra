import { EVIDENCE_CLASS_ORDER, evidenceClassLabel } from './evidenceClass';
import type { EvidenceRecord, EvidenceRegion, RegionCoverage } from './evidenceTypes';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

function classComposition(coverage: RegionCoverage): string {
  const parts = EVIDENCE_CLASS_ORDER.flatMap((evidenceClass) => {
    const count = coverage.byClass[evidenceClass] ?? 0;
    return count > 0 ? [`${evidenceClassLabel(evidenceClass, null)} ${String(count)}`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : 'tidak ada nilai untuk digolongkan';
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
      <h4 className="kk-body-strong">{region.name}</h4>
      <p className={`kk-small ${styles.muted}`}>
        {region.levelLabel} · {region.provinceName ?? 'provinsi belum tersedia'}
        {region.codes.length > 0 &&
          ` · kode ${region.codes.map(({ system, code }) => `${system} ${code}`).join(', ')}`}
      </p>
      {region.isSyntheticDemoName && (
        <p>
          <span className={`${styles.tag} ${styles.tagWarn}`}>Nama sintetis (DEMO), bukan nama resmi</span>
        </p>
      )}

      {coverage && (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>Kelengkapan indikator</dt>
              <dd>
                {coverage.indicatorsWithValue} indikator bernilai
                {coverage.catalogIndicatorCount === null
                  ? ' (jumlah indikator di katalog belum tersedia)'
                  : ` dari ${String(coverage.catalogIndicatorCount)} indikator di katalog snapshot ini`}
                ; {coverage.indicatorsWithoutValue} tanpa nilai.
              </dd>
            </div>
            <div>
              <dt>Granularitas geografis (terpisah dari kelengkapan)</dt>
              <dd>
                Tingkat {level}.{' '}
                {coverage.imputedCount > 0
                  ? `${String(coverage.imputedCount)} nilai diimputasi dari provinsi, bukan pengukuran tingkat ${level}.`
                  : 'Tidak ada nilai yang ditandai IMPUTED_PROVINCE.'}
              </dd>
            </div>
            <div>
              <dt>Kelas bukti nilai</dt>
              <dd>{classComposition(coverage)}</dd>
            </div>
          </dl>
          {coverage.missing.length > 0 && (
            <div>
              <h5 className="kk-small kk-body-strong">Indikator tanpa nilai ({coverage.missing.length})</h5>
              <ul role="list" className={`kk-small ${styles.list} ${styles.missingList}`}>
                {coverage.missing.map((item) => (
                  <li key={item.indicatorId}>
                    <strong>{item.label}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function RegionsSection({ record }: { readonly record: EvidenceRecord }) {
  return (
    <Section id="paspor-wilayah" title="Wilayah, kelengkapan, dan granularitas" mode={record.source.dataMode}>
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
