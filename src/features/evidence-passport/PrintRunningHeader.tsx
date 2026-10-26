import { BROWSER_ASSEMBLED_LABEL } from './notices';
import type { SourceStatus } from './evidenceTypes';
import styles from './EvidencePassport.module.css';

/** Characters that can safely sit inside a CSS string; anything else is left out of the margin text. */
const SAFE_IN_CSS_STRING = /^[A-Za-z0-9 ._:·/,()-]+$/;

/**
 * The line that names what is printed: mode, snapshot, and that this is not an official archive.
 *
 * It is printed once, at the top of the document, as ordinary content. It also feeds the `@page`
 * margin boxes, so browsers that support them (Chromium 131+) repeat it at the top of every page
 * with "Halaman n dari N" at the bottom; browsers that do not simply ignore the rule. The text goes
 * into a CSS string, so it is restricted to characters that cannot end that string.
 */
export function PrintRunningHeader({
  source,
}: {
  readonly source: Pick<SourceStatus, 'dataMode' | 'snapshotId'>;
}) {
  const snapshot = SAFE_IN_CSS_STRING.test(source.snapshotId) ? source.snapshotId : 'tidak dapat ditampilkan';
  const text = `Nusa Matra · Paspor Bukti · Mode ${source.dataMode} · Snapshot ${snapshot} · ${BROWSER_ASSEMBLED_LABEL}`;
  return (
    <>
      <style>{`@page { @top-left { content: "${text}"; font: 600 8pt sans-serif; color: #000; } @bottom-right { content: "Halaman " counter(page) " dari " counter(pages); font: 8pt sans-serif; color: #000; } }`}</style>
      <p className={styles.printHeader}>{text}</p>
    </>
  );
}
