/**
 * DEMO — the illustrative island groups drawn by the 3D engine when no verified geography is
 * supplied (engine `DEMO_ILLUSTRATIVE_GEOGRAPHY`). Listed here so the host can offer a keyboard
 * and screen-reader alternative to clicking the map without loading three.js up front.
 * `demoGeoRegions.test.ts` keeps this list identical to the engine's dataset.
 */
export const DEMO_GEO_REGIONS: readonly { regionId: string; displayName: string }[] = [
  { regionId: 'ID-DEMO-SUMATERA', displayName: 'Gugus Pulau Sumatera (Simulasi)' },
  { regionId: 'ID-DEMO-JAWA', displayName: 'Gugus Pulau Jawa & Madura (Simulasi)' },
  { regionId: 'ID-DEMO-NUSATENGGARA', displayName: 'Gugus Bali & Nusa Tenggara (Simulasi)' },
  { regionId: 'ID-DEMO-KALIMANTAN', displayName: 'Gugus Pulau Kalimantan (Simulasi)' },
  { regionId: 'ID-DEMO-SULAWESI', displayName: 'Gugus Pulau Sulawesi (Simulasi)' },
  { regionId: 'ID-DEMO-MALUKU', displayName: 'Gugus Kepulauan Maluku (Simulasi)' },
  { regionId: 'ID-DEMO-PAPUA', displayName: 'Gugus Tanah Papua (Simulasi)' },
];
