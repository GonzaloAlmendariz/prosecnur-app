# Acreditacion UI audit

Loop date: 2026-06-27

## Scope lock evidence

- Module: Monitoreo / Acreditacion profile.
- Product files touched: `frontend/src/features/monitoreo/profiles/acreditacion/index.ts`, `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`, `frontend/src/features/monitoreo/profiles/profilePage.css`.
- QA docs touched: this file plus `acreditacion_extraction_map.md` and `acreditacion_parity_matrix.md`.
- Backend touched: no.
- Explicit exclusions preserved: `.pulso`, territorial, aulas, telefonico, Kobo/SurveyMonkey connectors, sampling engines.

## Initial audit

- Pasted context read: yes.
- Previous territorial context read: yes.
- Acreditacion imported `MonitoreoPage` at start: yes, from `profiles/acreditacion/index.ts`.
- Canonical topbar sections detected: Fuentes, Modelo operativo, Consultas, Telefonico, Avance.
- Canonical nested tabs/modes detected: Fuentes `survey/sheets/activas`; Modelo `estructura/casos/enlaces/reglas/estrategias`; Consultas `casos/efectivas/faltantes/duplicados/diferencias`; Telefonico `resumen/dia/responsables/alertas`; Avance `resumen/actores/encuestas/detalle/salidas`.
- Backend/API reviewed: report scopes/cache, state payload, accreditation reports, seguimiento, cierre, case reconciliation, publication outputs.
- User-provided project used after objective update: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- User-provided CSV used as reconciliation parity evidence: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA-alertas-appscript-vs-reconciliacion-app-20260623.csv`.

## Iteration contract

Iteration 1
- Failure or bottleneck: Acreditacion profile still loaded the Monitoreo monolith.
- Focused change: changed profile loader to `./AcreditacionMonitoreoPage`.
- Files changed: `profiles/acreditacion/index.ts`.
- Validation command: focused tests, typecheck, import audit.
- Result: tests/typecheck passed; import audit has no matches.
- Better/worse/same: better.
- Next action: repair real tab/backend parity.

Iteration 2
- Failure or bottleneck: Modelo in the standalone page reused Consultas and did not expose seguimiento/cierre endpoints.
- Focused change: added `AcreditacionModelWorkbench` with actor cards, n efectivo, intentos, notas, plan de refuerzo, aprobacion metodologica, save/cierre handlers.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`.
- Validation command: focused tests and typecheck.
- Result: passed.
- Better/worse/same: better.
- Next action: extract full `AcreditacionOperationalModel` in a later loop.

Iteration 3
- Failure or bottleneck: Avance local tabs changed labels but not content except Salidas.
- Focused change: split Resumen, Actores, Encuestas and Detalle into distinct workbench bodies.
- Files changed: `AcreditacionMonitoreoPage.tsx`.
- Validation command: focused tests and typecheck.
- Result: passed.
- Better/worse/same: better.
- Next action: compare each body against canonical `AvanceView`.

Iteration 4
- Failure or bottleneck: Fuentes is read-only and does not expose canonical source picker/presets.
- Focused change: added `AcreditacionSourcesWorkbench` fallback with report sources, configured sources and local cut evidence.
- Files changed: `AcreditacionMonitoreoPage.tsx`.
- Validation command: typecheck and 1600x1000 visual QA.
- Result: partial, not done; source picker/actions remain out of scope.
- Better/worse/same: better UI and evidence.
- Next action: extract source picker as dedicated loop.

Iteration 5
- Failure or bottleneck: Consultas lacks case reconciliation apply feedback.
- Focused change: documented mismatch; preserved existing filters/detail views.
- Files changed: QA docs.
- Validation command: documentation review plus final checks.
- Result: partial.
- Better/worse/same: same UI, clearer next repair.
- Next action: add safe reconciliation handlers.

Iteration 6
- Failure or bottleneck: Telefonico needs `full` report scope.
- Focused change: documented performance risk.
- Files changed: QA docs.
- Validation command: final build/typecheck.
- Result: partial.
- Better/worse/same: same UI, known perf risk.
- Next action: lazy phone scope or phone-specific summary cache.

