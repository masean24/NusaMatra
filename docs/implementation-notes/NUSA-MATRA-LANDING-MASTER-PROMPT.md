# MASTER IMPLEMENTATION PROMPT — NUSA MATRA

## React Project Setup + Figma-Faithful Complete Landing Page + Premium Liquid Floating Navigation

You are **Claude Code**, acting as the **lead React engineer, senior UI/UX implementer, motion designer, accessibility engineer, and code-quality reviewer** for **Nusa Matra**, an Indonesian regional exploration and decision-support platform created for **WIA 2026**.

## 0. Mission, execution mode, and non-negotiable results

**THIS IS AN IMPLEMENTATION REQUEST, NOT A REQUEST FOR A PLAN ONLY.** Start implementing in the current repository and continue through verification. Do not stop after writing an architecture proposal or creating empty placeholder files. You have permission to create application source files, install justified project dependencies, configure the development environment, and refactor newly created code. **Do not delete unrelated user files, overwrite existing work blindly, expose credentials, or modify Figma itself.** Ask for human input only if a genuine blocker requires permissions, credentials, destructive changes, or an essential design decision that cannot be responsibly inferred from the provided sources.

The outcome must be an **actually running React + strict TypeScript application** with:

1. A clean repository foundation: runnable scripts, routing, standards, reusable design primitives, tooling, and tests.
2. A **fully implemented, full-length Nusa Matra landing page** matching the approved Figma composition as faithfully as possible, not merely a hero or generic landing template.
3. An accurate **Kapur & Kobalt** design system, **Lexend** typography, polished responsive layout, and matching Normal/Kaca display modes.
4. A real, accessible **floating navigation** with working destinations and a particularly polished **organic liquid spreading interaction** for items such as **Jelajahi**, **Lab Prioritas**, **Bandingkan**, and any other items shown in the approved Figma. See Section 8 for the exact requested behavior.
5. Purposeful section reveals, illustrated 3D scenes, graceful performance/accessibility fallbacks, and the Figma-inspired **liquid Normal ↔ Kaca mode transition**. The navbar liquid effect and the mode-transition liquid effect are two separate interactions.
6. Meaningful validation: successful build, lint, typecheck, relevant tests, keyboard interaction, reduced-motion behavior, mobile layout, and visual comparison against Figma.
7. An honest final implementation report specifying what works, what is mocked, what was inspected, what could not be confirmed, and any remaining blockers. Never claim checks ran if they did not.

**Product name is Nusa Matra.** The historical Figma file path contains “PrioritasKita”; do not use that as the website name. All user-facing copy must be **Bahasa Indonesia**; source identifiers and engineering documentation can be **English**.

The project is judged partly on **code cleanliness and maintainability**. Visual polish and Clean Code are equally important: do not accept visually pleasing but messy, brittle, inaccessible code.

## 1. Read the project and activate relevant skills BEFORE implementation

First inspect the current working directory, `git status`, package manager/lockfiles, existing project structure, local scripts, and any existing application code. Protect all pre-existing work. Read, at minimum:

- `CLAUDE.md` and `project_guidelines.md` — operational and product rules.
- `README.md`.
- `docs/01-PRODUCT-REQUIREMENTS.md` — product goals and scope.
- `docs/02-USER-FLOWS.md` — navigation and user states.
- `docs/03-UI-UX-DESIGN-SYSTEM.md` — visual tokens, Figma node register, interaction rules.
- `docs/04-TECH-STACK-ARCHITECTURE.md` — stack and clean architecture.
- `docs/09-ANIMATION-GUIDELINES.md` — motion G1–G11 and 3D-1–3D-4.
- `docs/10-TESTING-STRATEGY.md` and `docs/12-IMPLEMENTATION-ROADMAP.md`.
- `docs/13-ACCEPTANCE-CRITERIA.md`.

Review other docs as needed; do not read them only superficially or ignore constraints that apply to this slice. Resolve document conflicts using: **this owner's current task → approved current Figma → established project guidelines → architecture documents → library examples**. Record significant deviations and decisions in a short `docs/implementation-notes/landing.md` or an equivalent established project location.

