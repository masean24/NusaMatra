/** What a limitation is about, shown as a label so a reader can tell which part of the result it affects. */
export type LimitationCategory = 'Data' | 'Metode' | 'Cakupan' | 'Reproduksibilitas';

/**
 * One limitation as the page shows it: a short title over the full text. Only `text` is evidence: it
 * is what the record (and the JSON export) carries in `limitations`; the title and category are the
 * page's headings for it.
 */
export interface LimitationNote {
  readonly category: LimitationCategory;
  readonly title: string;
  readonly text: string;
}

/** Collects notes in order; their texts, in that order, are the record's `limitations`. */
export function limitationList() {
  const notes: LimitationNote[] = [];
  const add = (category: LimitationCategory, title: string, text: string) => {
    notes.push({ category, title, text });
  };
  return { notes, add };
}