Iteration 7
- Failure or bottleneck: Outputs need visual QA with project state.
- Focused change: kept existing workbench and recorded validation requirement.
- Files changed: QA docs.
- Validation command: visual QA planned.
- Result: partial.
- Better/worse/same: same UI.
- Next action: run with accreditation fixture/project.

Iteration 8
- Failure or bottleneck: Performance/cache must be documented by tab.
- Focused change: mapped report scopes and invalidations in extraction map.
- Files changed: `acreditacion_extraction_map.md`.
- Validation command: final import/build checks.
- Result: partial.
- Better/worse/same: better evidence.
- Next action: avoid `full` for phone where possible.

Iteration 9
- Failure or bottleneck: UI needed stronger model workbench polish without generic cards.
- Focused change: added dense model list/detail CSS, action states, alerts, close panel and responsive behavior.
- Files changed: `profilePage.css`.
- Validation command: typecheck; visual QA planned.
- Result: typecheck passed.
- Better/worse/same: better.
- Next action: browser QA.

Iteration 10
- Failure or bottleneck: final proof needed import audit and validations.
- Focused change: no product code; final checks queued.
- Files changed: QA docs.
- Validation command: focused tests, build:fast, typecheck, diff check, import audit, visual QA.
- Result: pending final validation in this loop.
- Better/worse/same: pending.
- Next action: execute final validation.

Iteration 11
- Failure or bottleneck: independent UI still felt far from canonical because most canonical sidebar tabs were absent or decorative.
- Focused change: replaced profile shell with canonical `PageFrame`, `MonitoreoModuleChrome`, `MonitoreoWorkbenchChrome`, and wired local tabs for Fuentes, Modelo, Consultas, Telefonico and Avance.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`.
- Validation command: `pnpm --dir frontend typecheck`; `ui-quick-check` on `ACRDCONTA.pulso`.
- Result: typecheck passed; Fuentes loaded screenshot at 1600x1000 passed with no overflow/errors.
- Better/worse/same: better.
- Next action: deepen individual tab workbenches.

Iteration 12
- Failure or bottleneck: Consultas did not expose the AppScript-vs-app reconciliation evidence: counts, duplicate status, partial completion and phone action.
- Focused change: aligned Consultas tabs to canonical `casos/efectivas/faltantes/duplicados/diferencias` and added reconciliation/audit rows from `internal_queries`.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`.
- Validation command: click QA `Consultas` -> `Duplicados` on `ACRDCONTA.pulso`.
- Result: passed at 1440x900; no overflow, page errors, API errors or wait misses.
- Better/worse/same: better.
- Next action: expose safe case reconciliation mutation and feedback.

Iteration 13
- Failure or bottleneck: Telefonico used `full` and blocked the workbench on the real ACRDCONTA project.
- Focused change: changed `telefonico` report scope to `queries_summary` and added fallback phone summaries from `internal_queries`.
- Files changed: `AcreditacionMonitoreoPage.tsx`.
- Validation command: click QA `Telefono` -> `Responsables` before and after change.
- Result: before change failed `postClickWaitSelector`; after change passed at 1440x900 with loaded responsables table and no errors.
- Better/worse/same: better.
- Next action: lazy-load richer `monitoreo_telefonico` workbook blocks only when required.

Iteration 14
- Failure or bottleneck: Fuentes has canonical local tabs but the independent workbench is still mostly read-only; it does not show the fixed accreditation source package, preset coverage, or real sync actions.
- Focused change: add a source package console for `survey/sheets/activas` using the existing source/sync client APIs only.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas profiles, Kobo/SurveyMonkey connector internals.
- Main risk: a sync button can start real local synchronization; validation must inspect rendering and disabled/enabled states without clicking mutating sync on the user project.
- Minimum validation command: focused frontend tests, typecheck, `git diff --check`, and non-mutating visual QA on `ACRDCONTA.pulso`.
- Result: focused tests passed (206 tests); `pnpm --dir frontend typecheck` passed; `git diff --check` passed; `build:fast` passed; visual QA passed for loaded Fuentes, `Sheets`, and `Fuentes activas`.
- Better/worse/same: better.
- Next action: add source add/search/picker forms and test sync clicks only on a disposable fixture.

