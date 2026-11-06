import { SPLASH_DOTS, SPLASH_MAP_HEIGHT, SPLASH_MAP_WIDTH } from './splashDots';

const CENTRE_X = SPLASH_MAP_WIDTH / 2;
const CENTRE_Y = SPLASH_MAP_HEIGHT / 2;

const MAX_PIXEL_RATIO = 2;
const MAP_SETTLE_MS = 3200;
const MAP_START_SCALE = 1.12;

const DOT_DURATION_MS = 900;
const DOT_START_DELAY_MS = 120;
const DOT_DELAY_PER_UNIT_MS = 2.4;
/** The sonar's front is an ellipse: rows are further apart in time than columns. */
const VERTICAL_STRETCH = 1.4;
/** A dot grows and shines for this part of its time, then settles. */
const FLASH_SHARE = 0.35;
const FLASH_SCALE = 2.8;
const FLASH_COLOUR = '#FF8A3D';

const INNER_RADIUS = 1.15;
const INNER_OPACITY = 0.55;
const COAST_RADIUS = 1.65;
const COAST_OPACITY = 0.72;
/** Below this share of warm colour a dot is simply its base colour. */
const WARM_VISIBLE = 0.02;

const FULL_CIRCLE = Math.PI * 2;

/** Each dot's start time, worked out once: the sonar leaves the middle of the map. */
const DOTS = SPLASH_DOTS.map(([x, y, coast]) => ({
  x,
  y,
  coast: coast === 1,
  delay:
    DOT_START_DELAY_MS + Math.hypot(x - CENTRE_X, (y - CENTRE_Y) * VERTICAL_STRETCH) * DOT_DELAY_PER_UNIT_MS,
}));

const expoOut = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/**
 * Draws the map of dots on the canvas, in its 1060×440 space. With `still`, one final frame; otherwise
 * frame by frame until every dot has settled and the map has stopped shrinking, and then nothing runs.
 * Colours come from the theme's custom properties. Returns the function that stops it.
 */
export function startSplashDots(canvas: HTMLCanvasElement, still: boolean): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;
  const style = getComputedStyle(canvas);
  const innerColour = style.getPropertyValue('--splash-dot').trim();
  const coastColour = style.getPropertyValue('--splash-dot-coast').trim();

  const fit = () => {
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
  };

  const draw = (elapsed: number): boolean => {
    let settled = true;
    const mapScale = still ? 1 : mix(MAP_START_SCALE, 1, expoOut(Math.min(1, elapsed / MAP_SETTLE_MS)));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(canvas.width / SPLASH_MAP_WIDTH, 0, 0, canvas.height / SPLASH_MAP_HEIGHT, 0, 0);
    context.translate(CENTRE_X, CENTRE_Y);
    context.scale(mapScale, mapScale);
    context.translate(-CENTRE_X, -CENTRE_Y);

    for (const dot of DOTS) {
      const progress = still ? 1 : (elapsed - dot.delay) / DOT_DURATION_MS;
      if (progress <= 0) {
        settled = false;
        continue;
      }
      const finalOpacity = dot.coast ? COAST_OPACITY : INNER_OPACITY;
      let scale = 1;
      let opacity = finalOpacity;
      let warm = 0;
      if (progress < FLASH_SHARE) {
        const rise = expoOut(progress / FLASH_SHARE);
        scale = FLASH_SCALE * rise;
        opacity = rise;
        warm = 1;
      } else if (progress < 1) {
        const fall = expoOut((progress - FLASH_SHARE) / (1 - FLASH_SHARE));
        scale = mix(FLASH_SCALE, 1, fall);
        opacity = mix(1, finalOpacity, fall);
        warm = 1 - fall;
      }
      if (progress < 1) settled = false;

      context.globalAlpha = opacity;
      context.fillStyle = dot.coast ? coastColour : innerColour;
      context.beginPath();
      context.arc(dot.x, dot.y, (dot.coast ? COAST_RADIUS : INNER_RADIUS) * scale, 0, FULL_CIRCLE);
      context.fill();
      if (warm > WARM_VISIBLE) {
        context.globalAlpha = opacity * warm;
        context.fillStyle = FLASH_COLOUR;
        context.fill();
      }
    }
    return settled && (still || elapsed >= MAP_SETTLE_MS);
  };

  fit();
  const started = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    frame = draw(now - started) ? 0 : requestAnimationFrame(tick);
  };
  if (still) draw(0);
  else frame = requestAnimationFrame(tick);

  const onResize = () => {
    fit();
    if (!frame) draw(performance.now() - started);
  };
  window.addEventListener('resize', onResize);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
  };
}
