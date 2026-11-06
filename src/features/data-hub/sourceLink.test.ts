import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage, prepareLanguage } from '@/lib/i18n';
import { sourceLinkAction, sourceLinkName, sourceNote } from './sourceLink';

const NOTE = { sourceLinkLevel: 'table', sourceNoteIdn: 'Catatan', sourceNoteEn: 'Note' } as const;

describe('source link wording', () => {
  afterEach(() => {
    applyLanguage('id');
  });

  it('names how far the link reaches', () => {
    expect(sourceLinkAction('table')).toBe('Buka tabel sumber');
    expect(sourceLinkAction('publication')).toBe('Buka publikasi sumber');
    expect(sourceLinkName('dashboard')).toBe('Dasbor sumber');
  });

  it('promises nothing about the reach of a link without a level', () => {
    expect(sourceLinkAction(null)).toBe('Buka sumber resmi');
    expect(sourceLinkName(null)).toBe('Sumber resmi');
  });

  it('gives the note in the reader language', async () => {
    expect(sourceNote(NOTE)).toBe('Catatan');
    await prepareLanguage('en');
    applyLanguage('en');
    expect(sourceNote(NOTE)).toBe('Note');
  });

  it('falls back to the other language, and to nothing when neither exists', () => {
    expect(sourceNote({ ...NOTE, sourceNoteIdn: null })).toBe('Note');
    expect(sourceNote({ ...NOTE, sourceNoteIdn: null, sourceNoteEn: null })).toBeNull();
  });
});
