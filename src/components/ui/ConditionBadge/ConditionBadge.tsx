import { Icon } from '@/components/ui/Icon/Icon';
import styles from './ConditionBadge.module.css';

export type ConditionTone = 'positive' | 'negative' | 'neutral' | 'unknown';

interface ConditionBadgeProps {
  readonly tone: ConditionTone;
  /** The words carry the meaning; the colour and icon only reinforce them. */
  readonly children: string;
}

/** A verdict pill: jade for relatively better, coral for relatively worse, brand neutral otherwise. */
export function ConditionBadge({ tone, children }: ConditionBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} data-tone={tone}>
      {tone === 'positive' && <Icon name="check" size={16} />}
      {tone === 'negative' && <Icon name="warning" size={16} />}
      {tone === 'neutral' && <span aria-hidden="true">≈</span>}
      {children}
    </span>
  );
}
