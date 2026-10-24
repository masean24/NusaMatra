import { useState, type CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
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

/** Same set of weights, ignoring order. */
function sameWeights(a: Weights, b: Readonly<Record<string, number>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

interface ScenarioPickerProps {
  readonly weights: Weights;
  readonly presets: readonly CompositePresetDTO[] | null;
  /** Why presets are missing or incomplete, when they are. */
  readonly note: string | null;
  readonly onApply: (weights: Weights) => void;
}

/** Data Hub presets as one-tap starting points; the active one is pressed, otherwise "Bobot sendiri". */
export function ScenarioPicker({ weights, presets, note, onApply }: ScenarioPickerProps) {
  const active = presets?.find((preset) => sameWeights(weights, preset.weightsBasisPoints)) ?? null;
  return (
    <section className={styles.configSection} aria-labelledby="lab-skenario">
      <div className={styles.sectionHead}>
        <h2 id="lab-skenario" className={styles.sectionTitle}>
          Skenario
        </h2>
        <span className={styles.sectionMeta}>{active ? active.label : 'Bobot sendiri'}</span>
      </div>
      {presets && presets.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Skenario siap pakai">
          {presets.map((preset) => (
            <button
              key={preset.presetId}
              type="button"
              className={styles.chip}
              aria-pressed={active?.presetId === preset.presetId}
              title={preset.description ?? undefined}
              onClick={() => {
                onApply({ ...preset.weightsBasisPoints });
              }}
            >
              {preset.label}
              {preset.availability && !preset.availability.rankable && (
                <span className={styles.chipNote}>
                  Belum dapat diperingkat · data nasional {preset.availability.requestedWeightAvailabilityPct}
                  % bobot
                </span>
              )}
              {preset.availability?.rankable && preset.availability.requestedWeightAvailabilityPct < 100 && (
                <span className={styles.chipNote}>
                  Data nasional {preset.availability.requestedWeightAvailabilityPct}% bobot, sisanya dialihkan
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {note && <p className={styles.hint}>{note}</p>}
    </section>
  );
}

interface WeightSlidersProps {
  readonly weights: Weights;
  readonly options: readonly IndicatorOption[];
  readonly onChange: (weights: Weights) => void;
  readonly seriesOf: (id: string) => number;
}

/**
 * One slider per criterion. Moving one makes the others give way proportionally, so the total is
 * always exactly 100 %; a one-line note says what moved.
 */
export function WeightSliders({ weights, options, onChange, seriesOf }: WeightSlidersProps) {
  const [lastChange, setLastChange] = useState<{ id: string; before: Weights } | null>(null);
  const ids = Object.keys(weights);
  const total = ids.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;

  const adjusted =
    lastChange === null
      ? []
      : ids.filter((id) => id !== lastChange.id && (lastChange.before[id] ?? 0) !== (weights[id] ?? 0));

  return (
    <section className={styles.configSection} aria-labelledby="lab-bobot-judul">
      <div className={styles.sectionHead}>
        <h2 id="lab-bobot-judul" className={styles.sectionTitle}>
          Bobot kriteria
        </h2>
        <span className={styles.sectionMeta} role="status">
          Total: {percentLabel(total)}
          {total === TOTAL_BASIS_POINTS ? '' : ' — harus tepat 100%'}
        </span>
      </div>
      {ids.length === 0 ? (
        <p className={styles.hint}>Pilih minimal satu kriteria di bawah.</p>
      ) : (
        <ul role="list" className={styles.sliders}>
          {ids.map((id) => {
            const option = options.find((entry) => entry.id === id);
            const reason = option ? unavailableReason(option) : 'Indikator tidak ada di katalog Data Hub.';
            return (
              <li key={id} className={styles.slider}>
                <span className={styles.swatch} data-series={seriesOf(id)} aria-hidden="true" />
                <label htmlFor={`bobot-${id}`} className={styles.sliderLabel}>
                  {/* Distinct from the criterion's checkbox, which has the indicator name alone. */}
                  <span className={styles.visuallyHidden}>Bobot </span>
                  {labelOf(id)}
                </label>
                <output htmlFor={`bobot-${id}`} className={styles.sliderValue}>
                  {percentLabel(weights[id] ?? 0)}
                </output>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Lepas kriteria ${labelOf(id)}`}
                  title="Lepas kriteria"
                  onClick={() => {
                    setLastChange(null);
                    onChange(removeCriterion(weights, id));
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
                <input
                  id={`bobot-${id}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={(weights[id] ?? 0) / 100}
                  disabled={ids.length === 1}
                  data-series={seriesOf(id)}
                  style={{ '--fill': `${String((weights[id] ?? 0) / 100)}%` } as CSSProperties}
                  aria-valuetext={percentLabel(weights[id] ?? 0)}
                  onChange={(event) => {
                    setLastChange({ id, before: weights });
                    onChange(redistributeWeights(weights, id, Number(event.target.value) * 100));
                  }}
                />
                {reason && <p className={styles.sliderNote}>Belum ada data — bobotnya akan dialihkan.</p>}
              </li>
            );
          })}
        </ul>
      )}
      {adjusted.length > 0 && (
        <p className={styles.hint} aria-live="polite">
          Bobot lain ikut menyesuaikan agar total tetap 100%: {adjusted.map(labelOf).join(', ')}.
        </p>
      )}
    </section>
  );
}
