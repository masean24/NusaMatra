import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { buttonClassName } from '@/components/ui/Button/buttonClassName';
import { Icon } from '@/components/ui/Icon/Icon';
import { Reveal } from '@/features/motion';
import { useStaggeredNavigate } from '@/features/navigation';
import { GUIDED_QUESTIONS, type GuidedQuestion, type QuestionId } from './howItWorksQuestions';
import { QuestionPreviewArt } from './QuestionPreviewArt';
import styles from './HowItWorksSection.module.css';

/* G3: heading rises 24px (600ms); the question cards follow one by one, 80ms apart. */
const G3_STEP_STAGGER_MS = 80;

/** Arrow keys move between questions in reading order, whether the list is a column or a 2×2 grid. */
const KEY_STEP: Partial<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

const tabId = (id: QuestionId) => `cara-kerja-tab-${id}`;
const panelId = (id: QuestionId) => `cara-kerja-panel-${id}`;

function QuestionPanel({
  question,
  active,
}: {
  readonly question: GuidedQuestion;
  readonly active: boolean;
}) {
  const leaveTo = useStaggeredNavigate();

  return (
    <div
      id={panelId(question.id)}
      role="tabpanel"
      aria-labelledby={tabId(question.id)}
      className={styles.panel}
      data-active={active || undefined}
      // Inactive panels stay mounted (stacked in one grid cell) so switching can crossfade and the
      // card keeps the height of its tallest panel; inert keeps them out of focus and the a11y tree.
      inert={!active}
    >
      <div className={styles.panelHead}>
        <p className={`kk-small ${styles.answers}`}>Menjawab: “{question.question}”</p>
        <h3 className={`kk-h3 ${styles.panelTitle}`}>{question.title}</h3>
      </div>
      <div className={styles.picture}>
        <span className={styles.tag}>Contoh</span>
        <QuestionPreviewArt id={question.id} />
      </div>
      <div className={styles.panelBody}>
        <p className={`kk-body ${styles.description}`}>{question.description}</p>
        <p className={`kk-caption ${styles.stepsLabel}`}>Mulai di sini</p>
        <ol className={styles.steps}>
          {question.steps.map((step, index) => (
            <li key={step}>
              <span className={`kk-number ${styles.stepNumber}`} aria-hidden="true">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Link
            to={question.to}
            className={buttonClassName('accent', styles.cta)}
            onClick={(event) => {
              leaveTo(event, question.to);
            }}
          >
            {question.cta} <span aria-hidden="true">→</span>
          </Link>
          <p className={`kk-small ${styles.hint}`}>{question.hint}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * "Cara kerja" as a Guided Question Canvas: four questions as tabs, and beside them an illustrated
 * preview of how the matching feature answers it, with a link into that feature. Selecting another
 * question crossfades the preview; the previews are static examples, labelled as such.
 */
export function HowItWorksSection() {
  const [activeId, setActiveId] = useState<QuestionId>('jelajahi');
  const tabRefs = useRef(new Map<QuestionId, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const last = GUIDED_QUESTIONS.length - 1;
    const step = KEY_STEP[event.key];
    let next: number | null = null;
    if (step !== undefined) next = (index + step + GUIDED_QUESTIONS.length) % GUIDED_QUESTIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    const target = next === null ? undefined : GUIDED_QUESTIONS[next];
    if (!target) return;
    event.preventDefault();
    setActiveId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    // tabIndex -1: the hero's "Lihat cara kerjanya" moves focus here along with the scroll.
    <section id="cara-kerja" tabIndex={-1} className={styles.section} aria-labelledby="cara-kerja-title">
      <Reveal distance={24} duration={600}>
        <h2 id="cara-kerja-title" className={`kk-h1 ${styles.title}`}>
          Dari pertanyaan sederhana ke keputusan yang bisa diperiksa
        </h2>
      </Reveal>
      <div className={styles.canvas}>
        <div
          role="tablist"
          aria-label="Pertanyaan yang bisa dijawab"
          aria-orientation="vertical"
          className={styles.tabs}
        >
          {GUIDED_QUESTIONS.map((question, index) => {
            const selected = question.id === activeId;
            return (
              <Reveal
                key={question.id}
                distance={0}
                fromX={-16}
                duration={600}
                delay={120 + index * G3_STEP_STAGGER_MS}
              >
                <button
                  ref={(element) => {
                    if (element) tabRefs.current.set(question.id, element);
                    else tabRefs.current.delete(question.id);
                  }}
                  id={tabId(question.id)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId(question.id)}
                  tabIndex={selected ? 0 : -1}
                  className={`glass ${styles.tab}`}
                  onClick={() => {
                    setActiveId(question.id);
                  }}
                  onKeyDown={(event) => {
                    handleKeyDown(event, index);
                  }}
                >
                  <span className={styles.tabIcon}>
                    <Icon name={question.icon} size={22} />
                  </span>
                  <span className={styles.tabText}>
                    <span className={`kk-caption ${styles.eyebrow}`}>{question.eyebrow}</span>
                    <span className={styles.question}>{question.question}</span>
                    {/* Opens under the question only while it is the selected one (height 0fr → 1fr). */}
                    <span className={styles.summaryReveal}>
                      <span className={`kk-small ${styles.summary}`}>{question.summary}</span>
                    </span>
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>
        <div className={`glass glass--read ${styles.preview}`}>
          {GUIDED_QUESTIONS.map((question) => (
            <QuestionPanel key={question.id} question={question} active={question.id === activeId} />
          ))}
        </div>
      </div>
    </section>
  );
}
