# 09 — Motion, 3D & Interaction Engineering Guidelines

**Product:** Nusa Matra · **Version:** 1.0 · **Updated:** 2026-10-19  
**Audience:** Claude Code, frontend engineers, designers, QA  
**Status:** Engineering contract with explicit `FIGMA-VERIFIED` and `PROPOSED` decisions

> **Implementation directive:** Reproduce approved motion when documented by Figma, build original animation when references are insufficient, and never sacrifice usability, responsiveness, accessibility, performance, or clean code to achieve a visual effect.

## 0. Reading order and decision authority

Read `../CLAUDE.md`, `../project_guidelines.md`, `03-UI-UX-DESIGN-SYSTEM.md`, `02-USER-FLOWS.md`, and `04-TECH-STACK-ARCHITECTURE.md` before implementing animation. Use the Figma file as visual authority. The hierarchy is: current explicit owner instructions → current Figma frames/annotations → approved engineering decisions → these guidelines → third-party inspiration.

**Evidence labels:** `LOCKED` = agreed; `FIGMA-VERIFIED` = directly inspected Figma node; `PROPOSED` = engineering recommendation to validate; `TBD` = blocked decision. Decorative prototype content is **not** authoritative live geospatial or risk data.

### Reference register

| Reference              | URL / node                                                                                              | Role                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Final Figma            | https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2 | Primary source of truth; historical file title does not rename the product |
| Motion annotation      | Figma `43:713`                                                                                          | G1–G11 scroll motion and 3D-1–3D-4                                         |
| Theme specification    | Figma `30:1467`                                                                                         | Organic Normal ↔ Kaca transition                                           |
| Landing Normal / Kaca  | `27:2` / `27:118`                                                                                       | Landing visual targets                                                     |
| Landing transitions    | `42:330` / `42:780`                                                                                     | Both theme directions                                                      |
| Jelajahi Normal / Kaca | `29:34` / `29:485`                                                                                      | Map page variants                                                          |
| Jelajahi transitions   | `30:479` / `30:955`                                                                                     | Both theme directions                                                      |
| Peta Utama hub         | `61:1183` / `61:1619`                                                                                   | Map hub variants                                                           |
| Hub transitions        | `63:858` / `63:1319`                                                                                    | Both theme directions                                                      |
| Story                  | `14:927`                                                                                                | Scroll story and reduced-motion control                                    |
| Fuselab inspiration    | https://fuselabcreative.com/our-projects/cyberdefend/                                                   | Aesthetic reference, not copy/license grant                                |
| 21st.dev               | https://21st.dev/                                                                                       | Inspect available React patterns, API, maintenance and licenses before use |

## 1. Non-negotiable behavior

1. Functionality and accessible content exist without animation or WebGL.
2. The user's current region, filters, route, weights, and analysis must survive a display-mode transition.
3. No scroll hijacking or forced scroll trapping. Keyboard, touch and conventional browser navigation continue to work.
4. Prefer transforms and opacity for animation; never continuously animate layout-heavy properties when avoidable.
5. Cancel, dispose, and detach all animation timelines, event listeners, requestAnimationFrame loops, observers, workers and WebGL resources when unmounted.
6. Cap movement amplitude, duration and visual complexity; never force vestibular-motion effects on users who request reduced motion.
7. Do not use an image of a mockup as a replacement for implemented, semantic React UI.
8. Maintain distinction between illustrative islands/hexagons and verified real geographic boundaries.
9. Provide semantic descriptions for data-rich visuals; decorative 3D can be hidden from assistive technology while adjacent meaningful content remains available.
10. Make custom animations reusable, testable, documented, and bounded to a component or hook.

## 2. Technology selection matrix (`PROPOSED`)

| Need                                   | Default option                                 | Avoid                                                   |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Hover, focus, simple enter/exit        | CSS transitions / keyframes                    | Adding a JS animation runtime for a single opacity fade |
| Component entrance, layout transitions | Motion for React (if selected)                 | Duplicated CSS and JS animation drivers                 |
| Long coordinated scroll sequences      | GSAP + ScrollTrigger (if justified)            | Global anonymous timelines and scroll hijacking         |
| Responsive 3D scene                    | Three.js / React Three Fiber (if selected)     | WebGL for simple flat UI                                |
| Lightweight illustration and map       | SVG, CSS, canvas as appropriate                | Full 3D stack for a static badge                        |
| Data plot changes                      | Accessible chart library transitions, optional | Morphs that obscure values or switch scale silently     |

