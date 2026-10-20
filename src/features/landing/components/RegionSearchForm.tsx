import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { TextField } from '@/components/ui/TextField/TextField';
import { normalizeRegionQuery, regionSearchHref } from './regionSearch';
import styles from './RegionSearchForm.module.css';

interface RegionSearchFormProps {
  /** Visible placeholder text from Figma; the field also has a real (visually hidden) label. */
  readonly placeholder: string;
  /** Extra controls placed after the field, e.g. the CTA band's submit button. */
  readonly actions?: ReactNode;
  readonly className?: string | undefined;
  /** G11: one subtle shimmer to draw the eye; never repeats. */
  readonly shimmerOnce?: boolean;
}

/**
 * Region search shared by the hero and the closing CTA. It validates the query and hands it to
 * Jelajahi through the URL; it never invents a result.
 */
export function RegionSearchForm({
  placeholder,
  actions,
  className,
  shimmerOnce = false,
}: RegionSearchFormProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get('wilayah');
    const query = normalizeRegionQuery(typeof raw === 'string' ? raw : '');
    if (query.length < 2) {
      setError('Ketik minimal 2 huruf nama kabupaten/kota.');
      return;
    }
    setError(null);
    void navigate(regionSearchHref(query));
  };

  return (
    <form
      role="search"
      className={[styles.form, className].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className={styles.row}>
        <TextField
          className={styles.searchField}
          fieldClassName={shimmerOnce ? styles.shimmer : undefined}
          label="Cari kabupaten/kota"
          hideLabel
          icon="search"
          name="wilayah"
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          error={error}
          onInput={() => {
            if (error) setError(null);
          }}
          trailing={
            actions ? undefined : (
              <button type="submit" className="visually-hidden">
                Cari
              </button>
            )
          }
        />
        {actions}
      </div>
    </form>
  );
}
