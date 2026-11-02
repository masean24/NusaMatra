import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { GlassSelect } from './GlassSelect';

const GROUPED = [
  { value: 'soc_poverty_rate', label: 'Penduduk miskin', group: 'Sosial ekonomi' },
  { value: 'soc_hdi', label: 'IPM', group: 'Sosial ekonomi' },
  { value: 'hlt_stunting', label: 'Stunting', group: 'Akses kesehatan' },
];

function Harness() {
  const [value, setValue] = useState('soc_poverty_rate');
  return (
    <>
      <span id="indikator">Pilih indikator</span>
      <GlassSelect labelledBy="indikator" value={value} options={GROUPED} onChange={setValue} />
    </>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Pilih indikator' });

describe('GlassSelect with groups', () => {
  it('lists options under their group heading, as an <optgroup> list would', () => {
    render(<Harness />);
    fireEvent.click(field());
    const social = screen.getByRole('group', { name: 'Sosial ekonomi' });
    expect(
      within(social)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Penduduk miskin', 'IPM']);
    expect(
      within(screen.getByRole('group', { name: 'Akses kesehatan' })).getByRole('option'),
    ).toHaveTextContent('Stunting');
  });

  it('moves across groups with the keyboard and chooses with Enter; a heading is never chosen', () => {
    render(<Harness />);
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'End' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(field()).toHaveTextContent('Stunting');
  });
});