**Library ownership:** Choose one principal UI timeline strategy per feature; do not install both GSAP and Motion automatically. Pick the smallest dependency set capable of meeting Figma. Record the rationale in an Architecture Decision Record (ADR). External code must be license compatible, independently reviewed, and adapted to the Nusa Matra design system.

## 3. Shared motion primitives (`FIGMA-VERIFIED`)

From Figma node `43:713`:

- General one-time scroll reveal begins when approximately **20% of an element enters the viewport**.
- Rise: **16–32 px**, with opacity 0 → 1.
- Duration: **600–700 ms**; easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- Sibling stagger: **80–100 ms**.
- Reduced-motion preference: content appears immediately without reveal displacement.

Implementation recommendation: `IntersectionObserver` with once-per-element state and explicit `rootMargin`/threshold tests; distinguish “20% visible” from “element crosses 20% of viewport.” If using an animation library, its viewport semantics must match the design outcome. Do not animate important content offscreen until a JS bundle finishes loading.

```ts
export type MotionPreference = 'full' | 'reduced';
export type DisplayMode = 'normal' | 'kaca';
export type RevealPreset = 'hero' | 'section' | 'cards' | 'none';

export interface MotionConfig {
  preference: MotionPreference;
  durationMs: number;
  easing: [number, number, number, number];
  staggerMs?: number;
  distancePx?: number;
}
```

Suggested CSS primitives (not a requirement to use these literal selectors):

```css
:root {
  --nm-ease-calm: cubic-bezier(0.16, 1, 0.3, 1);
  --nm-reveal-ms: 650ms;
  --nm-reveal-offset: 24px;
}

[data-reveal][data-state='pending'] {
  opacity: 0;
  transform: translateY(var(--nm-reveal-offset));
}
[data-reveal][data-state='entered'] {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity var(--nm-reveal-ms) var(--nm-ease-calm),
    transform var(--nm-reveal-ms) var(--nm-ease-calm);
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
```

Ensure pending content is never permanently invisible if JavaScript is disabled or initialization fails: apply pending state only after observer setup succeeds.

## 4. Figma motion inventory G1–G11

Each row is `FIGMA-VERIFIED` for its concept; implementation timing must be inspected at the specific scene before treating unmentioned numbers as exact.

| ID      | Trigger                           | Intended effect                                                                           | Acceptance behavior                                                  |
| ------- | --------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **G1**  | Landing load                      | Title, lead, search, CTA rise ~28px; ~90ms stagger; ~700ms                                | All remain interactive during/after entrance; no hydration flash     |
| **G2**  | Landing load + pointer            | Diorama rises ~60px, fades in ~1.1s; floating cards follow; optional pointer parallax ±6° | Pointer parallax disabled on touch/reduced motion                    |
| **G3**  | Worksteps section enters          | Heading rises ~24px; five steps enter horizontally ~16px with ~80ms stagger               | Each step readable in DOM, including without motion                  |
| **G4**  | Scroll through data-layer section | Layered island rises and splits into three layers following scroll progress               | No scroll lock; data labels persist                                  |
| **G5**  | Lab showcase enters               | Background scale ~0.96→1; weight bars fill from zero with offsets                         | Numbers available immediately and unaffected by cosmetic delay       |
| **G6**  | Priority ranking demo             | One-time FLIP ranking reorder ~320ms; one chip pulse                                      | Motion does not imply a LIVE calculation unless it actually occurred |
| **G7**  | Data-health section enters        | Three cards stagger ~100ms; status icons scale 0.8→1                                      | Status conveyed by words and not just motion/color                   |
| **G8**  | Evidence passport enters          | Floating 3D document rotates ~20°→8°; orange seal stamps ~300ms                           | Textual evidence summary adjacent                                    |
| **G9**  | Story chapter progression         | Camera travels to an island, water rises gently, story card arrives                       | Provide immediate/static chapter transition under reduced motion     |
| **G10** | Sources section enters            | Three source cards reveal sequentially (~90ms)                                            | Sources remain clickable and text-attributed                         |
| **G11** | Closing CTA enters                | CTA panel rises ~32px; search may shimmer **once**                                        | No infinite shimmer or flashing                                      |

