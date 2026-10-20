# Landing slice — implementation notes

Date: 2026-10-20 · Scope: React foundation, design system, floating navigation, full landing (Figma 27:2 / 27:118).

## Sources inspected

Figma (via MCP): 26:38 tokens, 26:14 buttons, 26:37 switch, 49:447 navbar, 49:304 nav item states, 62:1291 page pill, 27:2 and 27:118 full landing (design context, variables, motion data), 43:713 motion/3D spec, 30:1467 liquid transition spec, 42:330 transition frame. Assets were exported from these nodes into `src/assets/figma/`.

Skills applied: `design-taste-frontend` (Taste Skill), `ui-ux-pro-max`, `animate`, and the Figma `figma-design-to-code` guidance. No Matt Pocock TypeScript skill is installed in this environment; its usual practices (strict compiler flags, no `any`, discriminated unions for results) were applied by hand. Where the Taste Skill's house rules (no glass, no floating pill nav, no shadows) conflicted with the approved Figma, Figma won, as the project's authority order requires.

## Decisions and deviations

| Topic                                                     | What was done                                                                                                                                            | Why                                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Landing navbar                                            | The full "Navbar Melayang" (49:447) with all six items, not the logo-plus-switch bar drawn on 27:2                                                       | The owner's brief requires the liquid nav items on the landing; the 42:330 transition frame also shows the full bar. |
| Mobile navigation                                         | Compact top bar (logo + switch) plus a bottom tab bar below 1120px                                                                                       | Figma note on 49:447: "Mobile: menjadi bilah tab bawah".                                                             |
| Feature pages                                             | Honest "Sedang dikembangkan" shells with the navbar and a "Peta utama" back link styled after 62:1291                                                    | Every nav item and CTA leads somewhere real; nothing pretends to be a finished feature.                              |
| Nav hover / active colours                                | Hover: `info/laut-muda` wash (Normal) or white at 24% (Kaca). Active: Figma "Aktif" variants (cobalt pill / white pill)                                  | Figma defines only Default and Aktif; the hover tint is an engineering choice inside the palette.                    |
| DEMO labelling                                            | Added "Data simulasi untuk prototipe" to the Lab ranking, "Contoh · data simulasi" to the passport preview, and a caption under the data-status examples | Figma shows these numbers without a label; the PRD requires a visible DEMO label wherever simulated values appear.   |
| Lab preview numbers                                       | Computed by `rankRegions()` from fixtures in `src/data/fixtures/landingDemo.ts` and checked by tests against the Figma values (0,82 / 0,74 / 0,61)       | No hard-coded JSX numbers; the G6 reorder is a real recomputation from weights 20/30/50 to 45/35/20.                 |
| Search                                                    | Validates the query and passes it to `/jelajahi?cari=…`; Jelajahi says plainly that the region catalogue is not connected yet                            | No fake results before the Data Hub exists.                                                                          |
| "Mulai jelajahi" camera move into the hex map (3D-1 note) | Not implemented; the CTA navigates to `/peta` immediately                                                                                                | Depends on the Peta Utama hub, which is outside this slice.                                                          |
| 3D zone annotations                                       | The dashed outlines and orange "3D-x" labels on 27:2 are designer annotations and are not rendered                                                       | They mark canvas size and position, which the zones follow.                                                          |
| Kaca glows                                                | The seven "Cahaya latar" layers are placed proportionally to the page height                                                                             | The page height matches the frame (5080px at 1440px), so they land where Figma draws them.                           |

## Verification

- Commands: see the final report. The full-page render at 1440px is exactly 1440×5080, the Figma frame size.
- Browser checks covered 1440, 768 and 390px in Normal and Kaca, nav hover/focus/active, the theme transition mid-sequence, keyboard focus, search validation and the shell routes. They ran in the Claude browser pane and in headless Chrome via Playwright.
- Playwright smoke tests (`npm run test:e2e`) run on desktop and mobile profiles with the locally installed Chrome; they include a reduced-motion run.

## 3D engine boundary (2026-10-20)

The hero diorama (3D-1), the story diorama (3D-5) and the Peta Utama / Jelajahi map come from the separately developed 3D engine. The host renders `HeroDioramaSlot` and `Explore3DMapSlot` with static Figma illustrations until the engine is registered in `src/features/geo3d/engineRegistry.ts`. The host's own three.js dioramas were removed. Contract and steps: `docs/integration/geo3d-engine.md`.

## Known gaps

- Figma has no tablet or mobile frames; the responsive layouts are engineering proposals and need design review.
- The apple-touch icon is the transparent mark; iOS draws it on black. An opaque export would be better.
- The hover-tint values and the 1120px navbar breakpoint are engineering choices, not Figma values.
- ESLint is pinned to 9.x because `eslint-plugin-jsx-a11y` does not yet declare ESLint 10 support.
