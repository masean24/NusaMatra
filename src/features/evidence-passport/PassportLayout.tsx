import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { BackButton } from '@/features/navigation';
import type { LimitationNote } from './limitationNote';
import { PassportIcon } from './PassportIcons';
import { heroTitle, relatedLinks, type AnyEvidenceRecord } from './passportFormat';
import { PrintRunningHeader } from './PrintRunningHeader';
import { ModeTag, Section } from './Section';
import type { PassportActions } from './usePassportActions';
import styles from './EvidencePassport.module.css';
import { locale, t } from '@/lib/i18n';

const formatPercent = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

interface HeroProps {
  readonly record: AnyEvidenceRecord;
  readonly kindLabel: string;
  readonly actions: PassportActions;
}

function Hero({ record, kindLabel, actions }: HeroProps) {
  const { source } = record;
  const coverage = source.observedCoverage;

  return (
    <header id="paspor-atas" className={styles.hero}>
      <div className={styles.heroMain}>
        <div className={styles.heroChips}>
          <ModeTag mode={source.dataMode} />
          <span className={styles.heroChip}>{kindLabel}</span>
          {coverage && (
            <span className={styles.heroChip}>
              {t('{0} / {1} indikator berdata', coverage.availableIndicators, coverage.totalIndicators)}
            </span>
          )}
        </div>
        <p className={styles.heroKicker}>{t('Paspor Bukti')}</p>
        <h1 className={styles.heroTitle}>{heroTitle(record)}</h1>
        <div className={styles.heroQuestion}>
          <p className={styles.heroQuestionLabel}>{t('Pertanyaan yang dijawab paspor ini')}</p>
          <p>{record.question}</p>
        </div>
        <div className={`${styles.heroActions} ${styles.noPrint}`}>
          <Button variant="accent" onClick={actions.copyLink}>
            <PassportIcon name={actions.linkCopied ? 'check' : 'link'} />
            {actions.linkCopied ? t('Tautan tersalin') : t('Salin tautan')}
          </Button>
          <Button variant="glass" onClick={actions.download}>
            <PassportIcon name="download" />
            {t('Unduh JSON')}
          </Button>
          {actions.shareable && (
            <Button variant="glass" onClick={actions.share}>
              <PassportIcon name="share" />
              {t('Bagikan')}
            </Button>
          )}
          {/* Short visible label keeps the actions on one row; the name starts with it (WCAG 2.5.3). */}
          <Button variant="glass" onClick={actions.print} aria-label={t('Cetak atau simpan PDF')}>
            <PassportIcon name="printer" />
            {t('Cetak')}
          </Button>
        </div>
        <div className={styles.noPrint}>
          <p role="status" className={styles.actionMessage}>
            {actions.message}
          </p>
          {actions.manualText !== null && (
            <label className={styles.manualCopy}>
              {t('Salin teks ini secara manual')}
              <textarea
                className={styles.fallbackField}
                readOnly
                value={actions.manualText}
                ref={(element) => {
                  element?.focus();
                  element?.select();
                }}
              />
            </label>
          )}
        </div>
      </div>
    </header>
  );
}

/** Link warnings change how the whole record must be read, so they stay open under the hero. */
function LinkWarnings({ record }: { readonly record: AnyEvidenceRecord }) {
  const warnings = record.linkWarnings.filter((warning) => warning.severity === 'warning');
  if (warnings.length === 0) return null;
  return (
    <div role="alert" className={styles.linkWarnings}>
      {warnings.map((warning) => (
        <p key={warning.code} className={styles.linkWarning} data-severity="warning">
          <strong>{t('Peringatan tautan:')} </strong>
          {warning.message}
        </p>
      ))}
    </div>
  );
}

function bannerHint(record: AnyEvidenceRecord): string {
  if (record.source.dataMode === 'DEMO')
    return t('termasuk: semua angka adalah data simulasi, bukan observasi resmi.');
  return record.source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
    ? t('termasuk risiko versi data tidak tersedia lagi setelah pembaruan server.')
    : t('termasuk: data tidak dikunci ke versi data, jadi membuka tautan lagi dapat memberi data berbeda.');
}

