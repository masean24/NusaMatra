import { useEffect, useId, useRef, useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { GlassSelect } from '@/components/ui/GlassSelect/GlassSelect';
import { Surface } from '@/components/ui/Surface/Surface';
import { TextField } from '@/components/ui/TextField/TextField';
import { ResourceView, adminLevelLabel, useDataHub, useDataHubResource } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AdminLevel } from '@/services/api';
import { useRegionBrowserParams } from './regionCode';
import styles from './RegionExplorer.module.css';
import { localized, t } from '@/lib/i18n';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 30;

type LevelFilter = AdminLevel | 'ALL';
const LEVEL_FILTERS = localized((): readonly { readonly value: LevelFilter; readonly label: string }[] => [
  { value: 'ALL', label: t('Semua') },
  { value: 'REGENCY', label: t('Kabupaten') },
  { value: 'CITY', label: t('Kota') },
]);

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
  /** The field lives elsewhere (the map's header on a phone); this shows the filters and results. */
  readonly fieldless?: boolean;
}

/** Jelajahi's region search: debounced, abortable and driven by the real Data Hub region list. */
export function RegionExplorer({
  bare = false,
  onSelect,
  compact = false,
  fieldless = false,
}: RegionExplorerProps) {
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
  const provinceLabelId = useId();
  const pageKey = `${searchKey}|${province}`;
  const visibleCount = expanded?.key === pageKey ? expanded.count : PAGE_SIZE;

  /*
   * After "Tampilkan 30 lagi" the new rows are added below the last one, where the list's own
   * scroll (or the sheet's) leaves them out of sight, so the button seemed to do nothing. Focus goes
   * to the first new region instead: the browser scrolls it into view, and a keyboard or screen
   * reader user continues from there rather than from a button that moved further down.
   */
  const listRef = useRef<HTMLUListElement>(null);
  const focusFromRef = useRef<number | null>(null);
  useEffect(() => {
    const from = focusFromRef.current;
    if (from === null) return;
    focusFromRef.current = null;
    listRef.current?.querySelectorAll<HTMLButtonElement>(':scope > li > button')[from]?.focus();
  }, [visibleCount]);

  if (fieldless && !showResults) return null;

  return (
    <Frame {...frameProps}>
      {fieldless ? (
        <h2 className="visually-hidden">{t('Daftar wilayah')}</h2>
      ) : (
        <>
          <h2 className={compact ? `kk-body-strong ${styles.compactHeading}` : 'kk-h3'}>
            {compact ? t('Cari wilayah lain') : t('Cari wilayah')}
          </h2>
          <TextField
            glass
            label={t('Cari kabupaten/kota')}
            icon="search"
            type="search"
            value={query}
            placeholder={t('Ketik nama kabupaten/kota')}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </>
      )}

      {showResults && (
        <>
          <div role="group" aria-label={t('Jenis wilayah')} className="glass-seg">
            {LEVEL_FILTERS().map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={level === filter.value}
                onClick={() => {
                  setLevel(filter.value);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <ResourceView state={regions.state} onRetry={regions.retry} loadingTitle={t('Mencari wilayah…')}>
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
                        ? t('Tidak ada kabupaten/kota yang cocok')
                        : t('Tidak ada wilayah yang cocok pada dataset DEMO saat ini')
                    }
                    action={
                      query ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setQuery('');
                          }}
                        >
                          {t('Hapus pencarian')}
                        </Button>
                      ) : undefined
                    }
                  >
                    {dataMode === 'LIVE'
                      ? t(
                          'Periksa ejaan atau coba sebagian nama, misalnya “Bogor”; ubah juga filter jenis wilayah bila perlu.',
                        )
                      : t(
                          'Nama wilayah pada dataset DEMO bersifat sintetis (misalnya “Kabupaten Demo Jabar 1”), jadi nama kabupaten/kota yang sebenarnya tidak akan ditemukan.',
                        )}
                  </StatusMessage>
                );
              }

              return (
                <>
                  {provinces.length > 1 && (
                    <div className={styles.province}>
                      <span id={provinceLabelId} className="kk-small">
                        {t('Provinsi')}
                      </span>
                      <GlassSelect
                        labelledBy={provinceLabelId}
                        value={activeProvince}
                        options={[
                          { value: '', label: t('Semua provinsi') },
                          ...provinces.map((name) => ({ value: name, label: name })),
                        ]}
                        onChange={setProvince}
                      />
                    </div>
                  )}
                  <div className={styles.summary}>
                    <p className="kk-small" role="status">
                      {t('Menampilkan')} {Math.min(visibleCount, items.length)} {t('dari {0} wilayah', total)}
                    </p>
                    {items.some((region) => region.isSyntheticDemoName) && (
                      <Chip tone="warning">{t('Nama sintetis (DEMO), bukan nama resmi')}</Chip>
                    )}
                  </div>
                  <ul ref={listRef} role="list" className={`glass-group ${styles.list}`}>
                    {items.slice(0, visibleCount).map((region) => (
                      <li key={region.regionId}>
                        <button
                          type="button"
                          className={`glass-row ${styles.region}`}
                          aria-pressed={region.regionId === selectedCode}
                          onClick={() => {
                            choose(region.regionId, region.displayName);
                          }}
                        >
                          <span className="kk-body-strong">{region.displayName}</span>
                          <span className={`kk-small ${styles.regionMeta}`}>
                            {t(
                              '{0} di {1}, kode {2}',
                              adminLevelLabel(region.adminLevel),
                              region.provinceName ?? t('provinsi tidak diketahui'),
                              region.regionId,
                            )}
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
                        focusFromRef.current = visibleCount;
                      }}
                    >
                      {t('Tampilkan {0} lagi', Math.min(PAGE_SIZE, items.length - visibleCount))}
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
