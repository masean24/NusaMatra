import { Button } from '@/components/ui/Button/Button';
import type { PagedRows } from './usePagedRows';
import styles from './EvidencePassport.module.css';

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
  const range = `Menampilkan ${String(first)}–${String(last)} dari ${String(total)} ${noun}`;
  if (pageCount <= 1) {
    return <p className={`kk-small ${styles.muted}`}>{range}</p>;
  }
  return (
    <nav className={styles.pager} aria-label={`Halaman ${label}`}>
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
          Sebelumnya
        </Button>
        <label className={`kk-small ${styles.pagerSelect}`}>
          Halaman
          <select
            value={page}
            onChange={(event) => {
              onPage(Number(event.target.value));
            }}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index}>
                {index + 1} dari {pageCount}
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
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
