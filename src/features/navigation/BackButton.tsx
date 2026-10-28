import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/Icon/Icon';
import styles from './BackButton.module.css';

/** React Router keeps this visit's position in the history stack as `idx` (0 = the first page). */
function hasPreviousPage(): boolean {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null && 'idx' in state && typeof state.idx === 'number'
    ? state.idx > 0
    : false;
}

/**
 * "Kembali" (owner decision 2026-10-27, replacing the "Peta utama" link): returns to the page the
 * visitor came from, at the place they left it (ScrollRestoration in AppLayout restores the scroll
 * position per page). Opened directly, with nothing to go back to, it leads to the home page.
 */
export function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        if (hasPreviousPage()) void navigate(-1);
        else void navigate('/');
      }}
    >
      <Icon name="chevronLeft" size={18} />
      <span>Kembali</span>
    </button>
  );
}