/** The whole callout is one link to the limitations, so the hit area is the full row. */
function LimitsBanner({ record, count }: { readonly record: AnyEvidenceRecord; readonly count: number }) {
  return (
    <a href="#batasan" className={styles.limitsBanner}>
      <span className={styles.limitsIcon} aria-hidden="true">
        <PassportIcon name="alert" />
      </span>
      <span className={styles.limitsText}>
        <span className={styles.limitsTitle}>{t('{0} batasan berlaku untuk paspor ini', count)}</span>
        <span className={styles.limitsHint}>{t('Baca sebelum mengutip — {0}', bannerHint(record))}</span>
      </span>
      <span className={`${styles.limitsLink} ${styles.noPrint}`}>
        {t('Baca batasan')}
        <PassportIcon name="arrowRight" size={14} />
      </span>
    </a>
  );
}

function Meter({ value }: { readonly value: number }) {
  return (
    <span className={styles.meter} aria-hidden="true">
      <span style={{ width: `${String(Math.max(0, Math.min(100, value)))}%` }} />
    </span>
  );
}

function TrustOverview({ record }: { readonly record: AnyEvidenceRecord }) {
  const { source } = record;
  const completeness = source.snapshot?.completenessPct ?? null;
  const coverage = source.observedCoverage;
  const regionPct = coverage?.regionCoveragePct ?? null;
  const pinned = source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT';
  const ratioPct = coverage ? (coverage.availableIndicators / coverage.totalIndicators) * 100 : null;
  const disagree = completeness !== null && ratioPct !== null && Math.abs(completeness - ratioPct) > 0.1;

  return (
    <Section
      id="paspor-keterpercayaan"
      title={t('Seberapa bisa dipercaya?')}
      mode={source.dataMode}
      description={t(
        'Ringkasan dari status sumber data. Semua angka berasal dari server Data Hub, tidak dihitung ulang oleh peramban.',
      )}
      plain
    >
      <ul role="list" className={styles.trustGrid}>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="layers" size={14} />
              {t('Kelengkapan indikator')}
            </p>
            <p className={styles.trustValue}>
              {completeness === null ? t('Belum tersedia') : formatPercent(completeness)}
            </p>
            {completeness !== null && <Meter value={completeness} />}
            <p className={styles.trustText}>
              {coverage
                ? t(
                    '{0} dari {1} indikator berdata di versi data ini.',
                    String(coverage.availableIndicators),
                    String(coverage.totalIndicators),
                  )
                : t('Jumlah indikator berdata belum tersedia.')}
              {disagree && t(' Persentase server berbeda dari jumlah ini.')}
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="globe" size={14} />
              {t('Wilayah dengan observasi')}
            </p>
            <p className={styles.trustValue}>
              {regionPct === null ? t('Belum tersedia') : formatPercent(regionPct)}
            </p>
            {regionPct !== null && <Meter value={regionPct} />}
            <p className={styles.trustText}>
              {t('Persentase wilayah yang punya observasi — bukan jumlah indikator.')}
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name={pinned ? 'lock' : 'unlock'} size={14} />
              {t('Reproduksibilitas')}
            </p>
            <p className={styles.trustValue}>{pinned ? t('Terkunci') : t('Tidak terkunci')}</p>
            <span className={pinned ? styles.trustChip : `${styles.trustChip} ${styles.chipWarn}`}>
              <PassportIcon name={pinned ? 'check' : 'alert'} size={12} />
              {pinned
                ? source.reproducibility.origin === 'LINK'
                  ? t('Ke versi data di tautan')
                  : t('Ke versi data aktif saat dibuka')
                : t('Tanpa penguncian versi data')}
            </span>
            <p className={styles.trustText}>
              {pinned
                ? t('Setiap respons membawa sidik SHA-256 yang sama.')
                : t('Membuka tautan ini lagi dapat memberi data berbeda.')}
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="shield" size={14} />
              {t('Konsistensi respons')}
            </p>
            <p className={styles.trustValue}>{source.consistent ? t('Konsisten') : t('Tidak konsisten')}</p>
            <span className={source.consistent ? styles.trustChip : `${styles.trustChip} ${styles.chipWarn}`}>
              <PassportIcon name={source.consistent ? 'check' : 'alert'} size={12} />
              {t('{0} respons diperiksa', record.fetched.length)}
            </span>
            <p className={styles.trustText}>
              {source.consistent
                ? t('Mode, versi data, dan sidik sama di semua respons.')
                : t('Mode, versi data, atau sidik berbeda antarrespons; perbandingan ditahan.')}
            </p>
          </Surface>
        </li>
      </ul>
    </Section>
  );
}

