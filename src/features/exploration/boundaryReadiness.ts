import type { BoundaryCollectionDTO } from '@/services/api';
import { t } from '@/lib/i18n';

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
  const { geometryStatus, features, requestParams } = boundaries;

  if (geometryStatus.canExtrudePolygons) {
    return {
      hasPolygons: true,
      detail:
        t('Poligon batas {0} kabupaten/kota dari {1}', String(features.length), geometryStatus.source) +
        (geometryStatus.boundaryVersion ? t(', edisi {0}', geometryStatus.boundaryVersion) : '') +
        t('. Bentuk disederhanakan untuk tampilan web; bukan untuk pengukuran luas atau keperluan hukum.') +
        (requestParams.resolution === 'mobile'
          ? t(
              ' Perangkat ini memakai versi ringan: garis lebih sederhana dan pulau sangat kecil tidak digambar. Semua wilayah dan datanya tetap sama.',
            )
          : ''),
    };
  }

  const returned = geometryStatus.geometryTypeReturned ?? t('tanpa geometri');
  return {
    hasPolygons: false,
    detail:
      t(
        'Data Hub hanya mengirim geometri {0} (titik label) untuk {1} wilayah, ',
        returned,
        String(features.length),
      ) +
      t(
        'bukan poligon batas administrasi. Peta 3D tetap ilustratif dan tidak memakai titik ini sebagai batas wilayah.',
      ),
  };
}
