import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useImperativeHandle, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router';
import { DataHubProvider } from '@/features/data-hub';
import { ExplorationMapPanel } from '@/features/exploration';
import { DisplayModeProvider } from '@/features/theme';
import { setMediaQueryMatches } from '@/test/browserMocks';
import type { Explore3DMapProps, GeoCameraHandle, HeroHexMapProps } from './contract';
import { geoEngineRegistry } from './engineRegistry';
import { HeroDioramaSlot } from './HeroDioramaSlot';

type MutableRegistry = { -readonly [K in keyof typeof geoEngineRegistry]: (typeof geoEngineRegistry)[K] };
const registry = geoEngineRegistry as MutableRegistry;
const realRegistry = { ...geoEngineRegistry };

beforeEach(() => {
  // jsdom has no WebGL: tests swap in fake engines (or none) instead of loading three.js.
  registry.HeroHexMap = null;
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
      <DataHubProvider repository={null} initialDataMode="DEMO">
        <RouterProvider router={router} />
      </DataHubProvider>
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
  const oldIllustration = (container: HTMLElement) =>
    container.querySelector('img[src*="diorama-nusantara"]');

  it('shows the hexagon poster, never the old illustration, while no engine is available', () => {
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Peta hexagon." />);
    expect(container.querySelector('[data-hex-poster]')).not.toBeNull();
    expect(oldIllustration(container)).toBeNull();
    expect(container.querySelector('[data-engine="absent"]')).not.toBeNull();
    expect(screen.getByText('Peta hexagon.')).toBeInTheDocument();
    expect(screen.getByText(/data simulasi/)).toBeInTheDocument();
  });

  it('follows the active theme on the poster', () => {
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Peta." />);
    expect(container.querySelector('[data-hex-poster]')).toHaveAttribute('data-display-mode', 'normal');
  });

  it('passes host state to the engine and keeps the poster until it is ready', () => {
    let received: HeroHexMapProps | null = null;
    registry.HeroHexMap = function FakeHexMap(props: HeroHexMapProps) {
      received = props;
      return <div data-testid="engine" />;
    };
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Peta." />);

    expect(screen.getByTestId('engine')).toBeInTheDocument();
    expect(received).toMatchObject({ displayMode: 'normal', dataMode: 'DEMO', reducedMotion: false });
    expect(container.querySelector('[data-engine="loading"]')).not.toBeNull();
    expect(container.querySelector('[data-hex-poster]')).not.toBeNull();

    act(() => {
      received?.onReady?.();
    });
    expect(container.querySelector('[data-engine="ready"]')).not.toBeNull();
    expect(oldIllustration(container)).toBeNull();
  });

  it('runs the hexagon map and reports when its entrance has settled', () => {
    let hex: HeroHexMapProps | null = null;
    registry.HeroHexMap = function FakeHexMap(props: HeroHexMapProps) {
      hex = props;
      return <div data-testid="hex" />;
    };
    const outcome = vi.fn();
    withProviders(<HeroDioramaSlot scene="hero" description="Peta." onHeroMapOutcome={outcome} />);

    expect(screen.getByTestId('hex')).toBeInTheDocument();
    expect(outcome).not.toHaveBeenCalled();
    act(() => {
      hex?.onEntranceSettled?.();
    });
    expect(outcome).toHaveBeenCalledWith('settled');
  });

  it('keeps the hexagon poster when the hexagon map reports an error, and never mounts the relief map', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reliefMounted = vi.fn();
    registry.HeroHexMap = function FailingHexMap(props: HeroHexMapProps) {
      useEffect(() => {
        props.onError?.(new Error('WebGL tidak tersedia'));
      }, [props]);
      return null;
    };
    registry.HeroDiorama = function FakeRelief() {
      reliefMounted();
      return <div data-testid="relief" />;
    };
    const outcome = vi.fn();
    const { container } = withProviders(
      <HeroDioramaSlot scene="hero" description="Peta." onHeroMapOutcome={outcome} />,
    );

    expect(container.querySelector('[data-engine="failed"]')).not.toBeNull();
    expect(container.querySelector('[data-hex-poster]')).not.toBeNull();
    expect(oldIllustration(container)).toBeNull();
    expect(reliefMounted).not.toHaveBeenCalled();
    expect(outcome).toHaveBeenCalledWith('unavailable');
  });

  it('keeps the hexagon poster when the engine throws while rendering', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    registry.HeroHexMap = function BrokenEngine(): never {
      throw new Error('WebGL context lost');
    };
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Peta." />);
    expect(container.querySelector('[data-hex-poster]')).not.toBeNull();
    expect(oldIllustration(container)).toBeNull();
    expect(container.querySelector('[data-engine="failed"]')).not.toBeNull();
  });

  it('shows the same poster on phones (no separate still image)', () => {
    setMediaQueryMatches('(width < 768px)', true);
    const { container } = withProviders(<HeroDioramaSlot scene="hero" description="Peta." />);
    expect(container.querySelector('[data-hex-poster]')).not.toBeNull();
    expect(oldIllustration(container)).toBeNull();
  });

  it('never mounts the engine for the story scene, which it does not support', () => {
    registry.HeroHexMap = function FakeHexMap() {
      return <div data-testid="engine" />;
    };
    withProviders(<HeroDioramaSlot scene="story" description="Cerita." />);
    expect(screen.queryByTestId('engine')).toBeNull();
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
    const camera: GeoCameraHandle = { focusRegion: vi.fn(), resetView: vi.fn(), zoomBy: vi.fn() };
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
    const camera: GeoCameraHandle = { focusRegion: vi.fn(), resetView: vi.fn(), zoomBy: vi.fn() };
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
