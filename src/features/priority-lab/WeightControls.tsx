import { useId, useState, type CSSProperties, type ReactNode } from 'react';
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

/** Data Hub presets as starting points in one native select; hand-set weights read "Bobot sendiri". */
export function ScenarioPicker({ weights, presets, note, onApply }: ScenarioPickerProps) {
  const active = presets?.find((preset) => sameWeights(weights, preset.weightsBasisPoints)) ?? null;
  const fieldId = useId();
  const activeNote = active ? availabilityNote(active) : null;
  return (
    <section className={styles.configSection} aria-labelledby="lab-skenario">
      <div className={styles.sectionHead}>
        <h3 id="lab-skenario" className={styles.sectionTitle}>
          <span className={styles.stepNumber} aria-hidden="true">
            1
          </span>
          <label htmlFor={fieldId}>Skenario awal</label>
        </h3>
      </div>
      {presets && presets.length > 0 && (
        <span className="glass-field glass-field--select">
          <select
            id={fieldId}
            value={active?.presetId ?? ''}
            onChange={(event) => {
              const preset = presets.find((entry) => entry.presetId === event.target.value);
              if (preset) onApply({ ...preset.weightsBasisPoints });
            }}
          >
            {/* "Bobot sendiri" is where any hand-set weights land; it is chosen by moving a slider. */}
            <option value="" disabled={active !== null}>
              Bobot sendiri
            </option>
            {presets.map((preset) => {
              const presetNote = availabilityNote(preset);
              return (
                <option key={preset.presetId} value={preset.presetId}>
                  {presetNote ? `${preset.label} — ${presetNote}` : preset.label}
                </option>
              );
            })}
          </select>
        </span>
      )}
      {active?.description && <p className={styles.hint}>{active.description}</p>}
      {activeNote && <p className={styles.hint}>{activeNote}</p>}
      {note && <p className={styles.hint}>{note}</p>}
    </section>
  );
}

/** What the Data Hub says about a scenario's national data, in the scenario's own terms. */
function availabilityNote(preset: CompositePresetDTO): string | null {
  const availability = preset.availability;
  if (!availability) return null;
  if (!availability.rankable)
    return `Belum dapat diperingkat · data nasional ${String(availability.requestedWeightAvailabilityPct)}% bobot`;
  if (availability.requestedWeightAvailabilityPct < 100)
    return `Data nasional ${String(availability.requestedWeightAvailabilityPct)}% bobot, sisanya dialihkan`;
  return null;
}

interface WeightSlidersProps {
  readonly weights: Weights;
  readonly options: readonly IndicatorOption[];
  readonly onChange: (weights: Weights) => void;
  readonly seriesOf: (id: string) => number;
  /** The criteria picker and its notes, under the sliders. */
  readonly children?: ReactNode;
}

/** "Total 100%", or how far off it is. */
function totalLabel(total: number): string {
  if (total === TOTAL_BASIS_POINTS) return `Total ${percentLabel(total)}`;
  const gap = percentLabel(Math.abs(TOTAL_BASIS_POINTS - total));
  return total < TOTAL_BASIS_POINTS ? `Kurang ${gap}` : `Lebih ${gap}`;
}

/**
 * One slider per criterion. Moving one makes the others give way proportionally, so the total is
 * always exactly 100 %; a one-line note says what moved.
 */
export function WeightSliders({ weights, options, onChange, seriesOf, children }: WeightSlidersProps) {
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
        <h3 id="lab-bobot-judul" className={styles.sectionTitle}>
          <span className={styles.stepNumber} aria-hidden="true">
            2
          </span>
          Atur bobot
        </h3>
        <span
          className={styles.totalChip}
          data-tone={total === TOTAL_BASIS_POINTS ? 'ok' : 'warn'}
          role="status"
        >
          {totalLabel(total)}
          {total === TOTAL_BASIS_POINTS ? '' : ' — harus tepat 100%'}
        </span>
      </div>
      {ids.length > 0 && (
        <span className={styles.stack} aria-hidden="true">
          {ids
            .filter((id) => (weights[id] ?? 0) > 0)
            .map((id) => (
              <span
                key={id}
                className={styles.stackPart}
                data-series={seriesOf(id)}
                style={{ flexGrow: weights[id] ?? 0 }}
              />
            ))}
        </span>
      )}
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
                  className="glass-range"
                  min={0}
                  max={100}
                  step={1}
                  value={(weights[id] ?? 0) / 100}
                  disabled={ids.length === 1}
                  data-series={seriesOf(id)}
                  style={{ '--p': `${String((weights[id] ?? 0) / 100)}%` } as CSSProperties}
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
      {children}
    </section>
  );
}
