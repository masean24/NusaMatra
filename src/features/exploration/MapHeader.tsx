import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Icon } from '@/components/ui/Icon/Icon';
import { BackButton, LanguageSwitch } from '@/features/navigation';
import { DisplayModeSwitch } from '@/features/theme';
import { useRegionBrowserParams } from './regionCode';
import styles from './MapHeader.module.css';
import { t } from '@/lib/i18n';

interface MapHeaderProps {
  /** What the field says while empty: the open region's name once there is one. */
  readonly placeholder: string;
  /** The results open in the sheet below, as the search of a map app does. */
  readonly onSearchFocus: () => void;
}

/**
 * The top of the map on a phone: one floating search field, with the way back and the way home at
 * its start and the language and display settings at its end, instead of a page bar above the map.
 */
export function MapHeader({ placeholder, onSearchFocus }: MapHeaderProps) {
  const { query, setQuery } = useRegionBrowserParams();
  const fieldId = useId();
  const menuRef = useRef<HTMLDetailsElement>(null);

  // The settings fold away on any tap outside them, as a menu does.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <div className={styles.header} data-map-header>
      <div className={`glass ${styles.pill}`}>
        <BackButton variant="icon" />
        <Link to="/" className={styles.home} aria-label={t('Nusa Matra — Beranda')}>
          <Logo size="nav" surface="auto" />
        </Link>
        <label htmlFor={fieldId} className="visually-hidden">
          {t('Cari kabupaten/kota')}
        </label>
        <input
          id={fieldId}
          className={styles.field}
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          onFocus={onSearchFocus}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {query && (
          <button
            type="button"
            className={styles.button}
            aria-label={t('Hapus pencarian')}
            onClick={() => {
              setQuery('');
            }}
          >
            <Icon name="close" size={18} />
          </button>
        )}
        <details ref={menuRef} className={styles.menu}>
          <summary className={styles.button} aria-label={t('Bahasa dan tampilan')}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="12" cy="5" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="12" cy="19" r="1.9" />
            </svg>
          </summary>
          <div className={`glass ${styles.popover}`}>
            <LanguageSwitch />
            <DisplayModeSwitch size="compact" />
          </div>
        </details>
      </div>
    </div>
  );
}
