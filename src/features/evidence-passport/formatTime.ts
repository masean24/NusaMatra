const BROWSER_TIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

/** The moment the browser received a response, in the viewer's own time zone. Unparseable input is shown as sent. */
export function formatBrowserTime(iso: string | null): string {
  if (iso === null) return 'belum tersedia';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : BROWSER_TIME.format(date);
}

/**
 * Server timestamps look like "2026-10-21 17:14:49" with no time zone. They are shown exactly as
 * sent, with that fact stated, because adding a zone would be inventing one.
 */
export function formatServerTime(value: string | null): string {
  return value === null ? 'belum tersedia' : `${value} (zona waktu tidak dinyatakan server)`;
}
