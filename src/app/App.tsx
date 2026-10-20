import { useState } from 'react';
// The DOM build wires ReactDOM.flushSync, which navigations inside view transitions need.
import { RouterProvider } from 'react-router/dom';
import { DataHubProvider } from '@/features/data-hub';
import { DisplayModeProvider } from '@/features/theme';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <DisplayModeProvider>
      <DataHubProvider>
        <RouterProvider router={router} />
      </DataHubProvider>
    </DisplayModeProvider>
  );
}
