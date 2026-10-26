import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import type { LimitationNote } from './limitationNote';
import { BROWSER_ASSEMBLED_LABEL } from './notices';
import { PassportIcon } from './PassportIcons';
import {
  PASSPORT_CRUMB,
  formatReceived,
  heroTitle,
  relatedLinks,
  shortDigest,
  subjectCrumb,
  type AnyEvidenceRecord,
} from './passportFormat';
import { PrintRunningHeader } from './PrintRunningHeader';
import { ModeTag, Section } from './Section';
import type { PassportActions } from './usePassportActions';
import styles from './EvidencePassport.module.css';

const formatPercent = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

/** "Peta utama / Kota Langsa / Paspor Bukti"; the last step is this page. */
export function Breadcrumb({
  subject,
}: {
  readonly subject: { readonly label: string; readonly to: string } | null;
}) {
  return (
    <nav aria-label="Jejak navigasi" className={styles.breadcrumb}>
      <ol role="list">
        <li>
          <Link to="/peta">Peta utama</Link>
        </li>
        {subject && (
          <li>
            <Link to={subject.to}>{subject.label}</Link>
          </li>
        )}
        <li>
          <span aria-current="page">{PASSPORT_CRUMB.label}</span>
        </li>
      </ol>
    </nav>
  );
}

/** Orange stamp on the snapshot card: shown only when every response is pinned to one digest. */
function LockStamp() {
  return (
    <svg className={styles.stamp} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <path id="paspor-stamp-arc" d="M32 32 m-23 0 a23 23 0 1 1 46 0 a23 23 0 1 1 -46 0" />
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="16" fill="currentColor" opacity="0.9" />
      <text fontSize="6.4" fontWeight="700" letterSpacing="1.6" fill="currentColor">
        <textPath href="#paspor-stamp-arc">TERKUNCI · TERKUNCI · TERKUNCI ·</textPath>
      </text>
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="25.5" y="30" width="13" height="9" rx="2" />
        <path d="M28.5 30v-3a3.5 3.5 0 0 1 7 0v3" />
      </g>
    </svg>
  );
}

interface HeroProps {
  readonly record: AnyEvidenceRecord;
  readonly kindLabel: string;
  readonly actions: PassportActions;
}

