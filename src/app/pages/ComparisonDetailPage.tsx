import { COMPARISON_DETAIL_PATH, RegionComparison } from '@/features/comparison';
import { DataHubBanner } from '@/features/data-hub';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';

const DETAIL_SHELL: FeatureShell = {
  path: COMPARISON_DETAIL_PATH,
  title: 'Rincian Perbandingan',
  summary:
    'Versi lengkap dari Bandingkan: tahun, sumber dan dataset tiap angka, penjelasan selisihnya, dan alasan bila sebuah indikator tidak dibandingkan.',
  plannedCapabilities: [],
  figmaNode: '12:840',
};

/** "Selengkapnya" of Bandingkan: the same pair (`?a=&b=`) with every year, source and reason shown. */
export function ComparisonDetailPage() {
  return (
    <FeaturePageFrame shell={DETAIL_SHELL} wide>
      <DataHubBanner />
      <RegionComparison view="detail" />
    </FeaturePageFrame>
  );
}
