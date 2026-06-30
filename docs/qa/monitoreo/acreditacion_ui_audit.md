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

Iteration 24
- Failure or bottleneck: `Modelo` -> `Enlaces y envios` exposed a passive table of saved collectors, but the independent profile did not let the analyst classify channel by SurveyMonkey survey and by collector in the same local-first surface.
- Focused change: added `AcreditacionChannelSelectorMatrix` with survey source channel selectors, local snapshot collector discovery, collector use/channel/modality controls, response/recipient/link metrics, `web` and `desconocido` channel normalization, explicit remote SurveyMonkey read, source channel save wiring and collector config save wiring.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Explicit exclusions: backend routes, `.pulso` writes, territorial/aulas/telefonico profiles, deprecated `../prosecnur/`, source sync clicks and mutating save clicks on the real ACRDCONTA project.
- Main risk: the controls are wired to existing APIs but non-mutating ACRDCONTA QA did not click `Guardar canales` or `Guardar recopiladores`; those persistence clicks still need a disposable fixture.
- Minimum validation command: baseline and final `pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast`, `pnpm --dir frontend test`, `git diff --check`, import audit and loaded visual QA for `Modelo` -> `Enlaces`.
- Result: passed for the worked slice. Final validation passed: typecheck; build:fast with the known circular chunk warning; Vitest 34 files / 220 tests; `git diff --check`; import audit with no monolith matches; loaded ACRDCONTA QA `tmp/visual-qa/monitoreo-acreditacion-channel-selector-iteration24-loaded-final/report.json` with 1 capture, 0 visual issues, 0 scroll jails, 0 overflow and 0 page/API/resource/project/wait issues. Earlier loaded passes caught select/card overflow and were fixed before closure.
- Better/worse/same: better for model mechanism parity and daily analyst use; `Enlaces` is now a real channel/collector workbench instead of a passive table.
- Next action: click-test source channel save and collector config save on a disposable `.pulso` fixture, then continue exact canonical model anchor/rejection-rule parity.

Iteration 25
- Failure or bottleneck: `Teléfono` -> `Día` no longer had the inflated daily data-shape, but it still used the compact advance mini-table that produced the clipped `ECHA` header artifact and did not match the canonical phone trend chart grammar.
- Focused change: replaced the independent mini-table render with `AcreditacionPhoneDailyTrend`, using the shared lazy `PlotlyChart`, canonical `mon-phone-trend` CSS, official `internalQueries` date parsing/axis labels, stacked effective/partial/rejection bars and an accumulated line. The local component intentionally includes the `Sin fecha` row in the series so the profile preserves the raw ACRDCONTA `avance_efectivo_dia` block contract: 14 rows, 145 total responses, 141 effective and 4 rejections.
- Files changed: `AcreditacionMonitoreoPage.tsx`, QA docs.
- Explicit exclusions: backend routes, `.pulso` project data, `MonitoreoPage.tsx`, Territorial/Aulas profiles, source/model/case mutating clicks, output workbench changes, deprecated `../prosecnur/`.
- Main risk: copying the canonical chart exactly would drop undated responses from the visible total; the independent chart uses the canonical grammar but preserves the raw block count.
- Minimum validation command: baseline typecheck/diff/import audit before editing; final `pnpm --dir frontend typecheck`, `pnpm --dir frontend test`, `pnpm --dir frontend build:fast`, `git diff --check`, import audit, direct ACRDCONTA visual QA for `Teléfono` -> `Día`, and comparator capture for `Teléfono/Día`.
- Result: passed for the worked slice. Final validation passed: typecheck; Vitest 34 files / 221 tests; build:fast with the known circular chunk warning; `git diff --check`; import audit with no monolith imports. Direct ACRDCONTA QA passed at 1440x1000 portable (`tmp/visual-qa/acreditacion-telefono-dia-phone-trend-14cuts-20260629/report.json`) with 0 visual issues, 0 scroll jails, 0 overflow and 0 page/API/resource/project/wait issues. Manual screenshot review confirmed `TOTAL PERIODO 145`, `14 cortes diarios`, `Mejor día 38`, `Último corte 2 / 15 junio`, a final `Sin fecha` category, and no visible `ECHA` header artifact.
- Comparator limitation: `tmp/visual-qa/acreditacion-parity-telefono-dia-phone-trend-20260629/report.json` captured both panes but timed out because the strict heuristic does not recognize the `TOTAL PERIODO` chart metric as daily-series hydration. The screenshot is still useful evidence: original canonical `PhoneDailyTrend` reports 144/13 because it excludes the `Sin fecha` row, while the independent profile reports 145/14 from the raw block.
- Better/worse/same: better for `Teléfono/Día` visual grammar, data clarity and header artifact removal; still partial because a product decision remains on whether canonical `PhoneDailyTrend` should include undated rows or the comparator should accept the independent raw-block-preserving behavior.
- Next action: repair or explicitly document the canonical-vs-independent decision for undated phone daily rows, then continue `Teléfono/Alertas` workflow parity.

