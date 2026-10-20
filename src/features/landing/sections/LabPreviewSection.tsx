import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { surfaceClassName } from '@/components/ui/Surface/surfaceClassName';
import {
  DEMO_CRITERIA,
  DEMO_CURRENT_WEIGHTS,
  DEMO_PREVIOUS_WEIGHTS,
  DEMO_REGIONS,
} from '@/data/fixtures/landingDemo';
import { basisPointsToPercent, rankRegions } from '@/domain/prioritization';
import { Reveal, useReducedMotion, useRevealOnce } from '@/features/motion';
import { formatPercent } from '@/lib/format';
import { DemoRanking } from '../components/DemoRanking';
import { SceneZone } from '../scene3d/SceneZone';
import styles from './LabPreviewSection.module.css';

/* G5: bars fill over 500ms, 60ms apart, after the band's 700ms entrance; G6 runs once G5 is done. */
const BAR_FILL_MS = 500;
const BAR_STAGGER_MS = 60;
const G6_START_MS = 700 + BAR_FILL_MS + BAR_STAGGER_MS * (DEMO_CRITERIA.length - 1);

export function LabPreviewSection() {
  const reducedMotion = useReducedMotion();
  const { ref: panelRef, revealed } = useRevealOnce<HTMLDivElement>();
  const [replayed, setReplayed] = useState(false);

  const previousRanking = useMemo(() => rankRegions(DEMO_REGIONS, DEMO_PREVIOUS_WEIGHTS), []);
  const currentRanking = useMemo(() => rankRegions(DEMO_REGIONS, DEMO_CURRENT_WEIGHTS), []);
  const previousRanks = useMemo(
    () => new Map(previousRanking.ranked.map((entry) => [entry.region.code, entry.rank])),
    [previousRanking],
  );

  useEffect(() => {
    if (!revealed || replayed) return;
    const timer = window.setTimeout(
      () => {
        setReplayed(true);
      },
      reducedMotion ? 0 : G6_START_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [revealed, replayed, reducedMotion]);

  const columnHeights = DEMO_CRITERIA.map((criterion) => DEMO_CURRENT_WEIGHTS[criterion.id]);

  return (
    <section id="lab-prioritas" className={styles.section} aria-labelledby="lab-title">
      <Reveal className={styles.band} distance={0} fromScale={0.96} duration={700}>
        <SceneZone
          kind="dataColumns"
          className={styles.visual}
          values={columnHeights}
          description="Ilustrasi tiga kolom data oranye di atas alas kapur; tinggi kolom mengikuti bobot kriteria: paparan banjir 45 persen, kerentanan sosial 35 persen, kapasitas layanan 20 persen."
        />
        <div ref={panelRef} className={styles.content} data-revealed={revealed}>
          <h2 id="lab-title" className={`kk-h1 ${styles.title}`}>
            Ubah bobot, lihat urutan bergeser
          </h2>
          <p className={`kk-body ${styles.lead}`}>
            Lab Prioritas menghitung urutan wilayah dari kriteria yang Anda pilih, lengkap dengan alasan
            mengapa satu wilayah naik atau turun.
          </p>

          <ul role="list" className={styles.weights} aria-label="Bobot kriteria (contoh)">
            {DEMO_CRITERIA.map((criterion, index) => {
              const percent = basisPointsToPercent(DEMO_CURRENT_WEIGHTS[criterion.id]);
              const style = {
                '--fill': percent / 100,
                '--fill-delay': `${index * BAR_STAGGER_MS}ms`,
              } as CSSProperties;
              return (
                <li key={criterion.id} className={surfaceClassName('control', styles.weight)} style={style}>
                  <span className={styles.weightHeader}>
                    <span className="kk-body-strong">{criterion.label}</span>
                    <span className={`kk-number ${styles.percent}`}>{formatPercent(percent)}</span>
                  </span>
                  <span className={styles.track} aria-hidden="true">
                    <span className={styles.bar} />
                  </span>
                </li>
              );
            })}
          </ul>

          <div className={styles.demoNote}>
            <Chip tone="onBand">Data simulasi untuk prototipe</Chip>
            <p className={`kk-caption ${styles.caption}`}>
              Urutan dihitung ulang saat bobot berubah dari 20/30/50 menjadi 45/35/20.
            </p>
          </div>

          <DemoRanking
            ranking={replayed ? currentRanking : previousRanking}
            previousRanks={replayed ? previousRanks : null}
            reducedMotion={reducedMotion}
          />

          <ButtonLink to="/lab-prioritas" className={styles.cta}>
            Coba Lab Prioritas
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}
