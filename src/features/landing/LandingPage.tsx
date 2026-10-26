import { CallToActionSection } from './sections/CallToActionSection';
import { HeroSection } from './sections/HeroSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { LabPreviewSection } from './sections/LabPreviewSection';
import { SourcesSection } from './sections/SourcesSection';
import { TransparencySection } from './sections/TransparencySection';
import styles from './LandingPage.module.css';

/** The full scrolling landing from Figma 27:2 (Normal) and 27:118 (Kaca), in its section order. */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <title>Nusa Matra — Memahami wilayah, menentukan arah</title>
      <HeroSection />
      <HowItWorksSection />
      <LabPreviewSection />
      <TransparencySection />
      <SourcesSection />
      <CallToActionSection />
    </div>
  );
}
