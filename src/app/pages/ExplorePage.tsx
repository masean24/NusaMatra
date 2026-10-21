import { DataHubBanner } from '@/features/data-hub';
import { ExploreWorkspace, IndicatorPanel, useRegionBrowserParams } from '@/features/exploration';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';

/**
 * Jelajahi (Figma 29:34): the map with its contextual panel for the chosen region, and the
 * indicator catalog below for anyone who wants to read definitions on their own.
 */
export function ExplorePage({ shell }: { readonly shell: FeatureShell }) {
  const { selectedCode } = useRegionBrowserParams();

  return (
    <FeaturePageFrame shell={shell} wide>
      <DataHubBanner />
      <ExploreWorkspace />
      <IndicatorPanel regionId={selectedCode} />
    </FeaturePageFrame>
  );
}
