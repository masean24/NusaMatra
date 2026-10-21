import type { ReactElement } from 'react';
import { createBrowserRouter } from 'react-router';
import { FEATURE_SHELLS, FeatureShellPage, type FeatureShell } from '@/features/feature-shell';
import { LandingPage } from '@/features/landing';
import { AppLayout } from './AppLayout';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { ExplorePage } from './pages/ExplorePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PriorityLabPage } from './pages/PriorityLabPage';

/** Features that are built; every other shell is an honest "under development" page. */
const BUILT_PAGES: Readonly<Record<string, (shell: FeatureShell) => ReactElement>> = {
  '/jelajahi': (shell) => <ExplorePage shell={shell} />,
  '/bandingkan': (shell) => <ComparisonPage shell={shell} />,
  '/lab-prioritas': (shell) => <PriorityLabPage shell={shell} />,
};

function pageFor(shell: FeatureShell): ReactElement {
  const build = BUILT_PAGES[shell.path];
  return build ? build(shell) : <FeatureShellPage shell={shell} />;
}

/** Route slugs follow docs/01 §5 and docs/04 §5 (Indonesian, kebab-case). */
export const routes = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      ...FEATURE_SHELLS.map((shell) => ({ path: shell.path, element: pageFor(shell) })),
      { path: '/aksesibilitas', element: <AccessibilityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
