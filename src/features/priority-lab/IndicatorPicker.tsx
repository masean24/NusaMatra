import { categoryLabel } from '@/features/data-hub';
import { directionLabel, indicatorCoverageText, unavailableReason, type IndicatorOption } from './labModel';
import styles from './PriorityLab.module.css';

interface IndicatorPickerProps {
  readonly options: readonly IndicatorOption[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string, next: boolean) => void;
  /** Lab limit, so the sliders stay readable. */
  readonly maxSelected: number;
}

/**
 * Chooses the criteria. Indicators without data in this mode stay visible but cannot be chosen, and
 * say why; each one names its source, year, unit, direction and how many regions have a value.
 */
export function IndicatorPicker({ options, selected, onToggle, maxSelected }: IndicatorPickerProps) {
  // An indicator no region has data for is no choice at all, unless a scenario already carries it.
  const listed = options.filter((option) => option.availability !== 'empty' || selected.has(option.id));
  const categories = [...new Set(listed.map((option) => option.category))];
  const availableCount = options.filter((option) => option.availability === 'available').length;
  const full = selected.size >= maxSelected;

  return (
    <details className={styles.picker}>
      <summary>
        <span className="kk-body-strong">
          <span aria-hidden="true">+ </span>Tambah kriteria
        </span>
        <span className={`kk-small ${styles.muted}`}>
          {selected.size} dipilih dari {availableCount} indikator berdata
        </span>
      </summary>
      {full && (
        <p className={`kk-small ${styles.muted}`}>
          Paling banyak {maxSelected} kriteria. Lepas salah satu untuk memilih yang lain.
        </p>
      )}
      {categories.map((category) => (
        <fieldset key={category} className={styles.category}>
          <legend className="kk-small">{categoryLabel(category)}</legend>
          <ul role="list" className={styles.options}>
            {listed
              .filter((option) => option.category === category)
              .map((option) => {
                const reason = unavailableReason(option);
                const checked = selected.has(option.id);
                const disabled = !checked && (reason !== null || full);
                const inputId = `kriteria-${option.id}`;
                const describedBy = `${inputId}-info`;
                return (
                  <li key={option.id}>
                    <div className={styles.option} data-disabled={disabled || undefined}>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        aria-describedby={describedBy}
                        onChange={(event) => {
                          onToggle(option.id, event.target.checked);
                        }}
                      />
                      <span className={styles.optionText}>
                        <label htmlFor={inputId} className="kk-body">
                          {option.label}
                        </label>
                        <span id={describedBy} className={`kk-small ${styles.muted}`}>
                          {reason ?? (
                            <>
                              {option.agency ?? 'Sumber tidak disebutkan'}
                              {option.referenceYear !== null && ` ${String(option.referenceYear)}`}, satuan{' '}
                              {option.unit}. {directionLabel(option.polarity)}
                              {indicatorCoverageText(option) !== null &&
                                `. Data untuk ${indicatorCoverageText(option) ?? ''}`}
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        </fieldset>
      ))}
    </details>
  );
}
