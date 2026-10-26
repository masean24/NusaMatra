import { useId, useState, type KeyboardEvent, type ReactNode, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { TextField } from '@/components/ui/TextField/TextField';
import { adminLevelLabel } from '@/features/data-hub';
import type { DataHubRegionDTO } from '@/services/api';
import { normalizeRegionQuery, regionProfileHref, regionSearchHref } from './regionSearch';
import { SUGGESTION_MIN_LENGTH, useRegionSuggestions } from './useRegionSuggestions';
import styles from './RegionSearchForm.module.css';

interface RegionSearchFormProps {
  /** Visible placeholder text from Figma; the field also has a real (visually hidden) label. */
  readonly placeholder: string;
  /** Extra controls placed after the field, e.g. the CTA band's submit button. */
  readonly actions?: ReactNode;
  readonly className?: string | undefined;
  /** G11: one subtle shimmer to draw the eye; never repeats. */
  readonly shimmerOnce?: boolean;
  /** Name of the search landmark; each search on a page needs its own. */
  readonly landmarkLabel: string;
}

/** One line under the suggestions: progress, the empty case, or the DEMO naming caveat. */
function suggestionNote(loading: boolean, regions: readonly DataHubRegionDTO[]): string | null {
  if (loading) return 'Mencari wilayah…';
  if (regions.length === 0) return 'Tidak ada nama yang cocok. Tekan Enter untuk mencari di Jelajahi.';
  if (regions.some((region) => region.isSyntheticDemoName)) return 'Nama sintetis (DEMO), bukan nama resmi.';
  return null;
}

/**
 * Region search shared by the hero and the closing CTA. While the user types it suggests matching
 * kabupaten/kota from the Data Hub (a combobox: arrows move, Enter opens, Escape closes); picking one
 * opens that region in Jelajahi, and submitting the text hands the query to Jelajahi's search. It
 * never invents a result.
 */
export function RegionSearchForm({
  placeholder,
  actions,
  className,
  shimmerOnce = false,
  landmarkLabel,
}: RegionSearchFormProps) {
  const navigate = useNavigate();
  const listId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useRegionSuggestions(value);

  const typed = normalizeRegionQuery(value);
  const regions = suggestions.state.status === 'success' ? suggestions.state.data : [];
  // The popup shows only for the text on screen: a stale answer for older text stays hidden.
  const current = suggestions.query === typed;
  const loading =
    typed.length >= SUGGESTION_MIN_LENGTH && (!current || suggestions.state.status === 'loading');
  const showList =
    open &&
    typed.length >= SUGGESTION_MIN_LENGTH &&
    (loading || (current && suggestions.state.status === 'success'));
  const activeRegion = showList && current ? regions[activeIndex] : undefined;

  const openRegion = (region: DataHubRegionDTO) => {
    setOpen(false);
    void navigate(regionProfileHref(region.regionId));
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeRegion) {
      openRegion(activeRegion);
      return;
    }
    if (typed.length < SUGGESTION_MIN_LENGTH) {
      setError('Ketik minimal 2 huruf nama kabupaten/kota.');
      return;
    }
    setError(null);
    void navigate(regionSearchHref(typed));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && showList) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
    if (regions.length === 0) return;
    const step = event.key === 'ArrowDown' ? 1 : -1;
    // -1 is the text field itself, so the arrows can return to typing.
    setActiveIndex((index) => ((index + step + 1 + regions.length + 1) % (regions.length + 1)) - 1);
  };

  return (
    <form
      role="search"
      aria-label={landmarkLabel}
      className={[styles.form, className].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className={styles.row}>
        <div className={styles.combobox}>
          <TextField
            fieldClassName={shimmerOnce ? styles.shimmer : undefined}
            label="Cari kabupaten/kota"
            hideLabel
            icon="search"
            name="wilayah"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={activeRegion ? `${listId}-${activeRegion.regionId}` : undefined}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            value={value}
            error={error}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
            }}
            trailing={
              actions ? undefined : (
                <button type="submit" className="visually-hidden">
                  Cari
                </button>
              )
            }
          />
          <div className={styles.popup} hidden={!showList}>
            <div id={listId} role="listbox" aria-label="Saran kabupaten/kota" className={styles.options}>
              {current &&
                regions.map((region, index) => (
                  // The keyboard stays in the combobox field (arrows + Enter, aria-activedescendant), as
                  // the ARIA combobox pattern requires; the option itself only takes a pointer click.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={region.regionId}
                    id={`${listId}-${region.regionId}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    className={styles.option}
                    // Keeps focus in the field, so its blur does not close the list before the click lands.
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      openRegion(region);
                    }}
                  >
                    <span className={styles.optionName}>{region.displayName}</span>
                    <span className={`kk-small ${styles.optionMeta}`}>
                      {adminLevelLabel(region.adminLevel)}
                      {region.provinceName ? ` · ${region.provinceName}` : ''}
                    </span>
                  </div>
                ))}
            </div>
            <p className={`kk-small ${styles.popupNote}`} role="status">
              {suggestionNote(loading, regions)}
            </p>
          </div>
        </div>
        {actions}
      </div>
    </form>
  );
}
