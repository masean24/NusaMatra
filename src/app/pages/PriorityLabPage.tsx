import { DataHubBanner } from '@/features/data-hub';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import { PriorityLab } from '@/features/priority-lab';

/** Lab Prioritas (Figma 11:152): weight sliders on the Data Hub's exploratory DEMO ranking preview. */
export function PriorityLabPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} wide>
      <DataHubBanner />
      <PriorityLab />
    </FeaturePageFrame>
  );
}
