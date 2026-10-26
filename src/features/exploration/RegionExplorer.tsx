import { useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { TextField } from '@/components/ui/TextField/TextField';
import { ResourceView, adminLevelLabel, useDataHub, useDataHubResource } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminLevel } from '@/services/api';
import { useRegionBrowserParams } from './regionCode';
import styles from './RegionExplorer.module.css';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 30;

type LevelFilter = AdminLevel | 'ALL';
const LEVEL_FILTERS: readonly { readonly value: LevelFilter; readonly label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'REGENCY', label: 'Kabupaten' },
  { value: 'CITY', label: 'Kota' },
];

interface RegionExplorerProps {
  /** Render without its own card, for use inside the side panel. */
  readonly bare?: boolean;
  /** Receives the chosen region and its name; defaults to writing `?kode=` only. */
  readonly onSelect?: ((code: string, name: string) => void) | undefined;
  /**
   * A region is already open below: show only the search field until something is typed, then the
   * filters and results; picking one clears the search so the new profile comes into view.
   */
  readonly compact?: boolean;
}

/** Jelajahi's region search: debounced, abortable and driven by the real Data Hub region list. */
export function RegionExplorer({ bare = false, onSelect, compact = false }: RegionExplorerProps) {
  const { dataMode } = useDataHub();
  const { query, selectedCode, setQuery, selectCode } = useRegionBrowserParams();
  const choose =
    onSelect ??
    ((code: string) => {
      selectCode(code, { clearQuery: compact });
    });
  const showResults = !compact || query.trim() !== '';
  const Frame = bare ? 'div' : Surface;
  const frameProps = bare ? { className: styles.bare } : { radius: 'card' as const, className: styles.panel };
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const searchKey = `${debouncedQuery}|${level}`;

  const regions = useDataHubResource(searchKey, (repository, dataMode, signal) =>
    repository.searchRegions({
      dataMode,
      query: debouncedQuery,
      adminLevel: level === 'ALL' ? undefined : level,
      signal,
    }),
  );

  // Showing more is tied to the search it was asked for; a new search starts at one page again.
  const [expanded, setExpanded] = useState<{ readonly key: string; readonly count: number } | null>(null);
  // Province narrowing is made on the list already received (it names every region's province).
  const [province, setProvince] = useState('');
  const pageKey = `${searchKey}|${province}`;
  const visibleCount = expanded?.key === pageKey ? expanded.count : PAGE_SIZE;

  return (
    <Frame {...frameProps}>
      <h2 className={compact ? `kk-body-strong ${styles.compactHeading}` : 'kk-h3'}>
        {compact ? 'Cari wilayah lain' : 'Cari wilayah'}
      </h2>
      <TextField
        label="Cari kabupaten/kota"
        icon="search"
        type="search"
        value={query}
        placeholder="Ketik nama kabupaten/kota"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />

      {showResults && (
        <>
          <div role="group" aria-label="Jenis wilayah" className={styles.filters}>
            {LEVEL_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={styles.filter}
                aria-pressed={level === filter.value}
                onClick={() => {
                  setLevel(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <ResourceView state={regions.state} onRetry={regions.retry} loadingTitle="Mencari wilayah…">
            {(envelope) => {
              const allItems = envelope.data;
              const provinces = [
                ...new Set(allItems.map((region) => region.provinceName).filter((name) => name !== null)),
              ].sort((a, b) => a.localeCompare(b, 'id'));
              const activeProvince = provinces.includes(province) ? province : '';
              const items = activeProvince
                ? allItems.filter((region) => region.provinceName === activeProvince)
                : allItems;
              // The kabupaten/kota split is made on this side, so only the unfiltered list can use the
              // server's total; a filtered list is counted as received.
              const total =
                level === 'ALL' && !activeProvince
                  ? Math.max(envelope.meta.totalCount ?? 0, items.length)
                  : items.length;

              if (items.length === 0) {
                return (
                  <StatusMessage
                    kind="empty"
                    title={
                      dataMode === 'LIVE'
                        ? 'Tidak ada kabupaten/kota yang cocok'
                        : 'Tidak ada wilayah yang cocok pada dataset DEMO saat ini'
                    }
                    action={
                      query ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setQuery('');
                          }}
                        >
                          Hapus pencarian
                        </Button>
                      ) : undefined
                    }
                  >
                    {dataMode === 'LIVE'
                      ? 'Periksa ejaan atau coba sebagian nama, misalnya “Bogor”; ubah juga filter jenis wilayah bila perlu.'
                      : 'Nama wilayah pada dataset DEMO bersifat sintetis (misalnya “Kabupaten Demo Jabar 1”), jadi nama kabupaten/kota yang sebenarnya tidak akan ditemukan.'}
                  </StatusMessage>
                );
              }

              return (
                <>
                  {provinces.length > 1 && (
                    <label className={styles.province}>
                      <span className="kk-small">Provinsi</span>
                      <select
                        value={activeProvince}
                        onChange={(event) => {
                          setProvince(event.target.value);
                        }}
                      >
                        <option value="">Semua provinsi</option>
                        {provinces.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className={styles.summary}>
                    <p className="kk-small" role="status">
                      Menampilkan {Math.min(visibleCount, items.length)} dari {total} wilayah
                    </p>
                    {items.some((region) => region.isSyntheticDemoName) && (
                      <Chip tone="warning">Nama sintetis (DEMO), bukan nama resmi</Chip>
                    )}
                  </div>
                  <ul role="list" className={styles.list}>
                    {items.slice(0, visibleCount).map((region) => (
                      <li key={region.regionId}>
                        <button
                          type="button"
                          className={styles.region}
                          aria-pressed={region.regionId === selectedCode}
                          onClick={() => {
                            choose(region.regionId, region.displayName);
                          }}
                        >
                          <span className="kk-body-strong">{region.displayName}</span>
                          <span className={`kk-small ${styles.regionMeta}`}>
                            {adminLevelLabel(region.adminLevel)} ·{' '}
                            {region.provinceName ?? 'provinsi tidak diketahui'} · kode {region.regionId}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {visibleCount < items.length && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setExpanded({ key: pageKey, count: visibleCount + PAGE_SIZE });
                      }}
                    >
                      Tampilkan {Math.min(PAGE_SIZE, items.length - visibleCount)} lagi
                    </Button>
                  )}
                </>
              );
            }}
          </ResourceView>
        </>
      )}
    </Frame>
  );
}
