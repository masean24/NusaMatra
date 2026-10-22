import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import {
  TOTAL_BASIS_POINTS,
  redistributeWeights,
  removeCriterion,
  type WeightsBps,
} from '@/domain/prioritization';
import type { CompositePresetDTO } from '@/services/api';
import { percentLabel, unavailableReason, type IndicatorOption } from './labModel';
import styles from './PriorityLab.module.css';

type Weights = WeightsBps<string>;

interface WeightControlsProps {
  readonly weights: Weights;
  readonly options: readonly IndicatorOption[];
  readonly onChange: (weights: Weights) => void;
  readonly onReset: () => void;
  readonly presets: readonly CompositePresetDTO[] | null;
  /** Why presets are not offered, when they are not. */
  readonly presetsNote: string | null;
}

/** Same set of weights, ignoring order. */
function sameWeights(a: Weights, b: Readonly<Record<string, number>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

/**
 * The priority sliders. Moving one makes the others give way proportionally, so the total is always
 * exactly 100 %; the note under the sliders says what moved. Presets from the Data Hub set all
 * weights at once.
 */
export function WeightControls({
  weights,
  options,
  onChange,
  onReset,
  presets,
  presetsNote,
}: WeightControlsProps) {
  const [lastChange, setLastChange] = useState<{ id: string; before: Weights } | null>(null);
  const ids = Object.keys(weights);
  const total = ids.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;
  const activePreset = presets?.find((preset) => sameWeights(weights, preset.weightsBasisPoints)) ?? null;

  const adjustments =
    lastChange === null
      ? []
      : ids
          .filter((id) => id !== lastChange.id && (lastChange.before[id] ?? 0) !== (weights[id] ?? 0))
          .map(
            (id) =>
              `${labelOf(id)} ${percentLabel(lastChange.before[id] ?? 0)} → ${percentLabel(weights[id] ?? 0)}`,
          );

  return (
    <div className={styles.weights}>
      {presets && presets.length > 0 && (
        <div className={styles.presets} role="group" aria-label="Skenario siap pakai">
          {presets.map((preset) => (
            <button
              key={preset.presetId}
              type="button"
              className={styles.preset}
              aria-pressed={activePreset?.presetId === preset.presetId}
              title={preset.description ?? undefined}
              onClick={() => {
                setLastChange(null);
                onChange({ ...preset.weightsBasisPoints });
              }}
            >
              {preset.label}
            </button>
          ))}
          {!activePreset && <Chip>Bobot sendiri</Chip>}
        </div>
      )}
      {presetsNote && <p className={`kk-small ${styles.muted}`}>{presetsNote}</p>}

      <div className={styles.totalBar} aria-hidden="true">
        {ids.map((id, index) => (
          <span
            key={id}
            className={styles.segment}
            data-index={index % 6}
            style={{ width: `${String(((weights[id] ?? 0) / TOTAL_BASIS_POINTS) * 100)}%` }}
          />
        ))}
      </div>
      <p className="kk-body-strong" role="status">
        Total: {percentLabel(total)}
        {total === TOTAL_BASIS_POINTS ? ' — siap dihitung' : ' — harus tepat 100%'}
      </p>

      {ids.length === 0 ? (
        <p className="kk-body">Pilih minimal satu kriteria untuk mulai menghitung peringkat.</p>
      ) : (
        <ul role="list" className={styles.sliders}>
          {ids.map((id) => {
            const option = options.find((entry) => entry.id === id);
            const reason = option ? unavailableReason(option) : 'Indikator tidak ada di katalog Data Hub.';
            const percent = (weights[id] ?? 0) / 100;
            return (
              <li key={id} className={styles.slider}>
                <label htmlFor={`bobot-${id}`} className="kk-body">
                  {/* Distinct from the criterion's checkbox, which has the indicator name alone. */}
                  <span className="visually-hidden">Bobot </span>
                  {labelOf(id)}
                </label>
                <input
                  id={`bobot-${id}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={percent}
                  disabled={ids.length === 1}
                  aria-valuetext={percentLabel(weights[id] ?? 0)}
                  onChange={(event) => {
                    setLastChange({ id, before: weights });
                    onChange(redistributeWeights(weights, id, Number(event.target.value) * 100));
                  }}
                />
                <output htmlFor={`bobot-${id}`} className={`kk-body-strong ${styles.percent}`}>
                  {percentLabel(weights[id] ?? 0)}
                </output>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Lepas kriteria ${labelOf(id)}`}
                  onClick={() => {
                    setLastChange(null);
                    onChange(removeCriterion(weights, id));
                  }}
                >
                  Lepas
                </button>
                {reason && (
                  <p className={`kk-small ${styles.unavailable}`}>
                    {reason} Bobotnya akan dialihkan ke kriteria lain saat dihitung.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {adjustments.length > 0 && (
        <p className={`kk-small ${styles.muted}`} aria-live="polite">
          Agar total tetap 100%, bobot lain ikut menyesuaikan: {adjustments.join('; ')}.
        </p>
      )}
      <div className={styles.footer}>
        <Button
          variant="secondary"
          onClick={() => {
            setLastChange(null);
            onReset();
          }}
        >
          Atur ulang bobot
        </Button>
      </div>
    </div>
  );
}