**Mandatory skill discovery and usage:**

- Discover the skills, tools, and MCP integrations ACTUALLY available in this Claude Code environment.
- Before editing, read and apply the relevant available skills, particularly **Matt Pocock / TypeScript best practices**, **Taste Skill**, and **UI UX Pro Max** (their exact installed identifiers may differ). Use them in architecture, implementation, and final review whenever applicable.
- Use **Figma MCP** to inspect the design, tokens, screenshot/reference layers, components, assets, and animations. Follow the installed Figma integration's prerequisite instructions.
- Do not invent skill invocation commands, claim to have used unavailable skills, or install random third-party skills without consent. If a desired skill/MCP is absent, explicitly log the limitation, apply its ordinary best-practice principles where possible, and continue with the work that remains feasible.
- If the repo already has working conventions, reuse them unless they conflict with mandatory rules. Do not replace an existing app just because a new scaffold is easier.

**Time allocation rule:** Spend enough time to inspect the design carefully, but do not turn the task into an endless discovery exercise. Move from discovery into implementation and finish the entire requested scope.

## 2. Approved Figma: inspect these exact nodes

Figma file:
`https://www.figma.com/design/D8fuOoDZAGeBPG6nzxfFx4/PrioritasKita-%E2%80%94-UI-UX-WIA-2026?node-id=25-2`

Figma file key: `D8fuOoDZAGeBPG6nzxfFx4`.

Inspect at least these specific frames/nodes:

| Node                  | Role                                                          |
| --------------------- | ------------------------------------------------------------- |
| `25:2`                | Kapur & Kobalt design canvas                                  |
| `26:38`               | Design tokens, palette, typography and glass example          |
| `26:14`               | Button variants Aksen, Kaca, Garis; default/hover             |
| `26:37`               | Normal/Kaca mode switch                                       |
| `27:2`                | **Landing Normal**, complete 1440 × 5080 desktop page         |
| `27:118`              | **Landing Kaca**, complete 1440 × 5080 desktop page           |
| `43:250`              | Landing scroll-animation + 3D annotations                     |
| `43:713`              | Written motion specification G1–G11 and 3D-1–3D-4             |
| `49:304`              | Individual floating navbar item                               |
| `49:447`              | Complete floating navbar composition                          |
| `62:1291`             | Floating contextual page pill                                 |
| `42:330`              | Landing liquid Normal → Kaca transitional frame               |
| `42:780`              | Landing liquid Kaca → Normal transitional frame               |
| `30:1467`             | Liquid mode transition: timing, performance and accessibility |
| `61:1183` / `61:1619` | Peta Utama hub Normal/Kaca, for navigation continuity         |
| `29:34` / `29:485`    | Jelajahi Normal/Kaca, for destination semantics               |
| `11:152`              | Lab Prioritas; navigation destination context                 |
| `12:840`              | Bandingkan; navigation destination context                    |

**Before coding each major visible section:** inspect its actual Figma screen, layer tree, relevant colors/type styles, provided static assets, and available motion context. Extract actual navigation labels, layout, interaction target sizes, icons, radii, spacing, and wording from Figma rather than guessing. Read the annotated layers and compare Normal vs Kaca side by side. Use archived (`ARSIP`) frames **only as historical references**, never as the approved primary design.

If direct Figma read is unavailable, do not falsely claim pixel fidelity. Use the existing detailed docs as the fallback specification, implement the parts supported by evidence, log unverified details, and ask the owner for screenshots only if a truly essential visual detail blocks meaningful continuation.

**The final page should look like the current Figma design, not like a loosely inspired modern SaaS template.** Preserve visual hierarchy, genuine section order, layout rhythm, typography, iconography, CTA placement, layered backgrounds, data-storytelling layout, and overall art direction. Avoid generic neon/glow, arbitrary purple gradients, excessive rounded cards, irrelevant illustration, random stock images, and AI-looking decorative clutter.

