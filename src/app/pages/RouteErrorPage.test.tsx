import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RouteErrorPage } from './RouteErrorPage';

function Broken(): never {
  throw new TypeError('Failed to fetch dynamically imported module: https://nusamatra.site/assets/X.js');
}

describe('RouteErrorPage', () => {
  it('replaces the developer error screen with a plain message and a reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <RouteErrorPage /> }]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: 'Halaman gagal dimuat' })).toBeInTheDocument();
    expect(screen.getByText(/versi baru situs baru saja dipasang/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  });
});
