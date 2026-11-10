import { useMemo, useState, type CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { useDataHubResource } from '@/features/data-hub';
import { Reveal } from '@/features/motion';
import { useDisplayMode } from '@/features/theme';
import type { CompositePresetDTO } from '@/services/api';
import { SERIES_HEX, seriesRgb } from '../components/seriesPalette';
import { WeightDonut } from '../components/WeightDonut';
import styles from './LabPreviewSection.module.css';
import { locale, t } from '@/lib/i18n';

interface FocusInputs {
  readonly presets: readonly CompositePresetDTO[];
  /** Indicator id → its Indonesian name from the Data Hub catalog. */
  readonly names: ReadonlyMap<string, string>;
}

const percent = (basisPoints: number) =>
  `${(basisPoints / 100).toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

/**
 * The weights the preset really uses, largest first: an indicator without national data is left out and
 * its weight shared in proportion among the others, as the Data Hub does when it calculates.
 */
function weightRows(preset: CompositePresetDTO, names: ReadonlyMap<string, string>) {
  const unavailable = new Set(preset.availability?.unavailableIndicators ?? []);
  const used = Object.entries(preset.weightsBasisPoints).filter(
    ([id, bps]) => bps > 0 && !unavailable.has(id),
  );
  const total = used.reduce((sum, [, bps]) => sum + bps, 0);
  return used
    .sort(([, a], [, b]) => b - a)
    .map(([id, bps]) => ({ id, name: names.get(id) ?? id, bps: (bps * 10_000) / total }));
}

type WeightRow = ReturnType<typeof weightRows>[number];

/**
 * One focus: its name, its weights as the ring's legend (each row in its slice's colour, with a bar)
 * and what its largest weight means. The `live` panel is the one shown: its rows bring their slice
 * forward under the pointer or keyboard focus. The others only reserve their height, hidden.
 */
function FocusPanel({
  preset,
  rows,
  live = false,
  activeId = null,
  onActive,
  colours,
}: {
  readonly preset: CompositePresetDTO;
  readonly rows: readonly WeightRow[];
  readonly live?: boolean;
  readonly activeId?: string | null;
  readonly onActive?: (id: string | null) => void;
  /** The series colours, in the order of the rows (the ring's slices use the same). */
  readonly colours: readonly string[];
}) {
  const top = rows[0];
  return (
    <div
      className={styles.focusBody}
      data-sizer={live ? undefined : true}
      aria-live={live ? 'polite' : undefined}
      aria-hidden={live ? undefined : true}
    >
      <p className={`kk-body-strong ${styles.presetTitle}`}>{preset.label}</p>
      <ul
        role="list"
        className={styles.weights}
        aria-label={t('Bobot fokus {0}', preset.label)}
        onPointerLeave={() => onActive?.(null)}
      >
        {rows.map((row, index) => (
          <li
            // Keyed by place, not indicator: on a new focus each row stays and its bar glides to the
            // new length and colour, in step with the ring.
            key={index}
            className={styles.weight}
            data-active={row.id === activeId || undefined}
            style={
              {
                '--bar-fill': row.bps / 10000,
                '--row-colour': colours[index] ?? colours[colours.length - 1],
              } as CSSProperties
            }
            onPointerEnter={() => onActive?.(row.id)}
          >
            <button
              type="button"
              className={styles.weightButton}
              tabIndex={live ? undefined : -1}
              aria-pressed={live ? row.id === activeId : undefined}
              onFocus={() => onActive?.(row.id)}
              onBlur={() => onActive?.(null)}
              onClick={() => onActive?.(row.id)}
            >
              <span className={styles.weightHeader}>
                <span className={styles.weightName}>
                  <span className={styles.swatch} aria-hidden="true" />
                  {row.name}
                </span>
                <span className={`kk-number ${styles.percent}`}>{percent(row.bps)}</span>
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.bar} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {top && (
        <p className={`kk-small ${styles.explain}`}>
          {t(
            '{0} mendapat bobot terbesar ({1}). Di Lab Prioritas, bobot ini dipakai untuk mengurutkan kabupaten/kota, dan setiap skor bisa diurai menjadi sumbangan tiap indikator.',
            top.name,
            percent(top.bps),
          )}
        </p>
      )}
    </div>
  );
}

/**
 * "Bagaimana pilihanmu mengubah prioritas wilayah?": the visitor picks a
 * development focus, which is one of the Data Hub's own composite presets, and sees the weights it
 * puts on each indicator, as a ring and as its legend rows in the same colours; pointing at a slice
 * or a row (or reaching a row by keyboard) brings that weight forward. The button opens the Lab with that
 * preset, where the ranking is actually calculated. Nothing here is invented: the presets, names and
 * weights come from the Data Hub, and when it cannot be reached the section says so.
 */
export function LabPreviewSection() {
  const inputs = useDataHubResource('landing-focus', async (repository, dataMode, signal) => {
    const [presets, catalog] = await Promise.all([
      repository.getCompositePresets({ dataMode, signal }),
      repository.getIndicatorCatalog({ dataMode, signal }),
    ]);
    const names = new Map(catalog.data.items.map((item) => [item.indicatorId, item.labelId] as const));
    return { presets: presets.data.presets, names } satisfies FocusInputs;
  });
  const [chosenId, setChosenId] = useState<string | null>(null);
  // The weight in focus (pointer or keyboard); none = the largest, shown in the ring's centre.
  const [activeId, setActiveId] = useState<string | null>(null);

  const loaded = inputs.state.status === 'success' ? inputs.state.data : null;
  const preset = loaded
    ? (loaded.presets.find((item) => item.presetId === chosenId) ?? loaded.presets[0])
    : null;
  // Kept between renders, so only a new focus (not an unrelated re-render) starts the ring's glide.
  const rows = useMemo(() => (preset && loaded ? weightRows(preset, loaded.names) : []), [preset, loaded]);
  // One palette for the ring and its legend, in the active display mode.
  const { mode } = useDisplayMode();
  const palette = useMemo(() => seriesRgb(mode), [mode]);
  const colours = SERIES_HEX[mode];

  return (
    <section id="lab-prioritas" className={styles.section} aria-labelledby="lab-title">
      <Reveal className={`glass ${styles.band}`} distance={0} fromScale={0.96} duration={700}>
        <div className={styles.visual}>
          {rows.length > 0 ? (
            <WeightDonut
              slices={rows}
              activeId={activeId}
              onActive={setActiveId}
              formatShare={percent}
              palette={palette}
              centreLabel={t(
                'Diagram cincin bobot fokus yang dipilih: {0}.',
                rows.map((row) => `${row.name} ${percent(row.bps)}`).join(', '),
              )}
            />
          ) : (
            <div className={styles.donutPlaceholder} aria-hidden="true" />
          )}
        </div>
        <div className={styles.content}>
          <p className={`kk-small ${styles.eyebrow}`}>{t('Lab Prioritas')}</p>
          <h2 id="lab-title" className={`kk-h1 ${styles.title}`}>
            {t('Bagaimana pilihanmu mengubah prioritas wilayah?')}
          </h2>
          <p className={`kk-body ${styles.lead}`}>
            {t('Pilih fokus pembangunan untuk melihat bobot yang diberikan pada tiap indikator.')}
          </p>

          {inputs.state.status === 'error' ? (
            <div className={styles.problem} role="alert">
              <p className="kk-small">{t('Pilihan fokus tidak dapat dimuat dari Data Hub saat ini.')}</p>
              <button type="button" className="glass-btn" onClick={inputs.retry}>
                {t('Coba lagi')}
              </button>
            </div>
          ) : !loaded || !preset ? (
            <div className={styles.skeleton} aria-busy="true" aria-label={t('Memuat pilihan fokus')}>
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              <div className={`glass-seg ${styles.focus}`} role="group" aria-label={t('Fokus pembangunan')}>
                {loaded.presets.map((item) => (
                  <button
                    key={item.presetId}
                    type="button"
                    aria-pressed={item.presetId === preset.presetId}
                    onClick={() => {
                      setChosenId(item.presetId);
                      setActiveId(null);
                    }}
                  >
                    {item.targetFocus ?? item.label}
                  </button>
                ))}
              </div>

              {/*
               * The card keeps one size whichever focus is chosen: every focus is also laid out,
               * invisibly, in the same grid cell, so the cell is as tall as the tallest one and only
               * the content changes.
               */}
              <div className={styles.focusStack}>
                <FocusPanel
                  preset={preset}
                  rows={rows}
                  live
                  activeId={activeId}
                  onActive={setActiveId}
                  colours={colours}
                />
                {loaded.presets.map((item) => (
                  <FocusPanel
                    key={item.presetId}
                    preset={item}
                    rows={weightRows(item, loaded.names)}
                    colours={colours}
                  />
                ))}
              </div>
            </>
          )}

          <div className={styles.actions}>
            <ButtonLink
              to={
                preset ? `/lab-prioritas?skenario=${encodeURIComponent(preset.presetId)}` : '/lab-prioritas'
              }
            >
              {t('Coba di Lab Prioritas')}
            </ButtonLink>
            <ButtonLink to="/metodologi" variant="secondary">
              {t('Cara skor dihitung')}
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
