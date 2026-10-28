import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { DisplayModeProvider } from '@/features/theme';
import { HowItWorksSection } from './HowItWorksSection';

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderSection() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HowItWorksSection /> },
      { path: '*', element: <CurrentPath /> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <DisplayModeProvider>
      <RouterProvider router={router} />
    </DisplayModeProvider>,
  );
}

const tab = (question: RegExp) => screen.getByRole('tab', { name: question });
// Every panel stays mounted for the crossfade (jsdom does not apply `inert`); the shown one is marked.
const activePanel = () => {
  const panel = screen.getAllByRole('tabpanel').find((item) => item.hasAttribute('data-active'));
  if (!panel) throw new Error('no active panel');
  return panel;
};

describe('HowItWorksSection (Guided Question Canvas)', () => {
  it('offers the four questions, with Jelajahi selected first', () => {
    renderSection();
    expect(
      screen.getAllByRole('tab').map((item) => item.querySelector('[class*="question"]')?.textContent),
    ).toEqual([
      'Bagaimana kondisi daerah saya?',
      'Apa perbedaan dua daerah?',
      'Daerah mana yang perlu perhatian lebih?',
      'Dari mana angka dan hasilnya berasal?',
    ]);
    expect(tab(/Bagaimana kondisi daerah saya/)).toHaveAttribute('aria-selected', 'true');
    expect(within(activePanel()).getByRole('heading')).toHaveTextContent(
      'Pilih wilayah di peta, lalu baca indikatornya',
    );
  });

  it('labels every preview as an example', () => {
    renderSection();
    expect(within(activePanel()).getByText('Contoh')).toBeInTheDocument();
  });

  it.each([
    [/Apa perbedaan dua daerah/, 'Bandingkan wilayah', '/bandingkan'],
    [/Daerah mana yang perlu perhatian lebih/, 'Buka Lab Prioritas', '/lab-prioritas'],
    [/Dari mana angka dan hasilnya berasal/, 'Buka Paspor Bukti', '/paspor-bukti'],
  ])('selecting %s shows its preview, whose button opens %s', async (question, cta, path) => {
    renderSection();
    await userEvent.click(tab(question));
    expect(tab(question)).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(within(activePanel()).getByRole('link', { name: new RegExp(cta) }));
    expect(await screen.findByTestId('path')).toHaveTextContent(path);
  });

  it('keeps the other previews out of reach while hidden', () => {
    renderSection();
    expect(document.getElementById('cara-kerja-panel-bandingkan')).toHaveAttribute('inert');
    expect(document.getElementById('cara-kerja-panel-jelajahi')).not.toHaveAttribute('inert');
  });

  it('moves between questions with the arrow keys, Home and End', async () => {
    renderSection();
    await userEvent.click(tab(/Bagaimana kondisi daerah saya/));
    await userEvent.keyboard('{ArrowDown}');
    expect(tab(/Apa perbedaan dua daerah/)).toHaveFocus();
    expect(tab(/Apa perbedaan dua daerah/)).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(tab(/Dari mana angka/)).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab(/Bagaimana kondisi daerah saya/)).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(tab(/Dari mana angka/)).toHaveFocus();
  });

  it('lets the visitor try the example markers on the Jelajahi map', async () => {
    renderSection();
    const panel = activePanel();
    await userEvent.click(within(panel).getByRole('button', { name: 'Wilayah contoh A' }));
    expect(within(panel).getByRole('button', { name: 'Wilayah contoh A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByText('Wilayah contoh A', { selector: 'p' })).toBeInTheDocument();
  });
});
