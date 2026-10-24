/**
 * Public API of the Paspor Bukti feature.
 *
 * - `EvidencePassport`: the page body for `/paspor-bukti`. It reads its request from the address and
 *   needs `DataHubProvider` and a router above it.
 * - `passportHref(query)`: STABLE. Builds the site-relative link other features put on a CTA.
 * - `EvidenceQuery`: what `passportHref` accepts (`kind` 'wilayah' | 'bandingkan' | 'lab').
 * - `PASSPORT_PATH`: the route path.
 */
export { EvidencePassport } from './EvidencePassport';
export { PASSPORT_PATH, passportHref } from './evidenceQuery';
export type {
  ComparisonEvidenceQuery,
  EvidenceQuery,
  LabEvidenceQuery,
  RegionEvidenceQuery,
} from './evidenceQuery';
