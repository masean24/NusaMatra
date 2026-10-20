import { useState } from 'react';
import { RouterProvider } from 'react-router';
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
