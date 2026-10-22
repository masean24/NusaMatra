import { DataHubBanner } from '@/features/data-hub';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import { PriorityLab } from '@/features/priority-lab';

/** Lab Prioritas (Figma 11:152): a wide decision workspace on the Data Hub's composite ranking. */
export function PriorityLabPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} workspace workspaceMaxWidthPx={LAB_WORKSPACE_MAX_PX}>
      <DataHubBanner compact />
      <PriorityLab />
    </FeaturePageFrame>
  );
}

/** Room for a 380px settings column and charts beside it, without lines too long to read. */
const LAB_WORKSPACE_MAX_PX = 1600;
