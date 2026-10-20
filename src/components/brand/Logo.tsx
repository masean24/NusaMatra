import logoMarkOnDarkUrl from '@/assets/figma/landing/logo-mark-on-dark.png';
import logoMarkUrl from '@/assets/figma/landing/logo-mark.png';
import styles from './Logo.module.css';

interface LogoProps {
  /** `nav` = 29×26 mark + 17px wordmark (49:306); `footer` = 44×40 mark + 26px wordmark (78:994). */
  readonly size: 'nav' | 'footer';
  /** Which surface the logo sits on; dark/sea surfaces use the light mark and the peach "Matra". */
  readonly surface: 'auto' | 'dark';
}

/**
 * The approved Nusa Matra mark and wordmark from Figma. The mark files are Figma exports
 * (78:992 light-surface mark, 78:995 dark-surface mark), never redrawn.
 */
export function Logo({ size, surface }: LogoProps) {
  return (
    <span className={`${styles.logo} ${styles[size]}`} data-surface={surface}>
      <img className={styles.markLight} src={logoMarkUrl} alt="" width={29} height={26} />
      <img className={styles.markDark} src={logoMarkOnDarkUrl} alt="" width={29} height={26} />
      <span className={styles.wordmark}>
        Nusa <span className={styles.accent}>Matra</span>
      </span>
    </span>
  );
}
