import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import styles from './FloatingCard.module.css';

interface FloatingCardProps {
  readonly title: string;
  readonly detail: string;
  readonly badge: string;
  readonly badgeTone: 'neutral' | 'warning';
}

/** "Kartu melayang" around the hero diorama (Figma 27:102): padding 14px, gap 6px, radius 16px. */
export function FloatingCard({ title, detail, badge, badgeTone }: FloatingCardProps) {
  return (
    <Surface radius="control" className={styles.card}>
      <p className="kk-body-strong">{title}</p>
      <p className={`kk-caption ${styles.detail}`}>{detail}</p>
      <Chip tone={badgeTone}>{badge}</Chip>
    </Surface>
  );
}
