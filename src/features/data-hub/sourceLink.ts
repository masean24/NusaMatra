import type { SourceLinkInfo, SourceLinkLevel, SourceVerification } from '@/services/api';
import { language, t } from '@/lib/i18n';

type VerificationInfo = Pick<SourceLinkInfo, 'sourceVerification' | 'verificationScope'>;

function verifiedLabel(scope: SourceLinkInfo['verificationScope']): string {
  switch (scope) {
    case 'all_rows':
      return t('Seluruh baris cocok dengan sumber');
    case 'province_level':
      return t('Cocok pada tingkat provinsi');
    case 'sample':
      return t('Baru baris contoh yang dicocokkan');
    default:
      return t('Dicocokkan, cakupan tidak dinyatakan');
  }
}

/**
 * What the Data Hub says about matching the figures against the source. A match is named with its
 * scope, so one checked row never reads as all of them. `null` where there is nothing to say: figures
 * with no outside source, or a status not stated, are never shown as checked.
 */
export function sourceVerificationLabel(info: VerificationInfo): string | null {
  switch (info.sourceVerification) {
    case 'verified':
      return verifiedLabel(info.verificationScope);
    case 'partial':
      return t('Baru sebagian dicocokkan');
    case 'pending':
      return t('Belum dicocokkan dengan sumber');
    case 'problem_unresolved':
      return t('Belum dapat diverifikasi');
    case 'not_applicable':
    case null:
      return null;
  }
}

/** The statuses a reader must be warned about. */
export function isSourceUnverified(status: SourceVerification | null): boolean {
  return status === 'pending' || status === 'partial' || status === 'problem_unresolved';
}

/** Matched, but not row by row: a sample, a province level, or a scope not stated. */
export function isMatchedInPart(info: VerificationInfo): boolean {
  return info.sourceVerification === 'verified' && info.verificationScope !== 'all_rows';
}

/** The weakest status among several sources, which is the one that may speak for all of them. */
export function weakestVerification<T extends VerificationInfo>(items: readonly T[]): T | undefined {
  return (
    items.find((item) => isSourceUnverified(item.sourceVerification)) ??
    items.find(isMatchedInPart) ??
    items[0]
  );
}

/** What the link is called: the Data Hub says how far it reaches, so the page need not promise more. */
export function sourceLinkName(level: SourceLinkLevel | null): string {
  switch (level) {
    case 'table':
      return t('Tabel sumber');
    case 'dataset':
      return t('Dataset sumber');
    case 'publication':
      return t('Publikasi sumber');
    case 'dashboard':
      return t('Dasbor sumber');
    case 'portal':
      return t('Portal sumber');
    case null:
      return t('Sumber resmi');
  }
}

/** The same link as a call to action. */
export function sourceLinkAction(level: SourceLinkLevel | null): string {
  switch (level) {
    case 'table':
      return t('Buka tabel sumber');
    case 'dataset':
      return t('Buka dataset sumber');
    case 'publication':
      return t('Buka publikasi sumber');
    case 'dashboard':
      return t('Buka dasbor sumber');
    case 'portal':
      return t('Buka portal sumber');
    case null:
      return t('Buka sumber resmi');
  }
}

/** The Data Hub's note in the reader's language, or the other language rather than none. */
export function sourceNote(info: SourceLinkInfo): string | null {
  return language() === 'en'
    ? (info.sourceNoteEn ?? info.sourceNoteIdn)
    : (info.sourceNoteIdn ?? info.sourceNoteEn);
}
