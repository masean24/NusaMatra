import { IntroGate } from '@/features/intro';
import { CallToActionSection } from './sections/CallToActionSection';
import { HeroSection } from './sections/HeroSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { LabPreviewSection } from './sections/LabPreviewSection';
import { SourcesSection } from './sections/SourcesSection';
import { TransparencySection } from './sections/TransparencySection';
import styles from './LandingPage.module.css';
import { t } from '@/lib/i18n';

/**
 * The full scrolling landing from Figma 27:2 (Normal) and 27:118 (Kaca), in its section order. Each
 * time the site is loaded or refreshed here the opening plays over it; the page renders underneath
 * from the start, so nothing waits on the animation.
 */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <title>{t('Nusa Matra — Memahami wilayah, menentukan arah')}</title>
      <IntroGate />
      <HeroSection />
      <HowItWorksSection />
      <LabPreviewSection />
      <TransparencySection />
      <SourcesSection />
      <CallToActionSection />
    </div>
  );
}
