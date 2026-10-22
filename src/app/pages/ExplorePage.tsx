import { DataHubBanner } from '@/features/data-hub';
import { ExploreWorkspace, IndicatorPanel, useRegionBrowserParams } from '@/features/exploration';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';

/**
 * Jelajahi (Figma 29:34): a map-first workspace. The data mode sits in the map's toolbar, the map
 * and its contextual panel fill the first viewport, and the indicator catalog follows below for
 * anyone who wants to read definitions on their own.
 */
export function ExplorePage({ shell }: { readonly shell: FeatureShell }) {
  const { selectedCode } = useRegionBrowserParams();

  return (
    <FeaturePageFrame shell={shell} workspace>
      <ExploreWorkspace toolbar={<DataHubBanner compact />} />
      <IndicatorPanel regionId={selectedCode} />
    </FeaturePageFrame>
  );
}
