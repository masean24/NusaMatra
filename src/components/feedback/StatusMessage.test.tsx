import { render, screen } from '@testing-library/react';
import { StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('announces errors assertively and other states politely', () => {
    const { rerender } = render(<StatusMessage kind="error" title="Data gagal dimuat. Coba lagi." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Data gagal dimuat. Coba lagi.');

    rerender(<StatusMessage kind="empty" title="Wilayah tidak ditemukan." />);
    expect(screen.getByRole('status')).toHaveTextContent('Wilayah tidak ditemukan.');
  });

  it('marks its kind so each state has its own visual treatment, not colour alone', () => {
    render(
      <StatusMessage kind="unavailable" title="Data belum tersedia">
        Alasan
      </StatusMessage>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-kind', 'unavailable');
    expect(screen.getByText('Alasan')).toBeInTheDocument();
  });
});
