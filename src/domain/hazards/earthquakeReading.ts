/**
 * Reading BMKG's own words and numbers for a visitor. Nothing here adds a claim of its own: the felt
 * text is only sorted, and when its shape leaves any doubt it is handed back as sent.
 */

const ROMAN_LEVELS: Readonly<Record<string, number>> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

/** "III Siberut Barat" or "II - III Bungku Morowali": an intensity (or a range of two), then a place. */
const FELT_ENTRY = /^([IVX]+)(?:\s*-\s*([IVX]+))?\s+(\S.*)$/;

export interface FeltReport {
  /** The intensity as BMKG wrote it, for example "II - III". */
  readonly scale: string;
  /** The highest MMI level the scale names. */
  readonly level: number;
  readonly places: readonly string[];
}

/**
 * Groups BMKG's felt text by intensity, strongest first. A piece without an intensity belongs to the
 * place before it ("III Ruteng, Manggarai"). BMKG lists the strongest first, so an entry stronger than
 * the first one is more likely a place named like a number ("X Koto") than a level no one reported:
 * the text is then not interpreted at all. `null` means show it as sent.
 */
export function parseFeltReports(felt: string): readonly FeltReport[] | null {
  const groups = new Map<string, { level: number; places: string[] }>();
  let firstLevel: number | null = null;
  let lastPlaces: string[] | null = null;

  for (const piece of felt.split(',').map((part) => part.trim())) {
    if (piece.length === 0) continue;
    const match = FELT_ENTRY.exec(piece);
    const low = match?.[1] ? ROMAN_LEVELS[match[1]] : undefined;
    const high = match?.[2] ? ROMAN_LEVELS[match[2]] : low;
    if (!match?.[1] || !match[3] || low === undefined || high === undefined) {
      if (!lastPlaces) return null;
      lastPlaces[lastPlaces.length - 1] = `${lastPlaces[lastPlaces.length - 1] ?? ''}, ${piece}`;
      continue;
    }
    if (firstLevel !== null && high > firstLevel) return null;
    firstLevel ??= high;
    const scale = match[2] ? `${match[1]} - ${match[2]}` : match[1];
    const group = groups.get(scale) ?? { level: high, places: [] };
    group.places.push(match[3]);
    groups.set(scale, group);
    lastPlaces = group.places;
  }
  if (groups.size === 0) return null;
  return [...groups.entries()]
    .map(([scale, { level, places }]) => ({ scale, level, places }))
    .sort((a, b) => b.level - a.level);
}

export type DepthClass = 'shallow' | 'intermediate' | 'deep';

/** The usual classes in seismology: shallow under 60 km, intermediate to 300 km, deep beyond. */
export function depthClassOf(depthKm: number): DepthClass {
  if (depthKm < 60) return 'shallow';
  return depthKm <= 300 ? 'intermediate' : 'deep';
}

/** Whether BMKG's statement names a tsunami threat, so that it is never shown as a quiet note. */
export function statesTsunamiThreat(potency: string): boolean {
  return /tsunami/i.test(potency) && !/tidak/i.test(potency);
}
