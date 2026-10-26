import { useId, useState, type MouseEvent } from 'react';
import type { DisplayMode } from './displayModePreference';
import { Icon } from '@/components/ui/Icon/Icon';
import { useDisplayMode } from './DisplayModeContext';
import styles from './DisplayModeSwitch.module.css';

interface DisplayModeSwitchProps {
  /** `compact` hides the segment labels visually (narrow screens); the accessible name stays the same. */
  readonly size?: 'regular' | 'compact';
  readonly className?: string | undefined;
}

/** Figma 26:37 "Sakelar Mode Tampilan": role=switch, label "Mode tampilan kaca". */
export function DisplayModeSwitch({ size = 'regular', className }: DisplayModeSwitchProps) {
  const { mode, glassAvailable, isTransitioning, toggleMode } = useDisplayMode();
  const hintId = useId();
  const isGlass = mode === 'glass';
  // The knob moves on click; the theme itself follows once the liquid covers the screen.
  const [target, setTarget] = useState<DisplayMode | null>(null);
  const [squishing, setSquishing] = useState(false);
  const shown = isTransitioning && target ? target : mode;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isTransitioning || !glassAvailable) return;
    setTarget(isGlass ? 'normal' : 'glass');
    setSquishing(true);
    toggleMode(event.currentTarget.getBoundingClientRect());
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={isGlass}
        aria-label="Mode tampilan kaca"
        aria-describedby={glassAvailable ? undefined : hintId}
        aria-busy={isTransitioning || undefined}
        disabled={!glassAvailable}
        onClick={handleClick}
        className={[styles.switch, styles[size], className].filter(Boolean).join(' ')}
        data-selected={shown}
      >
        {/* Stretch-and-bounce only after a click (data-squish), never on page load. */}
        <span
          className={styles.knob}
          data-squish={squishing ? shown : undefined}
          onAnimationEnd={() => {
            setSquishing(false);
          }}
          aria-hidden="true"
        />
        <span className={styles.segment} data-segment="normal">
          <Icon name="sun" size={18} />
          <span className={styles.label}>Normal</span>
        </span>
        <span className={styles.segment} data-segment="glass">
          <Icon name="drop" size={18} />
          <span className={styles.label}>Kaca</span>
        </span>
      </button>
      {!glassAvailable && (
        <span id={hintId} className="visually-hidden">
          Mode kaca dimatikan karena perangkat Anda meminta kontras tinggi atau transparansi rendah.
        </span>
      )}
    </>
  );
}
