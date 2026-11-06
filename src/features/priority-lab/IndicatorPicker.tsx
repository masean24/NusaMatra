import { useEffect, useRef, useState } from 'react';
import { categoryLabel } from '@/features/data-hub';
import { directionLabel, indicatorCoverageText, unavailableReason, type IndicatorOption } from './labModel';
import styles from './PriorityLab.module.css';
import { t } from '@/lib/i18n';

interface IndicatorPickerProps {
  readonly options: readonly IndicatorOption[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string, next: boolean) => void;
  /** Lab limit, so the sliders stay readable. */
  readonly maxSelected: number;
}

/**
 * Chooses the criteria. Indicators without data in this mode stay visible but cannot be chosen, and
 * say why; each one names its source, year, unit, direction and how many regions have a value. The
 * list floats over the panel and scrolls, so opening it makes no card longer; a press outside or
 * Escape closes it.
 */
export function IndicatorPicker({ options, selected, onToggle, maxSelected }: IndicatorPickerProps) {
  // An indicator no region has data for is no choice at all, unless a scenario already carries it.
  const listed = options.filter((option) => option.availability !== 'empty' || selected.has(option.id));
  const categories = [...new Set(listed.map((option) => option.category))];
  const availableCount = options.filter((option) => option.availability === 'available').length;
  const full = selected.size >= maxSelected;
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      if (pickerRef.current) pickerRef.current.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      pickerRef.current?.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={pickerRef}
      className={styles.picker}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary>
        <span className="kk-body-strong">
          <span aria-hidden="true">+ </span>
          {t('Tambah kriteria')}
        </span>
        <span className={`kk-small ${styles.muted}`}>
          {t('{0} dipilih dari {1} indikator berdata', selected.size, availableCount)}
        </span>
      </summary>
      <div className={styles.pickerList}>
        {full && (
          <p className={`kk-small ${styles.muted}`}>
            {t('Paling banyak {0} kriteria. Lepas salah satu untuk memilih yang lain.', maxSelected)}
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
                                {option.agency ?? t('Sumber tidak disebutkan')}
                                {option.referenceYear !== null && ` ${String(option.referenceYear)}`}
                                {t(', satuan {0}. {1}', option.unit, directionLabel(option.polarity))}
                                {indicatorCoverageText(option) !== null &&
                                  t('. Data untuk {0}', indicatorCoverageText(option) ?? '')}
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
      </div>
    </details>
  );
}
