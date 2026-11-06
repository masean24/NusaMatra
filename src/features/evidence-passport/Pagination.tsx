import { Button } from '@/components/ui/Button/Button';
import type { PagedRows } from './usePagedRows';
import styles from './EvidencePassport.module.css';
import { t } from '@/lib/i18n';

interface PaginationProps {
  /** What the pages are of, e.g. "peringkat wilayah". Names the navigation landmark. */
  readonly label: string;
  /** Plural noun for the rows, e.g. "wilayah berperingkat". */
  readonly noun: string;
  readonly total: number;
  readonly paging: PagedRows;
}

/** Previous / page / next for a long table, with the visible range announced politely. */
export function Pagination({ label, noun, total, paging }: PaginationProps) {
  const { page, pageCount, first, last, setPage: onPage } = paging;
  const range = t('Menampilkan {0}–{1} dari {2} {3}', String(first), String(last), String(total), noun);
  if (pageCount <= 1) {
    return <p className={`kk-small ${styles.muted}`}>{range}</p>;
  }
  return (
    <nav className={styles.pager} aria-label={t('Halaman {0}', label)}>
      <p className="kk-small" role="status">
        {range}
      </p>
      <div className={styles.pagerControls}>
        <Button
          variant="secondary"
          disabled={page === 0}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          {t('Sebelumnya')}
        </Button>
        <label className={`kk-small ${styles.pagerSelect}`}>
          {t('Halaman')}
          <select
            value={page}
            onChange={(event) => {
              onPage(Number(event.target.value));
            }}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index}>
                {index + 1} {t('dari {0}', pageCount)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={page === pageCount - 1}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          {t('Berikutnya')}
        </Button>
      </div>
    </nav>
  );
}