function Hero({ record, kindLabel, actions }: HeroProps) {
  const { source } = record;
  const digest = source.snapshot?.contentSha256 ?? null;
  const coverage = source.observedCoverage;
  const pinned = source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT';

  return (
    <header id="paspor-atas" className={styles.hero}>
      <div className={styles.heroMain}>
        <div className={styles.heroChips}>
          <ModeTag mode={source.dataMode} />
          <span className={styles.heroChip}>{kindLabel}</span>
          {coverage && (
            <span className={styles.heroChip}>
              {coverage.availableIndicators} / {coverage.totalIndicators} indikator berdata
            </span>
          )}
        </div>
        <p className={styles.heroKicker}>Paspor Bukti</p>
        <h1 className={styles.heroTitle}>{heroTitle(record)}</h1>
        <div className={styles.heroQuestion}>
          <p className={styles.heroQuestionLabel}>Pertanyaan yang dijawab paspor ini</p>
          <p>{record.question}</p>
        </div>
        <div className={`${styles.heroActions} ${styles.noPrint}`}>
          <Button variant="accent" onClick={actions.copyLink}>
            <PassportIcon name={actions.linkCopied ? 'check' : 'link'} />
            {actions.linkCopied ? 'Tautan tersalin' : 'Salin tautan'}
          </Button>
          <Button variant="glass" onClick={actions.download}>
            <PassportIcon name="download" />
            Unduh JSON
          </Button>
          {actions.shareable && (
            <Button variant="glass" onClick={actions.share}>
              <PassportIcon name="share" />
              Bagikan
            </Button>
          )}
          {/* Short visible label keeps the actions on one row; the name starts with it (WCAG 2.5.3). */}
          <Button variant="glass" onClick={actions.print} aria-label="Cetak atau simpan PDF">
            <PassportIcon name="printer" />
            Cetak
          </Button>
        </div>
        <div className={styles.noPrint}>
          <p role="status" className={styles.actionMessage}>
            {actions.message}
          </p>
          {actions.manualText !== null && (
            <label className={styles.manualCopy}>
              Salin teks ini secara manual
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

      <div className={styles.snapshotCard}>
        {pinned && <LockStamp />}
        <dl className={styles.snapshotFacts}>
          <div className={styles.snapshotWide}>
            <dt>No. snapshot</dt>
            <dd className={styles.mono}>{source.snapshotId}</dd>
          </div>
          <div className={styles.snapshotWide}>
            <dt>Sidik isi data · SHA-256</dt>
            <dd className={styles.snapshotDigest}>
              {digest ? (
                <>
                  <span className={styles.mono}>
                    <span aria-hidden="true">{shortDigest(digest)}</span>
                    <span className={styles.srOnly}>{digest}</span>
                  </span>
                  <button
                    type="button"
                    className={`${styles.inlineButton} ${styles.noPrint}`}
                    aria-label="Salin sidik isi data"
                    onClick={() => {
                      actions.copyDigest(digest);
                    }}
                  >
                    <PassportIcon name="copy" size={14} />
                    Salin
                  </button>
                </>
              ) : (
                'tidak ada'
              )}
            </dd>
          </div>
          <div>
            <dt>Batas wilayah</dt>
            <dd className={styles.mono}>{source.snapshot?.boundaryVersion ?? 'belum tersedia'}</dd>
          </div>
          <div>
            <dt>Dirangkai</dt>
            <dd>{formatReceived(source.receivedByBrowserAt)}</dd>
          </div>
        </dl>
        <p className={styles.heroNote} role="note">
          <PassportIcon name="info" size={14} />
          <span>{BROWSER_ASSEMBLED_LABEL}</span>
        </p>
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
          <strong>Peringatan tautan: </strong>
          {warning.message}
        </p>
      ))}
    </div>
  );
}

function bannerHint(record: AnyEvidenceRecord): string {
  if (record.source.dataMode === 'DEMO')
    return 'termasuk: semua angka adalah data simulasi, bukan observasi resmi.';
  return record.source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
    ? 'termasuk risiko snapshot tidak tersedia lagi setelah pembaruan server.'
    : 'termasuk: data tidak dikunci ke snapshot, jadi membuka tautan lagi dapat memberi data berbeda.';
}

