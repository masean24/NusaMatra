import { useState } from 'react';
// The DOM build wires ReactDOM.flushSync, which navigations inside view transitions need.
import { RouterProvider } from 'react-router/dom';
import { DisplayModeProvider } from '@/features/theme';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <DisplayModeProvider>
      <RouterProvider router={router} />
    </DisplayModeProvider>
  );
}