### G6 correctness guardrail

If rank rows visibly exchange positions in the marketing demo, label it as illustrative. On the actual Lab page, reorder from the same engine result passed to the rankings and explanations. Do not animate stale rankings while the numeric scores already belong to the next run.

## 5. Four illustrated 3D zones (`FIGMA-VERIFIED` concepts)

### 5.1 `3D-1`: Diorama Nusantara (Landing hero)

- Visual: deep cobalt sea plate, approximately five layered chalk islands, three orange markers.
- Experience: entrance and subtle pointer parallax; “Mulai jelajahi” can animate camera toward flattening hexagon-style map illustration.
- The **visual diorama is illustrative**; it is not a geographic coordinate dataset.
- Interaction: CTA navigates to usable Jelajahi/Peta Utama route even if 3D fails or is disabled.
- Fallback: optimized poster SVG/image with the same accessible CTA and semantic text.

### 5.2 `3D-2`: Layered Data Island (How it works)

- A single island separates into **three** translucent layers (risk, social, services) as scroll progresses.
- The layers need labels and a plain-text description. Do not present specific 3D elevation as measured risk without source disclosure.
- Debounce/resample scrolling using animation frame or library driver; drop heavy shaders first on constrained devices.

### 5.3 `3D-3`: Reactive Data Columns (Lab Prioritas)

- Three orange-tinted glass columns above a pale base change height with weighting slider interaction.
- The 3D bars are explanatory decoration, not the sole presentation of scores or weights.
- Drive visual height from the **same canonical state** as numeric weights; never separately calculate a display-only “score.”
- Pause scene when tab hidden or outside viewport; restore safely.

### 5.4 `3D-4`: Floating Paspor Bukti (Transparency)

- Render an illustrative evidence document with orange seal and gentle motion.
- Do not misrepresent an ungenerated demo passport as an exported official record.
- Provide real evidence manifest/source links in accessible DOM; visual document can be `aria-hidden` when redundant.

## 6. Normal ↔ Kaca transition (`FIGMA-VERIFIED`)

From Figma `30:1467`:

1. Switch droplet springs toward target segment, **420 ms**.
2. Target-color organic liquid swells from the switch with droplets, **420 ms**, easing `cubic-bezier(.65, 0, .35, 1)`.
3. Liquid covers canvas and reveals destination mode, **520 ms**, easing `cubic-bezier(.16, 1, .3, 1)`.
4. Visual sequence **~0.95 seconds** with _overlapping_ phases; never sum these durations mechanically.
5. Suggested effect: two layered theme surfaces, SVG organic `clip-path`, a controlled gooey filter (`feGaussianBlur`/`feColorMatrix`) or shader only where necessary.
6. Persist chosen display mode in `localStorage`, applying it _before first meaningful render_ to avoid flashes.
7. Semantic switch: `role="switch"` / checked state with localized label **“Mode tampilan kaca”**.
8. For `prefers-reduced-motion: reduce`: use a **200 ms crossfade or instant swap** rather than liquid spread.
9. For `prefers-reduced-transparency` or `prefers-contrast: more`: disable/reduce glass opacity and blur to preserve readability.
10. Figma guidance: maximum **six simultaneous backdrop-filter glass panels** per screen; weaker device fallback blur around **8 px** (validate against actual performance).

### 6.1 State machine and interruptions (`PROPOSED`)

```text
NORMAL_IDLE -> TRANSITION_TO_KACA -> KACA_IDLE
KACA_IDLE   -> TRANSITION_TO_NORMAL -> NORMAL_IDLE
reduced motion: IDLE -> immediate/short crossfade -> IDLE
unmount/route change: cancel timeline -> commit latest requested mode -> cleanup
```

- During active transition, either coalesce subsequent toggle requests to the most recent intent or temporarily disable toggle with clear feedback; do **not** run simultaneous overlapping theme transitions.
- Set mode **once** in centralized app state. Ensure switching does not reset other route state.
- Restore keyboard focus to switch after transition where appropriate, without stealing focus if the user navigated elsewhere.
- Prevent inaccessible duplication from two rendered theme layers using `aria-hidden`, `inert`, and pointer-event controls on offscreen copy; ideally animate a visual overlay atop a **single semantic UI tree**.