Important: never use an exported full-page screenshot as the UI. Implement real semantic React elements. Download and use legitimate static assets from Figma when supported, keeping assets locally in the project. Do not reference short-lived Figma asset URLs at runtime. Do not redraw exact supplied vector assets when the actual source asset is available.

## 3. Brand, design tokens, and typography

Use a centralized, semantic token system with the source values below, which have been verified from Figma. Respect semantic contexts and variants:

```css
:root {
  --nm-sea-deep: #1e3fd9;
  --nm-sea: #2f5bff;
  --nm-sea-shallow: #5c7fff;
  --nm-land-1: #fbfaf6;
  --nm-land-2: #ede9df;
  --nm-land-3: #d9d3c3;
  --nm-land-4: #b8af9a;
  --nm-page-bg: #f2f1ec;
  --nm-text: #121826;
  --nm-text-muted: #5a6170;
  --nm-accent: #ff8a3d;
  --nm-accent-hover: #ff7420;
  --nm-priority-1: #fbfaf6;
  --nm-priority-2: #ffd9bf;
  --nm-priority-3: #ffb07a;
  --nm-priority-4: #ff8a3d;
  --nm-priority-5: #d9581a;
  --nm-glass-surface: #f2f1ec47;
  --nm-glass-stroke: #ffffff99;
  --nm-ease-calm: cubic-bezier(0.16, 1, 0.3, 1);
}
```

- **Font family:** Lexend. Load correctly and avoid layout shift; provide sensible local/system fallback.
- Figma styles include approximately `KK/Display` Lexend SemiBold 68px, `KK/H2` Medium 26px, `KK/H3` Medium 19px, `KK/Lead` Light 19px, `KK/Body` Regular 16px, `KK/Kecil` Regular 14px, `KK/Keterangan` Regular 12px, `KK/Tombol` Medium 15px. Also inspect the styles used on each target frame because other approved page-local styles exist.
- Normal panels use off-white, subtle shadows and crisp dark text.
- Glass mode uses translucent light surfaces, approximately 16px backdrop blur where verified, a subtle white stroke, and controlled shadow. Maintain readable contrast; avoid excessive blurring or stacking dozens of expensive glass panels.
- Buttons must implement **Aksen**, **Kaca**, and **Garis**, with actual hover/focus/pressed/disabled behavior. The standard primary accent is orange and its verified hover is `#FF7420`.
- Use tokens and small, reusable CSS utilities/variants rather than scattered hex codes or magic numbers. Exact dimensions must be taken from Figma; numbers absent from Figma should be treated as intentional engineering choices, not falsely called verified.
- **Do not mistake navigation icons for brand identity.** Navbar icons must be deliberate, consistent UI icons; do not put a logo into every nav item. Use the actual Figma assets when available or a consistent lightweight icon system when not.

## 4. Implement the React foundation properly

**Locked technology:** React + TypeScript (strict).

**Recommended if starting from documentation-only:** Vite + React + TypeScript, with an intentionally small set of justified packages. If the repository already has a sensible frontend stack, adapt it instead of destroying it. Avoid Next.js unless existing repo requirements explicitly require it; the agreed frontend is React and the existing docs propose Vite.

Minimum foundation:

- `package.json` with functioning `dev`, `build`, `typecheck`, `lint`, `format:check` (or equivalent), and test scripts.
- Strict `tsconfig`, ESLint and Prettier integrated into the actual source tree; sensible import conventions.
- Routing with real URLs for Landing and destination stubs, using the project's selected router. Use semantic links; no `href="#"` or decorative `onClick` with no action.
- Clean, feature-oriented architecture: `app/`, `components/ui/`, `components/layout/`, `features/landing/`, `features/navigation/`, `features/theme/`, `features/motion/`, `assets/`, `styles/`, with additional folders only when truly needed.
- Proper UI state isolation. **Display mode** is UI preference, not a data filter; changing it must not reset route/search/business state.
- Centralized responsive strategy; no horizontal overflow, z-index collisions, sticky overlays hiding content, or fixed-width desktop-only markup.
- App metadata: title, favicon, social/SEO description and accessible page title use **Nusa Matra**. Use genuine project assets when provided rather than inventing a new logo.
- A source-safe `.env.example` only. Never place a secret token into `VITE_*` or committed code.
- Lint and formatting in a consistent project configuration. Enable unit/component testing (Vitest + Testing Library is a reasonable choice) and at least a focused E2E or browser-validation path for core interactions.

