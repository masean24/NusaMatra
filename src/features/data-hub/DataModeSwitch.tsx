import { useId } from 'react';
import { publicConfig } from '@/lib/publicConfig';
import type { DataMode } from '@/services/api';
import { useDataHub } from './useDataHub';
import styles from './DataModeSwitch.module.css';

const MODES: readonly DataMode[] = ['DEMO', 'LIVE'];

/**
 * Which data the page reads. Deliberately separate from the Normal/Kaca appearance switch. Visitors
 * never see it (the site reads LIVE only); it renders only when `modeSwitch` is configured, for the
 * automated tests that use the DEMO fixtures.
 */
export function DataModeSwitch() {
  const { dataMode, setDataMode } = useDataHub();
  const id = useId();
  const labelId = `${id}-label`;

  if (!publicConfig.modeSwitch) return null;
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={styles.switch}>
      <span id={labelId} className={styles.label}>
        Mode data
      </span>
      {MODES.map((mode) => (
        <label key={mode} className={styles.option} data-selected={mode === dataMode || undefined}>
          <input
            type="radio"
            name={id}
            value={mode}
            checked={mode === dataMode}
            onChange={() => {
              setDataMode(mode);
            }}
            className="visually-hidden"
          />
          {mode}
        </label>
      ))}
    </div>
  );
}
