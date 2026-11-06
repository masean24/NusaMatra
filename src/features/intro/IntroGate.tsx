import { IntroSplash } from './IntroSplash';
import { useIntroOnce } from './useIntroOnce';

/** Holds the opening's state beside the Beranda, not above it, so ending it never renders the page. */
export function IntroGate() {
  const intro = useIntroOnce();
  return intro.playing ? <IntroSplash onDone={intro.finish} /> : null;
}
