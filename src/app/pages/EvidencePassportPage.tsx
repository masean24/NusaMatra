import { EvidencePassport } from '@/features/evidence-passport';
import { FeaturePageFrame, type FeatureShell } from '@/features/feature-shell';

/**
 * Paspor Bukti (Figma 13:446): a browser-assembled evidence record. It carries its own source-status
 * section, so the page deliberately has no DataHubBanner or mode switch: the record's mode comes from
 * the fetched responses, not from the global toggle.
 */
export function EvidencePassportPage({ shell }: { readonly shell: FeatureShell }) {
  return (
    <FeaturePageFrame shell={shell} wide>
      <EvidencePassport />
    </FeaturePageFrame>
  );
}
