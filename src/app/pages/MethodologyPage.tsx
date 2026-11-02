import { DataHubBanner } from '@/features/data-hub';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';
import { MethodHeader, ScoreMethod } from '@/features/methodology';

/** "Cara skor dihitung": the score method, explained with the Data Hub's own numbers. */
export function MethodologyPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} wide bare>
      <MethodHeader title={shell.title} summary={shell.summary} />
      <DataHubBanner />
      <ScoreMethod />
    </FeaturePageFrame>
  );
}