**Do not create a backend or a fake public API during this step.** The Data Hub is an intentionally separate project and will be integrated later. If any illustrative values are needed for the landing design, hold them in explicitly typed fixture modules marked `DEMO`, never as fake LIVE records. Prefer text-only storytelling or clearly disclosed illustrative examples over invented statistics.

## 5. Landing page scope: entire Figma scroll composition

Build **the complete desktop landing composition** represented by Figma `27:2` and `27:118`, not only the first viewport. The frame is 1440 × 5080 for design inspection, **not** an instruction to fix the browser page height at exactly 5080px. Let actual content flow naturally while preserving spacing and proportions at the reference viewport.

Implement the Figma's section order and exact approved content as closely as possible. The visual themes and interactions must work across the **whole landing**, not only on the hero. Specifically inspect and reproduce the elements associated with:

- Hero title, lead paragraph, search CTA, main CTA, brand visual, and entrance staggering.
- **Diorama Nusantara** on the hero side: cobalt sea plate, layered chalk-toned islands (approximately five in the approved illustration), orange location markers (approximately three), floating contextual cards and subtle depth.
- Illustrated step-by-step explanation / “Cara Kerja” with five stages when present in current Figma.
- Scroll-directed layered island representing data/risk/social/services, visually splitting into three layers.
- Lab Prioritas showcase with weight bars or glass/orange data columns and an **explicit DEMO context** where numerical examples occur.
- Priority/ranking preview; illustrative reorder animation must not imply actual live recalculation.
- Data-quality / Titik Buta indicators shown as distinct meaningful statuses, not only different colors.
- Floating/rotating **Paspor Bukti** graphic with orange seal and accessible accompanying explanation.
- Cerita Wilayah/story section with island focus and a readable nonanimated alternative.
- Data/source attribution area and final CTA section.
- Floating navigation, Normal/Kaca mode switch, section progress/contextual controls and footer if present in Figma.

**All text, buttons, labels and visual sections must be based on the approved Figma.** Do not create unrelated sections to make the page longer. If a visual is purely illustrative, label it honestly where required (e.g., `Ilustrasi, bukan peta geografis akurat` or `Data simulasi untuk demonstrasi`). Any preview numbers must come from an explicit fixture with meaningful description, not arbitrary hardcoded JSX.

CTA/search behavior must be **real and understandable**. On this task, implement Landing completely; more complex feature pages (Jelajahi, Lab Prioritas, Bandingkan, etc.) are NOT expected to have their full business implementation yet. Nevertheless, navbar links and CTAs must navigate to a valid destination/section. If those destination routes are not built, create minimal, branded, accessible route shells that honestly say the feature is in development, identify the intended purpose and offer a working back/return action. Do not present such shells as production-ready feature pages. Follow actual Figma link semantics when available, and do not conflate Peta Utama and Jelajahi by assumption.

## 6. Responsive and accessible behavior

Treat Figma's 1440px frames as the primary desktop reference; if tablet/mobile frames exist, inspect and follow them. Where responsive behavior is undocumented, derive a clean, coherent layout without inventing a “Figma verified” breakpoint. As provisional checks, verify at **1440px, 1024px, 768px and 390px** widths and at least one compact 320–360px viewport.

