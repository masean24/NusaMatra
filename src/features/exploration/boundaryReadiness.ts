import type { BoundaryCollectionDTO } from '@/services/api';

export interface BoundaryReadiness {
  /** True only when the Data Hub really sent polygon geometry. The 3D map is never fed anything else. */
  readonly hasPolygons: boolean;
  readonly detail: string;
}

/**
 * Plain-language reading of the Data Hub's `geometry_status`. In DEMO v0.1.0 the boundary endpoint
 * returns one label `Point` per region, which cannot be extruded as an administrative area, so the
 * illustrative diorama stays illustrative.
 */
export function describeBoundaryReadiness(boundaries: BoundaryCollectionDTO): BoundaryReadiness {
  const { geometryStatus, features } = boundaries;

  if (geometryStatus.canExtrudePolygons) {
    return {
      hasPolygons: true,
      detail:
        `Poligon batas ${String(features.length)} kabupaten/kota dari ${geometryStatus.source}` +
        (geometryStatus.boundaryVersion ? `, edisi ${geometryStatus.boundaryVersion}` : '') +
        '. Bentuk disederhanakan untuk tampilan web; bukan untuk pengukuran luas atau keperluan hukum.',
    };
  }

  const returned = geometryStatus.geometryTypeReturned ?? 'tanpa geometri';
  return {
    hasPolygons: false,
    detail:
      `Data Hub hanya mengirim geometri ${returned} (titik label) untuk ${String(features.length)} wilayah, ` +
      `bukan poligon batas administrasi. Peta 3D tetap ilustratif dan tidak memakai titik ini sebagai batas wilayah.`,
  };
}