Iteration 15
- Failure or bottleneck: Consultas/Diferencias exposes reconciliation evidence but not the canonical assisted review actions backed by `/api/monitoreo/acreditacion/case-reconciliation`.
- Focused change: add assisted case review controls with candidate selection, confirmation, note, loading/error/success feedback, and real `keep_excluded` / `include_with_caveat` handlers.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas profiles, source connectors, sampling engines.
- Main risk: reconciliation decisions mark the local project dirty; visual QA must render controls without clicking mutating buttons on `ACRDCONTA.pulso`.
- Minimum validation command: focused frontend tests, typecheck, build:fast, `git diff --check`, import audit, and non-mutating visual QA for `Consultas` -> `Diferencias`.
- Result: focused tests passed (32 files / 206 tests); `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed; `git diff --check` passed; import audit returned no monolith matches; strict visual QA passed at 1440x900 portable with `.mon-assisted-review` attached and no visual/API/resource/project/wait issues (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-consultas-diferencias-assisted-polished/report.json`).
- Better/worse/same: better.
- Next action: click-test `keep_excluded` / `include_with_caveat` on a disposable fixture and add a visible revert/audit history affordance if needed.

Iteration 16
- Failure or bottleneck: even after the functional `Diferencias` repair, independent Acreditacion `Consultas` still looks drastically different from the original canonical `MonitoreoPage` explorer.
- Focused change: replace the standalone `Consultas` body chrome with the canonical explorer pattern (`mon-stage--consultas`, `mon-query-status-strip`, `mon-query-answer`, `mon-case-explorer-toolbar`, `mon-case-explorer-body`) while preserving independent profile ownership and existing safe reconciliation handlers.
- Files changed: planned `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, `MonitoreoTerritorialCompare.tsx`, `MonitoreoShell.tsx`, `App.tsx`, `Layout.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas profiles, source sync/config editors, mutating reconciliation clicks.
- Main risk: copying the canonical look without importing the monolith can regress filters, selected-case detail, the `Diferencias` assisted-review flow, or the canonical visual comparison route.
- Minimum validation command: focused frontend tests, typecheck, build:fast, `git diff --check`, import audit, non-mutating visual QA for `Consultas` -> `Diferencias`, and canonical side-by-side visual comparison on `ACRDCONTA.pulso`.
- Result: passed for the worked slice. Focused tests passed (32 files / 206 tests); `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the pre-existing circular chunk warning; `git diff --check` passed; import audit returned no monolith matches. Canonical comparator route `/monitoreo/comparar-acreditacion` passed at 3000x1100 with `ACRDCONTA.pulso`, both panes ready, and no visual/API/resource issues. `Consultas` -> `Diferencias` initially exposed 24 overflow-y issue rows; scoped CSS raised canonical issue-row height and the repeat QA passed with 0 issues.
- Better/worse/same: better for `Consultas/Diferencias`; same residual global gap for `Fuentes`.
- Next action: use the comparator evidence to repair `Fuentes` next, because the side-by-side capture still shows the independent package console composition differs materially from the original source setup flow.

Iteration 17
- Failure or bottleneck: canonical comparator shows `Fuentes` in independent Acreditacion still differs materially from original `MonitoreoPage`: the target inserts an advance/status block where the original opens with source-package status/actions, and it compresses the canonical architecture/requisite flow into a generic package console.
- Focused change: align the independent `Fuentes` initial body to the canonical source architecture: source status strip, fixed-source blueprint, Google Sheets requirement cards, and SurveyMonkey source summary, reusing existing source/sync handlers without importing the monolith.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas/telefonico profiles, source add/edit mutations not already wired in this profile, external SurveyMonkey/Kobo actions, mutating sync clicks on `ACRDCONTA.pulso`.
- Main risk: visual alignment can accidentally hide real active tabs or create fake edit buttons; any control shown must either be read-only/evidence or use an existing handler.
- Minimum validation command: focused frontend tests, typecheck, build:fast, `git diff --check`, import audit, non-mutating visual QA for `Fuentes` on `ACRDCONTA.pulso`, and canonical comparator `/monitoreo/comparar-acreditacion`.
- Result: passed for the worked slice. Focused tests passed (32 files / 206 tests); `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the known circular chunk warning; `git diff --check` passed; import audit returned no monolith matches. `Fuentes` QA passed at 1440x900 portable with `.mon-acr-sources-panel--standalone` attached and 0 visual/API/resource/project/wait issues (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-canonical-iteration17-closure/report.json`). Canonical comparator `/monitoreo/comparar-acreditacion` passed at 3000x1100 with 0 issues and was visually inspected (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration17-closure/report.json`).
- Better/worse/same: better for the initial `Fuentes` architecture and first-screen visual parity; still partial because the canonical source add/edit/search/picker forms and safe mutating sync tests remain out of this slice.
- Next action: extract or mirror the source add/search/picker forms and validate sync/update actions only on a disposable fixture.

