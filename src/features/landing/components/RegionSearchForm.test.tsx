import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { RegionSearchForm } from './RegionSearchForm';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderForm() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <RegionSearchForm placeholder="Ketik nama kabupaten/kota Anda" /> },
      { path: '/jelajahi', element: <LocationProbe /> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('RegionSearchForm', () => {
  it('has a real label, not only a placeholder', () => {
    renderForm();
    expect(screen.getByRole('searchbox', { name: 'Cari kabupaten/kota' })).toBeInTheDocument();
  });

  it('explains an empty search instead of navigating', async () => {
    renderForm();
    await userEvent.type(screen.getByRole('searchbox'), '{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Ketik minimal 2 huruf nama kabupaten/kota.');
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('hands a valid query to Jelajahi through the URL', async () => {
    renderForm();
    await userEvent.type(screen.getByRole('searchbox'), '  Kota   Semarang {Enter}');
    expect(await screen.findByTestId('location')).toHaveTextContent('/jelajahi?cari=Kota+Semarang');
  });
});
