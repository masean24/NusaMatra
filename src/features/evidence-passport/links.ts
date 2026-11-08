/**
 * Light public entry of Paspor Bukti: what another feature needs to link to it, without loading
 * the passport itself (or the Lab code it builds on). Use this for links; `index` for the page.
 */
export { PASSPORT_PATH, passportHref } from './evidenceQuery';
export type {
  ComparisonEvidenceQuery,
  EvidenceQuery,
  LabEvidenceQuery,
  RegionEvidenceQuery,
} from './evidenceQuery';