Iteration 18
- Failure or bottleneck: after the source picker/editor extraction, the canonical comparator could pass while the independent iframe was still on `Preparando vista`; once captured strictly, the independent `Fuentes` first viewport still showed a duplicated "Paquete de acreditación" status block before the canonical architecture body.
- Focused change: added API-backed Google Sheets source editing, SurveyMonkey search/inspect/add controls, and editable configured-source labels; then made the canonical comparator wait for the real independent source workbench and removed the duplicated source package strip so the body opens with `Arquitectura de fuentes de acreditación` like the original.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `MonitoreoTerritorialCompare.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas/telefonico profiles, Kobo/SurveyMonkey connector internals, source mutation clicks on `ACRDCONTA.pulso`, sampling engines.
- Main risk: add/update/sync handlers are visible and wired, but real mutating clicks were intentionally not executed on the user project; they need a disposable fixture.
- Minimum validation command: focused frontend tests, typecheck, build:fast, `git diff --check`, import audit, non-mutating Fuentes visual QA for `Encuestas`/`Sheets`/`Fuentes activas`, and strict canonical comparator on `ACRDCONTA.pulso`.
- Result: passed for the worked slice. Focused tests passed (32 files / 206 tests); `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the known circular chunk warning; `git diff --check` passed; import audit returned no monolith matches. Final Fuentes QA passed at 1440x900 portable for `Encuestas` (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-encuestas-closure/report.json`), `Sheets` (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-sheets-closure/report.json`) and `Fuentes activas` (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-activas-closure/report.json`). Strict canonical comparator passed at 3000x1100 with both panes loaded and was visually inspected (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration18-final-strict/report.json`).
- Better/worse/same: better for visual parity and source backend exposure; same residual risk for destructive/mutating source click validation and full `Modelo` config/rejection-rule editor extraction.
- Next action: click-test source add/update/sync on a disposable `.pulso` fixture, then repair `Modelo` configuration goals and rejection-rule editing.

