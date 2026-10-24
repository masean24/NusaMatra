import { categoryLabel } from '@/features/data-hub';
import { bpsLabel } from './weightLabel';
import type { CompositeEvidenceRecord, CompositeIssueView } from './compositeTypes';
import { ScrollRegion } from './ScrollRegion';
import { scopeLabel } from './scopeLabel';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

const count = (value: number | null): string => (value === null ? 'belum dilaporkan' : String(value));

export function FocusSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { focus } = record;
  if (!focus) return null;
  return (
    <Section id="paspor-fokus" title="Wilayah yang Anda buka" mode={record.source.dataMode}>
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
    <Section id="paspor-cakupan" title="Cakupan hasil dan bobot" mode={record.source.dataMode}>
      <dl className={styles.facts}>
        <div>
          <dt>Cakupan wilayah</dt>
          <dd>{scopeLabel(scope.provinceId, scope.provinceName)}</dd>
        </div>
        <div>
          <dt>Wilayah diperingkat pada daftar ini (menurut Data Hub)</dt>
          <dd>{scope.totalRegions}</dd>
        </div>
        <div>
          <dt>Wilayah memenuhi syarat secara nasional</dt>
          <dd>{count(scope.totalEligibleNational)}</dd>
        </div>
        <div>
          <dt>Wilayah dikecualikan karena data tidak cukup</dt>
          <dd>{count(scope.totalExcluded)}</dd>
        </div>
        <div>
          <dt>Batas minimum Data Hub</dt>
          <dd>
            cakupan {scope.minCoveragePct === null ? 'belum dilaporkan' : `${String(scope.minCoveragePct)}%`},
            minimal {count(scope.minComponents)} kriteria bernilai
          </dd>
        </div>
        <div>
          <dt>Arah skor (dari Data Hub)</dt>
          <dd className={styles.code}>{scope.scoreDirection ?? 'belum dilaporkan'}</dd>
        </div>
        <div>
          <dt>Kelengkapan data wilayah yang diperingkat</dt>
          <dd>
            {record.ranking === 'SHOWN'
              ? `${String(integrity.coverageTiers.complete)} wilayah lengkap (100%); ${String(integrity.coverageTiers.partial)} wilayah parsial dengan bobot dialihkan; ${String(record.insufficient.length)} wilayah tidak diperingkat`
              : 'tidak dinyatakan karena peringkat ditahan'}
          </dd>
        </div>
        <div>
          <dt>Bobot yang diminta tersedia secara nasional</dt>
          <dd>
            {integrity.requestedWeightAvailabilityPct === null
              ? 'belum dapat dihitung'
              : `${integrity.requestedWeightAvailabilityPct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}
            {record.preset && ` (skenario "${record.preset.label}")`}
          </dd>
        </div>
      </dl>
      <ScrollRegion label="Bobot diminta dan bobot efektif">
        <table className={styles.table}>
          <caption className="kk-body-strong">Bobot yang diminta dan bobot efektif global</caption>
          <thead>
            <tr>
              <th scope="col">Kriteria</th>
              <th scope="col">Diminta</th>
              <th scope="col">Efektif global (dari Data Hub)</th>
              <th scope="col">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {record.indicators.map((indicator) => (
              <tr key={indicator.indicatorId}>
                <th scope="row">{indicator.label}</th>
                <td className={styles.numeric}>{bpsLabel(indicator.requestedBps)}</td>
                <td className={styles.numeric}>
                  {indicator.effectiveBps === null ? 'tidak dipakai' : bpsLabel(indicator.effectiveBps)}
                </td>
                <td className="kk-small">
                  {unavailable.has(indicator.indicatorId)
                    ? 'Tidak ada data nasional; bobotnya dialihkan ke kriteria lain.'
                    : record.effectiveWeights === null
                      ? 'Bobot efektif tidak dilaporkan Data Hub.'
                      : 'Dipakai. Wilayah dengan data kosong memakai bobot wilayahnya sendiri.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      {record.renormalized !== null && (
        <p className={`kk-small ${styles.muted}`}>
          Bobot global {record.renormalized ? 'dialihkan' : 'tidak perlu dialihkan'} (menurut Data Hub).
        </p>
      )}
    </Section>
  );
}

function IssueItem({ issue }: { readonly issue: CompositeIssueView }) {
  return (
    <li>
      <span className={`${styles.tag} ${issue.severity === 'block' ? styles.tagWarn : ''}`}>
        {issue.severity === 'block' ? 'Memblokir peringkat' : 'Catatan'}
      </span>{' '}
      {issue.message}
      {issue.examples.length > 0 && <> Contoh kode wilayah: {issue.examples.join(', ')}.</>}
      <br />
      <span className="kk-small">
        Sumber aturan: {issue.originLabel} · kode teknis <span className={styles.code}>{issue.code}</span>
        {issue.count > 0 && ` · jumlah terdampak ${String(issue.count)}`}
      </span>
    </li>
  );
}

export function IntegritySection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { integrity } = record;
  const blockers = integrity.issues.filter((issue) => issue.severity === 'block');
  return (
    <Section id="paspor-pemeriksaan" title="Pemeriksaan hasil" mode={record.source.dataMode}>
      {record.ranking === 'WITHHELD' ? (
        <div role="alert" className={styles.linkWarning} data-severity="warning">
          <p className="kk-body-strong">Peringkat ditahan, tidak ada tabel peringkat yang ditampilkan.</p>
          <p className="kk-small">
            {record.withheldReason === 'MIXED_SOURCES'
              ? 'Respons Data Hub berasal dari mode atau snapshot yang berbeda.'
              : record.withheldReason === 'DIRECTION_ANOMALY'
                ? 'Skor sumber Data Hub untuk kriteria yang dipakai tidak sesuai dengan nilai mentahnya. Hasil ini tidak boleh dibaca sebagai peringkat yang sah (lihat "Keterbatasan").'
                : `Pemeriksaan konsistensi di peramban menemukan ${String(blockers.length)} masalah yang memblokir. Hasil ini tidak boleh dibaca sebagai peringkat yang sah.`}
          </p>
        </div>
      ) : (
        <p className="kk-body">
          Pemeriksaan konsistensi di peramban tidak menemukan masalah yang memblokir. Peringkat di bawah
          adalah hasil Data Hub apa adanya.
        </p>
      )}
      {integrity.issues.length > 0 ? (
        <ul role="list" className={`kk-small ${styles.list}`}>
          {integrity.issues.map((issue) => (
            <IssueItem key={issue.code} issue={issue} />
          ))}
        </ul>
      ) : (
        <p className="kk-small">Tidak ada catatan pemeriksaan.</p>
      )}
    </Section>
  );
}

export function CriteriaSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <Section id="paspor-kriteria" title="Kriteria dan sumber" mode={record.source.dataMode}>
      <ScrollRegion label="Kriteria, tahun, dan sumber">
        <table className={styles.table}>
          <caption className="kk-body-strong">Kriteria yang dipakai ({record.indicators.length})</caption>
          <thead>
            <tr>
              <th scope="col">Kriteria</th>
              <th scope="col">Tahun data</th>
              <th scope="col">Arah indikator</th>
              <th scope="col">Sumber</th>
            </tr>
          </thead>
          <tbody>
            {record.indicators.map((indicator) => (
              <tr key={indicator.indicatorId}>
                <th scope="row">
                  <div className={styles.cell}>
                    <span>{indicator.label}</span>
                    <span className={`kk-small ${styles.muted}`}>
                      {indicator.category ? categoryLabel(indicator.category) : 'kategori belum tersedia'}
                      {indicator.unitLabel && ` · satuan ${indicator.unitLabel}`}
                    </span>
                  </div>
                </th>
                <td>{indicator.referenceYear ?? 'belum tersedia'}</td>
                <td className="kk-small">
                  {indicator.polarity === null ? 'belum tersedia' : indicator.polarity}
                </td>
                <td>
                  {indicator.source.officialUrl ? (
                    <a
                      className={styles.link}
                      href={indicator.source.officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {indicator.source.agencyCode ?? 'Lembaga belum tersedia'} ·{' '}
                      {indicator.source.datasetTitle ??
                        indicator.source.datasetId ??
                        'judul dataset belum tersedia'}
                      <span className={styles.srOnly}> (membuka tab baru)</span>
                    </a>
                  ) : (
                    <span>
                      {indicator.source.agencyCode ?? 'Lembaga belum tersedia'} ·{' '}
                      {indicator.source.datasetTitle ??
                        indicator.source.datasetId ??
                        'judul dataset belum tersedia'}
                      <br />
                      <span className={`kk-small ${styles.muted}`}>Tautan sumber belum tersedia.</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </Section>
  );
}
