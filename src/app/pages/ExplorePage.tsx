import { DataHubBanner } from '@/features/data-hub';
import {
  BoundaryNotice,
  ExplorationMapPanel,
  IndicatorPanel,
  RegionDetailPanel,
  RegionExplorer,
  useRegionBrowserParams,
} from '@/features/exploration';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import styles from './ExplorePage.module.css';

/** Jelajahi (Figma 29:34): the illustrative map, plus real region search, profile and indicators from the Data Hub. */
export function ExplorePage({ shell }: { readonly shell: FeatureShell }) {
  const { selectedCode } = useRegionBrowserParams();

  return (
    <FeaturePageFrame shell={shell} wide>
      <DataHubBanner />
      <ExplorationMapPanel />
      <BoundaryNotice />
      <div className={styles.browser}>
        <RegionExplorer />
        <RegionDetailPanel regionId={selectedCode} />
      </div>
      <IndicatorPanel regionId={selectedCode} />
    </FeaturePageFrame>
  );
}