Iteration 19
- Failure or bottleneck: `Modelo` exposed the canonical local tabs, but on `ACRDCONTA.pulso` the independent body fell back to "Modelo de acreditación pendiente" when `acreditacion.enabled=false`; the original canonical page still exposes the operational mapping/configuration controls in that state.
- Focused change: added a real `AcreditacionModelConfigWorkbench` fallback for disabled/missing multi-corte state, backed by `MonitoreoConfig` and `apiMonitoreoConfig`. The five canonical model tabs now render real bodies for variables/metas, base de barrido, enlaces/envíos, estados válidos/eventos/reglas, and calendario/fases instead of an empty panel.
- Files changed: `AcreditacionMonitoreoPage.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas/telefonico profiles, Kobo/SurveyMonkey connector internals, sampling engines, source mutation clicks, config save click on the user project.
- Main risk: the save handler is typed and wired, but was not clicked on `ACRDCONTA.pulso`; exact `PlatformRejectionRulePanel`, remote collector classification and every canonical `AcreditacionOperationalModel` inspector detail remain partial.
- Minimum validation command: focused frontend tests, typecheck, build:fast, `git diff --check`, import audit, non-mutating visual QA for `Modelo` -> `Metas y modalidades` and `Modelo` -> `Estados válidos`, plus canonical comparator route.
- Result: passed for the worked slice. Baseline before editing passed (206 tests, typecheck, diff check, build:fast). After editing, `pnpm --dir frontend typecheck`, focused tests (32 files / 206 tests), `git diff --check`, refined import audit and `pnpm --dir frontend build:fast` all passed. Direct visual QA passed for `Modelo` -> `Metas y modalidades` (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-estructura/report.json`) and `Modelo` -> `Estados válidos` (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-reglas/report.json`), both with 0 visual/API/resource/project/wait issues. Canonical comparator `/monitoreo/comparar-acreditacion` also passed at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration19-modelo/report.json`) and was visually inspected; note that comparator readiness still anchors on the Fuentes first viewport, so Modelo parity evidence is the direct tab QA.
- Better/worse/same: better for active model tab parity and for the user's "tabs visibles pero sin uso" complaint.
- Next action: extract the remaining exact rejection-rule/collector inspector depth and click-test config save on a disposable fixture.

Iteration 20
- Failure or bottleneck: `Avance` local tabs were active, but `Resumen` still rendered a generic `mon-profile-*` two-table layout. The canonical original uses the `mon-advance-*` workbench with report header, synchronized-cut hero, KPI strip, universe/progress storage, daily rhythm and actor focus.
- Focused change: added `AcreditacionAdvanceSummaryWorkbench` for `Avance` -> `Resumen`, deriving cards from real `client_report.actors`, daily points from `client_report.daily_general`, metas from `state.config.goals`, and rendering the canonical `mon-advance-panel`, `mon-advance-hero`, `mon-advance-storage`, `mon-advance-daily-mini` and `mon-advance-focus` surfaces. Date labels were shortened after QA found header overflow.
- Files changed: `AcreditacionMonitoreoPage.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas/telefonico profiles, source connectors, source/model/case mutating clicks, sampling engines.
- Main risk: the visual grammar now matches the canonical Avance summary much more closely, but the exact original Plotly line/bar chart remains represented by the canonical table/metrics surface rather than the lazy Plotly chart component. `Actores`, `Encuestas` and `Detalle` still need their own deeper canonical extraction.
- Minimum validation command: baseline focused tests, typecheck, build:fast, `git diff --check`, import audit, direct non-mutating visual QA for `Avance` -> `Resumen`, and canonical comparator route.
- Result: passed for the worked slice. Baseline before editing passed (206 tests, typecheck, diff check, build:fast). After editing, `pnpm --dir frontend typecheck`, focused tests (32 files / 206 tests), `git diff --check`, import audit and `pnpm --dir frontend build:fast` all passed. First direct QA caught 18 date-header overflow issues; after shortening labels, direct `Avance` -> `Resumen` QA passed at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration20-resumen-fixed/report.json`) with 0 visual/API/resource/project/wait issues. Canonical comparator `/monitoreo/comparar-acreditacion` passed at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration20-avance/report.json`) and was visually inspected; note that comparator readiness still anchors on the Fuentes first viewport, so Avance evidence is the direct tab QA plus canonical code comparison.
- Better/worse/same: better for visible Avance parity; `Resumen` no longer looks like a generic profile table.
- Next action: repair `Avance` -> `Detalle` with canonical `AcreditacionControlVariablesPanel` / `AcreditacionGsReportsPanel` depth, then `Actores`/`Encuestas` actor-card and source contribution surfaces.

Iteration 21
- Failure or bottleneck: `Avance` -> `Detalle` still used generic profile tables for controls and internal alerts, while the canonical original renders a `mon-advance-detail-stack` with `AcreditacionControlVariablesPanel` and `AcreditacionGsReportsPanel`.
- Focused change: added `AcreditacionAdvanceDetailWorkbench`, a canonical-style control variables panel, and a GS report panel that prefers `reports.sheets` and falls back to real `client_report` sheets for actors, daily advance, controls and sources. The empty controls state was compacted after the first visual pass showed a visually oversized blank panel.
- Files changed: `AcreditacionMonitoreoPage.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas/telefonico profiles, source connectors, source/model/case mutating clicks, sampling engines, deprecated `../prosecnur/`.
- Main risk: `ACRDCONTA.pulso` does not expose full control-variable rows under `advance_summary`; the UI must preserve real empty states and avoid fabricated rows while still matching the canonical detail grammar.
- Minimum validation command: baseline focused tests, typecheck, build:fast, `git diff --check`, import audit, direct non-mutating visual QA for `Avance` -> `Detalle`, and canonical comparator route.
- Result: passed for the worked slice. Baseline before editing passed (206 tests, typecheck, diff check, build:fast). After editing, `pnpm --dir frontend typecheck`, focused tests (32 files / 206 tests), `git diff --check`, import audit and `pnpm --dir frontend build:fast` all passed. Direct `Avance` -> `Detalle` QA passed at 1440x900 with prefetch enabled (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration21-detalle-fixed-prefetch/report.json`) with 1 capture, 0 visual issues, 0 scroll jails, 0 overflow, 0 page/API/resource/project/wait issues. The canonical comparator route passed at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration21-detalle-bootstrap/report.json`) with both panes ready and 0 issues.
- Comparator limitation: the canonical comparator still anchors readiness on the Fuentes first viewport. A manual attempt to navigate both iframes into `Avance` -> `Detalle` timed out after the kept API/browser session became busy, so the tab-specific parity proof is the direct `Avance` -> `Detalle` screenshot plus source comparison against the canonical `AcreditacionControlVariablesPanel` / `AcreditacionGsReportsPanel` implementation.
- Better/worse/same: better for visible Avance detail parity; the body no longer looks like a generic controls/alerts table.
- Next action: repair canonical `Avance` -> `Actores` and `Avance` -> `Encuestas`, then address the exact Plotly rhythm chart and cold `advance_summary` latency.

