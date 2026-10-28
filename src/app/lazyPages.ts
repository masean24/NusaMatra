import { lazy } from 'react';

/*
 * Feature pages are split per route: the home page downloads only its own code, and each feature's
 * code (and the libraries only it uses) loads when that page is opened. AppLayout's Suspense shows
 * nothing new meanwhile; the previous page stays until the next is ready.
 */
export const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
export const ComparisonPage = lazy(() =>
  import('./pages/ComparisonPage').then((m) => ({ default: m.ComparisonPage })),
);
export const PriorityLabPage = lazy(() =>
  import('./pages/PriorityLabPage').then((m) => ({ default: m.PriorityLabPage })),
);
export const EvidencePassportPage = lazy(() =>
  import('./pages/EvidencePassportPage').then((m) => ({ default: m.EvidencePassportPage })),
);
export const ComparisonDetailPage = lazy(() =>
  import('./pages/ComparisonDetailPage').then((m) => ({ default: m.ComparisonDetailPage })),
);
