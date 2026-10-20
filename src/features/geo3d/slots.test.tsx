import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useImperativeHandle, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router';
import { ExplorationMapPanel } from '@/features/exploration';
import { DisplayModeProvider } from '@/features/theme';
import type { Explore3DMapProps, GeoCameraHandle, HeroDioramaProps } from './contract';
import { geoEngineRegistry } from './engineRegistry';
import { HeroDioramaSlot } from './HeroDioramaSlot';

type MutableRegistry = { -readonly [K in keyof typeof geoEngineRegistry]: (typeof geoEngineRegistry)[K] };
const registry = geoEngineRegistry as MutableRegistry;
const realRegistry = { ...geoEngineRegistry };

beforeEach(() => {
  // jsdom has no WebGL: tests swap in fake engines (or none) instead of loading three.js.
  registry.HeroDiorama = null;
  registry.Explore3DMap = null;
});

afterAll(() => {
  Object.assign(registry, realRegistry);
});

function withProviders(ui: ReactNode, path = '/') {
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] });
  return render(
    <DisplayModeProvider>
      <RouterProvider router={router} />
    </DisplayModeProvider>,
  );
}

describe('engine registry', () => {
  it('wires the real engine lazily for the hero and the exploration map', () => {
    expect(realRegistry.HeroDiorama).not.toBeNull();
    expect(realRegistry.Explore3DMap).not.toBeNull();
  });
});

describe('HeroDioramaSlot', () => {
  it('shows the static Figma illustration while no engine is available', () => {
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Ilustrasi diorama." />);
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('diorama-nusantara'),
    );
    expect(container.querySelector('[data-engine="absent"]')).not.toBeNull();
    expect(screen.getByText('Ilustrasi diorama.')).toBeInTheDocument();
  });

  it('passes host state to the engine and keeps the placeholder until it is ready', () => {
    let received: HeroDioramaProps | null = null;
    registry.HeroDiorama = function FakeHeroDiorama(props: HeroDioramaProps) {
      received = props;
      return <div data-testid="engine" />;
    };
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Diorama." />);

    expect(screen.getByTestId('engine')).toBeInTheDocument();
    expect(received).toMatchObject({ displayMode: 'normal', dataMode: 'DEMO', reducedMotion: false });
    expect(container.querySelector('[data-engine="loading"]')).not.toBeNull();

    act(() => {
      received?.onReady?.();
    });
    expect(container.querySelector('[data-engine="ready"]')).not.toBeNull();
  });

  it('never mounts the engine for the story scene, which it does not support', () => {
    registry.HeroDiorama = function FakeHeroDiorama() {
      return <div data-testid="engine" />;
    };
    withProviders(<HeroDioramaSlot scene="story" description="Cerita." />);
    expect(screen.queryByTestId('engine')).toBeNull();
  });

  it('keeps the placeholder when the engine throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registry.HeroDiorama = function BrokenEngine(): never {
      throw new Error('WebGL context lost');
    };
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Ilustrasi." />);
    expect(container.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('[data-engine="failed"]')).not.toBeNull();
  });
});

describe('Explore3DMapSlot in the exploration panel', () => {
  function SearchProbe() {
    const [params] = useSearchParams();
    return <output data-testid="url">{params.toString()}</output>;
  }

  function installFakeMap(camera: GeoCameraHandle) {
    const calls: { props: Explore3DMapProps | null } = { props: null };
    registry.Explore3DMap = function FakeMap(engineProps: Explore3DMapProps) {
      calls.props = engineProps;
      useImperativeHandle(engineProps.cameraRef, () => camera);
      useEffect(() => {
        engineProps.onReady?.();
      }, [engineProps]);
      return <div data-testid="map" />;
    };
    return calls;
  }

  it('asks for the DEMO illustration (no invented geography) and keeps the selection in the URL', () => {
    const camera: GeoCameraHandle = { focusRegion: vi.fn(), resetView: vi.fn() };
    const calls = installFakeMap(camera);
    withProviders(
      <>
        <ExplorationMapPanel />
        <SearchProbe />
      </>,
      '/peta',
    );

    expect(calls.props).toMatchObject({ geography: null, selectedRegionId: null, dataMode: 'DEMO' });
    act(() => {
      calls.props?.onRegionSelect({
        regionId: 'ID-DEMO-JAWA',
        displayName: 'Gugus Pulau Jawa & Madura (Simulasi)',
        boundaryEditionId: 'demo',
        dataMode: 'DEMO',
      });
    });
    expect(screen.getByTestId('url')).toHaveTextContent('wilayah=ID-DEMO-JAWA');
    expect(calls.props).toMatchObject({ selectedRegionId: 'ID-DEMO-JAWA' });
    expect(screen.getByText('Gugus Pulau Jawa & Madura (Simulasi) dipilih')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Hapus pilihan' }).click();
    });
    expect(screen.getByTestId('url')).toHaveTextContent('');
    expect(camera.resetView).toHaveBeenCalledOnce();
  });

  it('offers a keyboard alternative that selects and focuses a region', async () => {
    const camera: GeoCameraHandle = { focusRegion: vi.fn(), resetView: vi.fn() };
    installFakeMap(camera);
    withProviders(<ExplorationMapPanel />, '/jelajahi');

    const list = screen.getByRole('group', { name: 'Pilih wilayah ilustratif' });
    const papua = within(list).getByRole('button', { name: 'Gugus Tanah Papua (Simulasi)' });
    papua.focus();
    await userEvent.keyboard('{Enter}');

    expect(papua).toHaveAttribute('aria-pressed', 'true');
    expect(camera.focusRegion).toHaveBeenCalledWith('ID-DEMO-PAPUA');
  });

  it('ignores region ids from the URL that are not plain identifiers', () => {
    withProviders(<ExplorationMapPanel />, '/peta?wilayah=%3Cscript%3E');
    expect(screen.getByText('Belum ada wilayah dipilih')).toBeInTheDocument();
  });
});