Iteration 22
- Failure or bottleneck: the previous canonical comparator could report success while one pane was still on a loading/preparing state, and it could not prove the specific `Telefono` -> `Alertas` slice the user flagged.
- Focused change: added comparator deep-link support for `compareView` and `compareTab`, then repaired the accreditation phone path so it loads the full telephone scope, merges responsible rows from the sweep/source evidence, exposes telephone incidence ratios, insistence buckets, responsible/status panels and operational phone alerts.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `MonitoreoTerritorialCompare.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas profiles, source/model/case mutating clicks, deprecated `../prosecnur/`.
- Main risk: the comparator now proves both panes are in the requested phone/alert slice, but the capture still shows real visual parity gaps against the original: the original includes the `Salidas` strip and a different telephone alert/legend surface while the independent pane emphasizes status/progress and phone block summaries.
- Minimum validation command: `pnpm --dir frontend typecheck`, `git diff --check`, and canonical comparator capture for `/monitoreo/comparar-acreditacion?compareView=telefonico&compareTab=alertas&qaWarmup=skip`.
- Result: `pnpm --dir frontend typecheck` passed; `git diff --check` passed. Strict manual comparator evidence passed with both iframes ready, phone view active, `Alertas` active, rows loaded and no loading state (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration28-telefono-alertas-session/manual-report.json`). Screenshot: `tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration28-telefono-alertas-session/compare-telefono-alertas-3000x1100.png`.
- Better/worse/same: better for evidence quality and telephone operational completeness; same residual gap for exact original visual composition.
- Next action: repair the remaining telephone parity deltas visible in the canonical screenshot, starting with the original `Salidas` strip and the telephone-specific alert/legend composition.

