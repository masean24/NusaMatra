import { RegionComparison } from '@/features/comparison';
import { DataHubBanner } from '@/features/data-hub';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';

/** Bandingkan (Figma 12:840): two regions side by side, comparing only indicators that are comparable. */
export function ComparisonPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} wide>
      <DataHubBanner />
      <RegionComparison />
    </FeaturePageFrame>
  );
}