Iteration 26
- Failure or bottleneck: after the independent `Teléfono/Día` repair, the canonical original still dropped the `Sin fecha` row from `PhoneDailyTrend`, so comparator evidence showed original 144/13 versus independent 145/14. The strict comparator also had a brittle daily-series heuristic.
- Focused change: updated canonical `PhoneDailyTrend` to include all daily points in the plotted/acumulated series while keeping `Último corte` tied to the last dated point, and hardened the comparator daily readiness check with `cortes diarios`.
- Files changed: `MonitoreoPage.tsx`, `scripts/monitoreo-visual-parity-check.mjs`, QA docs.
- Explicit exclusions: backend routes, `.pulso` project data, Territorial/Aulas profiles, Salidas, source/model/case mutating clicks, deprecated `../prosecnur/`.
- Main risk: changing the canonical chart could hide an incomplete daily series if the comparator readiness were too broad; the direct screenshot and comparator both had to prove the 14-row/145-response ACRDCONTA contract.
- Minimum validation command: baseline typecheck/diff/import audit, final `pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast`, `git diff --check`, direct ACRDCONTA route QA, and strict comparator `Teléfono/Día`.
- Result: passed for the worked slice. `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the known circular chunk warning; `git diff --check` passed. Direct QA passed in `tmp/visual-qa/acreditacion-telefono-dia-canonical-undated-keep-20260629/report.json` with 0 visual/overflow/page/API/resource/wait issues. Strict comparator passed in `tmp/visual-qa/acreditacion-parity-telefono-dia-undated-canonical-20260629/report.json` with `ready=1`, two frames, both `hydration.ready=true`, no blockers/errors, and screenshot `15-telefono-dia.png` showing both panes with `TOTAL PERIODO 145` and `14 cortes diarios`.
- Technical follow-up: updated `registry.test.ts` to match the current single-view `telefonico` profile contract (`views=['telefonico']`, `warmupScopes=['phone_summary']`). The focused Monitoreo Vitest battery now passes 35 files / 222 tests.
- Better/worse/same: better. `Teléfono/Día` now has chart grammar, data-shape and strict comparator parity for the undated row.
- Next action: repair `Teléfono/Alertas` workflow parity.

Iteration 27
- Failure or bottleneck: `Teléfono > Alertas` had the supervision workflow visible, but the independent board inflated active alerts from fallback pending/insistence rows (76 active / 5 focos) instead of the canonical `Alertas` sheet (48 active / 2 focos). A cold-cache visual run also exposed that `SessionLostBanner` could crash the app during Vite/HMR session refresh.
- Focused change: added a pure `AcreditacionPhoneAlerts` model, made `phone_summary` include both `Monitoreo telefónico` and `Alertas`, bumped the dashboard cache key to invalidate stale `phone_summary` payloads, stacked the alert layout for readable first viewport, and made `SessionLostBanner` use an optional session context so session-loss UI degrades without tripping the app error boundary.
- Files changed: `AcreditacionPhoneAlerts.ts`, `AcreditacionMonitoreoPage.tsx`, `monitoreo.css`, `SessionContext.tsx`, `SessionLostBanner.tsx`, `api/R/monitoreo_engine.R`, `api/R/router_monitoreo.R`, `api/tests/testthat/test-monitoreo-engine.R`, QA docs.
- Explicit exclusions: `.pulso` project data, Territorial/Aulas profile repairs, source/model/case mutating clicks, Salidas workbench, deprecated `../prosecnur/`.
- Main risk: mixing phone pending rows with canonical alert rows could double-count or hide real supervision priorities; the board must use canonical alerts when present and only fall back when the alert block is absent.
- Minimum validation command: `pnpm --dir frontend typecheck`, focused Monitoreo Vitest battery, R focal engine test, `git diff --check`, direct ACRDCONTA visual QA for `Teléfono > Alertas`, and comparator attempt for the same slice.
- Result: passed for the worked slice. Direct ACRDCONTA QA passed at 1600x1000 (`tmp/visual-qa/acreditacion-telefono-alertas-alert-sheet-session-guard-20260629/report.json`) with 0 visual issues, 0 scroll jails, 0 overflow and 0 page/API/resource/project/wait issues; screenshot shows 48 active alerts / 2 focos. Focused frontend tests passed 35 files / 225 tests, typecheck passed, R `test-monitoreo-engine.R` passed 1390 assertions, and `git diff --check` passed. Comparator `tmp/visual-qa/acreditacion-parity-telefono-alertas-alert-sheet-20260629/report.json` captured the modular frame at 48/2 but timed out because the legacy frame stayed on `Sin monitoreo telefónico`, so it is not counted as a side-by-side pass.
- Better/worse/same: better for data semantics, first viewport readability and cold-cache resilience; still partial for full comparator closure until the legacy phone frame readiness issue is repaired or warmed reliably.
- Next action: repair the legacy/comparator readiness path for `Teléfono/Alertas`, then run full ordered comparator and mutating alert workflow validation only on a disposable fixture.

Iteration 28
- Failure or bottleneck: `Teléfono > Alertas` still lacked a fresh side-by-side pass. The legacy frame could receive the correct `phone_summary`, but later `light`, `source`, `advance_summary` or `queries_summary` responses could overwrite `dashboard.acreditacion_reports` with a non-phone report while the view remained `telefonico`, leaving the original pane on `Sin monitoreo telefónico`.
- Focused change: treated `phone_summary` as phone-covering report scope in the legacy helper, requested `phone_summary` from the phone-view hydration effect, preserved an already-valid phone report while the active view is `telefonico` when incoming reports lack phone blocks, and made the comparator prefetch the target accreditation report scope before navigation.
- Files changed: `MonitoreoPage.tsx`, `scripts/monitoreo-visual-parity-check.mjs`, QA docs.
- Explicit exclusions: `.pulso` project data, Territorial/Aulas product logic, Salidas, source/model/case mutating clicks, alert workflow mutations on the real ACRDCONTA project, secrets, deprecated `../prosecnur/`.
- Main risk: preserving reports too broadly could hide legitimate state changes. The guard is constrained to `acreditacion`/`telefonico`, `activeView=telefonico`, a current valid phone report, and an incoming report that does not cover phone blocks.
- Minimum validation command: baseline/final typecheck and diff check, focused Monitoreo Vitest battery, `node --check scripts/monitoreo-visual-parity-check.mjs`, and strict ACRDCONTA comparator for `Teléfono/Alertas`.
- Result: passed for the worked slice. `pnpm --dir frontend typecheck`, focused Monitoreo Vitest (35 files / 225 tests), `node --check scripts/monitoreo-visual-parity-check.mjs`, and `git diff --check` passed. Fresh comparator evidence `tmp/visual-qa/acreditacion-parity-telefono-alertas-preserve-fresh-20260629/report.json` passed with `ready=1`, two hydrated frames, no blockers/errors, `environment_issues=0`, `wait_ms=36616`, and screenshot `17-telefono-alertas.png` showing both panes at 48 active alerts / 2 focos.
- Better/worse/same: better. `Teléfono/Alertas` now has cold/fresh side-by-side readiness evidence instead of a warm-only workaround.
- Next action: continue full ordered comparator stabilization and mutating alert workflow validation on a disposable fixture; the broader Acreditacion loop remains open for source/model/consultas/output parity gaps.

Iteration 29
- Failure or bottleneck: `Consultas > Casos` still felt less canonical than the monolith. The independent profile jumped from the status/filters into table+detail, while the original gives the analyst a first-viewport distribution by actor and source/base. The cold direct QA also showed the legacy frame could lose or miss `queries_summary` while later non-query scopes were arriving.
- Focused change: added `AcreditacionDistributionView` with `Por actor`, `Por fuente/base` and `Por canal` cards using the existing `mon-query-chart-card` donut/table grammar; changed the source KPI to prefer real project sources over report-sheet count; added a `Consultas` report-preservation guard in the legacy state merge, mirroring the scoped `Telefono` guard.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `MonitoreoPage.tsx`, QA docs.
- Explicit exclusions: `.pulso` project data, Territorial/Aulas product logic, Salidas, source/model/case mutating clicks, case reconciliation mutations on ACRDCONTA, secrets, deprecated `../prosecnur/`.
- Main risk: a first-viewport distribution could become decorative or misleading if it does not filter the real case explorer. The cards use the same `modeCases` as the table and filter by actor/source/channel through the existing filter state.
- Minimum validation command: baseline/final typecheck and diff check, focused Monitoreo Vitest battery, direct ACRDCONTA QA, and strict ACRDCONTA comparator for `Consultas/Casos`.
- Result: passed for the worked slice. Baseline and final `pnpm --dir frontend typecheck`, focused Monitoreo Vitest (35 files / 229 tests), and `git diff --check` passed. Direct ACRDCONTA QA `tmp/visual-qa/acreditacion-consultas-casos-distribution-20260629/report.json` exposed cold `queries_summary` wait misses but no visual/API/page/resource issues. Strict comparator passed: `tmp/visual-qa/acreditacion-parity-consultas-casos-distribution-preserve-20260629/report.json`, `ready=1`, two hydrated frames, no blockers/errors, `environment_issues=0`, screenshot `09-consultas-casos.png` with 519 cases, 12 sources and actor/source distribution cards in both panes.
- Better/worse/same: better. `Consultas/Casos` now has a canonical first-viewport distribution and side-by-side readiness evidence; cold `queries_summary` remains slow.
- Next action: repair `Consultas/Efectivas` and `Consultas/Faltantes` first-viewport parity, then address cold `queries_summary` performance separately.

Iteration 30
- Failure or bottleneck: `Consultas > Efectivas` still lacked canonical chart facets in the first viewport, and `Consultas > Faltantes` inflated the flow with all pending universe cases instead of showing only real pending-exit recoveries.
- Focused change: extended the independent query breakdown to `date` and `collector`, added visible `Fecha` filtering plus `Por fecha`, `Por canal` and `Por recopilador` cards for Efectivas, changed collector filters to use the same internal collector value consumed by `filterInternalQueryCases`, and made Faltantes prefer `internal_queries.pending_exit` / explicit `pending_exit` with a compact no-flow empty state and no blank inspector.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `monitoreo.css`, QA docs.
- Explicit exclusions: `.pulso` project data, backend/API, Territorial/Aulas product logic, Salidas, source/model/case mutating clicks, case reconciliation decisions on ACRDCONTA, secrets, deprecated `../prosecnur/`.
- Main risk: direct QA proves the independent tab render, but the strict side-by-side comparator still needs a stable frontend/cold `queries_summary` pass before these tabs can be marked full comparator parity.
- Minimum validation command: baseline/final typecheck and diff check, focused Monitoreo Vitest battery, `build:fast`, and direct ACRDCONTA QA for `Consultas/Efectivas` and `Consultas/Faltantes`.
- Result: passed for direct-route UI semantics. Baseline/final `pnpm --dir frontend typecheck`, focused Monitoreo Vitest (35 files / 231 tests), `pnpm --dir frontend build:fast`, and `git diff --check` passed. Efectivas direct QA: `tmp/visual-qa/acreditacion-consultas-efectivas-iteration30-20260629/report.json`, 0 visual/overflow/page/API/resource issues, screenshot with chart facets and `Fecha` filter. Faltantes direct QA: `tmp/visual-qa/acreditacion-consultas-faltantes-final-iteration30-20260629/report.json`, 0 visual/overflow/page/API/resource issues, screenshot with 156 pending, 0 pending-exit cases, compact `Sin flujo disponible` and local detail `0 filas`. Both reports kept `ok=false` only because an intermediate wait selector missed during cold `queries_summary`; final post-click selectors matched.
- Better/worse/same: better. `Efectivas` now has meaningful filterable chart cards, and `Faltantes` no longer presents all pending cases as recovered flow.
- Next action: stabilize cold `queries_summary`/comparator navigation, then rerun strict `Consultas/Efectivas` and `Consultas/Faltantes` side-by-side evidence.

Iteration 31
- Failure or bottleneck: the direct Consultas QA was still brittle because `ui-quick-check` prefetched `queries_summary` in one session, then navigated with `devPulso` and created a second session. ACRDCONTA therefore paid for two cold builds, and the old 12s prefetch budget was too short for the real cold `queries_summary` build.
- Focused change: changed the QA harness only. Heavy Monitoreo report scopes now get a 90s default prefetch budget, click timeout is configurable, and the browser route omits `devPulso` when a session has already been opened and seeded through localStorage.
- Files changed: `scripts/ui-quick-check.mjs`, QA docs.
- Explicit exclusions: product UI, backend/API, `.pulso` files, Territorial/Aulas profiles, Salidas, source/model/case mutating clicks, secrets, deprecated `../prosecnur/`.
- Main risk: improving harness tolerance could hide true product slowness; the evidence keeps cold build time separate from cache/session correctness.
- Minimum validation command: `node --check scripts/ui-quick-check.mjs`, `pnpm --dir frontend typecheck`, `git diff --check`, and ACRDCONTA direct QA for same-session Consultas.
- Result: `node --check scripts/ui-quick-check.mjs` and `git diff --check` passed after the harness change. `Consultas > Faltantes` same-session ACRDCONTA QA passed in `tmp/visual-qa/acreditacion-consultas-faltantes-same-session-iteration31-20260629/report.json` with `ok=true`, 0 wait misses, URL without `devPulso`, matching stack/result session, 0 visual/overflow/page/API/resource issues, and screenshot `quick-monitoreo-1440x1000-portable.png`. API log proves cache reuse after the cold build: `queries_summary build_ms=65176`, then `dashboard=cache build_ms=0 total_ms=1953`. `Consultas > Efectivas` has an `ok=true` screenshot in `tmp/visual-qa/acreditacion-consultas-efectivas-prefetch-stable-iteration31-20260629/report.json`, but that run predates the no-`devPulso` patch and used a duplicate session; the same-session rerun proved cache reuse in logs (`queries_summary build_ms=61834`, then cached `build_ms=0` responses) but the browser/harness stalled before producing a screenshot and was killed.
- Better/worse/same: better for reproducible direct QA and same-session cache correctness. Same for product cold performance: `queries_summary` still takes about a minute cold on ACRDCONTA, and `advance_summary` can still build for more than a minute in the background.
- Next action: capture `Consultas > Efectivas` again with same-session navigation and then run strict side-by-side comparator for `Efectivas`/`Faltantes`; treat product cold `queries_summary` optimization as a separate backend/cache loop.

## UI findings

- Hierarchy: independent page now follows module/path topbar, workbench sidebar/context and active content. It is not one long page.
- States: loading, empty and error states exist; seguimiento action success/error feedback was added.
- Visual polish: model workbench uses dense list/detail surfaces, monitoring accent for chrome and semantic tokens for warnings/errors/success.
- Performance: `source`, `advance_summary`, `queries_summary` and `phone_summary` scopes are used for active tabs; `telefonico` no longer requests `full` on initial entry, and the legacy phone/consultas views now preserve valid scoped reports across later non-matching scope responses. The QA harness now reuses the same opened session for direct Consultas checks, so `queries_summary` is no longer rebuilt just because `devPulso` created a second session. Product cold performance is still slow on ACRDCONTA: observed cold `queries_summary` builds were about 61-65s, and background `advance_summary` can still take more than 70s.
- Visual QA: `ui-quick-check` passed on `ACRDCONTA.pulso` for loaded Fuentes at 1600x1000 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-console-loaded`) and final Fuentes at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-console-final`), final source picker tabs at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-encuestas-closure`, `tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-sheets-closure`, `tmp/visual-qa/monitoreo-acreditacion-acrdconta-fuentes-picker-iteration18-activas-closure`), Modelo/Base de barrido at 1440x900, Modelo/Metas y modalidades at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-estructura`), Modelo/Estados válidos at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-modelo-iteration19-reglas`), Avance/Resumen at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration20-resumen-fixed`), Avance/Detalle at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-avance-iteration21-detalle-fixed-prefetch`), Consultas/Duplicados at 1440x900, Consultas/Diferencias assisted review at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-consultas-diferencias-assisted-polished`), final Consultas/Diferencias at 1440x900 (`tmp/visual-qa/monitoreo-acreditacion-acrdconta-consultas-diferencias-final-fixed`), Consultas/Efectivas direct QA at 1440x1000 (`tmp/visual-qa/acreditacion-consultas-efectivas-prefetch-stable-iteration31-20260629`, with duplicate-session caveat), Consultas/Faltantes same-session direct QA at 1440x1000 (`tmp/visual-qa/acreditacion-consultas-faltantes-same-session-iteration31-20260629`), strict accreditation canonical comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration18-final-strict`), Iteration 19 canonical comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration19-modelo`), Iteration 20 comparator at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration20-avance`), Iteration 21 comparator bootstrap at 3000x1100 (`tmp/visual-qa/monitoreo-acreditacion-canonical-compare-iteration21-detalle-bootstrap`), and Telefonico/Responsables at 1440x900 after the scope repair.
- Remaining visual risk: `Fuentes` now opens much closer to the original in the strict canonical comparator, `Modelo` no longer has dead tabs in the disabled/missing accreditation state, `Consultas/Casos` now has canonical distribution in the first viewport, `Faltantes` has clean direct same-session evidence, `Efectivas` still needs same-session screenshot closure, and `Avance/Resumen` plus `Avance/Detalle` now use the canonical report grammar. Source add/update/sync, model config save, alert workflow mutations and case reconciliation mutations still need a dedicated safe fixture and click script; exact rejection-rule/collector inspector depth, the Plotly rhythm chart, `Avance/Actores`, `Avance/Encuestas`, full ordered comparator stability, and several first-viewport parity gaps remain below full canonical parity.
- Next action: capture `Consultas/Efectivas` with the same-session harness, then rerun strict `Consultas/Efectivas`/`Consultas/Faltantes` side-by-side evidence before continuing with `Avance/Actores` and `Avance/Encuestas`.
