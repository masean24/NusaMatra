import { useState, type CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { useDataHubResource } from '@/features/data-hub';
import { Reveal } from '@/features/motion';
import type { CompositePresetDTO } from '@/services/api';
import { SceneZone } from '../scene3d/SceneZone';
import styles from './LabPreviewSection.module.css';

interface FocusInputs {
  readonly presets: readonly CompositePresetDTO[];
  /** Indicator id → its Indonesian name from the Data Hub catalog. */
  readonly names: ReadonlyMap<string, string>;
}

const percent = (basisPoints: number) =>
  `${(basisPoints / 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

/** The preset's weights, largest first, with the indicators the Data Hub has no data for. */
function weightRows(preset: CompositePresetDTO, names: ReadonlyMap<string, string>) {
  const unavailable = new Set(preset.availability?.unavailableIndicators ?? []);
  return Object.entries(preset.weightsBasisPoints)
    .filter(([, bps]) => bps > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([id, bps]) => ({ id, name: names.get(id) ?? id, bps, unavailable: unavailable.has(id) }));
}

/**
 * "Bagaimana pilihanmu mengubah prioritas wilayah?" (owner revision 2026-10-27): the visitor picks a
 * development focus, which is one of the Data Hub's own composite presets, and sees the weights it
 * puts on each indicator; the 3D columns follow the same weights. The button opens the Lab with that
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

  const loaded = inputs.state.status === 'success' ? inputs.state.data : null;
  const preset = loaded
    ? (loaded.presets.find((item) => item.presetId === chosenId) ?? loaded.presets[0])
    : null;
  const rows = preset && loaded ? weightRows(preset, loaded.names) : [];
  const top = rows[0];

  return (
    <section id="lab-prioritas" className={styles.section} aria-labelledby="lab-title">
      <Reveal className={`glass ${styles.band}`} distance={0} fromScale={0.96} duration={700}>
        <SceneZone
          kind="dataColumns"
          className={styles.visual}
          values={rows.map((row) => row.bps)}
          description={
            rows.length > 0
              ? `Kolom oranye di atas alas kapur; tinggi kolom mengikuti bobot fokus yang dipilih: ${rows
                  .map((row) => `${row.name} ${percent(row.bps)}`)
                  .join(', ')}.`
              : 'Kolom oranye di atas alas kapur; tingginya mengikuti bobot fokus yang dipilih.'
          }
        />
        <div className={styles.content}>
          <p className={`kk-small ${styles.eyebrow}`}>Lab Prioritas</p>
          <h2 id="lab-title" className={`kk-h1 ${styles.title}`}>
            Bagaimana pilihanmu mengubah prioritas wilayah?
          </h2>
          <p className={`kk-body ${styles.lead}`}>
            Pilih fokus pembangunan untuk melihat bobot yang diberikan pada tiap indikator.
          </p>

          {inputs.state.status === 'error' ? (
            <div className={styles.problem} role="alert">
              <p className="kk-small">Pilihan fokus tidak dapat dimuat dari Data Hub saat ini.</p>
              <button type="button" className="glass-btn" onClick={inputs.retry}>
                Coba lagi
              </button>
            </div>
          ) : !loaded || !preset ? (
            <div className={styles.skeleton} aria-busy="true" aria-label="Memuat pilihan fokus">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              <div className={`glass-seg ${styles.focus}`} role="group" aria-label="Fokus pembangunan">
                {loaded.presets.map((item) => (
                  <button
                    key={item.presetId}
                    type="button"
                    aria-pressed={item.presetId === preset.presetId}
                    onClick={() => {
                      setChosenId(item.presetId);
                    }}
                  >
                    {item.targetFocus ?? item.label}
                  </button>
                ))}
              </div>

              <div className={styles.focusBody} aria-live="polite">
                <p className={`kk-body-strong ${styles.presetTitle}`}>{preset.label}</p>
                <ul role="list" className={styles.weights} aria-label={`Bobot fokus ${preset.label}`}>
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className={styles.weight}
                      style={{ '--bar-fill': row.bps / 10000 } as CSSProperties}
                    >
                      <span className={styles.weightHeader}>
                        <span>{row.name}</span>
                        <span className={`kk-number ${styles.percent}`}>{percent(row.bps)}</span>
                      </span>
                      <span className={styles.track} aria-hidden="true">
                        <span className={styles.bar} />
                      </span>
                      {row.unavailable && (
                        <span className={`kk-caption ${styles.note}`}>
                          Belum ada data · bobotnya dialihkan ke indikator lain
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {top && (
                  <p className={`kk-small ${styles.explain}`}>
                    {top.name} mendapat bobot terbesar ({percent(top.bps)}). Di Lab Prioritas, bobot ini
                    dipakai untuk mengurutkan kabupaten/kota, dan setiap skor bisa diurai menjadi sumbangan
                    tiap indikator.
                  </p>
                )}
              </div>
            </>
          )}

          <div className={styles.actions}>
            <ButtonLink
              to={
                preset ? `/lab-prioritas?skenario=${encodeURIComponent(preset.presetId)}` : '/lab-prioritas'
              }
            >
              Coba di Lab Prioritas
            </ButtonLink>
            <ButtonLink to="/metodologi" variant="secondary">
              Cara skor dihitung
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
