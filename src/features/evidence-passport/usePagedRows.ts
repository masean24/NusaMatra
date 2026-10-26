import { useState } from 'react';

/** Rows per screen page of a long table. The JSON export always carries every row. */
export const ROWS_PER_PAGE = 20;

/** The rows of one page of a long table, and the paging state. Pages are 0-based. */
export function usePagedRows<T>(rows: readonly T[], perPage = ROWS_PER_PAGE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const [requested, setPage] = useState(0);
  const page = Math.min(requested, pageCount - 1);
  return {
    page,
    pageCount,
    setPage,
    pageRows: rows.slice(page * perPage, (page + 1) * perPage),
    first: rows.length === 0 ? 0 : page * perPage + 1,
    last: Math.min((page + 1) * perPage, rows.length),
  };
}

export type PagedRows = Omit<ReturnType<typeof usePagedRows>, 'pageRows'>;
