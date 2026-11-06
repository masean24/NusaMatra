import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage, prepareLanguage } from '@/lib/i18n';
import {
  isSourceUnverified,
  sourceLinkAction,
  sourceLinkName,
  sourceNote,
  sourceVerificationLabel,
  weakestVerification,
} from './sourceLink';

const NOTE = {
  sourceLinkLevel: 'table',
  sourceVerification: 'verified',
  verificationScope: 'all_rows',
  sourceNoteIdn: 'Catatan',
  sourceNoteEn: 'Note',
} as const;

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

  const status = (
    sourceVerification: 'verified' | 'pending' | 'not_applicable' | null,
    verificationScope: 'all_rows' | 'sample' | 'province_level' | null = null,
  ) => ({ sourceVerification, verificationScope });

  it('names a match with its scope, so one checked row never reads as all of them', () => {
    expect(sourceVerificationLabel(status('verified', 'all_rows'))).toBe('Seluruh baris cocok dengan sumber');
    expect(sourceVerificationLabel(status('verified', 'province_level'))).toBe('Cocok pada tingkat provinsi');
    expect(sourceVerificationLabel(status('verified', 'sample'))).toBe('Baru baris contoh yang dicocokkan');
    expect(sourceVerificationLabel(status('verified'))).toBe('Dicocokkan, cakupan tidak dinyatakan');
  });

  it('lets the weakest status speak for several sources', () => {
    const full = status('verified', 'all_rows');
    const sample = status('verified', 'sample');
    const pending = status('pending');
    expect(weakestVerification([full, sample, pending])).toBe(pending);
    expect(weakestVerification([full, sample])).toBe(sample);
    expect(weakestVerification([full])).toBe(full);
    expect(weakestVerification<typeof full>([])).toBeUndefined();
  });

  it('never presents an unstated or inapplicable status as checked', () => {
    expect(sourceVerificationLabel(status('pending'))).toBe('Belum dicocokkan dengan sumber');
    expect(sourceVerificationLabel(status('not_applicable'))).toBeNull();
    expect(sourceVerificationLabel(status(null))).toBeNull();
    expect(isSourceUnverified('partial')).toBe(true);
    expect(isSourceUnverified('problem_unresolved')).toBe(true);
    expect(isSourceUnverified('verified')).toBe(false);
    expect(isSourceUnverified(null)).toBe(false);
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
