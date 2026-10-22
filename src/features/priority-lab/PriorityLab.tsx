import { useId, useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Surface } from '@/components/ui/Surface/Surface';
import { addCriterion, removeCriterion, type WeightsBps } from '@/domain/prioritization';
import { ResourceView, useDataHub, useDataHubResource, type ResourceState } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { CompositePresetsDTO, DataHubRegionDTO } from '@/services/api';
import { IndicatorPicker } from './IndicatorPicker';
import { RankingResults } from './RankingResults';
import { WeightControls } from './WeightControls';
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

function Workbench({ options }: { readonly options: readonly IndicatorOption[] }) {
  const { dataMode } = useDataHub();
  const [start] = useState(() => startingWeights(dataMode, options));
  const [weights, setWeights] = useState<Weights>(start.weights);
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const settledWeights = useDebouncedValue(weights, RECOMPUTE_DEBOUNCE_MS);
  const isSettling = settledWeights !== weights;
  const provinceFieldId = useId();

  const presets = useDataHubResource('presets', (repository, mode, signal) =>
    repository.getCompositePresets({ dataMode: mode, signal }),
  );
  const registry = useDataHubResource('registry', (repository, mode, signal) =>
    repository.searchRegions({ dataMode: mode, query: '', signal }),
  );
  const regions: readonly DataHubRegionDTO[] | null =
    registry.state.status === 'success' ? registry.state.data.data : null;
  const provinces = regions ? provinceOptions(regions) : [];

  return (
    <div className={styles.lab}>
      <Surface radius="card" className={styles.panel}>
        <h2 className="kk-h3">Atur prioritas</h2>
        <p className={`kk-small ${styles.muted}`}>
          Pilih kriteria yang penting bagi Anda dan tentukan seberapa besar pengaruhnya. Data Hub menghitung
          peringkatnya dari data resmi; halaman ini memeriksa dan menjelaskan hasilnya.
        </p>
        {start.dropped.length > 0 && (
          <p className={`kk-small ${styles.unavailable}`}>
            Kriteria awal tanpa data tidak dipakai: {start.dropped.join(', ')}. Tidak ada kriteria pengganti
            yang dipilih otomatis.
          </p>
        )}

        <IndicatorPicker
          options={options}
          selected={new Set(Object.keys(weights))}
          maxSelected={MAX_CRITERIA}
          onToggle={(id, next) => {
            setWeights((current) => (next ? addCriterion(current, id) : removeCriterion(current, id)));
          }}
        />

        <WeightControls
          weights={weights}
          options={options}
          onChange={setWeights}
          onReset={() => {
            setWeights(start.weights);
          }}
          presets={presets.state.status === 'success' ? presets.state.data.data.presets : null}
          presetsNote={presetsNote(presets.state)}
        />

        {provinces.length > 0 && (
          <div className={styles.province}>
            <label htmlFor={provinceFieldId} className="kk-body">
              Cakupan wilayah
            </label>
            <select
              id={provinceFieldId}
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
          </div>
        )}
      </Surface>

      {regions === null && registry.state.status === 'error' && (
        <StatusMessage kind="unavailable" title="Daftar wilayah tidak dapat dimuat">
          Peringkat tetap dihitung, tetapi wilayah yang tidak ikut dihitung tidak dapat dicantumkan.
        </StatusMessage>
      )}
      <RankingResults
        weights={settledWeights}
        isSettling={isSettling}
        provinceId={provinceId}
        registry={regions ?? []}
        options={options}
      />
    </div>
  );
}

function presetsNote(state: ResourceState<{ readonly data: CompositePresetsDTO }>): string | null {
  if (state.status === 'error')
    return 'Skenario siap pakai dari Data Hub tidak dapat dimuat; bobot tetap bisa diatur sendiri.';
  if (state.status !== 'success') return null;
  const { presets, rejectedCount } = state.data.data;
  const notes: string[] = [];
  if (presets.length > 0)
    notes.push('Skenario siap pakai disediakan Data Hub sebagai titik awal, bukan rekomendasi resmi.');
  if (rejectedCount > 0) {
    notes.push(
      `${String(rejectedCount)} skenario dari Data Hub tidak ditampilkan karena bobotnya tidak tepat 100%.`,
    );
  }
  return notes.length > 0 ? notes.join(' ') : null;
}
