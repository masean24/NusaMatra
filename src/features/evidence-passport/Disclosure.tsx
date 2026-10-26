import { useId, useState, type ReactNode } from 'react';
import styles from './EvidencePassport.module.css';

interface DisclosureProps {
  readonly title: string;
  /** One line that says what is inside, readable while closed. */
  readonly helper?: string;
  /** Heading level of the title within the surrounding outline. */
  readonly level?: 3 | 4;
  /**
   * `inline`: a small text toggle without a heading, for details inside a table cell or a list item
   * (definitions, quality notes, source details). `block` (default): a full-width row with a heading.
   */
  readonly variant?: 'block' | 'inline';
  /** What the details belong to, for a toggle repeated per row: its name becomes "title: context". */
  readonly context?: string;
  readonly children: ReactNode;
}

/**
 * Long technical wording, closed by default: a short title, and the full text on demand. A button with
 * `aria-expanded` rather than `<details>`, because the closed body is `hidden` and the print
 * stylesheet can override that, so paper and PDF always carry the complete wording.
 */
export function Disclosure({
  title,
  helper,
  level = 3,
  variant = 'block',
  context,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const Heading = level === 3 ? 'h3' : 'h4';
  const toggle = (
    <button
      type="button"
      className={variant === 'inline' ? styles.inlineToggle : styles.disclosureToggle}
      aria-expanded={open}
      aria-controls={bodyId}
      aria-label={context ? `${title}: ${context}` : undefined}
      onClick={() => {
        setOpen((current) => !current);
      }}
    >
      <span className={styles.disclosureTitle}>{title}</span>
      {helper && variant === 'block' && <span className={styles.disclosureHelper}>{helper}</span>}
    </button>
  );

  return (
    <div
      className={variant === 'inline' ? styles.inlineDisclosure : styles.disclosure}
      data-open={open || undefined}
    >
      {variant === 'inline' ? toggle : <Heading className={styles.disclosureHeading}>{toggle}</Heading>}
      <div id={bodyId} className={styles.disclosureBody} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
