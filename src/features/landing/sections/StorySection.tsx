import { ButtonLink } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { HeroDioramaSlot } from '@/features/geo3d';
import { Reveal } from '@/features/motion';
import styles from './StorySection.module.css';

/**
 * Figma 41:337 "Cerita wilayah": full-width diorama band with the story card on the left.
 * The 3D engine has no story camera yet (3D-5), so the slot shows the Figma illustration.
 */
export function StorySection() {
  return (
    <section id="cerita-wilayah" className={styles.section} aria-labelledby="cerita-title">
      <div className={styles.band}>
        <HeroDioramaSlot
          scene="story"
          description="Ilustrasi diorama: kamera mendekat ke satu pulau dan air naik perlahan untuk menunjukkan dataran rendah. Ilustrasi, bukan peta geografis akurat."
        />
        <Reveal className={styles.cardSlot} distance={24} duration={700} threshold={0.35}>
          <Surface radius="card" className={styles.card}>
            <p className={`kk-body-strong ${styles.kicker}`}>Cerita wilayah</p>
            <h2 id="cerita-title" className={`kk-h2 ${styles.title}`}>
              Banyak orang tinggal tepat di tempat air berkumpul
            </h2>
            <p className={`kk-small ${styles.text}`}>
              Data yang rumit diceritakan bab demi bab, dengan visual yang bergerak mengikuti bacaan Anda.
            </p>
            <ButtonLink to="/cerita-wilayah" variant="secondary">
              Baca ceritanya
            </ButtonLink>
          </Surface>
        </Reveal>
      </div>
    </section>
  );
}
