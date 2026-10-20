import { createBrowserRouter } from 'react-router';
import { FEATURE_SHELLS, FeatureShellPage } from '@/features/feature-shell';
import { LandingPage } from '@/features/landing';
import { AppLayout } from './AppLayout';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Route slugs follow docs/01 §5 and docs/04 §5 (Indonesian, kebab-case). */
export const routes = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      ...FEATURE_SHELLS.map((shell) => ({ path: shell.path, element: <FeatureShellPage shell={shell} /> })),
      { path: '/aksesibilitas', element: <AccessibilityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
