import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import {
  FEATURE_SHELLS,
  FeatureShellPage,
  findFeatureShell,
  type FeatureShell,
} from '@/features/feature-shell';
import { LandingPage } from '@/features/landing';
import { AppLayout } from './AppLayout';
import { COMPARISON_DETAIL_PATH } from '@/features/comparison';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import {
  ComparisonDetailPage,
  ComparisonPage,
  EvidencePassportPage,
  ExplorePage,
  MethodologyPage,
  PriorityLabPage,
} from './lazyPages';
import { Localized } from '@/lib/i18n/Localized';

/** Features that are built; every other shell is an honest "under development" page. */
const BUILT_PAGES: Readonly<Record<string, (shell: FeatureShell) => ReactElement>> = {
  // "Peta Utama" was retired (owner decision 2026-10-28): its address opens Jelajahi.
  '/peta': () => <Navigate to="/jelajahi" replace />,
  '/jelajahi': (shell) => <ExplorePage shell={shell} />,
  '/bandingkan': (shell) => <ComparisonPage shell={shell} />,
  '/lab-prioritas': (shell) => <PriorityLabPage shell={shell} />,
  '/paspor-bukti': (shell) => <EvidencePassportPage shell={shell} />,
  '/metodologi': (shell) => <MethodologyPage shell={shell} />,
};

function pageFor(shell: FeatureShell): ReactElement {
  const build = BUILT_PAGES[shell.path];
  return build ? build(shell) : <FeatureShellPage shell={shell} />;
}

/** Route slugs follow docs/01 §5 and docs/04 §5 (Indonesian, kebab-case). */
export const routes = [
  {
    element: <Localized render={() => <AppLayout />} />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        // A page that fails to load or render shows the error page inside the layout, so the
        // navigation stays usable.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <Localized render={() => <LandingPage />} /> },
          ...FEATURE_SHELLS().map(({ path }) => ({
            path,
            element: <Localized render={() => pageFor(findFeatureShell(path) as FeatureShell)} />,
          })),
          { path: COMPARISON_DETAIL_PATH, element: <Localized render={() => <ComparisonDetailPage />} /> },
          { path: '/aksesibilitas', element: <Localized render={() => <AccessibilityPage />} /> },
          { path: '*', element: <Localized render={() => <NotFoundPage />} /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
