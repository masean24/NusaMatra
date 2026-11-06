import { categoryLabel } from '@/features/data-hub';
import { bpsLabel } from './weightLabel';
import type { CompositeEvidenceRecord, CompositeIssueView } from './compositeTypes';
import { Disclosure } from './Disclosure';
import { SourceLine } from './IndicatorTables';
import { withheldReasonText } from './withheldReason';
import { ScrollRegion } from './ScrollRegion';
import { scopeLabel } from './scopeLabel';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';
import { locale, t } from '@/lib/i18n';

const count = (value: number | null): string => (value === null ? t('belum dilaporkan') : String(value));

export function FocusSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { focus } = record;
  if (!focus) return null;
  return (
    <Section id="paspor-fokus" title={t('Wilayah yang Anda buka')} mode={record.source.dataMode}>
      <p className="kk-body" data-focus-status={focus.status}>
        {focus.message}
      </p>
    </Section>
  );
}

export function ScopeSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { scope, integrity } = record;
  const unavailable = new Set(record.unavailableIndicatorIds);
  return (
    <Section id="paspor-cakupan" title={t('Cakupan hasil dan bobot')} mode={record.source.dataMode}>
      <dl className={styles.facts}>
        <div>
          <dt>{t('Cakupan wilayah')}</dt>
          <dd>{scopeLabel(scope.provinceId, scope.provinceName)}</dd>
        </div>
        <div>
          <dt>{t('Wilayah diperingkat pada daftar ini (menurut Data Hub)')}</dt>
          <dd>{scope.totalRegions}</dd>
        </div>
        <div>
          <dt>{t('Wilayah memenuhi syarat secara nasional')}</dt>
          <dd>{count(scope.totalEligibleNational)}</dd>
        </div>
        <div>
          <dt>{t('Wilayah dikecualikan karena data tidak cukup')}</dt>
          <dd>{count(scope.totalExcluded)}</dd>
        </div>
        <div>
          <dt>{t('Batas minimum Data Hub')}</dt>
          <dd>
            {t(
              'cakupan {0}, minimal {1} kriteria bernilai',
              scope.minCoveragePct === null ? t('belum dilaporkan') : `${String(scope.minCoveragePct)}%`,
              count(scope.minComponents),
            )}
          </dd>
        </div>
        <div>
          <dt>{t('Arah skor (dari Data Hub)')}</dt>
          <dd className={styles.code}>{scope.scoreDirection ?? t('belum dilaporkan')}</dd>
        </div>
        <div>
          <dt>{t('Kelengkapan data wilayah yang diperingkat')}</dt>
          <dd>
            {record.ranking === 'SHOWN'
              ? t(
                  '{0} wilayah lengkap (100%); {1} wilayah parsial dengan bobot dialihkan; {2} wilayah tidak diperingkat',
                  String(integrity.coverageTiers.complete),
                  String(integrity.coverageTiers.partial),
                  String(record.insufficient.length),
                )
              : t('tidak dinyatakan karena peringkat ditahan')}
          </dd>
        </div>
        <div>
          <dt>{t('Bobot yang diminta tersedia secara nasional')}</dt>
          <dd>
            {integrity.requestedWeightAvailabilityPct === null
              ? t('belum dapat dihitung')
              : `${integrity.requestedWeightAvailabilityPct.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`}
            {record.preset && t(' (skenario "{0}")', record.preset.label)}
          </dd>
        </div>
      </dl>
      <ScrollRegion label={t('Bobot diminta dan bobot efektif')}>
        <table className={styles.table}>
          <caption className="kk-body-strong">{t('Bobot yang diminta dan bobot efektif global')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Kriteria')}</th>
              <th scope="col">{t('Diminta')}</th>
              <th scope="col">{t('Efektif global (dari Data Hub)')}</th>
              <th scope="col">{t('Keterangan')}</th>
            </tr>
          </thead>
          <tbody>
            {record.indicators.map((indicator) => (
              <tr key={indicator.indicatorId}>
                <th scope="row">{indicator.label}</th>
                <td className={styles.numeric}>{bpsLabel(indicator.requestedBps)}</td>
                <td className={styles.numeric}>
                  {indicator.effectiveBps === null ? t('tidak dipakai') : bpsLabel(indicator.effectiveBps)}
                </td>
                <td className="kk-small">
                  {unavailable.has(indicator.indicatorId)
                    ? t('Tidak ada data nasional; bobotnya dialihkan ke kriteria lain.')
                    : record.effectiveWeights === null
                      ? t('Bobot efektif tidak dilaporkan Data Hub.')
                      : t('Dipakai. Wilayah dengan data kosong memakai bobot wilayahnya sendiri.')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      {record.renormalized !== null && (
        <p className={`kk-small ${styles.muted}`}>
          {t(
            'Bobot global {0} (menurut Data Hub).',
            record.renormalized ? t('dialihkan') : t('tidak perlu dialihkan'),
          )}
        </p>
      )}
    </Section>
  );
}

function IssueItem({ issue }: { readonly issue: CompositeIssueView }) {
  return (
    <li>
      <span className={`${styles.tag} ${issue.severity === 'block' ? styles.tagWarn : ''}`}>
        {issue.severity === 'block' ? t('Memblokir peringkat') : t('Catatan')}
      </span>{' '}
      {issue.message}
      {issue.examples.length > 0 && <> {t('Contoh kode wilayah: {0}.', issue.examples.join(', '))}</>}
      <br />
      <span className="kk-small">
        {t('Sumber aturan: {0}, kode teknis', issue.originLabel)}{' '}
        <span className={styles.code}>{issue.code}</span>
        {issue.count > 0 && t(', jumlah terdampak {0}', String(issue.count))}
      </span>
    </li>
  );
}

/** Blocking issues stay open; notes that only disclose something open on demand. */
export function IntegritySection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { integrity } = record;
  const blockers = integrity.issues.filter((issue) => issue.severity === 'block');
  const notes = integrity.issues.filter((issue) => issue.severity !== 'block');
  return (
    <Section id="paspor-pemeriksaan" title={t('Pemeriksaan hasil')} mode={record.source.dataMode}>
      {record.ranking === 'WITHHELD' ? (
        <div role="alert" className={styles.linkWarning} data-severity="warning">
          <p className="kk-body-strong">
            {t('Peringkat ditahan, tidak ada tabel peringkat yang ditampilkan.')}
          </p>
          <p className="kk-small">{withheldReasonText(record)}</p>
        </div>
      ) : (
        <p className="kk-body">
          {t(
            'Pemeriksaan konsistensi di peramban tidak menemukan masalah yang memblokir. Peringkat di bawah adalah hasil Data Hub apa adanya.',
          )}
        </p>
      )}
      {blockers.length > 0 && (
        <ul role="list" className={`kk-small ${styles.list}`}>
          {blockers.map((issue) => (
            <IssueItem key={issue.code} issue={issue} />
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <Disclosure
          title={t('Catatan pemeriksaan ({0})', String(notes.length))}
          helper={t('Hal yang perlu diketahui, tidak memblokir peringkat')}
        >
          <ul role="list" className={`kk-small ${styles.list}`}>
            {notes.map((issue) => (
              <IssueItem key={issue.code} issue={issue} />
            ))}
          </ul>
        </Disclosure>
      )}
      {integrity.issues.length === 0 && <p className="kk-small">{t('Tidak ada catatan pemeriksaan.')}</p>}
    </Section>
  );
}

export function CriteriaSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <Section id="paspor-kriteria" title={t('Kriteria dan sumber')} mode={record.source.dataMode}>
      <ScrollRegion label={t('Kriteria, tahun, dan sumber')}>
        <table className={styles.table}>
          <caption className="kk-body-strong">
            {t('Kriteria yang dipakai ({0})', record.indicators.length)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Kriteria')}</th>
              <th scope="col">{t('Tahun data')}</th>
              <th scope="col">{t('Arah indikator')}</th>
              <th scope="col">{t('Sumber')}</th>
            </tr>
          </thead>
          <tbody>
            {record.indicators.map((indicator) => (
              <tr key={indicator.indicatorId}>
                <th scope="row">
                  <div className={styles.cell}>
                    <span>{indicator.label}</span>
                    <span className={`kk-small ${styles.muted}`}>
                      {indicator.category ? categoryLabel(indicator.category) : t('kategori belum tersedia')}
                      {indicator.unitLabel && t(', satuan {0}', indicator.unitLabel)}
                    </span>
                  </div>
                </th>
                <td>{indicator.referenceYear ?? t('belum tersedia')}</td>
                <td className="kk-small">
                  {indicator.polarity === null ? t('belum tersedia') : indicator.polarity}
                </td>
                <td>
                  <SourceLine source={indicator.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </Section>
  );
}