- Desktop: retain the intentional hero composition and floating navigation.
- Tablet: gracefully reduce scene scale, reflow columns, prevent scene/card overlaps, and keep CTAs prominent.
- Mobile: stack or reorganize sections, provide a discoverable compact accessible floating nav alternative, scale/hide _decorative_ 3D without hiding meaning, keep readable typography and reasonable touch targets.
- Never trap focus, override default scrolling, or make navbar actions keyboard-inaccessible. Provide clear `:focus-visible`, labels, `aria-current="page"`, and semantic landmarks.
- Maintain accessible color contrast, especially white-on-blue/orange and text over transparent glass. Aim for WCAG 2.2 AA where practical; test actual computed surfaces, not token pairs in isolation.
- Honor `prefers-reduced-motion`, `prefers-reduced-transparency` where supported, high-contrast preferences, and a low-performance static fallback. Functional navigation must remain available without JavaScript-dependent decorative animation.
- Prevent cumulative layout shift; ensure media has dimensions and sections don't jump when fonts/scenes load.

## 7. Shared motion and 3D implementation (Figma G1–G11)

Follow `docs/09-ANIMATION-GUIDELINES.md` and actual motion annotations at `43:713`. Use a **single coordinated animation approach per class of interaction**, choosing the lightest suitable method. CSS/SVG for small effects; Motion for React or GSAP where orchestration warrants it; Three.js/React Three Fiber only where real spatial geometry is necessary. Avoid installing overlapping heavy animation engines without a clear reason.

Implement the landing-specific approved motion:

- **G1:** Hero heading, lead, search and CTA rise roughly 28px and reveal in ~700ms, stagger approximately 90ms.
- **G2:** Diorama rises roughly 60px and appears (~1.1s); floating cards follow; restrained pointer parallax approximately ±6° on capable pointer devices.
- **G3:** How-it-works title and five steps reveal with 16–24px displacement and ~80ms stagger.
- **G4:** Three island layers separate progressively during ordinary native scroll; **no scroll hijacking**.
- **G5:** Lab showcase surface appears and weight bars fill, but semantic values remain available immediately.
- **G6:** Illustrative ranking FLIP/reorder animation once, ~320ms, clearly identified as demonstration.
- **G7:** Data-health cards and stamps appear sequentially, with meaning conveyed in text.
- **G8:** Evidence document moves from roughly 20° to 8° and the orange seal stamps in around 300ms.
- **G9:** Story illustration transitions gently with a static alternative.
- **G10:** Source cards enter one by one; citation targets stay functional.
- **G11:** Final CTA rises and the search field may have **one** subtle shimmer, never an infinite flashing effect.

General reveal specification: one-time IntersectionObserver entry at approximately 20% visibility; 16–32px upward movement; ~600–700ms duration; `cubic-bezier(.16,1,.3,1)`; 80–100ms sibling stagger. Ensure visible content cannot remain stuck at `opacity: 0` if JS/observer initialization fails.

**Original animation requirement:** Search `https://21st.dev/` and Fuselab inspiration for permitted design patterns when useful, but never treat their demos as authoritative or copy external proprietary code/assets without license verification. If no suitable reusable animation exists, **create the effect independently**. A credible custom React/CSS/SVG/R3F implementation is better than a superficial library gimmick.

**3D performance:** Lazy-load heavy scene code, bound pixel ratio, throttle pointer responses, dispose geometry/material/textures, pause animation when offscreen/hidden, respect reduced motion and mobile power constraints, and show a well-composed static fallback if WebGL fails. Never allow a GPU effect to block reading the hero or using the CTA. The visual diorama is **illustrative**, not a source of map coordinates.

## 8. SPECIAL PRIORITY: floating navbar with organic LIQUID-SPREAD animation

This owner-specific request is **mandatory and high priority**. Target the **floating navigation** from Figma `49:304` and `49:447` and relevant floating page chips at `62:1291`. Items may include **Jelajahi**, **Lab Prioritas**, **Bandingkan**, and other actual Figma-approved sections/routes. **Inspect the exact items, ordering, icons and current-state layout from Figma before finalizing them.** Do not invent a different navbar arrangement just to accommodate the effect.