### 6.2 React hook boundaries (`PROPOSED`)

```ts
interface ThemeTransitionDriver {
  enter(nextMode: DisplayMode, origin: { x: number; y: number }): Promise<void>;
  cancel(): void;
  dispose(): void;
}

interface UseDisplayModeResult {
  mode: DisplayMode;
  isTransitioning: boolean;
  setMode: (next: DisplayMode) => void;
}
```

Components: `DisplayModeSwitch` (control), `DisplayModeProvider` (persistent state), `LiquidThemeOverlay` (decorative effect), `useReducedMotionPreference`, `useMotionLifecycle`. Do not create a global god hook that also owns map, comparison and API state.

## 7. Scroll, gesture and navigation rules

- Use `IntersectionObserver` for entering static sections and a scroll progress driver only for animations genuinely dependent on scroll position.
- Never block wheel/touch events or override the user's scroll distance.
- Page transition must not delay accessibility announcements or prevent browser Back from working.
- Keep browser history and route focus management handled by routing, not animation code.
- On route unmount, restore body scroll if a dialog/overlay acquired a temporary lock.
- Pointer parallax is optional, visually subordinate, and disabled for coarse pointer/touch and reduced motion.
- Interactive graph transitions keep scales and labels legible, and use non-motion change announcements for screen readers.

## 8. Accessibility and motion safety

Minimum practices:

- Use `matchMedia('(prefers-reduced-motion: reduce)')` or framework helper and subscribe to preference changes.
- Honor motion reduction in **all** custom WebGL, GSAP, canvas and CSS code—not only CSS.
- Detect `prefers-contrast: more` and `prefers-reduced-transparency` as supported, with readable fallback even when preference media query is unsupported.
- Prevent flashes/strobes, repeated zooming, rapid high-amplitude movement and perpetual pulsing.
- Respect keyboard-only journeys, `focus-visible`, `aria-live` where needed, and non-color data distinction.
- Provide controls to pause prolonged nonessential animation when warranted.
- Deliver sufficient text contrast over glass and animated backgrounds (target ordinary text 4.5:1).
- Do not create a separate invisible duplicated interactive DOM tree solely to implement transitions.

## 9. Performance budgets (`PROPOSED`, to validate on target devices)

| Resource         | Engineering target / policy                                                                        | Evidence                          |
| ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| Initial route    | Do not eagerly ship full 3D libraries to users not viewing 3D                                      | Bundle analyzer and coverage      |
| Animation frames | Aim for smooth 60fps on reasonable desktop hardware; degrade gracefully                            | Performance panel, frame timeline |
| Long tasks       | Reduce work and blocking CPU execution; prefer deferred imports                                    | DevTools / automated metrics      |
| GPU context      | Maximum one heavy active WebGL hero scene per visible area as a starting guideline                 | Memory/CPU profiling              |
| Reduced motion   | No parallax/liquid/camera flight; static informative state remains                                 | E2E / visual checks               |
| Map              | Load map code/tiles only on map routes; don't allocate hidden map + diorama together unnecessarily | Route profiling                   |
| Blur             | Constrain simultaneous expensive backdrop filters                                                  | Frame profile and device testing  |
| Background tab   | Pause animation and rendering loops                                                                | Visibility lifecycle tests        |

Performance numbers other than explicit Figma timing are **targets, not measured claims**. Measure on low/mid-range Android, iOS Safari, desktop Chromium and Firefox when available.

### Adaptive quality (`PROPOSED`)

Use feature detection, viewport, device capability and actual performance—not user-agent sniffing—as inputs to a documented quality tier:

- `full`: 3D scene and richer nonessential motion.
- `reduced`: fewer particles, reduced pixel ratio and subtle transforms.
- `static`: SVG/image poster with no animated scene.

The same controls and explanatory content are present at all tiers. Avoid inferring actual memory limits from `navigator.deviceMemory` alone; it may be unavailable.

## 10. Original animation creation requirement (`LOCKED`)

If a suitable asset, pattern or motion effect cannot be sourced from Figma, Fuselab or 21st.dev, **Claude Code must implement an original solution** rather than dropping the approved interaction. Workflow:

1. Write the intended experience in one paragraph and define semantic fallback.
2. Choose simplest sufficient primitive (CSS/SVG → Motion/GSAP → WebGL).
3. Check asset source, version, license, vulnerabilities and maintainability.
4. Separate animation state from domain state; define cleanup and cancellation.
5. Implement on a small isolated component/story first.
6. Integrate approved color tokens and Lexend typography; preserve keyboard semantics.
7. Test reduced motion, route unmount, re-entry, touch and slow device.
8. Capture visual evidence against applicable Figma node; document intentional deviations.
9. Never copy proprietary code/graphics or remove attribution obligations.

If a perfect recreation would violate browser/accessibility/performance constraints, propose an equivalent user experience and record the trade-off instead of silently changing requirements.

## 11. Example component architecture (`PROPOSED`)

```text
src/
  features/
    landing/
      components/HeroDiorama.tsx
      components/HeroDioramaFallback.tsx
      motion/heroSequence.ts
    theme/
      components/DisplayModeSwitch.tsx
      components/LiquidThemeOverlay.tsx
      hooks/useDisplayMode.ts
      motion/liquidTransition.ts
    story/
      components/StoryDiorama.tsx
      hooks/useStoryProgress.ts
  shared/
    motion/RevealOnScroll.tsx
    motion/useReducedMotionPreference.ts
    motion/useVisibilityPause.ts
    motion/easing.ts
```

Do not create this structure blindly if the repository already has suitable components; follow `04-TECH-STACK-ARCHITECTURE.md` and the existing codebase.

## 12. Motion-specific tests and acceptance IDs

| ID      | Scenario                                  | Expected result                                                  |
| ------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `AN-01` | Landing initial view                      | G1 entrances appear once and content remains usable              |
| `AN-02` | Hero pointer movement                     | Subtle parallax within bounded amplitude                         |
| `AN-03` | Touch or reduced motion                   | No forced pointer parallax                                       |
| `AN-04` | Scroll through G3–G11                     | Correct triggers, no content clipped or inaccessible             |
| `AN-05` | Rapid theme toggle                        | At most one active liquid timeline; final user intent retained   |
| `AN-06` | Navigate during theme transition          | Resources disposed; valid mode persists                          |
| `AN-07` | Reload after choosing Kaca                | Mode restored without visible flash                              |
| `AN-08` | Reduced motion                            | No liquid spread; immediate/brief crossfade; all content present |
| `AN-09` | Increased contrast / reduced transparency | Readable solid or stronger panels replace unsuitable glass       |
| `AN-10` | WebGL unsupported or context lost         | Poster fallback and core CTA remain                              |
| `AN-11` | Map + 3D navigation                       | Contexts and listeners do not accumulate                         |
| `AN-12` | Lab slider update                         | 3D changes correspond to canonical weights and scores            |
| `AN-13` | Story with assistive tech                 | Equivalent chapter text and next/previous controls available     |
| `AN-14` | Browser back/reload                       | Route, focus and theme do not deadlock                           |
| `AN-15` | Animation source copied                   | License and attribution tracked in asset register                |

Use `10-TESTING-STRATEGY.md` for levels, fixtures and CI jobs, and `13-ACCEPTANCE-CRITERIA.md` for release gate IDs.

## 13. Claude Code completion checklist

- [ ] Read the exact Figma node and record any unverified dimension/motion assumptions.
- [ ] Confirm approved library choice; avoid unnecessary packages.
- [ ] Implement with isolated components and explicit resource cleanup.
- [ ] Preserve domain state throughout motion and mode switches.
- [ ] Verify all important information is accessible without 3D.
- [ ] Check reduced motion, contrast, transparency and touch alternatives.
- [ ] Verify map and diorama are not semantically confused.
- [ ] Measure performance on at least one constrained test profile.
- [ ] Execute lint, typecheck, unit/component/E2E tests as applicable.
- [ ] Record screenshot/video comparison evidence and known deviations.
- [ ] Confirm licenses/attribution for external code, assets and animations.

**Never mark a motion feature complete based on an attractive desktop screenshot alone.**

---

Related: [`03 UI/UX`](./03-UI-UX-DESIGN-SYSTEM.md) · [`04 Architecture`](./04-TECH-STACK-ARCHITECTURE.md) · [`10 Testing`](./10-TESTING-STRATEGY.md) · [`13 Acceptance`](./13-ACCEPTANCE-CRITERIA.md).
