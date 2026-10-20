import { useId } from 'react';
import type { DataMode } from '@/services/api';
import { useDataHub } from './useDataHub';
import styles from './DataModeSwitch.module.css';

const MODES: readonly DataMode[] = ['DEMO', 'LIVE'];

/** Which data the page reads. Deliberately separate from the Normal/Kaca appearance switch. */
export function DataModeSwitch() {
  const { dataMode, setDataMode } = useDataHub();
  const id = useId();
  const labelId = `${id}-label`;

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
