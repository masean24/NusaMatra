import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { TextField } from '@/components/ui/TextField/TextField';
import { ResourceView, adminLevelLabel, useDataHubResource } from '@/features/data-hub';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import styles from './RegionPicker.module.css';
import { t } from '@/lib/i18n';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

interface RegionPickerProps {
  /** "Wilayah A" / "Wilayah B": the name of the slot, also its accessible label. */
  readonly slot: string;
  readonly selectedCode: string | null;
  readonly onSelect: (code: string | null) => void;
  /** The region already chosen in the other slot; it is not offered again. */
  readonly excludeCode?: string | null;
}

/** Picks one Data Hub region by searching the real region list; the choice lives in the page URL. */
export function RegionPicker({ slot, selectedCode, onSelect, excludeCode = null }: RegionPickerProps) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = selectedCode === null && debounced.length > 0;

  const results = useDataHubResource(
    `picker|${debounced}`,
    (repository, dataMode, signal) => repository.searchRegions({ dataMode, query: debounced, signal }),
    isSearching,
  );
  const selected = useDataHubResource(
    `picked|${selectedCode ?? ''}`,
    (repository, dataMode, signal) =>
      repository.getRegionDetail({ dataMode, regionId: selectedCode ?? '', signal }),
    selectedCode !== null,
  );

  return (
    <Surface radius="card" className={styles.picker}>
      {selectedCode === null ? (
        // The suggestions float under the field (as on the home page) instead of growing the card.
        <div className={styles.searchBox}>
          <TextField
            glass
            label={t('Cari {0}', slot)}
            icon="search"
            type="search"
            value={query}
            placeholder={t('Ketik nama kabupaten/kota')}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {isSearching && (
            <div className={styles.popup}>
              <ResourceView
                state={results.state}
                onRetry={results.retry}
                loadingTitle={t('Mencari wilayah…')}
              >
                {(envelope) => {
                  const candidates = envelope.data.filter(
                    (region) =>
                      (region.adminLevel === 'REGENCY' || region.adminLevel === 'CITY') &&
                      region.regionId !== excludeCode,
                  );
                  return candidates.length === 0 ? (
                    <p className="kk-small" role="status">
                      {t(
                        'Tidak ada kabupaten/kota yang cocok dengan “{0}”{1}.',
                        debounced,
                        excludeCode
                          ? t(' (wilayah yang sudah dipilih di slot lain tidak ditawarkan lagi)')
                          : '',
                      )}
                    </p>
                  ) : (
                    <ul
                      role="list"
                      className={styles.suggestions}
                      aria-label={t('Hasil pencarian {0}', slot)}
                    >
                      {candidates.slice(0, MAX_SUGGESTIONS).map((region) => (
                        <li key={region.regionId}>
                          <button
                            type="button"
                            className={styles.suggestion}
                            // The list is shown only while focus is inside the search box. iOS Safari
                            // does not focus a tapped button, so the field's blur would hide the list
                            // before the tap's click arrives; keeping focus in the field lets it land
                            // (as the home page search does).
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              setQuery('');
                              onSelect(region.regionId);
                            }}
                          >
                            <span className="kk-body-strong">{region.displayName}</span>
                            <span className="kk-small">
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
                  );
                }}
              </ResourceView>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.chosen}>
          <div>
            <p className={`kk-small ${styles.slot}`}>{slot}</p>
            <ResourceView state={selected.state} onRetry={selected.retry} loadingTitle={t('Memuat wilayah…')}>
              {(envelope) => (
                <>
                  <p className="kk-h3">{envelope.data.region.displayName}</p>
                  <p className={`kk-small ${styles.slot}`}>
                    {t(
                      '{0}, kode {1}',
                      envelope.data.region.provinceName ?? t('provinsi tidak diketahui'),
                      envelope.data.region.regionId,
                    )}
                  </p>
                </>
              )}
            </ResourceView>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              onSelect(null);
            }}
          >
            {t('Ganti {0}', slot)}
          </Button>
        </div>
      )}
    </Surface>
  );
}
