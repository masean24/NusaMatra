# ADR-0001 — Frontend foundation and documentation conflict resolution

- Date: 2026-10-20
- Status: Accepted
- Decided by: project owner (architecture approval, 2026-10-20)

## Context

The repository contained documentation only. Several documents disagreed on folder structure, weight representation, comparator scope, scripts and the backend's location. The owner approved a stack and resolved the conflicts listed below.

## Decisions

| Area                           | Decision                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository scope               | This repository is the **React frontend only**. Backend, database, ingestion and validated datasets belong to the separate **Data Hub** service/repository. `docs/08-API-SPECIFICATION.md` is the initial proposed contract between them. |
| Data until the Data Hub exists | Clearly labelled `DEMO` fixtures behind repository interfaces. Simulated values are never shown as official data.                                                                                                                         |
| Package manager / runtime      | npm; current Node.js LTS, pinned in `.nvmrc` and `package.json#engines`.                                                                                                                                                                  |
| Build / routing                | Vite + React + strict TypeScript; React Router in declarative mode.                                                                                                                                                                       |
| Styling                        | CSS Modules plus centralised CSS custom properties from the Figma Kapur & Kobalt variables. No Tailwind.                                                                                                                                  |
| MVP geography                  | Kabupaten/kota is the primary level; province supports grouping and navigation. Region types must allow more levels later.                                                                                                                |
| Weights                        | Canonical weights are nonnegative integer basis points summing to exactly 10000.                                                                                                                                                          |
| Comparator                     | Exactly two regions in the MVP.                                                                                                                                                                                                           |
| Dashboard                      | A potential future feature, not an MVP module.                                                                                                                                                                                            |
| Hosting                        | Provisional: VPS via Coolify, serving the static build with an SPA history fallback.                                                                                                                                                      |

## Documentation conflicts resolved

| ID  | Conflict                                                   | Resolution                                                                                                                                                                                          |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Links to `project_guidelines.md` vs an upper-case filename | File is `project_guidelines.md` at the repository root.                                                                                                                                             |
| C2  | `.env.example` referenced but missing                      | Added at the repository root (public, non-secret values only).                                                                                                                                      |
| C3  | Four different `src/` trees                                | `docs/04-TECH-STACK-ARCHITECTURE.md` §3 is canonical; the landing slice adds `features/navigation`, `features/theme` and `features/motion` per the landing master prompt.                           |
| C4  | Dashboard module only in the older guidelines              | Marked as a future feature in `project_guidelines.md` §4.3.                                                                                                                                         |
| C5  | "Two or more" vs "exactly two" regions                     | Exactly two for the MVP (`project_guidelines.md` §4.2 updated).                                                                                                                                     |
| C6  | Weights as floats `0..1` vs basis points                   | Basis points (`CLAUDE.md` §5.4 updated).                                                                                                                                                            |
| C7  | `tsc --noEmit` vs `tsc -b`, `test` vs `test:unit`          | `typecheck` = `tsc -b`, `test` = `vitest run` (`CLAUDE.md`, `README.md`, doc 10 updated).                                                                                                           |
| C8  | Three milestone numbering schemes                          | `docs/12-IMPLEMENTATION-ROADMAP.md` M0–M10 is canonical.                                                                                                                                            |
| C9  | `Observation` shape and region key differ between docs     | Docs 06 and 08 own the wire and domain contracts; doc 04's discriminated `result` union and doc 08's `regionId` take precedence over the illustrative `CLAUDE.md` types when the data slice starts. |

## Consequences

- Docs 04 §12, 06, 08 and roadmap M5 carry a scope note: backend content is the Data Hub's contract.
- No backend or fake public API is built in this repository.
- Further stack choices (animation engine, 3D, maps, charts, server-state cache) get their own ADRs when a slice needs them.