export interface TocEntry {
  readonly id: string;
  readonly label: string;
}

function Aside({
  record,
  toc,
  citation,
  exportNote,
  actions,
}: {
  readonly record: AnyEvidenceRecord;
  readonly toc: readonly TocEntry[];
  readonly citation: string;
  readonly exportNote: string;
  readonly actions: PassportActions;
}) {
  return (
    <aside className={styles.aside} aria-label={t('Navigasi dan kutipan paspor')}>
      <Surface
        as="nav"
        radius="control"
        className={`${styles.asideCard} ${styles.noPrint}`}
        aria-label={t('Isi paspor')}
      >
        <p className={styles.eyebrow}>{t('Isi paspor')}</p>
        <ol role="list" className={styles.toc}>
          {toc.map((entry, index) => (
            <li key={entry.id}>
              <a href={`#${entry.id}`}>
                <span>{entry.label}</span>
                <span className={styles.tocNumber}>{String(index + 1).padStart(2, '0')}</span>
              </a>
            </li>
          ))}
        </ol>
      </Surface>
      <Surface
        radius="control"
        reading
        className={`${styles.asideCard} ${styles.citationCard} ${styles.noPrint}`}
      >
        <h2 className={styles.asideTitle}>{t('Kutip paspor ini')}</h2>
        {/* The full citation, scrollable; a keyboard user can reach and scroll it. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className={styles.citation} role="region" aria-label={t('Teks kutipan')} tabIndex={0}>
          {citation}
        </div>
        <Button variant="secondary" className={styles.fullButton} onClick={actions.copyCitation}>
          <PassportIcon name="copy" />
          {t('Salin kutipan')}
        </Button>
        <p className={styles.asideNote}>{t('Sertakan batasan saat mengutip angka dari paspor ini.')}</p>
        <p className={styles.asideNote}>{exportNote}</p>
      </Surface>
      <Surface
        as="nav"
        radius="control"
        className={`${styles.asideCard} ${styles.noPrint}`}
        aria-label={t('Lanjutkan')}
      >
        <ul role="list" className={styles.related}>
          {relatedLinks(record).map((link) => (
            <li key={link.to + link.label}>
              <Link to={link.to}>
                {link.label}
                <PassportIcon name="arrowRight" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      </Surface>
    </aside>
  );
}

interface PassportLayoutProps {
  readonly record: AnyEvidenceRecord;
  readonly kindLabel: string;
  readonly notes: readonly LimitationNote[];
  readonly agencies: readonly string[];
  readonly toc: readonly TocEntry[];
  readonly citation: string;
  readonly exportNote: string;
  readonly actions: PassportActions;
  /** The main column, in reading order. */
  readonly children: ReactNode;
  /**
   * Sections that follow at the full width of the page, under the main column and the aside (the
   * wide evidence tables read better with the room). The aside then stretches to the main column,
   * its citation card taking the spare height, so its last card ends level with the last section.
   */
  readonly wide?: ReactNode;
}

/**
 * The page of every Paspor Bukti (Figma "Paspor Bukti", Normal and Kaca): breadcrumb, a hero that
 * answers what this is and how it is pinned, the limitations banner, the trust overview, then the
 * evidence beside a table of contents and the citation.
 */
export function PassportLayout({
  record,
  kindLabel,
  notes,
  agencies,
  toc,
  citation,
  exportNote,
  actions,
  children,
  wide,
}: PassportLayoutProps) {
  return (
    <>
      <BackButton />
      <article className={styles.document} aria-label={record.title}>
        <PrintRunningHeader source={record.source} />
        <Hero record={record} kindLabel={kindLabel} actions={actions} />
        <LinkWarnings record={record} />
        <LimitsBanner record={record} count={notes.length} />
        <TrustOverview record={record} />
        <div className={styles.columns} data-split={wide ? true : undefined}>
          <div className={styles.mainColumn}>{children}</div>
          <Aside record={record} toc={toc} citation={citation} exportNote={exportNote} actions={actions} />
        </div>
        {wide && <div className={styles.wideSections}>{wide}</div>}
        <p className={styles.footerLine}>
          {t(
            'Nusa Matra. Data dari {0} melalui Data Hub ({1}). Paspor dirangkai di peramban dan bukan arsip resmi.',
            agencies.length > 0 ? agencies.join(', ') : t('sumber yang belum tersedia'),
            record.source.dataMode,
          )}
        </p>
      </article>
    </>
  );
}
