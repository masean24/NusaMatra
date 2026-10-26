import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import { LabHeader, PriorityLab } from '@/features/priority-lab';

/** Lab Prioritas (Figma 11:152): settings, ranking and explanation side by side in the site column. */
export function PriorityLabPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} bare>
      <LabHeader />
      <PriorityLab />
    </FeaturePageFrame>
  );
}
