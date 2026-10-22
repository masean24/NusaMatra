import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { addCriterion, removeCriterion, type WeightsBps } from '@/domain/prioritization';
import { ResourceView, useDataHub, useDataHubResource, type ResourceState } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { CompositePresetsDTO, DataHubRegionDTO } from '@/services/api';
import { AnalysisPanel } from './AnalysisPanel';
import { IndicatorPicker } from './IndicatorPicker';
import { SERIES_COUNT } from './LabCharts';
import { ScenarioPicker, WeightSliders } from './WeightControls';
import { buildIndicatorOptions, provinceOptions, startingWeights, type IndicatorOption } from './labModel';
import styles from './PriorityLab.module.css';

/** Waits this long after the last slider move before asking the Data Hub again. */
const RECOMPUTE_DEBOUNCE_MS = 400;
/** Enough criteria to express a policy, few enough that every slider stays meaningful. */
const MAX_CRITERIA = 8;

type Weights = WeightsBps<string>;

/**
 * Lab Prioritas: choose criteria, weigh them, and read the Data Hub's ranking with an explanation of
 * how it was calculated. The Data Hub calculates; this page validates and explains.
 */
export function PriorityLab() {
  const { dataMode } = useDataHub();
  // Each mode starts over, so weights or results never carry across DEMO and LIVE.
  return <LabInputs key={dataMode} />;
}

/**
 * The catalog and, in LIVE, the coverage matrix load as one resource: in LIVE the Lab cannot say
 * which criteria hold data without both, and one failure is one message.
 */
function LabInputs() {
  const inputs = useDataHubResource('lab-inputs', async (repository, dataMode, signal) => {
    const [catalog, coverage] = await Promise.all([
      repository.getIndicatorCatalog({ dataMode, signal }),
      dataMode === 'LIVE' ? repository.getIndicatorCoverage({ dataMode, signal }) : Promise.resolve(null),
    ]);
    return buildIndicatorOptions(catalog.data, coverage?.data ?? null);
  });

  return (
    <ResourceView
      state={inputs.state}
      onRetry={inputs.retry}
      loadingTitle="Memuat kriteria dan ketersediaan data…"
    >
      {(options) => <Workbench options={options} />}
    </ResourceView>
  );
}

/**
 * Settings on the left (scenario, weights, criteria, scope), the analysis on the right. On narrow
 * screens the two stack in the same order.
 */
function Workbench({ options }: { readonly options: readonly IndicatorOption[] }) {
  const { dataMode } = useDataHub();
  const [start] = useState(() => startingWeights(dataMode, options));
  const [weights, setWeights] = useState<Weights>(start.weights);
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const settledWeights = useDebouncedValue(weights, RECOMPUTE_DEBOUNCE_MS);
  const isSettling = settledWeights !== weights;
  const provinceFieldId = useId();
  // A criterion keeps its colour while it stays selected, across sliders and charts.
  const [series, setSeries] = useState<readonly string[]>(() => Object.keys(start.weights));

  const presets = useDataHubResource('presets', (repository, mode, signal) =>
    repository.getCompositePresets({ dataMode: mode, signal }),
  );
  const registry = useDataHubResource('registry', (repository, mode, signal) =>
    repository.searchRegions({ dataMode: mode, query: '', signal }),
  );
  const regions: readonly DataHubRegionDTO[] | null =
    registry.state.status === 'success' ? registry.state.data.data : null;
  const provinces = regions ? provinceOptions(regions) : [];

  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;
  const seriesOf = (id: string) => {
    const index = series.indexOf(id);
    return (index < 0 ? Object.keys(weights).indexOf(id) : index) % SERIES_COUNT;
  };
  const changeWeights = (next: Weights) => {
    setSeries((current) => {
      const kept = current.filter((id) => id in next);
      return [...kept, ...Object.keys(next).filter((id) => !kept.includes(id))];
    });
    setWeights(next);
  };

  return (
    <div className={styles.lab}>
      <aside className={`${styles.panel} ${styles.config}`} aria-label="Atur prioritas">
        <ScenarioPicker
          weights={weights}
          presets={presets.state.status === 'success' ? presets.state.data.data.presets : null}
          note={presetsNote(presets.state)}
          onApply={changeWeights}
        />
        <WeightSliders weights={weights} options={options} onChange={changeWeights} seriesOf={seriesOf} />
        {start.dropped.length > 0 && (
          <p className={styles.hint}>
            Kriteria awal tanpa data tidak dipakai: {start.dropped.join(', ')}. Tidak ada pengganti otomatis.
          </p>
        )}
        <IndicatorPicker
          options={options}
          selected={new Set(Object.keys(weights))}
          maxSelected={MAX_CRITERIA}
          onToggle={(id, next) => {
            changeWeights(next ? addCriterion(weights, id) : removeCriterion(weights, id));
          }}
        />
        {provinces.length > 0 && (
          <section className={styles.configSection}>
            <label htmlFor={provinceFieldId} className={styles.sectionTitle}>
              Cakupan wilayah
            </label>
            <select
              id={provinceFieldId}
              className={styles.input}
              value={provinceId ?? ''}
              onChange={(event) => {
                setProvinceId(event.target.value === '' ? null : event.target.value);
              }}
            >
              <option value="">Seluruh Indonesia</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name} ({province.regionCount} kab/kota)
                </option>
              ))}
            </select>
          </section>
        )}
        {regions === null && registry.state.status === 'error' && (
          <p className={styles.hint}>
            Daftar wilayah tidak dapat dimuat: peringkat tetap dihitung, tetapi wilayah yang tidak ikut tidak
            dapat dicantumkan.
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            changeWeights(start.weights);
          }}
        >
          Atur ulang bobot
        </Button>
      </aside>

      <AnalysisPanel
        chosen={weights}
        weights={settledWeights}
        isSettling={isSettling}
        provinceId={provinceId}
        registry={regions ?? []}
        options={options}
        labelOf={labelOf}
        seriesOf={seriesOf}
      />
    </div>
  );
}

function presetsNote(state: ResourceState<{ readonly data: CompositePresetsDTO }>): string | null {
  if (state.status === 'error')
    return 'Skenario dari Data Hub tidak dapat dimuat. Bobot tetap bisa diatur sendiri.';
  if (state.status !== 'success') return null;
  const { presets, rejectedCount } = state.data.data;
  const notes: string[] = [];
  if (presets.length > 0) notes.push('Titik awal dari Data Hub, bukan rekomendasi resmi.');
  if (rejectedCount > 0) {
    notes.push(
      `${String(rejectedCount)} skenario dari Data Hub tidak ditampilkan karena bobotnya tidak tepat 100%.`,
    );
  }
  return notes.length > 0 ? notes.join(' ') : null;
}
