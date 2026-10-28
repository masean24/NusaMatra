import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { GlassSelect } from './GlassSelect';

const OPTIONS = [
  { value: '', label: 'Seluruh Indonesia' },
  { value: '33', label: 'Provinsi Jawa Tengah', detail: '35 kab/kota' },
  { value: '12', label: 'Provinsi Sumatera Utara', detail: '33 kab/kota' },
];

function Harness({ onChange }: { readonly onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <>
      <span id="scope">Cakupan wilayah</span>
      <GlassSelect
        labelledBy="scope"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Cakupan wilayah' });

describe('GlassSelect', () => {
  it('shows the chosen option and keeps the list closed until asked', () => {
    render(<Harness />);
    expect(field()).toHaveTextContent('Seluruh Indonesia');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on click and chooses an option with the pointer', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(field());
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('option', { name: /Jawa Tengah/ }));
    expect(onChange).toHaveBeenCalledWith('33');
    expect(field()).toHaveTextContent('Provinsi Jawa Tengah');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });

  it('works from the keyboard: arrows move, Enter chooses, Escape closes', async () => {
    render(<Harness />);
    field().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(field()).toHaveTextContent('Provinsi Sumatera Utara');
    expect(field()).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(field()).toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Escape}');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the chosen option as selected', async () => {
    render(<Harness />);
    await userEvent.click(field());
    expect(screen.getByRole('option', { name: 'Seluruh Indonesia' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
