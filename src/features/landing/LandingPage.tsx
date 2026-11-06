import { IntroGarisPantai, useIntroOnce } from '@/features/intro';
import { CallToActionSection } from './sections/CallToActionSection';
import { HeroSection } from './sections/HeroSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { LabPreviewSection } from './sections/LabPreviewSection';
import { SourcesSection } from './sections/SourcesSection';
import { TransparencySection } from './sections/TransparencySection';
import styles from './LandingPage.module.css';
import { t } from '@/lib/i18n';

/**
 * The full scrolling landing from Figma 27:2 (Normal) and 27:118 (Kaca), in its section order. On
 * the first visit of a browser session the Garis Pantai opening plays over it; the page renders
 * underneath from the start, so nothing waits on the animation.
 */
export function LandingPage() {
  const intro = useIntroOnce();
  return (
    <div className={styles.page}>
      <title>{t('Nusa Matra — Memahami wilayah, menentukan arah')}</title>
      {intro.playing && <IntroGarisPantai onDone={intro.finish} />}
      <HeroSection />
      <HowItWorksSection />
      <LabPreviewSection />
      <TransparencySection />
      <SourcesSection />
      <CallToActionSection />
    </div>
  );
}
