import { DataHubBanner } from '@/features/data-hub';
import { ExploreWorkspace, IndicatorPanel, useRegionBrowserParams } from '@/features/exploration';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import { BackButton } from '@/features/navigation';

/**
 * Jelajahi (Figma 29:34): a full-screen map application. The 3D map fills the viewport; the search,
 * the selected region and the indicator explorer sit in one floating sidebar (a bottom sheet on
 * phones), and the data mode and the BMKG layer are status controls over the map's top right.
 */
export function ExplorePage({ shell }: { readonly shell: FeatureShell }) {
  const { selectedCode } = useRegionBrowserParams();

  return (
    <FeaturePageFrame shell={shell} immersive>
      <ExploreWorkspace
        title={shell.title}
        backLink={<BackButton />}
        status={<DataHubBanner compact />}
        indicators={<IndicatorPanel regionId={selectedCode} embedded />}
      />
    </FeaturePageFrame>
  );
}