/** The whole callout is one link to the limitations, so the hit area is the full row. */
function LimitsBanner({ record, count }: { readonly record: AnyEvidenceRecord; readonly count: number }) {
  return (
    <a href="#batasan" className={styles.limitsBanner}>
      <span className={styles.limitsIcon} aria-hidden="true">
        <PassportIcon name="alert" />
      </span>
      <span className={styles.limitsText}>
        <span className={styles.limitsTitle}>{count} batasan berlaku untuk paspor ini</span>
        <span className={styles.limitsHint}>Baca sebelum mengutip — {bannerHint(record)}</span>
      </span>
      <span className={`${styles.limitsLink} ${styles.noPrint}`}>
        Baca batasan
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
      title="Seberapa bisa dipercaya?"
      mode={source.dataMode}
      description="Ringkasan dari status sumber data. Semua angka berasal dari server Data Hub, tidak dihitung ulang oleh peramban."
      plain
    >
      <ul role="list" className={styles.trustGrid}>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="layers" size={14} />
              Kelengkapan indikator
            </p>
            <p className={styles.trustValue}>
              {completeness === null ? 'Belum tersedia' : formatPercent(completeness)}
            </p>
            {completeness !== null && <Meter value={completeness} />}
            <p className={styles.trustText}>
              {coverage
                ? `${String(coverage.availableIndicators)} dari ${String(coverage.totalIndicators)} indikator berdata di snapshot ini.`
                : 'Jumlah indikator berdata belum tersedia.'}
              {disagree && ' Persentase server berbeda dari jumlah ini.'}
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="globe" size={14} />
              Wilayah dengan observasi
            </p>
            <p className={styles.trustValue}>
              {regionPct === null ? 'Belum tersedia' : formatPercent(regionPct)}
            </p>
            {regionPct !== null && <Meter value={regionPct} />}
            <p className={styles.trustText}>
              Persentase wilayah yang punya observasi — bukan jumlah indikator.
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name={pinned ? 'lock' : 'unlock'} size={14} />
              Reproduksibilitas
            </p>
            <p className={styles.trustValue}>{pinned ? 'Terkunci' : 'Tidak terkunci'}</p>
            <span className={pinned ? styles.trustChip : `${styles.trustChip} ${styles.chipWarn}`}>
              <PassportIcon name={pinned ? 'check' : 'alert'} size={12} />
              {pinned
                ? source.reproducibility.origin === 'LINK'
                  ? 'Ke snapshot di tautan'
                  : 'Ke snapshot aktif saat dibuka'
                : 'Tanpa penguncian snapshot'}
            </span>
            <p className={styles.trustText}>
              {pinned
                ? 'Setiap respons membawa sidik SHA-256 yang sama.'
                : 'Membuka tautan ini lagi dapat memberi data berbeda.'}
            </p>
          </Surface>
        </li>
        <li>
          <Surface radius="control" className={styles.trustCard}>
            <p className={styles.trustLabel}>
              <PassportIcon name="shield" size={14} />
              Konsistensi respons
            </p>
            <p className={styles.trustValue}>{source.consistent ? 'Konsisten' : 'Tidak konsisten'}</p>
            <span className={source.consistent ? styles.trustChip : `${styles.trustChip} ${styles.chipWarn}`}>
              <PassportIcon name={source.consistent ? 'check' : 'alert'} size={12} />
              {record.fetched.length} respons diperiksa
            </span>
            <p className={styles.trustText}>
              {source.consistent
                ? 'Mode, snapshot, dan sidik sama di semua respons.'
                : 'Mode, snapshot, atau sidik berbeda antarrespons; perbandingan ditahan.'}
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
    <aside className={styles.aside} aria-label="Navigasi dan kutipan paspor">
      <Surface
        as="nav"
        radius="control"
        className={`${styles.asideCard} ${styles.noPrint}`}
        aria-label="Isi paspor"
      >
        <p className={styles.eyebrow}>Isi paspor</p>
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
      <Surface radius="control" className={`${styles.asideCard} ${styles.citationCard} ${styles.noPrint}`}>
        <h2 className={styles.asideTitle}>Kutip paspor ini</h2>
        {/* The full citation, scrollable; a keyboard user can reach and scroll it. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className={styles.citation} role="region" aria-label="Teks kutipan" tabIndex={0}>
          {citation}
        </div>
        <Button variant="secondary" className={styles.fullButton} onClick={actions.copyCitation}>
          <PassportIcon name="copy" />
          Salin kutipan
        </Button>
        <p className={styles.asideNote}>Sertakan batasan saat mengutip angka dari paspor ini.</p>
        <p className={styles.asideNote}>{exportNote}</p>
      </Surface>
      <Surface
        as="nav"
        radius="control"
        className={`${styles.asideCard} ${styles.noPrint}`}
        aria-label="Lanjutkan"
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
      <Breadcrumb subject={subjectCrumb(record)} />
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
          Nusa Matra · Data dari {agencies.length > 0 ? agencies.join(', ') : 'sumber yang belum tersedia'}{' '}
          melalui Data Hub ({record.source.dataMode}). Paspor dirangkai di peramban dan bukan arsip resmi.
        </p>
      </article>
    </>
  );
}
