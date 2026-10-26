import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon/Icon';
import layersUrl from '@/assets/figma/icons/layers.svg';
import styles from './BackToHubLink.module.css';

/** The "Kembali ke peta utama" button of the floating page pill (Figma 62:1291). */
export function BackToHubLink() {
  return (
    <Link to="/peta" className={styles.link}>
      <Icon name="chevronLeft" size={18} />
      {/* The layers glyph is two-tone (cobalt/white + orange), so it is used as the Figma image itself. */}
      <img src={layersUrl} alt="" width={18} height={18} />
      <span>Peta utama</span>
    </Link>
  );
}