Iteration 23
- Failure or bottleneck: Acreditacion had too many top-level KPI/stat cards across sections and local tabs, which consumed vertical space before the analyst reached the actual source package, case explorer, daily advance, actor cards or telephone workbench.
- Focused change: compacted the accreditation metric hierarchy. The global status panel is now a one-line progress rail, `Fuentes` no longer repeats stat rows already present in package/table headers, `Telefono` and `Avance` hero KPIs were reduced to the critical signals, and retained secondary indicators are rendered as compact chips/bars scoped to the accreditation shell.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Explicit exclusions: backend routes, `.pulso` files, territorial/aulas profiles, deprecated `../prosecnur/`, source/model/case mutating clicks.
- Main risk: compacting indicators can hide useful context if too aggressive; this pass preserves the data in headers, tables, bars or compact chips instead of deleting analytical state.
- Minimum validation command: `pnpm --dir frontend typecheck`, `git diff --check`, and loaded visual QA for `Fuentes`, `Modelo`, `Consultas`, `Avance`; `Telefono` requires a separate API performance repair because `report_scope=full` did not return in 5 minutes.
- Result: `pnpm --dir frontend typecheck` passed; `git diff --check` passed. Loaded manual screenshots passed for `Fuentes/Encuestas`, `Modelo/Metas y modalidades`, and `Consultas/Diferencias` under `tmp/visual-qa/monitoreo-acreditacion-kpi-density-iteration29-manual-loaded/`. Loaded `Avance/Resumen` passed with `.mon-advance-panel` wait selector (`tmp/visual-qa/monitoreo-acreditacion-kpi-density-iteration29-avance-resumen-loaded/report.json`). `Telefono/Alertas` was not certified as loaded: API `report_scope=full` timed out after 300000 ms in a direct scope probe.
- Better/worse/same: better for density and first-screen focus in the verified accreditation sections; same residual telephone risk until the full-scope report can be split, cached or narrowed.
- Next action: repair the telephone report load path so the phone workbench can hydrate from a narrower/cached scope, then repeat the loaded `Telefono/Alertas` visual QA.

## UI findings

- Hierarchy: independent page now follows module/path topbar, workbench sidebar/context and active content. It is not one long page.
- States: loading, empty and error states exist; seguimiento action success/error feedback was added.
- Visual polish: model workbench uses dense list/detail surfaces, monitoring accent for chrome and semantic tokens for warnings/errors/success.
- Performance: `source`, `advance_summary`, `queries_summary` scopes are used for active tabs; `telefonico` no longer requests `full` on initial entry. `advance_summary` can still be slow on cold ACRDCONTA loads: one prefetch attempt timed out before the final direct QA completed successfully.
- Visual QA: `ui-quick-check` passed on `ACRDCONTA.pulso` for loaded Fuentes at 1600x1000 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-console-loaded`) and final Fuentes at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-console-final`), final source picker tabs at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-encuestas-closure`, `tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-sheets-closure`, `tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-activas-closure`), Modelo/Base de barrido at 1440x900, Modelo/Metas y modalidades at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-estructura`), Modelo/Estados válidos at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-reglas`), Avance/Resumen at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration20-resumen-fixed`), Avance/Detalle at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration21-detalle-fixed-prefetch`), Consultas/Duplicados at 1440x900, Consultas/Diferencias assisted review at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-consultas-diferencias-assisted-polished`), final Consultas/Diferencias at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-consultas-diferencias-final-fixed`), strict accreditation canonical comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration18-final-strict`), Iteration 19 canonical comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration19-modelo`), Iteration 20 comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration20-avance`), Iteration 21 comparator bootstrap at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration21-detalle-bootstrap`), and Telefonico/Responsables at 1440x900 after the scope repair.
- Remaining visual risk: `Fuentes` now opens much closer to the original in the strict canonical comparator, `Modelo` no longer has dead tabs in the disabled/missing accreditation state, and `Avance/Resumen` plus `Avance/Detalle` now use the canonical report grammar. Source add/update/sync, model config save and case reconciliation mutations still need a dedicated safe fixture and click script; exact rejection-rule/collector inspector depth, the Plotly rhythm chart, `Avance/Actores`, `Avance/Encuestas`, and a comparator that can deep-link both panes into a subtab remain below full canonical parity.
