import { useEffect, useId, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { GlassSelect } from '@/components/ui/GlassSelect/GlassSelect';
import { CompositeSection } from './CompositeSection';
import { formatNumber } from './formatNumber';
import { MethodIcon } from './MethodIcon';
import { ClosingSection, MissingDataSection } from './MethodNotes';
import { ReferencesSection } from './MethodReferences';
import { MethodToc } from './MethodToc';
import { ResultSection } from './ResultSection';
import { useScoreMethod, type Loadable, type ScoreMethodData } from './useScoreMethod';
import { ScaleStep, ValueStep } from './ValueAndScaleSteps';
import styles from './Methodology.module.css';
import { t } from '@/lib/i18n';

/** The id a link uses to open the page at the worked example (see scoreMethodHref in Jelajahi). */
export const EXAMPLE_ID = 'contoh';

/**
 * "Cara skor dihitung": how a raw official figure becomes a 0–100 need score, how scores combine
 * into a Lab Prioritas ranking, and what happens when data is missing, each step shown with the
 * Data Hub's own numbers. The page explains; every score on it comes from the Data Hub.
 */
export function ScoreMethod() {
  const { hash } = useLocation();
  const method = useScoreMethod();
  const exampleReady = method.example.status === 'ready';

  // A link from Jelajahi opens the page at the worked example. The page arrives after the route
  // change (lazy route), so the layout's own hash jump found nothing; this one runs once it exists.
  useEffect(() => {
    if (hash !== `#${EXAMPLE_ID}` || !exampleReady) return;
    document.getElementById(EXAMPLE_ID)?.scrollIntoView({ block: 'start' });
  }, [hash, exampleReady]);

  return (
    <div className={styles.page}>
      <MethodSummary method={method} />
      <ControlBar method={method} />
      <div className={styles.layout}>
        <MethodToc />
        <div className={styles.content}>
          <ValueStep method={method} />
          <ScaleStep method={method} exampleId={EXAMPLE_ID} />
          <ResultSection method={method} />
          <CompositeSection method={method} />
          <MissingDataSection />
          <ReferencesSection />
          <ClosingSection passportTo={method.passportTo} />
        </div>
      </div>
    </div>
  );
}

/** A live number in a summary card: an ellipsis while loading, a dash when there is none. */
function liveFigure<T>(part: Loadable<T>, read: (value: T) => string | null): string {
  if (part.status === 'loading') return '…';
  if (part.status === 'error') return '—';
  return read(part.value) ?? '—';
}

function MethodSummary({ method }: { readonly method: ScoreMethodData }) {
  const { example, composite } = method;
  const ready = example.status === 'ready' && example.value.status === 'ready' ? example.value : null;
  return (
    <section id="ringkasan" aria-labelledby="metode-ringkas" className={styles.section}>
      <h2 id="metode-ringkas" className="kk-h2">
        {t('Tiga langkah dari angka resmi ke peringkat')}
      </h2>
      <ol role="list" className={styles.summary}>
        <SummaryCard
          step={1}
          title={t('Ambil nilai asli')}
          figure={liveFigure(example, (value) => (value.status === 'ready' ? value.valueText : null))}
          unit={ready?.unitText.trim() ?? ''}
          caption={
            example.status === 'ready'
              ? `${example.value.indicatorLabel} (${`${example.value.agency} ${String(example.value.referenceYear ?? '')}`.trim()})`
              : t('Nilai resmi dari sumber')
          }
        >
          {t(
            'Angka resmi tiap kabupaten/kota dari BPS, BNPB, Kemenkes, Kemendikdasmen, BIG, dan BMKG, lengkap dengan satuan dan tahunnya.',
          )}
        </SummaryCard>
        <SummaryCard
          step={2}
          title={t('Ubah ke skala kebutuhan 0–100')}
          figure={liveFigure(example, (value) =>
            value.status === 'ready' && value.reported !== null ? formatNumber(value.reported) : null,
          )}
          unit={t('dari 100')}
          caption={t('Skor kebutuhan untuk indikator ini')}
        >
          {t(
            'Setiap indikator diletakkan di antara nilai terendah dan tertinggi nasional. Skor 100 berarti kebutuhan paling tinggi.',
          )}
        </SummaryCard>
        <SummaryCard
          step={3}
          title={t('Gabungkan dengan bobot')}
          figure={liveFigure(composite, (value) => (value.total === null ? null : formatNumber(value.total)))}
          unit={t('skor gabungan')}
          caption={t('Contoh 4 indikator berbobot')}
        >
          {t(
            'Di Lab Prioritas, skor kebutuhan beberapa indikator dijumlahkan menurut bobot pilihan Anda, lalu wilayah diurutkan.',
          )}
        </SummaryCard>
      </ol>
    </section>
  );
}

function SummaryCard({
  step,
  title,
  figure,
  unit,
  caption,
  children,
}: {
  readonly step: number;
  readonly title: string;
  readonly figure: string;
  readonly unit: string;
  readonly caption: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={`glass glass--read ${styles.summaryCard}`}>
      <span className={styles.stepBadge}>{step}</span>
      <h3 className="kk-body-strong">{title}</h3>
      <p className={styles.summaryFigure}>
        <span>{figure}</span>
        {unit && <span className={styles.summaryUnit}> {unit}</span>}
      </p>
      <p className={`kk-small ${styles.muted}`}>{caption}</p>
      <hr className={styles.rule} />
      <p className="kk-small">{children}</p>
      {step < 3 && (
        <span className={styles.summaryArrow} aria-hidden="true">
          <MethodIcon name="arrow" />
        </span>
      )}
    </li>
  );
}

/** The example's controls: the data mode, the indicator picker and where the region comes from. */
function ControlBar({ method }: { readonly method: ScoreMethodData }) {
  const pickerId = useId();
  const { indicators } = method;
  return (
    <div className={styles.controlBar}>
      <span className={styles.modeChip} data-mode={method.dataMode}>
        <span className={styles.modeDot} aria-hidden="true" />
        {t('Data {0}', method.dataMode)}
      </span>
      <div className={styles.controlPicker}>
        <span id={pickerId} className="kk-small kk-body-strong">
          {t('Indikator contoh')}
        </span>
        {indicators.status === 'ready' ? (
          <GlassSelect
            labelledBy={pickerId}
            value={indicators.value.chosen}
            options={indicators.value.options}
            onChange={method.chooseIndicator}
          />
        ) : (
          <span className={`kk-small ${styles.muted}`}>
            {indicators.status === 'loading'
              ? t('Memuat daftar indikator…')
              : t('Daftar indikator tidak tersedia.')}
          </span>
        )}
      </div>
      <p className={`kk-small ${styles.controlRegion}`}>
        {t('Wilayah contoh:')} <strong>{method.regionName}</strong>
        {t('. Pilih wilayah lain di Jelajahi, lalu tekan “Bagaimana skor tersebut dihitung”.')}
      </p>
    </div>
  );
}
