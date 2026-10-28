import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button/Button';
import { GlassSelect } from '@/components/ui/GlassSelect/GlassSelect';
import { TOTAL_BASIS_POINTS, addCriterion, removeCriterion, type WeightsBps } from '@/domain/prioritization';
import { ResourceView, useDataHub, useDataHubResource, type ResourceState } from '@/features/data-hub';
import type { CompositePresetsDTO, DataHubRegionDTO } from '@/services/api';
import { AnalysisPanel } from './AnalysisPanel';
import { IndicatorPicker } from './IndicatorPicker';
import { SERIES_COUNT } from './LabCharts';
import { ScenarioPicker, WeightSliders } from './WeightControls';
import { weightsKey } from './criteria';
import { buildIndicatorOptions, provinceOptions, startingWeights, type IndicatorOption } from './labModel';
import styles from './PriorityLab.module.css';

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
  // The ranking is recalculated only on "Hitung ulang peringkat", never while a slider moves.
  const [appliedWeights, setAppliedWeights] = useState<Weights>(start.weights);
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const changed = weightsKey(weights) !== weightsKey(appliedWeights);
  const canRecompute = changed && total === TOTAL_BASIS_POINTS && Object.keys(weights).length > 0;
  const recompute = () => {
    if (canRecompute) setAppliedWeights(weights);
  };
  const provinceFieldId = useId();
  const settingsBodyId = useId();
  // One column: the settings start folded, so the result is not below every slider.
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // `?skenario=<preset id>` (the landing's focus chooser) starts the Lab on that Data Hub preset,
  // once, as soon as the presets have loaded; an unknown id leaves the default weights.
  const [searchParams] = useSearchParams();
  const presetFromLink = useRef(searchParams.get('skenario'));
  const applyPresetFromLink = useEffectEvent((loaded: CompositePresetsDTO) => {
    const wanted = presetFromLink.current;
    presetFromLink.current = null;
    const preset = loaded.presets.find((entry) => entry.presetId === wanted);
    if (!preset) return;
    const next = { ...preset.weightsBasisPoints };
    changeWeights(next);
    setAppliedWeights(next);
  });
  useEffect(() => {
    if (presets.state.status === 'success' && presetFromLink.current)
      applyPresetFromLink(presets.state.data.data);
  }, [presets.state]);

  const controls = (
    <aside
      className={`glass glass--read ${styles.config}`}
      aria-label="Pengaturan"
      data-collapsed={settingsOpen ? undefined : true}
    >
      {/* One column only (hidden by CSS on desktop, where the panel is always open). */}
      <button
        type="button"
        className={styles.configToggle}
        aria-expanded={settingsOpen}
        aria-controls={settingsBodyId}
        onClick={() => {
          setSettingsOpen((open) => !open);
        }}
      >
        Atur prioritas
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <h2 className={styles.panelTitle}>Pengaturan</h2>
      <div id={settingsBodyId} className={styles.configBody}>
        <ScenarioPicker
          weights={weights}
          presets={presets.state.status === 'success' ? presets.state.data.data.presets : null}
          note={presetsNote(presets.state)}
          onApply={changeWeights}
        />
        <WeightSliders weights={weights} options={options} onChange={changeWeights} seriesOf={seriesOf}>
          {start.dropped.length > 0 && (
            <p className={styles.hint}>
              Kriteria awal tanpa data tidak dipakai: {start.dropped.join(', ')}. Tidak ada pengganti
              otomatis.
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
        </WeightSliders>
        {provinces.length > 0 && (
          <section className={styles.configSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.stepNumber} aria-hidden="true">
                3
              </span>
              <span id={provinceFieldId}>Cakupan wilayah</span>
            </div>
            <GlassSelect
              labelledBy={provinceFieldId}
              value={provinceId ?? ''}
              options={[
                { value: '', label: 'Seluruh Indonesia' },
                ...provinces.map((province) => ({
                  value: province.id,
                  label: province.name,
                  detail: `${String(province.regionCount)} kab/kota`,
                })),
              ]}
              onChange={(next) => {
                setProvinceId(next === '' ? null : next);
              }}
            />
          </section>
        )}
        {regions === null && registry.state.status === 'error' && (
          <p className={styles.hint}>
            Daftar wilayah tidak dapat dimuat: peringkat tetap dihitung, tetapi wilayah yang tidak ikut tidak
            dapat dicantumkan.
          </p>
        )}
        <div className={styles.configActions}>
          <Button variant="accent" disabled={!canRecompute} onClick={recompute}>
            Hitung ulang peringkat
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              changeWeights(start.weights);
            }}
          >
            Atur ulang bobot
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className={styles.lab}>
      <AnalysisPanel
        weights={appliedWeights}
        stale={changed}
        canRecompute={canRecompute}
        onRecompute={recompute}
        provinceId={provinceId}
        registry={regions ?? []}
        options={options}
        presets={presets.state.status === 'success' ? presets.state.data.data.presets : null}
        labelOf={labelOf}
        seriesOf={seriesOf}
        controls={controls}
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
      `${String(rejectedCount)} skenario dari Data Hub tidak ditampilkan karena bobot atau keterangan ketersediaannya tidak sesuai kontrak.`,
    );
  }
  if (presets.some((preset) => preset.availability?.rankable === false)) {
    notes.push(
      'Skenario bertanda “belum dapat diperingkat” tetap bisa dipilih untuk melihat bobotnya, tetapi peringkatnya tidak ditampilkan.',
    );
  }
  return notes.length > 0 ? notes.join(' ') : null;
}
