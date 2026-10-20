import { useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { TextField } from '@/components/ui/TextField/TextField';
import { ResourceView, adminLevelLabel, useDataHubResource } from '@/features/data-hub';
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

/** Jelajahi's region search: debounced, abortable and driven by the real Data Hub region list. */
export function RegionExplorer() {
  const { query, selectedCode, setQuery, selectCode } = useRegionBrowserParams();
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
  const visibleCount = expanded?.key === searchKey ? expanded.count : PAGE_SIZE;

  return (
    <Surface radius="card" className={styles.panel}>
      <h2 className="kk-h3">Cari wilayah</h2>
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
          const items = envelope.data;
          // The kabupaten/kota split is made on this side, so only the unfiltered list can use the
          // server's total; a filtered list is counted as received.
          const total =
            level === 'ALL' ? Math.max(envelope.meta.totalCount ?? 0, items.length) : items.length;

          if (items.length === 0) {
            return (
              <StatusMessage
                kind="empty"
                title="Tidak ada wilayah yang cocok pada dataset DEMO saat ini"
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
                Nama wilayah pada dataset DEMO bersifat sintetis (misalnya “Kabupaten Demo Jabar 1”), jadi
                nama kabupaten/kota yang sebenarnya tidak akan ditemukan.
              </StatusMessage>
            );
          }

          return (
            <>
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
                        selectCode(region.regionId);
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
                    setExpanded({ key: searchKey, count: visibleCount + PAGE_SIZE });
                  }}
                >
                  Tampilkan {Math.min(PAGE_SIZE, items.length - visibleCount)} lagi
                </Button>
              )}
            </>
          );
        }}
      </ResourceView>
    </Surface>
  );
}
