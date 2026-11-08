import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/Icon/Icon';
import styles from './BackButton.module.css';
import { t } from '@/lib/i18n';

/** React Router keeps this visit's position in the history stack as `idx` (0 = the first page). */
function hasPreviousPage(): boolean {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null && 'idx' in state && typeof state.idx === 'number'
    ? state.idx > 0
    : false;
}

interface BackButtonProps {
  /**
   * `pill` (default): the labelled cobalt pill at the top of a page. `icon`: the chevron alone, for a
   * bar with no room for the label (the Jelajahi search field on a phone); its name stays "Kembali".
   */
  readonly variant?: 'pill' | 'icon';
}

/**
 * "Kembali" (owner decision 2026-10-27, replacing the "Peta utama" link): returns to the page the
 * visitor came from, at the place they left it (ScrollRestoration in AppLayout restores the scroll
 * position per page). Opened directly, with nothing to go back to, it leads to the home page.
 */
export function BackButton({ variant = 'pill' }: BackButtonProps) {
  const navigate = useNavigate();
  const label = t('Kembali');
  return (
    <button
      type="button"
      className={variant === 'icon' ? styles.icon : styles.button}
      aria-label={variant === 'icon' ? label : undefined}
      onClick={() => {
        if (hasPreviousPage()) void navigate(-1);
        else void navigate('/');
      }}
    >
      <Icon name="chevronLeft" size={variant === 'icon' ? 22 : 18} />
      {variant === 'pill' && <span>{label}</span>}
    </button>
  );
}