The intended interaction is **a premium, fluid patch of cobalt/orange/appropriate theme color that organically spreads across the selected floating pill when it receives interaction**. It must feel like liquid/ink occupying a surface—not merely an underline slide, a standard opacity change, a rectangle moving across the navbar, or a generic radial CSS ripple.

### Required triggers and state behavior

1. **Pointer hover:** When the user enters a nav item, an organic liquid shape should emerge from the pointer entry point or from the icon/center if pointer position is unavailable, then expand softly across that pill. A few tiny connected secondary droplets/rounded lobes may briefly join the main shape. The color and opacity should follow the current Normal/Kaca theme and Figma state tokens.
2. **Keyboard focus (`focus-visible`):** Trigger an equivalent clear liquid reveal without needing a cursor. Do not rely on hover only. The focus indicator must remain strong and accessible above the animation.
3. **Press/tap/click:** Provide a subtle compression and liquid surge response while preserving immediate activation. Touch devices should not depend on hover; tapping must navigate.
4. **Active route/selected item:** Liquid should settle into an elegant persistent active treatment for the current destination (or follow the Figma's explicit active state if defined). On pointer leave, transient hover liquid recedes/fades; active route stays legible. Do not leave two contradictory active items.
5. **Changing between items:** Avoid simultaneous giant puddles or aggressive full-navbar flashes. Where justified, the liquid highlight can travel/reshape between adjacent pills with continuity, but each pill must remain clearly clickable.
6. **Reduced motion:** Replace spreading/shape morphing with an immediate or short (~100–150ms) color/contrast state change, while maintaining focus and active semantics.
7. **Mobile:** A compact-nav variant should retain a restrained liquid response or an accessible static fallback. It must never overflow the viewport or cover vital page content.

### Motion/art-direction target (engineering proposal, tune to Figma)

- Fast tactile onset within roughly **0–70ms** of hover/focus, followed by fluid organic expansion over approximately **260–420ms**.
- Prefer natural easing: `cubic-bezier(.16,1,.3,1)` for settling; slightly elastic but never cartoonish, squishy, gelatinous or bouncy for multiple cycles.
- Main blob + subtle satellite lobes may merge into one pill-sized puddle using CSS border-radius morphing, masked radial layers, or an **SVG gooey filter** (`feGaussianBlur` + `feColorMatrix`) if it materially improves authenticity. A shader is **not justified** for a small navbar hover unless lighter methods demonstrably cannot match.
- Keep paint/animation within a safely clipped navbar/item surface. You may let lobes reach the pill edge while respecting focus ring and nav silhouette; do not spill across text/content outside the control.
- Layer order: interactive pill background → liquid layer → icon and readable text → focus outline. `pointer-events: none` on all purely decorative layers.
- The liquid fill must keep readable contrast at **every animation frame**. Never obscure navigation labels or make icon colors unpredictable.
- Colors should be restrained and token-based: cobalt for selected emphasis where suitable, orange for action emphasis if confirmed by Figma, and appropriately adapted translucent material in Kaca mode. **Inspect the actual Figma state hierarchy; do not recolor all items randomly.**
- Distinguish **hover/focus/pressed/active** explicitly in state and visual behavior; avoid state races and stale timers across quick pointer movement or route changes.
- No endless idle ripples, motion on every scroll frame, or expensive GPU textures for navbar buttons.

### Implementation expectations

Build a small, reusable system rather than duplicated per-button effects; suggested boundaries (rename to match repo conventions):

- `FloatingNavbar` — positioning, landmark/semantics, items, route awareness.
- `FloatingNavItem` — accessible link/button and state transitions.
- `LiquidNavHighlight` / `LiquidFill` — **decorative** SVG/CSS effect, independent of routing/business logic.
- `useReducedMotion` and, if needed, a narrowly scoped `usePointerOrigin` hook.
- Centralized visual tokens for animation amplitude, duration, masking and z-index.

CSS pseudo-elements + transforms/masks are preferred when visually sufficient. If Motion or GSAP is already chosen, coordinate transforms/shape changes in a way that does not create unnecessary React renders at 60fps. Clean up observers/handlers/timelines on unmount. Do not mutate arbitrary global DOM elements or leak event listeners. **Never use direct state updates on every `pointermove` when CSS variables/refs suffice.**

### Acceptance examples

- Hover over `Jelajahi`: an obvious but elegant liquid fill grows organically in its pill; label and icon remain readable; leaving reverses gracefully.
- Tab to `Lab Prioritas`: keyboard-visible focus triggers an equivalent accessible reveal, without fake pointer coordinates; Enter navigates to an honest destination.
- Click `Bandingkan`: immediate click action, settled selected treatment, browser back/forward updates active state correctly.
- Switch Normal/Kaca: floating navbar adjusts surface/contrast; liquid behavior still works and does not reset navigation.
- Enable reduced motion: interaction remains understandable but liquid expansion/morphing stops.
- Move pointer rapidly over many items: no stuck overlay, no flickering, no permanently selected hover states, and no runaway animation resources.

**Do not implement the effect as an always-running pre-rendered video, static PNG, generic hover glow, or heavyweight inaccessible 3D canvas.** It must respond to real user input.

## 9. Separate interaction: Normal ↔ Kaca liquid theme transition

Use `30:1467`, `42:330`, and `42:780`. This is **NOT** the navbar-hover effect above. Follow Figma's timing and visual direction:

1. Mode switch droplet moves to the target segment with spring feeling: approximately **420ms**.
2. Destination-colored organic liquid expands from the **switch control**, with merging bubbles/droplets over approximately **420ms**, easing `cubic-bezier(.65,0,.35,1)`.
3. Liquid briefly fills/reveals the viewport and dissipates into the target theme over approximately **520ms**, easing `cubic-bezier(.16,1,.3,1)`; total perceived duration around **0.95s**, with appropriate overlap.

Use an accessible control with `role="switch"` or a genuine checkbox, labelled **“Mode tampilan kaca”**, conveying state through `aria-checked`. Persist preference in `localStorage`; initialize early enough to avoid theme flash. Support direct refresh, browser navigation, and route changes. The overlay must never intercept pointer interactions (`pointer-events: none`). Respect reduced motion with a short ~200ms crossfade or an immediate switch. Respect high-contrast/reduced-transparency preferences with readable fallback. Limit expensive backdrop blurs; do not build duplicated full application trees just to run the transition if a lighter effect can achieve the same result.

## 10. Quality, tests and screenshot verification

**Do not declare success without evidence.** Work toward the following release gate:

### Engineering checks

- `npm run typecheck` or equivalent succeeds.
- `npm run lint` succeeds.
- `npm run format:check` or equivalent succeeds.
- `npm run build` succeeds.
- Component/unit tests for at least navigation active logic, Normal/Kaca preference restoration, reduced-motion behavior, and liquid interaction state/presentation.
- Browser/E2E or manual browser validation covers primary CTA, floating navbar, theme switch, keyboard traversal, mobile navigation, and route fallback.
- No console runtime errors, React invalid keys, hydration/initialization flashes, broken asset URLs, or obvious layout overflow.
- No fake calls to government APIs, no unlabelled fabricated statistics, and no private credentials in frontend code.

### Visual checks

- Use Figma as the visual reference; compare actual running local browser screenshots against `27:2`, `27:118` and the floating-nav `49:447` at approximately **1440px width**.
- Compare overall structure, section spacing, typography, button geometry, navbar placement, sea/land areas, diorama position, priority visualizations, floating panels, and theme-specific materials.
- Validate Normal and Kaca variants, not only one theme.
- Test 1024px, 768px, 390px and a narrow mobile viewport. Avoid clipped, unreadable or offscreen controls.
- Inspect actual hover/focus/active/pressed visuals in the browser, not just source code.
- If screenshot/browser automation is available, capture and inspect screenshots, fix visible mismatches, then recheck. If unavailable, state exactly what was and wasn't visually tested.
- Check reduced-motion and WebGL-unavailable static fallback.

### Code review gate

Keep component responsibilities small, names descriptive, props typed, hooks isolated, animation code decoupled from route logic, CSS consistent, and tests meaningful. Avoid a 1000-line `App.tsx`, massive one-file CSS, magic numbers scattered through JSX, duplicated animations, random dependencies, and architecture created solely for elegance without practical need. Comment _why_, not trivially _what_. Run a final cleanup/refactor pass before reporting completion.

## 11. Work in phases automatically; do not stop for phase approval

Execute the following order in this single request:

**Phase A — Audit:** inspect repo, docs, skills, MCP and Figma; identify locked vs proposed choices, and existing assets. Briefly log decisions; proceed.

**Phase B — Foundation:** scaffold/adapt React/TypeScript, tooling, design tokens, global typography, application shell, routing, source structure and test harness. Confirm the dev server starts or clearly report environmental obstacles.

**Phase C — UI primitives:** build shared buttons (Aksen/Kaca/Garis), cards, glass panels, typography primitives, display-mode system and navigation shell with correct semantics.

**Phase D — Complete landing:** implement **every approved visible section** from the full scrolling Figma landing, with real copy, assets, usable CTA/search routing, responsive composition, and meaningful DEMO disclosures.

**Phase E — Premium interaction:** implement **liquid floating-nav hover/focus/active** per Section 8; implement separately **liquid Normal/Kaca theme switch** per Section 9; add section reveals and approved landing 3D illustrations with fallback.

**Phase F — Verify and improve:** run scripts/tests, launch app if possible, compare running UI against Figma, fix discrepancies, review keyboard/mobile/performance/reduced-motion states, and refactor code.

**Phase G — Handoff:** deliver a final concise report with files changed, chosen dependencies and why, completed sections, routes and behavior, validation commands and actual outcomes, screenshot/preview location if available, unresolved Figma/scope gaps, and exactly how the owner launches the project.

You may provide concise progress summaries during work but **do not ask for approval between phases** unless a real blocker requires it. **Do not stop at a beautiful hero mockup. Complete the full landing and operational foundation.**

## 12. Definition of Done — hard requirements

The task is complete only when all of the following are true or explicitly identified as blocked with evidence:

- [ ] A developer can install dependencies and run the React project locally.
- [ ] React + strict TypeScript + lint/format/build/test tooling exist and operate.
- [ ] Nusa Matra brand, Lexend, Kapur & Kobalt tokens and button variants match approved intent.
- [ ] All landing sections in `27:2` and `27:118` are represented, not just the hero.
- [ ] Desktop Normal/Kaca variants have been compared to their Figma references.
- [ ] Floating navbar items reflect Figma information architecture and navigate to valid, honest destinations.
- [ ] **Jelajahi / Lab Prioritas / other navbar pills exhibit a responsive, organic liquid-spreading hover/focus/press/active effect**, with accessible fallback.
- [ ] Normal ↔ Kaca mode switching exhibits the **separate full-screen organic liquid transition** specified by Figma.
- [ ] The diorama and relevant approved landing animations work where supported; meaningful static alternatives remain usable.
- [ ] Mobile, tablet, keyboard, reduced motion and missing WebGL states are verified.
- [ ] Fixture/example content is clearly labelled DEMO; nothing is falsely presented as official LIVE data.
- [ ] No broken CTAs, dead buttons, unreachable focus targets, or accidental scroll trapping.
- [ ] Typecheck, lint, build, formatting and targeted tests are run and their outcomes reported honestly.
- [ ] Code is readable, modular, typed, and ready for later separate Data Hub integration.

### Final instruction

**Use your strongest design-to-code, TypeScript, React, motion, and visual-review capabilities available in this environment. Spend tokens where they improve actual fidelity and reliability. Do not optimize for minimal token usage at the expense of quality. Start now, execute end-to-end, and deliver the best functional Figma-faithful Nusa Matra landing page you can—not merely a plan.**
