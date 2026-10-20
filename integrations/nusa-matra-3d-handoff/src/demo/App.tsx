import { useRef, useState } from 'react';
import { HeroDiorama, Explore3DMap } from '../index';
import type { NusaMatra3DMapHandle, RegionSelection, NusaMatraDisplayMode } from '../index';

export default function App() {
  const [mode, setMode] = useState<'hero' | 'explore'>('hero');
  const [theme, setTheme] = useState<NusaMatraDisplayMode>('normal');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selection, setSelection] = useState<RegionSelection | null>(null);
  const map = useRef<NusaMatra3DMapHandle>(null);
  return <main>
    <header><h1>Nusa Matra 3D — Integration Preview</h1>
      <nav aria-label="Mode pratinjau">
        <button onClick={() => setMode('hero')}>Hero</button>
        <button onClick={() => setMode('explore')}>Jelajahi</button>
        <button onClick={() => setTheme(t => t === 'normal' ? 'glass' : 'normal')}>Tema: {theme}</button>
        <button onClick={() => setReducedMotion(x => !x)}>Reduced motion: {reducedMotion ? 'On' : 'Off'}</button>
        <button onClick={() => map.current?.resetCamera()}>Reset kamera</button>
      </nav>
    </header>
    <div className="viewport">
      {mode === 'hero' ?
        <HeroDiorama ref={map} displayMode={theme} dataMode="DEMO" reducedMotion={reducedMotion} /> :
        <Explore3DMap ref={map} displayMode={theme} dataMode="DEMO" reducedMotion={reducedMotion}
          selectedRegionId={selection?.regionId ?? null} onSelectRegion={r => { setSelection(r); map.current?.focusRegion(r.regionId); }} />}
    </div>
    <p>Data simulasi — relief ilustratif, bukan elevasi atau batas administrasi resmi.</p>
    {selection && <p>Wilayah: {selection.displayName} · {selection.regionId}</p>}
  </main>;
}
