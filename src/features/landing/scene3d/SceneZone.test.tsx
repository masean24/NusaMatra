import { render, screen } from '@testing-library/react';
import { DisplayModeProvider } from '@/features/theme';
import { SceneZone } from './SceneZone';

function renderZone() {
  return render(
    <DisplayModeProvider>
      <SceneZone kind="layeredIsland" description="Ilustrasi pulau berlapis data." />
    </DisplayModeProvider>,
  );
}

describe('SceneZone', () => {
  it('shows the approved static illustration and a text description when WebGL is unavailable', () => {
    // jsdom has no WebGL: canvas.getContext returns null, exactly like a GPU-less browser.
    const { container } = renderZone();
    expect(screen.getByText('Ilustrasi pulau berlapis data.')).toBeInTheDocument();
    const poster = container.querySelector('img');
    // Small SVGs are inlined as data URIs by Vite; either way it is the exported Figma file.
    expect(poster?.getAttribute('src')).toMatch(/placeholder-layered-island|^data:image\/svg\+xml/);
    expect(poster).toHaveAttribute('alt', '');
    expect(container.querySelector('canvas')).toBeNull();
  });
});
