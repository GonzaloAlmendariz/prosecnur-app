# Territorial Monitoreo parity matrix

Truth source: `frontend/src/features/monitoreo/MonitoreoPage.tsx`.

Target audited: `frontend/src/features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx`.

Extraction map: `docs/qa/monitoreo/territorial_extraction_map.md`.

Loop date: 2026-06-26; updated 2026-06-27.

## Baseline before canonical repairs

- Registry/cache tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Typecheck: `pnpm --dir frontend typecheck` -> passed.
- Build: `pnpm --dir frontend build:fast` -> passed.
- Diff hygiene: `git diff --check` -> passed.
- Import audit territorial: `profiles/territorial/index.ts` loads `./TerritorialMonitoreoPage`; no `from .*MonitoreoPage` import exists under the territorial profile.
- Visual QA baseline: `tmp/visual-qa/monitoreo-territorial-canonical-baseline/report.json` -> ok=true, captures=2, issues=0, overflow=0, pageErrors=0.

## Previous navigation-only score

The previous parity loop counted tab presence and visual hierarchy. That score reached `34 / 42 = 81.0%`, but it was not a behavior/action parity score. This canonical loop supersedes that reading: a tab is not `done` unless the target renders the same behavior, state, or action surface as the original.

## Canonical behavior score

### Iteration 0 canonical baseline

- Total original items: 42.
- Not applicable: 0.
- Done: 10.
- Missing: 0.
- Mismatch: 26.
- Unverified: 0.
- Blocked: 6.
- Score: 10 / 42 = 23.8%.

### Iteration 1 current

- Total original items: 42.
- Not applicable: 0.
- Done: 11.
- Missing: 0.
- Mismatch: 25.
- Unverified: 0.
- Blocked: 6.
- Score: 11 / 42 = 26.2%.

### Iteration 2 current

- Total original items: 42.
- Not applicable: 0.
- Done: 15.
- Missing: 0.
- Mismatch: 22.
- Unverified: 0.
- Blocked: 5.
- Score: 15 / 42 = 35.7%.

### Iteration 3 current

- Total original items: 42.
- Not applicable: 0.
- Done: 17.
- Missing: 0.
- Mismatch: 20.
- Unverified: 0.
- Blocked: 5.
- Score: 17 / 42 = 40.5%.

### Iteration 4 current

- Total original items: 42.
- Not applicable: 0.
- Done: 19.
- Missing: 0.
- Mismatch: 19.
- Unverified: 0.
- Blocked: 4.
- Score: 19 / 42 = 45.2%.

### Iteration 5 current

- Total original items: 42.
- Not applicable: 0.
- Done: 20.
- Missing: 0.
- Mismatch: 18.
- Unverified: 0.
- Blocked: 4.
- Score: 20 / 42 = 47.6%.

### Iteration 6 current

- Total original items: 42.
- Not applicable: 0.
- Done: 20.
- Missing: 0.
- Mismatch: 18.
- Unverified: 0.
- Blocked: 4.
- Score: 20 / 42 = 47.6%.
- Note: `calidad/geolocalizacion` now renders a canonical GPS/cartography workbench instead of the lightweight `ter-*` map, but it remains `mismatch` because it is not yet identical to the historical `TerritorialValidationGeoWorkbench`.

### Iteration 9 current

- Total original items: 42.
- Not applicable: 0.
- Done: 20.
- Missing: 0.
- Mismatch: 17.
- Unverified: 1.
- Blocked: 4.
- Score: 20 / 42 = 47.6%.
- Note: `calidad/reconciliacion` now renders a canonical spatial reconciliation panel with local queue, confirmation dialog, batch apply, and dismiss actions against existing endpoints, but it remains `mismatch` until it reproduces the original map focus behavior and data-rich candidate handling exactly. `calidad/duracion` now renders the canonical duration workbench, but remains `unverified` until a duration-rich fixture exercises review rows and map handoff.

### Iteration 10 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 16.
- Unverified: 1.
- Blocked: 4.
- Score: 21 / 42 = 50.0%.
- Note: `calidad/cuotas` now renders the canonical quota consistency panel with search, filters, replacement toggle, block cards, sex/age margins, and observed cross matrix. The audit fixture exercised quota blocks and passed visual QA, so this tab is marked `done`.

### Iteration 11 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 15.
- Unverified: 2.
- Blocked: 4.
- Score: 21 / 42 = 50.0%.
- Note: `calidad/anulacion` now routes to the extracted production-annulment workspace and reuses the historical empty state. The preview/apply/revert handlers are typed and built against existing APIs, but the audit fixture has no responsibles, so impact table and history behavior remain `unverified`.

### Iteration 12 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 15.
- Unverified: 2.
- Blocked: 4.
- Score: 21 / 42 = 50.0%.
- Note: `calidad/reconciliacion` now carries the candidate `response_id` into `geolocalizacion` before opening the map tab. It remains `mismatch` because the audit fixture has no candidate-rich spatial queue to verify exact historical focus behavior.

### Iteration 13 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 12.
- Unverified: 6.
- Blocked: 3.
- Score: 21 / 42 = 50.0%.
- Note: `consultas` now renders `TerritorialReviewCasesWorkbench` with canonical `mon-territorial-review-*` table/filter language, local tab type filters, UUID copy, and GPS/duration handoff to `calidad`. It is not marked `done` because the audit fixture exposes 0 query rows and `subsanaciones` still lacks full apply/revert parity.

### Iteration 14 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 11.
- Unverified: 7.
- Blocked: 3.
- Score: 21 / 42 = 50.0%.
- Note: `consultas/subsanaciones` now renders the extracted `TerritorialOperationalAdjustmentsWorkspace` and wires apply/revert/reset through the existing territorial operational-adjustment APIs. It remains `unverified` because the audit fixture exposes 0 suggestions/applied adjustments, so the mutation-rich package UI was not exercised with real data.

### Iteration 15 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: `avance` now uses `TerritorialAdvanceWorkbench` for `resumen`, `ump`, and `ritmo`, with the canonical datebar, executive summary, district board, UMP table/detail, and rhythm chart classes. It is not closed because `avance/ump` still lacks the original georeferenced map complexity and exact point/block interaction.

### Iteration 16 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: `avance/ump` rendered a real territorial map with 206 block paths, 150 navigable manzanas, active selection, pan/zoom/reset controls, district outlines, titular/replacement/status color classes, and a selected-UMP navigator at the end of this iteration. It remained `mismatch` at that point because the GPS layer was still pending before Iteration 17, and the cold path was much slower than the goal targets.

### Iteration 17 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: `avance/ump` now loads the GPS point layer on demand, filters rendered GPS points to the selected manzana/UMP, keeps point radii screen-stable while zooming, lists the selected UMP responses, and focuses a clicked GPS response at 4.2x. It remains `mismatch`: the original still has richer map context/inspector behavior and the ACNURCG cold path is still too slow.

### Iteration 18 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: the client warm cache now reuses resolved `warmupCache` state values, and the territorial profile no longer launches a duplicate view-scope request while the initial scope is still hydrating. ACNURCG `/monitoreo -> Avance -> Mapa y UMP` dropped from 4 light + 2 source requests to 2 light + 1 source request before `advance_summary`. It remains `mismatch` because `advance_summary` itself still builds cold in about 13 s / 18.7 s total.

### Iteration 19 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: `avance/ump` now asks for `route_summary` first and cancels the deferred `advance_summary` hydration if the user moves from Resumen to Mapa y UMP quickly. The ACNURCG scripted path `/monitoreo -> Avance -> Mapa y UMP` rendered the desktop cartography/GPS map with no `advance_summary` request observed. It remains `mismatch`: `route_summary` is still about 4.5 s in the measured cold route, and the original map inspector/context behavior is not fully reproduced.

### Iteration 20 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 10.
- Unverified: 9.
- Blocked: 2.
- Score: 21 / 42 = 50.0%.
- Note: the modular territorial page now reuses the canonical `mon-territorial-loading-*` state while an active report scope is pending, tracks pending scopes reactively, and treats background prefetch separately from active UI loading. This avoids false "Sin avance" empty states during `avance/ump` hydration and gives immediate local feedback. It remains `mismatch`: `route_summary` still takes about 4.8-4.9 s in the measured ACNURCG cache-hit route, and the map inspector/context parity is still incomplete.

### Iteration 21 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 8.
- Unverified: 12.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `ocurrencias` now renders `TerritorialFieldOccurrencesWorkbench` instead of the simplified target. The ACNURCG project exercises real occurrence data for `Estados general`, `Por UMP`, and `Observaciones`; all three visual QA captures passed after a UMP row overflow repair. It remains outside `done` because the canonical asset picker/configuration console, upload-Kobo flow, exact log surface, and mutating occurrence round trips remain open.

### Iteration 22 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 8.
- Unverified: 12.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `route_summary` and `advance_summary` now trim `source_coherence.survey_fields` and `choices_by_list` in the direct territorial summary builder, while the `source` scope keeps the canonical Kobo schema details for Fuentes. The territorial report cache schema is bumped to `v21` so old cached payloads cannot preserve the heavier contract. This is a cache-contract repair, not a parity close: ACNURCG still shows a cold `route_summary` build around 10 s / 14 s total in the measured route, and the richer original map inspector/context remains open.

### Iteration 23 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 8.
- Unverified: 12.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `ocurrencias` now exposes a compact Kobo asset selector/configuration panel using `apiConnectionsList`, `apiMonitoreoKoboAssets`, and `apiMonitoreoTerritorialOccurrencesConfig`. Visual QA opened the selector panel on ACNURCG with no layout issues. It remains outside `done` because catalog loading/asset selection were not clicked in QA and upload-Kobo/full log parity remains open.

### Iteration 24 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 8.
- Unverified: 12.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `ocurrencias/Por UMP` now includes the expanded canonical filter set: search, status, district, responsible, and dominant outcome. ACNURCG visual QA passed with the denser filter row and no overflow. It remains `unverified` because exact canonical detail depth and mutating occurrence actions are still not exercised.

### Iteration 25 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 8.
- Unverified: 12.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `route_summary` and `advance_summary` now remove duplicate route/map/source-console branches from the lightweight payload: `map.blocks`, `advance.district_progress`, `advance.block_progress`, `ump_declared_summary.rows/route_options`, and `enumerator_code_summary` are empty in the route scope, while `route_blocks`, `block_progress`, and `district_progress` remain available for the map/model fallbacks. ACNURCG visual QA still renders the full desktop UMP/GPS map across 1280, 1440, 1600, and 1920 px desktop widths. This improves payload size but does not close performance parity because cold route-summary rebuilds still spend too long in backend computation.

### Iteration 26 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 7.
- Unverified: 13.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `ocurrencias` now exposes the existing upload-Kobo endpoint in the command bar through `apiMonitoreoTerritorialOccurrencesUploadKobo`, reuses the canonical config-summary surface for status/XLSForm/upload/sync state, and expands the visible history log with status, message, response count, and asset UID. ACNURCG visual QA passed for `Estados general` and `Observaciones`; `Subir Kobo` was not clicked because it is a mutating external Kobo action and the audit session had no Kobo token.

### Iteration 27 current

- Total original items: 42.
- Not applicable: 0.
- Done: 21.
- Missing: 0.
- Mismatch: 7.
- Unverified: 13.
- Blocked: 1.
- Score: 21 / 42 = 50.0%.
- Note: `avance/ump` now renders a canonical-style audited inspector over the map for the selected manzana or GPS point, reusing `mon-territorial-inspector-card` and exposing Kobo date, lat/lon, spatial district/zone, declared UMP, operational manzana, distance, GPS state, source, nearest block, and alerts. ACNURCG QA passed broad map capture and direct GPS click assertions; the tab remains `mismatch` because the original map still has richer street/neighbor/context layers and the route-summary cold path remains slower than the target.

### Iteration 28 current

- Total original items: 42.
- Not applicable: 0.
- Done: 22.
- Missing: 0.
- Mismatch: 6.
- Unverified: 13.
- Blocked: 1.
- Score: 22 / 42 = 52.4%.
- Note: the modular territorial page now renders the canonical global error shell with `Alert kind="error"`, `mon-territorial-view-error`, and a real retry action. Failed report scopes now pause automatic active/background report hydration until the user retries, preventing the forced-error request storm observed before this repair. Full parity remains open because phase/cache coherence and section-specific gaps are unchanged.

### Iteration 29 current

- Total original items: 42.
- Not applicable: 0.
- Done: 22.
- Missing: 0.
- Mismatch: 5.
- Unverified: 14.
- Blocked: 1.
- Score: 22 / 42 = 52.4%.
- Note: the modular rail now exposes canonical-style phase/source/cache status: pilot/field badges are backed by `territorial_phase_coherence`, the active source card shows source name plus local/snapshot rows, and the report card shows cache source/scope/size when available. Visual QA on a fresh ACNURCG stack proves the rail renders without overflow. The row remains `unverified` because the full `TerritorialBootPanel` readiness sequence and exact authoritative phase state machine are still not extracted.

### Iteration 30 current

- Total original items: 42.
- Not applicable: 0.
- Done: 22.
- Missing: 0.
- Mismatch: 5.
- Unverified: 14.
- Blocked: 1.
- Score: 22 / 42 = 52.4%.
- Note: `ocurrencias/Observaciones` now renders a searchable review board for missing UMP, observation, outside-route, and high no-effectivity alerts, plus a fuller event log in the summary rail. ACNURCG visual QA proves the board renders with real alert data (`80 visibles de 148`) and no overflow/page/API/resource errors. The row remains `unverified` rather than `done` because the typed filter/search interaction and the external Kobo mutation round trip were not executed in a safe fixture.

### Iteration 31 current

- Total original items: 42.
- Not applicable: 0.
- Done: 23.
- Missing: 0.
- Mismatch: 5.
- Unverified: 13.
- Blocked: 1.
- Score: 23 / 42 = 54.8%.
- Note: `ocurrencias/Observaciones` is now closed as a local tab. A manual Playwright probe on ACNURCG reused the fresh QA stack, selected the `Sin reporte` alert filter, verified 68 visible `is-missing` rows, searched `0390` down to 2 matching rows, and verified the empty state for an impossible query without page or console errors. The broader `Content/actions ocurrencias` row remains `unverified` because upload/config mutation round trips against Kobo are still not executed in a safe tokened fixture.

### Iteration 32 current

- Total original items: 42.
- Not applicable: 0.
- Done: 24.
- Missing: 0.
- Mismatch: 5.
- Unverified: 12.
- Blocked: 1.
- Score: 24 / 42 = 57.1%.
- Note: `ocurrencias/Por UMP` is now closed as a local tab. The target detail drawer restores the canonical advance-without-occurrence notices, attention reasons, source-row facts, route/cruce fact, source-record list, and left/right drawer placement. Manual Playwright QA on ACNURCG selected `Completa sin reporte` and `Con reporte no efectivo`, verified 60 complete-missing rows, 80 non-effective rows, an advance notice, 2 reason chips, a records section with source rows, no select/global overflow, and no page/console errors. The broader `Content/actions ocurrencias` row remains `unverified` because upload/config mutation round trips against Kobo are still not executed in a safe tokened fixture.

### Iteration 33 current

- Total original items: 42.
- Not applicable: 0.
- Done: 25.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 25 / 42 = 59.5%.
- Note: `ocurrencias/Estados general` is now closed as a local tab. The target state chart now matches the canonical `is-state` card with intent summary, state meter, four state stats, no legacy quickstats block, and district rows now include validas-without-occurrences context. Manual Playwright QA on ACNURCG verified 5,112 attempts, 7 outcome rows, 7 daily rows, 7 district rows, 7 advance-missing district cells, no old composition card, no overflow, and no page/console errors. The broader `Content/actions ocurrencias` row remains `unverified` because upload/config mutation round trips against Kobo are still not executed in a safe tokened fixture.

### Iteration 34 current

- Total original items: 42.
- Not applicable: 0.
- Done: 25.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 25 / 42 = 59.5%.
- Note: user-reported visual parity gap in `fuentes/Formulario` was reopened and repaired without changing the global score, because Fuentes was already counted as closed. The modular target now uses the canonical single active form surface: pilot/field phase strip, route-sheet source card, selected form summary, source-readiness metrics, and the asset list hidden until `Cambiar formulario`. The pre-repair comparator screenshot in `tmp/visual-qa/monitoreo-territorial-user-reported-ui-diff/quick-monitoreo-comparar-territorial-3000x1100-auto.png` showed the mismatch; the post-repair QA in `tmp/visual-qa/monitoreo-territorial-source-form-user-diff-repair/report.json` passed with the selected form picker rendered.

### Iteration 36 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: `avance/Ritmo diario` is closed as a local tab, and Iteration 36 reduces the remaining visual gap in `avance/Mapa y UMP`: the map now shows opt-in street/context layers for the selected district, zone overlays, neighbor blocks, canonical GPS state classes/legend, and an in-map legend visible at 1440x1000. This keeps the global score unchanged because `avance/ump` still has cold route-summary performance debt and is not yet the exact historical map engine.

### Iteration 37 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 37 reduces the remaining visual and behavior gap in `calidad/Geolocalización`: the validation map is now paneable, can reset, auto-focuses the selected UMP or focused GPS point, keeps GPS markers stable under zoom, filters visible GPS points to the selected UMP when possible, and shows the canonical GPS-state legend in-map. This keeps the global score unchanged because `calidad/geolocalizacion` still lacks exact historical context/street/neighbor layers and original virtualized case behavior.

### Iteration 38 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 38 reduces the remaining visual gap in `calidad/Geolocalización`: the validation map now loads cartography for the active UMP district first, renders selected-zone and neighboring manzana context, normalizes `001`/`00100` zone keys, and restores the original accordion distinction between selecting a manzana card and opening its nested GPS points. This keeps the global score unchanged because exact historical street/context layers and virtualized case behavior remain open.

### Iteration 39 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 39 does not change the product parity score; it closes the missing accordion point-click evidence by adding QA helper wait support and proving `Validación` -> `Abrir puntos GPS` -> `Punto 1` at 1440x1000.

### Iteration 40 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 40 does not change the global parity score; it reduces the remaining visual gap in `calidad/Geolocalización` by restoring selected-district Hoja de Ruta street/context layers in the validation map. It remains `mismatch` because original case virtualization and data-rich validation details remain open.

### Iteration 41 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 41 does not change the global parity score; it reduces the remaining `calidad/Geolocalización` sidebar gap by restoring virtualized UMP groups, canonical-style group risk summaries, explicit UMP-to-GPS child containment, and the original separation between selecting a manzana card and opening/clicking its nested GPS points. It remains `mismatch` because exact original district section grouping and richer per-case detail summaries still need extraction.

### Iteration 42 current

- Total original items: 42.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 10.
- Blocked: 1.
- Score: 26 / 42 = 61.9%.
- Note: Iteration 42 does not change the global parity score; it reduces the remaining `calidad/Geolocalización` case-list gap by restoring canonical-style district/section headings over the virtualized UMP rail. It remains `mismatch` because richer original per-case summaries and exact split of mixed GPS/no-GPS groups still need extraction.

### Iteration 43 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 43 does not change the global parity score; it corrects the remaining `calidad/Geolocalización` sidebar semantics after rechecking the original source. The case-list now uses the published territorial GPS criterion (`En zona`, `Fuera de zona`, `Fuera de distrito`, `Sin cruce`, `Sin GPS`) instead of presenting `Dentro/Fuera manzana` as the main containment signal. It remains `mismatch` because richer original per-case summaries and exact split of mixed GPS/no-GPS groups still need extraction.

### Iteration 44 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 44 does not change the global parity score; it restores the original richer per-point row detail inside `calidad/Geolocalización` after rechecking `MonitoreoPage.tsx:19330-19530` and its GPS/stamp/responsible helpers. Opened UMP groups now count only GPS rows as `Punto N`, show canonical date/hour, sex/age, responsible, district/ubigeo, UMP reference, GPS source/reclassification/precision trace, and preserve the Iteration 43 zone/district chips (`UMP seleccionada`, `En zona UMP`). It remains `mismatch` because exact mixed GPS/no-GPS grouping and broader validation/reconciliation parity are still open.

### Iteration 45 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 45 does not change the global parity score; it closes the exact mixed GPS/no-GPS grouping gap inside `calidad/Geolocalización` by aligning the target list construction with the original case-first section model. `territorialGeoGroupListItems` now assigns each case to its canonical section (`route`, `without_cross`, `without_gps`, `outside_frame`) before cloning visual UMP groups, so rows without GPS can move to `Sin punto geográfico` even when their base UMP also has GPS cases. Expansion state is keyed by the section item while map selection still uses the base UMP key. It remains `mismatch` because broader validation/reconciliation parity and data-rich verification remain open.

### Iteration 46 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 46 does not change the global parity score; it fixes the user-reported visual clipping in the `calidad/Geolocalización` in-map GPS/ruta legend. The legend now uses mini pills, compact route labels, and full labels in hover titles, preserving the GPS zone/district criteria and UMP-vs-point behavior.

### Iteration 47 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 47 does not change the global parity score; it removes the user-reported redundant upper map card from `calidad/Geolocalización` and makes the lower GPS KPI strip the only in-map summary. The five KPI cards now use a single-row grid at desktop/compact desktop sizes.

### Iteration 48 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 48 does not change the global parity score; it corrects the map-context emphasis in `calidad/Geolocalización` after rechecking the original source. The validation map now selects active-zone and neighbor manzanas by a 500 m radius around the selected UMP/GPS anchors, attenuates street-line weight, and renders labels for principal streets.

### Iteration 49 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 49 does not change the global parity score; it fixes the 500 m context criterion so surrounding manzanas do not exclude loaded manzanas from other zones. Other-zone neighbor manzanas are prioritized before extra active-zone context and rendered as subtle cross-zone texture.

### Iteration 50 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 50 does not change the global parity score; it fixes the compact desktop split in `calidad/Geolocalización`. The validation map keeps a two-column desktop layout from 1121px to 1320px, with a denser map/list split, and only collapses to a vertical stack below 1120px.

### Iteration 60 current

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 60 completes the ordered first-pass review of the `Validación` section. It keeps the global done score unchanged because annulment preview/apply/revert actions were not clicked on the real project, but it closes the data-rich visual gap for `calidad/anulacion`. Evidence `tmp/visual-qa/territorial-parity-validacion-anulacion-8792-20260628/12-validacion-anulacion.png` shows both frames hydrated with the audited-annulment form, 1 active tacha, 311 excluded responses, 13 affected UMPs, selected responsible, preview panel, action buttons, and history row with no loaders/errors (`wait_ms=44237`).

### Iteration 59 previous

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 59 keeps the global done score unchanged because `calidad/cuotas` was already counted as done, but it adds ordered canonical evidence using the clean 8792/5177 stack. Comparator evidence `tmp/visual-qa/territorial-parity-validacion-cuotas-8792-20260628/11-validacion-cuotas.png` shows both frames hydrated with 300 evaluated manzanas, replacement toggle, status filters, complete and replacement UMP cards, sex/age quota bars, observed-fill tables, no loaders and no page/console errors (`wait_ms=45851`).

### Iteration 58 previous

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 58 keeps the global done score unchanged because the duration map handoff was not clicked, but it closes the data-rich visual/hydration gap for `calidad/duracion`. The old stack blocked the API during a `validation_summary` rebuild (`HTTP 000` after 300s and health timeout), so a clean QA stack was started on API `8792` and frontend `5177`; the project-loading/session-open wait is recorded separately from tab hydration. In the clean session `4e67e63a-149d-492f-94d9-05c93205845f`, `validation_summary` prefetch took 11.815s and the comparator captured `Validación > Duración de tiempo` after `wait_ms=56409`. Evidence `tmp/visual-qa/territorial-parity-validacion-duracion-8792-20260628/10-validacion-duracion-de-tiempo.png` shows both frames hydrated with 1,215 timed interviews, 54 for review, median 14 min, P95 6h18, duration histogram, and valid-response rhythm rail with no loaders/errors.

### Iteration 57 previous

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 57 keeps the global done score unchanged because `calidad/reconciliacion` still has unexercised mutating actions on the real project, but the ordered visual/hydration gap is now closed for the first viewport. Session-seeded comparator evidence `tmp/visual-qa/territorial-parity-validacion-reconciliacion-current-20260628/09-validacion-reconciliacion-ump.png` shows both canonical and modular frames hydrated with 5 spatial suspicions, 4 patterns, candidate cards, action buttons, no loaders, and no page/console errors (`wait_ms=216929`). Queue/dismiss/apply behavior remains code-wired but was not clicked in ACNURCG to avoid mutating the project during visual QA.

### Iteration 56 previous

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 56 does not change the global parity score and deliberately does not mark `calidad/geolocalizacion` as done. The ordered session-seeded comparator first exposed a false-ready state where the canonical frame still showed `Cargando cartografia de Hojas de Ruta`; the comparator now blocks on that text. The product repair then aligns the modular initial validation map to the canonical `3.4x` focus, removes the full-district projection from selected UMP views, uses the selected GPS cluster as the camera anchor when available, and only shows `Cargando calles` as a blocking overlay when no street/context layer is visible yet. Final evidence `tmp/visual-qa/territorial-parity-validacion-geolocalizacion-loading-guard-20260628/08-validacion-geolocalizacion.png` is hydrated in both frames (`wait_ms=216689`, no loaders, no page/console errors), but still remains `mismatch`: the modular map renders the active zone and street/context layers with a different visual emphasis and geometry scale than the canonical original.

### Iteration 55 previous

- Total original items: 43.
- Not applicable: 0.
- Done: 26.
- Missing: 0.
- Mismatch: 5.
- Unverified: 11.
- Blocked: 1.
- Score: 26 / 43 = 60.5%.
- Note: Iteration 55 does not change the global parity score because `modelo/tabla` was already counted as done in an older QA pass, but the ordered canonical comparator reopened it after proving a false-ready UI failure: the modular `UMPs > Manzanas` frame had 150 DOM rows, yet each accordion `article` collapsed to 2 px and rendered as blank stripes. The repair moves the table-scroll row protection into the territorial profile tab scope, lets the accordion render as a flex column, and restores the first viewport height so UMP 1 expanded plus UMP 2-5 match the canonical original. Final session-seeded comparator evidence: `tmp/visual-qa/territorial-parity-umps-manzanas-session-height-20260628/07-umps-manzanas.png`, `wait_ms=83815`, no frame loaders, no page/console errors.

## Performance/cache score

Scoring: `0` absent, `1` label-only, `2` partial with weak loading/cache, `3` usable but slow or incomplete, `4` near-equivalent with small gaps, `5` canonical parity with acceptable cold/warm evidence.

| Area | Section | Tab/Subtab | Cold-load evidence | Warm/cache evidence | Requests/scopes observed | Cache/Perf score | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Global entry | territorial | initial route | `Avance` text appeared after 82,702 ms and Avance content after 122,928 ms on an ACNURCG manual run before the cache repair. Direct scope measurement found cold `advance_summary` at `build_ms=12689`, `totalMs=17023`; v21 `route_summary` rebuilt at `build_ms=10051`, `total_ms=14040`, direct curl `size_download=1845831`. Iteration 25 forced report-cache `v23`; direct curl now measures `size_download=1129963`, dashboard `payload_size=510045`, while cold rebuild still varied from `total_ms=11520` to `19939`. | Resolved warm-cache values are reused for repeated `warmupCache` calls, the territorial profile avoids heavy prewarm for common Mapa y UMP navigation, active/background loading is separated, and the route scope no longer carries source schema, duplicate map blocks, duplicate advance progress, UMP reconciliation rows, or enumerator-code summaries. Warm cache in the measured v23 session reached API log `total_ms=2518` and direct curl `time_total=3.284903`. | Baseline scripted run: 4 `light`, 2 `source`, 1 `advance_summary`. After Iteration 25 QA: 2 `light`, 1 `source`, 1 route-scope navigation build; no `full` or `advance_summary` in the measured Mapa y UMP navigation. The final multi-viewport run repeated the path at 1280x800, 1440x900, 1600x1000, and 1920x1080 with no page/API/resource errors. | 3 | mismatch | Baseline `tmp/visual-qa/monitoreo-territorial-goal-loop-perf-baseline/logs/api.log`; Iteration 25 `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v23-source-trim/logs/api.log`; `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v23-multiview/report.json`; `/tmp/route_summary_v23.json`; `/tmp/route_summary_v23_warm.json`. |
| Global rail | territorial | phase/cache status | Before Iteration 29 the target rail had hard-coded pilot/field hints and a single cache fallback label. | The rail now derives pilot/field badges from `territorial_phase_coherence`, active source from phase source/coherence, and report status from `territorial_report_cache`. | Fresh-stack QA rendered `Fuente activa`, `Última actualización`, and `Reporte territorial` cards at 1440x1000 with no overflow/page/API/resource errors. | 4 | unverified | `tmp/visual-qa/monitoreo-territorial-phase-cache-status-iteration29-workbench/report.json`; `tmp/visual-qa/monitoreo-territorial-phase-cache-status-iteration29-workbench/quick-monitoreo-1440x1000-auto.png`. |
| Local tabs | avance | ump | Earlier exact run: local tab visibility took 12,682 ms and UMP map layout took 20,959 ms. Iteration 25 reaches the desktop UMP/GPS map after `route_summary` only; the v23 route scope is lighter, but cold backend rebuild is still above target. While the scope is pending, the page renders the canonical `mon-territorial-loading is-avance` state instead of a false empty panel. | Selected UMP 38 rendered the desktop map after payload dedupe, with `route_blocks=300`, `block_progress=150`, `map_blocks=0`, `advance_block_progress=0`, `ump_rows=0`, and `enumerator_code_keys=0`. Iteration 36 keeps GPS lazy-loading and adds opt-in rich cartography for the selected district; final ACNURCG QA shows 150 manzanas with geometry, 9 GPS points in-map, 1,513 visible GPS, 90 zones, 220 streets, 34 context features, and 180 neighbor blocks with visible GPS-state legend. | `route_summary` covers the first Mapa y UMP render; `reports.map.points` remains absent, so the target still loads the `gps_points` layer on demand. Rich street/context layers are opt-in through `loadTerritorialRouteCartography(..., { includeRichLayers: true })` for the selected district, not all districts. | 3 | mismatch | `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v23-source-trim/report.json`; `tmp/visual-qa/monitoreo-territorial-avance-ump-inspector-gps-ready-iteration27/report.json`; `tmp/visual-qa/monitoreo-territorial-avance-ump-inspector-gps-click-iteration27b/manual-report.json`; `tmp/visual-qa/monitoreo-territorial-avance-ump-inspector-compact-iteration27/report.json`; `tmp/visual-qa/monitoreo-territorial-avance-ump-streets-loaded-iteration36/report.json`; `/tmp/route_summary_v23.json`. |
| Local tabs | avance | ritmo | Iteration 35 waits for the real Plotly rhythm chart after `advance_summary` hydrates; the cold direct API call rebuilt the canonical audit before returning 13 daily rows. | A repeated direct `advance_summary` request returned `cache_source=session`, `cache_hit=true`, schema `monitoreo_territorial_report_cache_v24`, in about 4.1 s. | `avance/ritmo` uses `advance_summary`; no `full` payload is exposed to the UI, and the scoped payload keeps `response_audit`, `map.points`, and `map.blocks` empty. | 3 | mismatch | `tmp/visual-qa/monitoreo-territorial-avance-ritmo-canonical-v24-iteration35/report.json`; direct API proof on session `8fa20d57-0494-49ad-8ccf-bc5ff4b3471c`. |
| Global guard | territorial | report error | Before the guard, a forced report failure retried in the background and produced 47 intercepted report requests in the manual probe. | Iteration 28 forced-error guard now renders one failed request, pauses automatic report hydration, and issues only one additional request when the user clicks `Reintentar`. | Forced probe: `beforeRetry=1`, `afterRetry=2`, `retryButton="Reintentar"`, `alertClass="pulso-alert pulso-alert-error"`, page errors empty. | 4 | done | `tmp/visual-qa/monitoreo-territorial-error-state-retry-guard-iteration28/manual-report.json`; before-guard evidence in `tmp/visual-qa/monitoreo-territorial-error-state-retry-iteration28/manual-report.json`. |
| QA tool | comparison | canonical vs modular | First fixed ready capture loaded both desktop iframes with project state. | Not a user workflow tab; used only to compare parity. | Parent project state plus two forced surfaces; no API/page/resource errors in final capture. | not applicable | done | `tmp/visual-qa/monitoreo-territorial-compare-desktop-wide-ready-fixed/report.json`. |

### Fuentes/source console score

- Total source items: 6.
- Done before this loop: 0.
- Done after this loop: 6.
- Missing after this loop: 0.
- Mismatch after this loop: 0.
- Unverified after this loop: 0.
- Blocked after this loop: 0.
- Score after this loop: 6 / 6 = 100%.

### Modelo/workbench score

- Total model items: 3.
- Done before this loop: 0.
- Done after this loop: 3.
- Missing after this loop: 0.
- Mismatch after this loop: 0.
- Unverified after this loop: 0.
- Blocked after this loop: 0.
- Score after this loop: 3 / 3 = 100%.

> Closure rule: the loop cannot close as full parity while a primary section or canonical subtab behavior remains `mismatch` or `blocked`, even if the visual navigation exists.

## Current validation

- `avance/salidas` was extracted into `TerritorialOutputsPanel` and is now consumed by both `MonitoreoPage.tsx` and `TerritorialMonitoreoPage.tsx`.
- `pnpm --dir frontend typecheck` -> passed.
- `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- `pnpm --dir frontend build:fast` -> passed.
- `git diff --check` -> passed after the Iteration 3 code and documentation updates.
- Visual QA base: `tmp/visual-qa/monitoreo-territorial-canonical-final/report.json` -> ok=true, captures=2, issues=0, overflow=0.
- Visual QA click `Avance` -> `Salidas`: `tmp/visual-qa/monitoreo-territorial-canonical-salidas/report.json` -> ok=true, captures=1, issues=0, overflow=0, waitSelectorMisses=0.
- `fuentes/source console` now renders `TerritorialSourceConsole.tsx` instead of the simplified `SourceView`.
- Visual QA source base: `tmp/visual-qa/monitoreo-territorial-source-after/report.json` -> ok=true, captures=2, issues=0, overflow=0.
- Visual QA click `Filtro y distritos`: `tmp/visual-qa/monitoreo-territorial-source-filter/report.json` -> ok=true, waitSelectorMisses=0.
- Visual QA click `Encuestadores`: `tmp/visual-qa/monitoreo-territorial-source-roster/report.json` -> ok=true, waitSelectorMisses=0.
- Visual QA click `Reconciliación`: `tmp/visual-qa/monitoreo-territorial-source-reconciliation/report.json` -> ok=true, waitSelectorMisses=0.
- Visual QA click `Historial`: `tmp/visual-qa/monitoreo-territorial-source-history/report.json` -> ok=true, waitSelectorMisses=0.
- Iteration 3 Fuentes batch/progress repair: `pnpm --dir frontend typecheck` -> passed.
- Iteration 3 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 3 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 3 import audit: no `MonitoreoPage` imports under `frontend/src/features/monitoreo/profiles/territorial`; `TerritorialMonitoreoPage.tsx` imports `MonitoreoWorkbenchChrome`.
- Visual QA batch base: `tmp/visual-qa/monitoreo-territorial-parity-fuentes-batch/report.json` -> ok=true, captures=2, issues=0, overflow=0.
- Visual QA click `Reconciliación` after batch repair: `tmp/visual-qa/monitoreo-territorial-source-reconciliation-batch/report.json` -> ok=true, captures=1, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 4 Modelo repair: `TerritorialModelWorkbench.tsx` replaces the simplified `RouteView` path for `modelo`.
- Iteration 4 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 4 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 4 build: `pnpm --dir frontend build:fast` -> passed.
- Visual QA click `UMPs` -> `Cobertura`: `tmp/visual-qa/monitoreo-territorial-modelo-resumen-fixed2/report.json` -> ok=true, captures=1, issues=0, overflow=0, waitSelectorMisses=0.
- Visual QA click `UMPs` -> `Manzanas`: `tmp/visual-qa/monitoreo-territorial-modelo-tabla-fixed2/report.json` -> ok=true, captures=1, issues=0, overflow=0, waitSelectorMisses=0.
- Visual QA compact click `UMPs` -> `Manzanas`: `tmp/visual-qa/monitoreo-territorial-modelo-tabla-compact/report.json` -> ok=true, captures=1, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 5 Modelo coverage atlas repair: `TerritorialRouteCoverageAtlas.tsx` restores the canonical `modelo/Cobertura` atlas with route KPI hero, selected-block map, sex/age rail, and district coverage table.
- Iteration 5 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 5 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 5 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 5 visual QA click `UMPs` -> `Cobertura`: `tmp/visual-qa/monitoreo-territorial-modelo-cobertura-atlas/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 6 baseline build: `pnpm --dir frontend build:fast` -> passed before edits.
- Iteration 6 baseline visual QA: `tmp/visual-qa/monitoreo-territorial-calidad-geoloc-baseline/report.json` -> ok=true, captures=2, issues=0, overflow=0.
- Iteration 6 import audit: territorial still loads `./TerritorialMonitoreoPage`; `acreditacion/index.ts` still loads `../../MonitoreoPage`.
- Iteration 6 geolocation repair: `TerritorialValidationGeoWorkbench.tsx` renders `calidad/geolocalizacion` with `mon-territorial-validation-geo-*`, `mon-territorial-route-map-*`, `mon-territorial-map-*`, and `mon-territorial-geo-case-*` classes, using Hojas de Ruta block/zone cartography and Kobo GPS points.
- Iteration 6 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 6 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 6 diff hygiene: `git diff --check -- frontend/src/features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx frontend/src/features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx docs/qa/monitoreo/territorial_parity_matrix.md docs/qa/monitoreo/territorial_extraction_map.md` -> passed.
- Iteration 6 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 6 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geoloc-iteration6/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project exposed the empty validation state (`0 GPS`, `0 cases`), so data-rich GPS/case parity remains unverified.
- Iteration 7 reconciliation repair: `TerritorialSpatialReconciliationWorkbench` renders `calidad/reconciliacion` with `mon-territorial-validation-geo-spatial`, `mon-territorial-spatial-reconciliation-panel`, pattern/candidate cards, local queue, batch apply through `apiMonitoreoTerritorialReconciliationBatch`, and dismiss actions through the existing spatial reconciliation endpoints.
- Iteration 7 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 7 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 7 diff hygiene: `git diff --check -- frontend/src/features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx frontend/src/features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx docs/qa/monitoreo/territorial_parity_matrix.md docs/qa/monitoreo/territorial_extraction_map.md` -> passed.
- Iteration 7 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 7 import audit: territorial still loads `./TerritorialMonitoreoPage`; `acreditacion/index.ts` still loads `../../MonitoreoPage`.
- Iteration 7 visual QA click `Validación` -> `Reconciliación UMP`: `tmp/visual-qa/monitoreo-territorial-calidad-reconciliacion-iteration7/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project exposed the empty reconciliation state (`sin_respuestas`), so candidate-rich queue/apply/dismiss visual parity remains unverified.
- Iteration 8 reconciliation confirmation repair: the target spatial queue now opens a `mon-territorial-reconciliation-dialog` before applying UMP spatial changes, preserving the original confirmation-list visual language and apply/cancel flow.
- Iteration 8 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 8 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 8 diff hygiene: `git diff --check --no-index /dev/null` run per touched untracked file -> passed.
- Iteration 8 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 8 import audit: no `from .*MonitoreoPage` imports under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 8 visual QA click `Validación` -> `Reconciliación UMP`: `tmp/visual-qa/monitoreo-territorial-calidad-reconciliacion-confirm-iteration8/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project still exposes the empty reconciliation state (`sin_respuestas`), so the confirmation dialog remains code/build validated but not visually exercised with queued candidate data.
- Iteration 9 duration repair: `calidad/duracion` now renders `TerritorialDurationControl` with the canonical `mon-duration-*` workbench, histogram, daily rhythm card, review table, enumerator summary, and selected-response handoff to `geolocalizacion`.
- Iteration 9 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 9 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 9 diff hygiene: `git diff --check` for tracked touched files and `git diff --check --no-index /dev/null` per touched untracked file -> passed.
- Iteration 9 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 9 import audit: no `from .*MonitoreoPage` imports under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 9 visual QA click `Validación` -> `Duración de tiempo`: `tmp/visual-qa/monitoreo-territorial-calidad-duracion-iteration9-wrap/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project exposed the empty duration state, so review-row/map-handoff parity remains unverified with data.
- Iteration 10 quota repair: `calidad/cuotas` now renders `TerritorialQuotaConsistencyPanel` with the canonical `mon-territorial-quota-*` workflow: commandbar, search, status filters, replacement toggle, UMP block cards, sex/age margin meters, and observed sex-by-age matrix.
- Iteration 10 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 10 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 10 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 10 visual QA click `Validación` -> `Cuotas`: `tmp/visual-qa/monitoreo-territorial-calidad-cuotas-iteration10/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project exposed 8 quota blocks with sex/age targets and observed matrix content.
- Iteration 11 annulment repair: `calidad/anulacion` now renders `TerritorialProductionAnnulmentWorkspace`, with canonical `EmptyState`, preview/apply/revert API wiring, required reason validation, impact table, and history controls.
- Iteration 11 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 11 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 11 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 11 visual QA click `Validación` -> `Anulación`: `tmp/visual-qa/monitoreo-territorial-calidad-anulacion-empty-final-iteration11/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project exposed the no-responsibles empty state; data-rich preview/apply/revert UI remains unverified.
- Iteration 12 reconciliation focus repair: `TerritorialSpatialReconciliationWorkbench` now sends the staged/focused candidate `response_id` to `TerritorialValidationGeoWorkbench` before opening `geolocalizacion`.
- Iteration 12 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 12 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 12 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 12 visual QA click `Validación` -> `Reconciliación UMP`: `tmp/visual-qa/monitoreo-territorial-calidad-reconciliacion-focus-iteration12/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit project still exposed the empty reconciliation state.
- Iteration 12 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geoloc-focus-iteration12/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 13 consultas repair: `TerritorialReviewCasesWorkbench.tsx` replaces the simplified `QueriesView` path with canonical review hero, filters, table shell, UUID copy, GPS/duration actions, and an operational-adjustment summary for `subsanaciones`.
- Iteration 13 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 13 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 13 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 13 diff hygiene: `git diff --check -- frontend/src/features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx frontend/src/features/monitoreo/profiles/territorial/TerritorialReviewCasesWorkbench.tsx frontend/src/features/monitoreo/profiles/territorial/TerritorialValidationGeoWorkbench.tsx` -> passed.
- Iteration 13 visual QA click `Consultas` -> `Registro`: `tmp/visual-qa/monitoreo-territorial-consultas-registro-iteration13/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0. The audit fixture exposed 0 review rows.
- Iteration 13 visual QA click `Consultas` -> `GPS por revisar`: `tmp/visual-qa/monitoreo-territorial-consultas-gps-iteration13/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 13 visual QA click `Consultas` -> `Duración por revisar`: `tmp/visual-qa/monitoreo-territorial-consultas-duracion-iteration13/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 13 visual QA click `Consultas` -> `Cruce responsable`: `tmp/visual-qa/monitoreo-territorial-consultas-responsable-iteration13/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 13 visual QA click `Consultas` -> `Subsanaciones`: `tmp/visual-qa/monitoreo-territorial-consultas-subsanaciones-final-iteration13/report.json` -> ok=true, captures=2, issues=0, overflow=0, waitSelectorMisses=0.
- Iteration 14 subsanaciones repair: `TerritorialOperationalAdjustmentsWorkspace.tsx` extracts the original operational-adjustment package picker, decision note, apply, revert, reset, metrics, empty state, and applied-history surface for `consultas/subsanaciones`.
- Iteration 14 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 14 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 14 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 14 diff hygiene: `git diff --check -- frontend/src/features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx frontend/src/features/monitoreo/profiles/territorial/TerritorialReviewCasesWorkbench.tsx` -> passed; `git diff --check --no-index /dev/null frontend/src/features/monitoreo/profiles/territorial/TerritorialOperationalAdjustmentsWorkspace.tsx` returned no whitespace diagnostics.
- Iteration 14 import audit: no `MonitoreoPage` import/reference under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 14 visual QA click `Consultas` -> `Subsanaciones`: `tmp/visual-qa/monitoreo-territorial-consultas-subsanaciones-operational-iteration14-final/report.json` -> ok=true, captures=2, issues=0, overflow=0, pageErrors=0, apiErrors=0, waitSelectorMisses=0. The audit project exposed the `sin_respuestas_validas` empty operational matrix.
- Iteration 15 avance repair: `TerritorialAdvanceWorkbench.tsx` replaces the simplified `AdvanceView` path for `resumen`, `ump`, and `ritmo`, using canonical `mon-territorial-datebar`, `mon-territorial-overview-*`, `mon-territorial-exec-*`, `mon-territorial-ump-*`, and `mon-territorial-rhythm-*` classes.
- Iteration 15 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 15 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 15 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 15 import audit: no `MonitoreoPage` import/reference under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 15 visual QA click `Avance` -> `Resumen`: `tmp/visual-qa/monitoreo-territorial-avance-resumen-iteration15/report.json` -> ok=true, captures=2, issues=0, overflow=0, pageErrors=0, apiErrors=0, waitSelectorMisses=0.
- Iteration 15 visual QA click `Avance` -> `Mapa y UMP`: first run found one select overflow; after repair `tmp/visual-qa/monitoreo-territorial-avance-ump-iteration15-final/report.json` -> ok=true, captures=2, issues=0, overflow=0, pageErrors=0, apiErrors=0, waitSelectorMisses=0.
- Iteration 15 visual QA click `Avance` -> `Ritmo diario`: `tmp/visual-qa/monitoreo-territorial-avance-ritmo-iteration15/report.json` -> ok=true, captures=2, issues=0, overflow=0, pageErrors=0, apiErrors=0, waitSelectorMisses=0.
- Iteration 16 `avance/ump` map repair: `TerritorialAdvanceWorkbench.tsx` now uses the route coverage atlas cartography helpers for an interactive UMP/manzana map with pan, zoom, reset, selected feature focus, selected UMP navigator, and canonical `mon-territorial-*` map classes.
- Iteration 16 exact manual QA click `Avance` -> `Mapa y UMP`: `tmp/visual-qa/monitoreo-territorial-goal-loop-avance-ump-exact/manual-report.json` captured `toAvanceButtonMs=86921`, `toLocalTabVisibleMs=12682`, `toUmpMapLayoutMs=20959`, `selectFirstUmpMs=121`, `navRows=150`, `mapPaths=206`, `selectedMapPaths=1`, `gpsPoints=0`.
- Iteration 16 exact screenshot: `tmp/visual-qa/monitoreo-territorial-goal-loop-avance-ump-exact/avance-ump-1600x1000.png` shows desktop chrome, active `Avance > Mapa y UMP`, large map, district outlines, block paths, selected manzana, zoom controls, and the manzana navigator.
- Iteration 16 comparison repair: `/monitoreo/comparar-territorial` now forwards the dev project path to both forced surfaces and waits for actual iframe `data-audit-ready="monitoreo"` before marking the comparison ready.
- Iteration 16 comparison QA: `tmp/visual-qa/monitoreo-territorial-compare-desktop-wide-ready-fixed/report.json` -> ok=true, captures=1, issues=0, overflow=0, pageErrors=0, apiErrors=0, resourceErrors=0, projectMisses=0, waitSelectorMisses=0. Screenshot `tmp/visual-qa/monitoreo-territorial-compare-desktop-wide-ready-fixed/quick-monitoreo-comparar-territorial-3000x1100-auto.png` shows both canonical and modular panes with desktop-width layouts.
- Iteration 16 typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 16 targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 16 build: `pnpm --dir frontend build:fast` -> passed.
- Iteration 16 diff hygiene/import audit: `git diff --check` over touched files -> passed; no `MonitoreoPage` import/reference under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 17 GPS/manzana repair: `TerritorialAdvanceWorkbench.tsx` now composes the cache-backed `gps_points` layer into `avance/ump`, filters map points to the selected UMP/manzana, scales point radii inversely to zoom, lists selected UMP GPS responses, and supports click-to-focus response selection.
- Iteration 17 direct API inspection on ACNURCG: `advance_summary` returned 150 blocks and no embedded `reports.map.points`; `/api/monitoreo/territorial/map?layer=gps_points` returned a valid cached layer with 1,594 GPS points.
- Iteration 17 QA path/content inspection: `tmp/visual-qa/monitoreo-territorial-goal-loop-gps-path-inspect/report.json` captured `avanceContent=122928`, `pointsAfterAvance=2017`, `pathsAfterAvance=3211`, `pointNodes=9`, `blockPaths=150`, `overflowRows=0`, and map header `150 manzanas con geometría · 9 puntos GPS en mapa · 1,513 GPS visibles · 6 distritos filtrados`.
- Iteration 17 QA click inspection: `tmp/visual-qa/monitoreo-territorial-goal-loop-gps-click-inspect/report.json` captured `selectedPointNodes=1`, `responseSelected=1`, `zoom=4.2x`, and selected title `39 · CHORRILLOS · Sin encuestador asignado · GPS fuera de zona`.
- Iteration 17 visual QA after GPS sizing/filtering: `tmp/visual-qa/monitoreo-territorial-goal-loop-gps-ump-scaled-filtered/report.json` -> ok=true, issues=0.
- Iteration 17 final typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 17 final targeted tests: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 205 tests.
- Iteration 17 final build: `pnpm --dir frontend build:fast` -> passed; `monitoreo-territorial-DWjkhkrv.js` 610.34 kB and `monitoreo-territorial-CIGtVHu8.css` 1,293.75 kB.
- Iteration 17 final diff hygiene/import audit: `git diff --check` over touched code/docs -> passed; no `MonitoreoPage` import/reference under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 18 cache/loading baseline QA without prefetch: `tmp/visual-qa/monitoreo-territorial-goal-loop-perf-baseline/report.json` -> no visual issues, but `waitSelectorMisses=1`; API log showed 4 `light`, 2 `source`, 1 cold `advance_summary` with `build_ms=12449`, `total_ms=18569`.
- Iteration 18 warm cache repair: `frontend/src/api/client.ts` now returns resolved warm-cache values even when the repeated call also passes `warmupCache:true`.
- Iteration 18 initial scope guard: `TerritorialMonitoreoPage.tsx` skips the per-view load effect while `loadingView === "initial"`, avoiding a duplicate `source` request during initial hydration.
- Iteration 18 post-repair QA without prefetch: `tmp/visual-qa/monitoreo-territorial-goal-loop-perf-initial-guard/report.json` -> no visual issues/scroll jails/page/API/resource errors; API log showed 2 `light`, 1 `source`, 1 cold `advance_summary` with `build_ms=12962`, `total_ms=18740`.
- Iteration 18 targeted client test: `pnpm --dir frontend test -- src/api/client.test.ts` -> passed; 206 tests, including warm-cache reuse.
- Iteration 18 final typecheck: `pnpm --dir frontend typecheck` -> passed.
- Iteration 18 final targeted tests: `pnpm --dir frontend test -- src/api/client.test.ts src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests.
- Iteration 18 final build: `pnpm --dir frontend build:fast` -> passed; `monitoreo-territorial-BArHDutS.js` 610.38 kB.
- Iteration 18 final diff hygiene/import audit: `git diff --check` over touched code/docs -> passed; no `MonitoreoPage` import/reference under `frontend/src/features/monitoreo/profiles/territorial`.
- Iteration 19 direct scope measurement on ACNURCG: `route_summary` first request returned `size_download=1854779`, `totalMs=4206`; warm session request returned `totalMs=2431`. A cold `advance_summary` comparison returned `size_download=2447215`, `build_ms=12689`, `totalMs=17023`.
- Iteration 19 route-first repair: `TerritorialMonitoreoPage.tsx` now prefers `route_summary` for `avance` local tabs other than `ritmo`, keeps `advance_summary` for pilot/ritmo/full advance hydration, reduces field background scopes to `source` + `route_summary`, and defers `advance_summary` hydration for `avance/resumen`.
- Iteration 19 QA after route-first repair: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-first-ump-gps-ready/report.json` -> ok=true, visual issues=0, scrollJails=0, overflow=0, pageErrors=0, apiErrors=0, resourceErrors=0, waitSelectorMisses=0. API log showed 2 `light`, 1 `source`, 1 `route_summary` with `total_ms=4524`; no `advance_summary` request was observed in the Mapa y UMP path.
- Iteration 19 screenshot evidence: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-first-ump-gps-ready/quick-monitoreo-1440x1000-auto.png` shows a desktop-width territorial map with 150 manzanas con geometría, 9 GPS points in the selected UMP/map, and 1,513 GPS visible in scope.
- Iteration 19 typecheck: `pnpm --dir frontend typecheck` -> passed before the documentation update.
- Iteration 20 canonical loading repair: `TerritorialMonitoreoPage.tsx` now ports the canonical `TerritorialLoadingView` presentation and renders it for active report-dependent tabs while their scope is pending. It tracks pending scope keys in React state, so a background `route_summary` request no longer leaves `avance/ump` showing a false empty state.
- Iteration 20 active/background split: `chromeBusy` now reflects initial/active loading and mutations, not every background prefetch. `Fuentes` and `Avance/Salidas` remain renderable from light state because they do not require a territorial report payload for first paint.
- Iteration 20 QA progressive map card: `tmp/visual-qa/monitoreo-territorial-goal-loop-loading-canonical/report.json` -> ok=true; screenshot captured the progressive map frame with local `Cargando manzanas` and `Cargando GPS` indicators. API log showed 2 `light`, 1 `source`, 1 `route_summary` with `total_ms=4904`, no `full`, no `advance_summary`.
- Iteration 20 QA GPS-ready map: `tmp/visual-qa/monitoreo-territorial-goal-loop-loading-canonical-gps-ready/report.json` -> ok=true, visual issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. API log showed 2 `light`, 1 `source`, 1 `route_summary` with `total_ms=4793`, no `full`, no `advance_summary`.
- Iteration 20 screenshot evidence: `tmp/visual-qa/monitoreo-territorial-goal-loop-loading-canonical-gps-ready/quick-monitoreo-1440x1000-auto.png` shows the same desktop UMP/GPS map with 150 manzanas con geometría, 9 GPS points in map, and 1,513 GPS visible in scope.
- Iteration 20 baseline and repair typecheck: baseline `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts`, `pnpm --dir frontend typecheck`, `git diff --check`, import audit, and `pnpm --dir frontend build:fast` passed before the repair; `pnpm --dir frontend typecheck` passed after the code change.
- Iteration 21 Ocurrencias repair: `TerritorialFieldOccurrencesWorkbench.tsx` replaces the simplified `ocurrencias` body with data-backed states, UMP follow-up, observation coverage, history excerpt, XLSForm, field inspection, sync, and link-copy controls.
- Iteration 21 UMP overflow repair: `territorialProfile.css` adds a scoped `.mon-stage--ocurrencias` UMP row sizing override after visual QA found real ACNURCG rows overflowing at 112 px.
- Iteration 21 visual QA click `Ocurrencias` -> `Estados general`: `tmp/visual-qa/monitoreo-territorial-occurrences-states-iteration1/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0.
- Iteration 21 visual QA click `Ocurrencias` -> `Por UMP`: first run `tmp/visual-qa/monitoreo-territorial-occurrences-ump-iteration1/report.json` found 80 row overflow issues; after the CSS repair, `tmp/visual-qa/monitoreo-territorial-occurrences-ump-iteration1b/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0.
- Iteration 21 visual QA click `Ocurrencias` -> `Observaciones`: `tmp/visual-qa/monitoreo-territorial-occurrences-observaciones-iteration1/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0.
- Iteration 21 validation: `pnpm --dir frontend typecheck`, targeted tests (`fieldOccurrences`, `registry`, `reportScopeCache`), `pnpm --dir frontend build:fast`, `git diff --check`, and the territorial import audit passed after the code and CSS changes.
- Iteration 22 route-summary payload repair: `.monitoreo_territorial_route_summary_report()` now strips `source_coherence.survey_fields` and `source_coherence.choices_by_list` for `route_summary` and `advance_summary`; `source` remains the owner of full Kobo schema metadata.
- Iteration 22 cache-contract repair: `.monitoreo_territorial_report_cache_schema` moved from `v20` to `v21` so ACNURCG and other projects do not reuse older cached territorial summaries with the heavier source-coherence payload.
- Iteration 22 backend validation: `Rscript -e 'testthat::test_file("api/tests/testthat/test-monitoreo-report-cache.R")'` -> passed; the test fixture now verifies that `route_summary` keeps source counts but empties schema lists, while `source` retains the schema lists.
- Iteration 22 clean desktop QA: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-trim-gps-ready-clean/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. API log showed 2 `light`, 1 `source`, 1 `route_summary`, no `full`, no `advance_summary`.
- Iteration 22 v21 rebuild QA: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v21-measure/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. API log showed `route_summary` rebuilt with `build_ms=10051`, `total_ms=14040`.
- Iteration 22 direct payload verification: `/tmp/route_summary_v21.json` reported cache schema `monitoreo_territorial_report_cache_v21`, `cache_source=build`, `payload_size=1225909`, direct curl `size_download=1845831`, `survey_fields_len=0`, `choices_by_list_len=0`; `/tmp/source_scope_v21.json` retained `survey_fields_len=35`, `choices_by_list_len=12`.
- Iteration 23 Ocurrencias config selector repair: `TerritorialFieldOccurrencesWorkbench.tsx` now loads Kobo connection state, lists asset catalogs per profile/base URL, opens a selector panel, persists selected assets with `apiMonitoreoTerritorialOccurrencesConfig`, and requests a current-scope reload after config changes.
- Iteration 23 visual QA click `Ocurrencias` -> `Cambiar formulario`: `tmp/visual-qa/monitoreo-territorial-occurrences-config-selector-iteration22-prefetch/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. The run opened the selector panel; `prefetch` timed out harmlessly before capture, and no asset was selected.
- Iteration 24 Ocurrencias UMP filter repair: `OccurrenceUmpWorkspace` now exposes district, responsible, and dominant-outcome filters in addition to search and status.
- Iteration 24 visual QA click `Ocurrencias` -> `Por UMP`: `tmp/visual-qa/monitoreo-territorial-occurrences-ump-filters-iteration23/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0.
- Iteration 25 route-summary duplicate payload repair: `.monitoreo_territorial_route_summary_report()` now strips duplicate `advance.district_progress`, `advance.block_progress`, and `map.blocks` from `route_summary`/`advance_summary`; top-level `district_progress`, `block_progress`, and `route_blocks` remain available for canonical frontend fallbacks.
- Iteration 25 route-summary source-console payload repair: `route_summary`/`advance_summary` now strip `ump_declared_summary.rows`, `ump_declared_summary.route_options`, and `enumerator_code_summary`; the source console continues to own those details through the `source` scope.
- Iteration 25 cache-contract repair: `.monitoreo_territorial_report_cache_schema` moved to `monitoreo_territorial_report_cache_v23` so ACNURCG and other projects do not reuse older route-summary payloads with duplicate branches.
- Iteration 25 backend validation: `Rscript -e 'testthat::test_file("api/tests/testthat/test-monitoreo-report-cache.R")'` -> passed; the fixture verifies that the light route scope keeps route/block progress but strips duplicate map/advance/source-console branches.
- Iteration 25 visual QA: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v23-source-trim/report.json` -> ok=true, captures=1, issues=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1600x1000. Screenshot shows the desktop Mapa y UMP with 150 manzanas, 9 GPS points in map, and 1,513 GPS visible.
- Iteration 25 desktop-width QA: `tmp/visual-qa/monitoreo-territorial-goal-loop-route-summary-v23-multiview/report.json` -> ok=true, captures=4, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1280x800, 1440x900, 1600x1000, and 1920x1080.
- Iteration 25 payload verification: `/tmp/route_summary_v23.json` reported cache schema `monitoreo_territorial_report_cache_v23`, `payload_size=510045`, direct curl `size_download=1129963`, `route_blocks=300`, `block_progress=150`, `map_blocks=0`, `advance_block_progress=0`, `ump_rows=0`, and `enumerator_code_keys=0`. A warm direct curl to `/tmp/route_summary_v23_warm.json` measured `time_total=3.284903`, and the API log recorded a session cache hit at `total_ms=2518`.
- Iteration 26 Ocurrencias upload/config/log repair: `TerritorialFieldOccurrencesWorkbench.tsx` now imports `apiMonitoreoTerritorialOccurrencesUploadKobo`, adds the `upload` busy state, exposes `Subir Kobo` in the command bar, updates state/reloads after a successful upload response, renders the canonical `.mon-field-occurrences-connect-summary` with config/XLSForm/upload/sync state, and shows richer history entries in `Observaciones`.
- Iteration 26 visual QA click `Ocurrencias` -> `Estados general`: `tmp/visual-qa/monitoreo-territorial-occurrences-upload-state-iteration26/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. Screenshot shows `Subir Kobo` disabled without token and the config summary visible.
- Iteration 26 visual QA click `Ocurrencias` -> `Observaciones`: `tmp/visual-qa/monitoreo-territorial-occurrences-upload-log-iteration26/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. Screenshot shows history entries with type/status/message/count/asset context.
- Iteration 25 final build validation: `pnpm --dir frontend build:fast` -> passed; production chunking still emits `monitoreo-territorial-BStunapx.js` and `monitoreo-territorial-7OXpZMoJ.css`.
- Iteration 28 loading/error repair: `TerritorialMonitoreoPage.tsx` now renders `TerritorialViewError` through the shared `Alert` component, keeps the canonical `mon-territorial-view-error` layout, and disables automatic active/background report hydration while a report error is visible.
- Iteration 28 normal visual QA: `tmp/visual-qa/monitoreo-territorial-error-state-normal-iteration28/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0.
- Iteration 28 forced-error visual QA: `tmp/visual-qa/monitoreo-territorial-error-state-forced-iteration28/manual-report.json` -> ok=true with `pulso-alert-error`, retry button visible, loading hidden, and no page errors.
- Iteration 28 retry-guard QA: `tmp/visual-qa/monitoreo-territorial-error-state-retry-guard-iteration28/manual-report.json` -> ok=true, `beforeRetry=1`, `afterRetry=2`, retry button `Reintentar`, and no page errors.
- Iteration 29 phase/cache rail repair: `TerritorialWorkbenchRail` now derives pilot/field badges from `territorial_phase_coherence`, active-source detail from phase coherence/source config, and report status from `territorial_report_cache`.
- Iteration 29 visual QA with fresh stack and workbench wait: `tmp/visual-qa/monitoreo-territorial-phase-cache-status-iteration29-workbench/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. Screenshot shows `Fuente activa`, `Última actualización`, and `Reporte territorial` cards in the rail.
- Iteration 30 Ocurrencias alert-board repair: `TerritorialFieldOccurrencesWorkbench.tsx` now normalizes missing UMP, observation, outside-route, and high no-effectivity rows into a searchable `Observaciones` review board, with a fuller history list in the summary rail.
- Iteration 30 visual QA click `Ocurrencias` -> `Observaciones`: `tmp/visual-qa/monitoreo-territorial-occurrences-alerts-iteration30/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0. Screenshot shows `80 visibles de 148` alert rows, filter controls, outcome/cobertura summary cards, and the history panel at 1440x1000.
- Iteration 31 Ocurrencias alert interaction QA: `tmp/visual-qa/monitoreo-territorial-occurrences-alerts-filter-iteration31/manual-report.json` -> ok=true. The probe reused the ACNURCG stack, selected `Sin reporte`, verified 68 visible rows with `is-missing`, searched `0390` down to 2 matching rows, and verified the impossible-query empty state (`No hay UMP esperadas sin reporte de ocurrencias.`) with no page/console errors.
- Iteration 31 validation: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `git diff --check`, territorial import audit, and docs whitespace checks passed.
- Iteration 32 Ocurrencias UMP detail repair: `TerritorialFieldOccurrencesWorkbench.tsx` now renders advance-without-occurrence notices, attention reasons, route/cruce and source-row facts, capped source records, richer row messaging, complete/incomplete/started missing counters, and left/right detail placement for `Por UMP`. A scoped CSS adjustment keeps the UMP filter selects from overflowing with long labels.
- Iteration 32 visual QA click `Ocurrencias` -> `Por UMP`: `tmp/visual-qa/monitoreo-territorial-occurrences-ump-detail-iteration32-quick/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000.
- Iteration 32 manual UMP detail QA: `tmp/visual-qa/monitoreo-territorial-occurrences-ump-detail-iteration32/manual-report.json` -> ok=true. The probe selected `Completa sin reporte` and verified 60 rows, an advance notice, 2 reason chips, then selected `Con reporte no efectivo` and verified 80 rows, a source-record section with 1 source row, `Fuente` facts, no filter-select overflow, no global overflow, and no page/console errors.
- Iteration 32 validation: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed; `git diff --check`, territorial import audit, and docs whitespace checks passed.
- Iteration 33 Ocurrencias states repair: `TerritorialFieldOccurrencesWorkbench.tsx` now aligns `Estados general` with the canonical `is-state` composition card, intent summary, state meter, state stats, canonical outcome header copy, and district validas-without-occurrences cells.
- Iteration 33 visual QA click `Ocurrencias` -> `Estados general`: `tmp/visual-qa/monitoreo-territorial-occurrences-states-canonical-iteration33/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000.
- Iteration 33 manual states QA: `tmp/visual-qa/monitoreo-territorial-occurrences-states-canonical-iteration33-manual/manual-report.json` -> ok=true. The probe verified `Intentos reportados` = 5,112, 4 state stat chips, 7 outcome rows, 7 daily rows, 7 district rows, 7 district `Validas sin ocurrencias` cells, no legacy `.is-composition` or `.mon-field-occurrences-quickstats`, no overflow, and no page/console errors.
- Iteration 33 validation: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed; `git diff --check`, territorial import audit, and docs whitespace checks passed.
- Iteration 34 Fuente/Formulario visual repair: the user-reported side-by-side comparator gap was reproduced in `tmp/visual-qa/monitoreo-territorial-user-reported-ui-diff/quick-monitoreo-comparar-territorial-3000x1100-auto.png`. `TerritorialSourceConsole.tsx` now renders the active form tab as a canonical single workbench with pilot/field source phase cards, route-sheet source controls, the selected form summary, readiness metrics, inspect/sync actions, and the asset selector hidden behind `Cambiar formulario`.
- Iteration 34 visual QA click `Fuente` -> `Formulario`: `tmp/visual-qa/monitoreo-territorial-source-form-user-diff-repair/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000.
- Iteration 34 validation: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed with the existing monitoreo-acreditacion/monitoreo-territorial circular chunk warning; `git diff --check`, territorial import audit, and docs whitespace checks passed.
- Iteration 35 Avance/Ritmo repair: `TerritorialAdvanceWorkbench.tsx` now prioritizes top-level `reports.daily` like the canonical monolith, while `api/R/monitoreo_engine.R` routes `advance_summary` through the canonical territorial audit and scopes the heavy payload afterward. `api/R/router_monitoreo.R` bumps the report-cache schema to `monitoreo_territorial_report_cache_v24`.
- Iteration 35 backend validation: `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-report-cache.R")'` -> passed, 56 expectations; the fixture verifies that `advance_summary` keeps daily rows while `response_audit`, `map.blocks`, and `map.points` stay empty.
- Iteration 35 visual QA click `Avance` -> `Ritmo diario`: `tmp/visual-qa/monitoreo-territorial-avance-ritmo-canonical-v24-iteration35/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows the Plotly rhythm chart, 13-day table, and side metrics instead of an empty state.
- Iteration 35 direct API proof on ACNURCG session `8fa20d57-0494-49ad-8ccf-bc5ff4b3471c`: `advance_summary` returned schema `monitoreo_territorial_report_cache_v24`, `daily=13`, `advanceDaily=13`, totals `total=1283`, `validas=982`, `revision=233`, `responseAudit=0`, `mapPoints=0`, `mapBlocks=0`, `blockProgress=150`; warm repeat returned `cache_source=session`, `cache_hit=true`, ~4.1 s.
- Iteration 35 validation: `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no `MonitoreoPage` imports.
- Iteration 36 Avance/Mapa y UMP visual repair: `TerritorialRouteCoverageAtlas.tsx` now supports opt-in rich street/context cartography without forcing those layers on existing map callers, and `TerritorialAdvanceWorkbench.tsx` renders selected-district context features, streets, zones, neighbor blocks, canonical GPS-state classes, and a visible `.mon-territorial-advance-map-legend` overlay.
- Iteration 36 visual QA click `Avance` -> `Mapa y UMP`: `tmp/visual-qa/monitoreo-territorial-avance-ump-streets-loaded-iteration36/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows 150 manzanas with geometry, 9 GPS points in-map, 1,513 visible GPS, 90 zones, 220 streets, 34 context features, 180 neighbor blocks, and the GPS legend visible over the map.
- Iteration 36 validation: baseline and final `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no `MonitoreoPage` imports.
- Iteration 37 Calidad/Geolocalización visual repair: `TerritorialValidationGeoWorkbench.tsx` now scopes visible GPS points to the selected UMP when possible, adds drag/trackpad pan, reset, UMP auto-focus, GPS point auto-focus, stable GPS marker scale under zoom, canonical GPS-state classes, and a visible `.mon-territorial-validation-geo-map-legend` overlay.
- Iteration 37 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-camera-iteration37b/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows UMP 1 focused at 2.4x, 8 GPS visible, 2 zones/2 manzanas in the in-map legend, and footer metrics visible without overflow.
- Iteration 37 point-focus QA click `Validación` -> `Geolocalización` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-point-click-iteration37/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows point selection focused at 4.2x, selected manzana outline, and focused row state.
- Iteration 37 validation: baseline and final `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no `MonitoreoPage` imports.
- Iteration 38 Calidad/Geolocalización context/sidebar repair: `TerritorialValidationGeoWorkbench.tsx` now loads active-district cartography first, derives focus-zone and neighbor manzana layers, normalizes short/full INEI zone keys, keeps the selected manzana card separate from the GPS accordion, and marks point rows as inside/outside the selected manzana when local geometry is available.
- Iteration 38 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-active-district-iteration38b/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows UMP 1 focused at 2.4x, 8 GPS visible, 2 zonas/2 manzanas/236 vecinas in the in-map legend, selected manzana outline, and sidebar GPS points collapsed under the selected UMP.
- Iteration 39 QA helper repair: `scripts/ui-quick-check.mjs` now supports `--wait-after-click-selector`, allowing staged clicks to wait for report-driven controls before continuing.
- Iteration 39 point-focus QA click `Validación` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-accordion-point-iteration39/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows the GPS accordion open, `Punto 1` focused at 4.2x, selected point and focused row, `Puntos visibles`, and inside/outside manzana chips visible.
- Iteration 38 validation: final `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` -> passed; `pnpm --dir frontend build:fast` -> passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no prohibited imports.
- Iteration 39 validation: `node scripts/ui-quick-check.mjs --help` exposes `--wait-after-click-selector`; final targeted registry/cache tests passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no prohibited imports.
- Iteration 40 Calidad/Geolocalización rich context repair: `TerritorialValidationGeoWorkbench.tsx` now reuses `loadTerritorialRouteCartography(..., { includeRichLayers: true })` for the active UMP district, samples the canonical street/context features, renders `.mon-territorial-map-context-features` and `.mon-territorial-map-streets` behind selected manzanas/GPS, and keeps a separate `Cargando calles` state without touching backend report payloads.
- Iteration 40 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-rich-context-iteration40/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows UMP 1 / Mz 0390 embedded in a visible street grid, GPS points still focused inside the selected manzana, and legend `Hoja de Ruta: 2 zonas · 220 vias · 120 contexto`.
- Iteration 40 validation: final targeted registry/cache tests passed, 32 files / 206 tests; `pnpm --dir frontend typecheck` passed; `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no prohibited imports.
- Iteration 41 Calidad/Geolocalización case-list repair: `TerritorialValidationGeoWorkbench.tsx` imports `useVirtualizer`, virtualizes UMP/manzana groups, scrolls/focuses the opened group when a GPS response is selected, and separates selecting the UMP card from opening/clicking its nested GPS points. The Iteration 41 wording still exposed geometric `Dentro/Fuera manzana` chips; Iteration 43 supersedes that semantic layer with zone/district labels from the original publication criterion.
- Iteration 41 visual QA click `Validación` -> `Geolocalización` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-case-containment-iteration41/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows the selected `UMP 1 · Mz 0390` card, virtualized child list, opened point rows, and map point focus preserved at `4.2x`; the `FUERA MANZANA` chip shown there is superseded by Iteration 43.
- Iteration 41 validation: baseline and final targeted registry/cache tests passed, 32 files / 206 tests; baseline and final `pnpm --dir frontend typecheck` passed; baseline and final `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no prohibited imports. Baseline and QA prefetch of `validation_summary` timed out in the quick-check script, but route hydration and click validation completed with `ok=true`.
- Iteration 42 Calidad/Geolocalización district-section repair: `TerritorialValidationGeoWorkbench.tsx` now derives virtual `groupItems` from canonical-style district sections, classifies fully `sin_cruce`, fully `sin_gps`, outside-frame, and route sections, renders `.mon-territorial-geo-district-heading` above the first UMP in each section, and includes the heading height in the virtualizer estimate so rows do not overlap.
- Iteration 42 visual QA click `Validación` -> `Geolocalización` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-section-heading-iteration42/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows the district heading `ATE` with `150103 · 210 casos · 25 UMP`, the selected `UMP 1 · Mz 0390` card, nested points, and map point focus preserved at `4.2x`.
- Iteration 42 validation: baseline and final targeted registry/cache tests passed, 32 files / 206 tests; baseline and final `pnpm --dir frontend typecheck` passed; baseline and final `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed; territorial import audit found no prohibited imports. QA prefetch of `validation_summary` timed out, but route hydration and click validation completed with `ok=true`.
- Iteration 43 Calidad/Geolocalización original-criterion repair: original source review confirmed the sidebar groups by UMP (`MonitoreoPage.tsx:19330-19530`) while the published GPS criterion is zone/district (`api/R/monitoreo_engine.R:26428-26485`, tested in `api/tests/testthat/test-monitoreo-engine.R:6372-6411`). `TerritorialValidationGeoWorkbench.tsx` now summarizes opened points as `en zona UMP / fuera zona / fuera distrito`, renders `UMP seleccionada` plus `En zona UMP` on point rows, and removes the active `Dentro/Fuera manzana` containment copy from the sidebar. `monitoreo.css` adds the matching zone/district chip states.
- Iteration 43 visual QA click `Validación` -> `Geolocalización` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-zone-criteria-iteration43/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows `8/8 en zona`, `Zona activa`, `8 en zona UMP · 0 fuera zona · 0 fuera distrito`, and `Punto 1` with `UMP seleccionada` + `En zona UMP`; map point focus remains at `4.2x`.
- Iteration 43 validation: baseline and final targeted territorial/registry/cache tests passed, 32 files / 206 tests; baseline and final `pnpm --dir frontend typecheck` passed; final `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed. QA prefetch of `validation_summary` timed out, but route hydration and click validation completed with `ok=true`.
- Iteration 44 Calidad/Geolocalización per-point detail repair: original source review rechecked `TerritorialGeoCaseList` and helpers (`territorialSubmissionStampParts`, `territorialPulsoCodeLabel`, `territorialCaseResponsibleLabel`, `territorialGpsTraceLabel`, `territorialReviewSexLabel`, `territorialReviewAgeLabel`). `TerritorialValidationGeoWorkbench.tsx` now renders the original richer point row summary: GPS-only `Punto N` numbering, date/hour with `sin hora` fallback, H/M/S/D + age, responsible/code fallback, district/ubigeo, UMP reference, and GPS source/reclassification/precision trace while preserving the zone/district child chips from Iteration 43. The fallback `map.points` audit row conversion now preserves GPS primary/effective fields, code reconciliation flags, submission source/hour, spatial block match fields, and observation fields.
- Iteration 44 visual QA click `Validación` -> `Geolocalización` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-rich-row-detail-iteration44/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot shows selected `UMP 1 · Mz 0390`, the opened child rail, `Punto 1` focused, date/hour, `H · 78`, responsible, `fuente GPS fondo · reemplaza Kobo · prec. 13 m`, `UMP seleccionada`, and `En zona UMP`; map focus remains at `4.2x`. QA prefetch of `validation_summary` timed out, but route hydration and click validation completed.
- Iteration 44 validation: baseline and final targeted territorial/registry/cache tests passed, 32 files / 206 tests; baseline and final `pnpm --dir frontend typecheck` passed; final `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed; territorial import boundary audit found no prohibited `MonitoreoPage` import.
- Iteration 45 Calidad/Geolocalización mixed GPS/no-GPS grouping repair: `TerritorialValidationGeoWorkbench.tsx` now builds virtual case-list sections from each case before grouping, mirroring the original `territorialGeoBlockSections` behavior. Mixed UMPs can render GPS rows under their route section while no-GPS rows render under `Sin punto geográfico`; cloned visual groups recompute GPS/review/no-defendible counts and responsible labels for the section subset. Expansion now keys on the section item (`section:key + group:key`) while `onSelectGroup` still uses the base UMP key for map focus. Group badges now show related replacement counts (`N R`) when applicable.
- Iteration 45 visual QA click `Validación` -> `Geolocalización` -> `Abrir puntos GPS` -> `Punto 1`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-mixed-gps-split-iteration45/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Screenshot preserves selected `UMP 1 · Mz 0390`, opened child rail, `Punto 1`, `8 en zona UMP · 0 fuera zona · 0 fuera distrito`, and map focus at `4.2x`.
- Iteration 45 validation: baseline and final targeted territorial/registry/cache tests passed, 32 files / 206 tests; baseline and final `pnpm --dir frontend typecheck` passed; final `pnpm --dir frontend build:fast` passed with the existing circular chunk warning; `git diff --check` passed.
- Iteration 46 Calidad/Geolocalización compact legend repair: `monitoreo.css` reduces the in-map `.mon-territorial-validation-geo-map-legend` to mini pills with less padding, lighter shadow, visible overflow, and a wider-but-bounded max width. `TerritorialValidationGeoWorkbench.tsx` abbreviates only the visible overlay labels (`GPS`, `Fuera dist.`, `UMP sel.`, `ctx`, `vec.`) while retaining full meanings through `title` attributes.
- Iteration 46 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-compact-legend-iteration46-final/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Compact desktop QA `tmp/visual-qa/monitoreo-territorial-calidad-geo-compact-legend-iteration46-1280/report.json` -> ok=true at 1280x800 `compact`; screenshots show the legend fits inside the map without clipping while the UMP/GPS criteria remain visible.
- Iteration 46 validation: baseline and final `pnpm --dir frontend typecheck` passed; `git diff --check` passed. QA prefetch of `validation_summary` timed out, but route hydration and visual validation completed with `ok=true`.
- Iteration 47 Calidad/Geolocalización KPI-strip repair: `TerritorialValidationGeoWorkbench.tsx` removes the upper `.mon-territorial-validation-geo-map-legend` overlay and its now-dead legend variables. `monitoreo.css` changes `.mon-territorial-validation-geo-map-footer` to a full-width five-column KPI strip with smaller card padding/type, so `En zona`, `Fuera de zona`, `Fuera de distrito`, `Sin cruce`, and `Sin GPS` fit in one row.
- Iteration 47 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-footer-kpis-iteration47-1440/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Compact desktop QA `tmp/visual-qa/monitoreo-territorial-calidad-geo-footer-kpis-iteration47-1280/report.json` -> ok=true at 1280x800 `compact`; screenshots show no upper card and all five KPIs in one row.
- Iteration 47 validation: targeted Monitoreo frontend tests passed, 32 files / 206 tests; `git diff --check` passed. Global `pnpm --dir frontend typecheck` is blocked by unrelated `src/features/recopiladores/RecopiladoresPage.tsx(1243,18)` missing `hasSessionLinks`; it was not touched in this iteration. QA prefetch of `validation_summary` timed out, but route hydration and visual validation completed with `ok=true`.
- Iteration 48 Calidad/Geolocalización 500 m context repair: original-source recheck confirmed that validation context should prioritize surrounding manzanas and principal street names over dense street-line texture. `TerritorialValidationGeoWorkbench.tsx` now uses `VALIDATION_NEIGHBOR_CONTEXT_RADIUS_M = 500` for focus-zone and neighbor block selection around selected UMP/GPS anchors, adds major-street label anchors, and keeps street labels from `display_name/name`. `monitoreo.css` makes context blocks more legible, reduces street-line prominence, and styles street-name labels with a white halo.
- Iteration 48 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-500m-labels-iteration48-1440b/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Compact desktop QA `tmp/visual-qa/monitoreo-territorial-calidad-geo-500m-labels-iteration48-1280/report.json` -> ok=true at 1280x800 `compact`; screenshots show five KPI cards in one row, no upper map card, visible 500 m-context manzanas, muted street lines, and principal street labels at the desktop viewport.
- Iteration 48 validation: `pnpm --dir frontend typecheck` passed; targeted Monitoreo frontend tests passed, 32 files / 206 tests; `git diff --check` passed. QA prefetch of `validation_summary` timed out, but route hydration and visual validation completed with `ok=true`.
- Iteration 49 Calidad/Geolocalización cross-zone context repair: `TerritorialValidationGeoWorkbench.tsx` now treats `selectedDistrict` as a ranking hint instead of an exclusion filter for neighbor context and passes `selectedRouteZoneKeys` into the neighbor selector. Neighbor manzanas inside the 500 m loaded radial context are sorted with non-active-zone features first, while active-zone features remain in the focus layer. `monitoreo.css` adds a subtle dashed amber `is-cross-zone` state so other-zone context is visible without looking selected.
- Iteration 49 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-cross-zone-context-iteration49-1440/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1440x1000. Compact desktop QA `tmp/visual-qa/monitoreo-territorial-calidad-geo-cross-zone-context-iteration49-1280/report.json` -> ok=true at 1280x800 `compact`; screenshot shows the active selected UMP in the focus layer, other-zone neighbor manzanas visible as cross-zone context, and five KPI cards in one row.
- Iteration 50 Calidad/Geolocalización compact map repair: `monitoreo.css` changes the 1320px validation-geo breakpoint from a single-column stack to a dense two-column desktop layout and moves the vertical collapse to `max-width: 1120px`. This prevents the compact 1280x800 view from splitting the map into a top band and the case list into a lower band.
- Iteration 50 visual QA click `Validación` -> `Geolocalización`: `tmp/visual-qa/monitoreo-territorial-calidad-geo-compact-map-unbroken-iteration50-1280/report.json` -> ok=true, captures=1, issues=0, scrollJails=0, overflow=0, page/API/resource errors=0, waitSelectorMisses=0 at 1280x800 `compact`; screenshot shows map and case list side-by-side, the map in one piece, cross-zone texture visible, and all five KPIs still in one row.
- Iteration 50 validation: post-edit `pnpm --dir frontend typecheck` passed and `git diff --check` passed. QA prefetch of `validation_summary` timed out, but route hydration and visual validation completed with `ok=true`.

## Loop conclusion

Status: partial success globally, Fuentes closed after Iteration 3 and Modelo closed after Iteration 5. Calidad, Consultas, Avance, and Ocurrencias have all started as canonical extractions, but none of those sections is fully closed.

Iteration 1 extracted one coherent rich unit: `avance/salidas`. Iteration 2 replaced the simplified Fuentes cards with `TerritorialSourceConsole`, including real Kobo asset/source actions, operational filter mapping, roster upload/downloads, route-sheet connect/sync, reconciliation summaries, and history. Iteration 3 closed Fuentes by adding selectable batch reconciliation against the existing batch endpoint and polling/progress feedback for Kobo sync jobs. Iteration 4 replaced the simplified Modelo body with `TerritorialModelWorkbench`, including route command state, route-sheet strip, Kobo sync job handler, coverage summary, titular/replacement table, filters, selection, and UMP context. Iteration 5 restored the canonical Modelo coverage atlas and route map surface inside `Cobertura`.

Iteration 6 replaced the lightweight `ter-*` geolocation map path with a canonical GPS/cartography workbench for `calidad/geolocalizacion`. It restores real Hojas de Ruta cartography, Kobo GPS points, a map footer, case grouping by UMP, and the entry point toward `reconciliacion`. It is intentionally still marked `mismatch`: the target does not yet reproduce the exact historical validation workbench, especially spatial reconciliation action parity, dismissal/staging handlers, virtualized case behavior, and full map context.

Iteration 7 starts the spatial reconciliation subtab. It restores the canonical panel language, queueing behavior, batch apply endpoint, and dismissal endpoints inside the territorial profile. Iteration 8 restores the original confirmation-dialog step before applying queued spatial UMP changes. It is still not marked `done`: the original includes tighter map focus integration and richer candidate/pattern staging state that the target has not fully reproduced or verified with a candidate-rich fixture.

Iteration 9 replaces the `duracion` fallback with the canonical duration workbench. It restores the `mon-duration-*` visual language, duration histogram, daily rhythm card, review table, enumerator summary, and the "Ver en mapa" handoff into geolocation selection. It is marked `unverified` rather than `done` because the audit project has no duration review rows.

Iteration 10 replaces the `cuotas` fallback with the canonical quota consistency panel. It restores the `mon-territorial-quota-*` visual language, search/filter controls, replacement toggle, block cards, sex/age marginal meters, and observed sex-by-age matrix. The audit fixture contained quota blocks and the visual QA passed, so `cuotas` is closed for this parity matrix.

Iteration 11 replaces the `anulacion` fallback with the extracted production-annulment workspace. It restores the canonical no-responsibles empty state and wires preview/apply/revert against the existing annulment APIs, but remains `unverified` because the audit fixture has no responsible production to exercise the control, impact table, or history list.

Iteration 12 repairs one exact behavior gap in `reconciliacion`: focusing or staging a spatial candidate now opens the map with the candidate response selected. The UI remains unclosed because the audit fixture does not provide spatial candidates to verify the full map-focus state.

Iteration 13 replaces the simplified `ter-*` consultas body with a canonical review-cases workbench. It restores the original table/filter visual language and the GPS/duration deep links into validation, but remains `unverified`/`mismatch` because the audit fixture exposes 0 review rows and the original UMP audit drawer is still trapped in the monolith.

Iteration 14 extracts the operational-adjustment workspace for `consultas/subsanaciones`. The target now has the canonical package picker, note, apply/revert/reset controls, metrics, empty state, and applied-history surface wired to the existing APIs. It is marked `unverified`, not `done`, because the audit project only exposes the empty operational matrix and does not exercise suggestions, applied packages, or mutation round trips.

Iteration 15 replaces the simplified `AdvanceView` body for `resumen`, `ump`, and `ritmo` with `TerritorialAdvanceWorkbench`. The target now has the historical datebar, executive dashboard, district cards, demographic/cut panels, UMP filter/table/detail, and daily rhythm chart language.

Iteration 16 adds the first real `avance/ump` map repair: the target now has a desktop-scale territorial map, route cartography cache reuse, 206 block paths, 150 navigable manzanas, selection focus, pan/zoom/reset controls, and a selected UMP navigator.

Iteration 17 repairs the GPS/manzana behavior inside `avance/ump`: the target loads the GPS layer lazily when `advance_summary` lacks embedded points, filters rendered GPS to the selected manzana/UMP, keeps point sizes stable across zoom, exposes the selected UMP response list, and lets a point click select/focus the response. It still cannot close as full parity because the original map retains richer context/inspection behavior and the measured ACNURCG cold path remains too slow: 82.7 s to Avance text and 122.9 s to Avance content in the latest manual run.

Iteration 18 removes one class of duplicated state requests: repeated resolved `warmupCache` calls now use the client cache, and the modular territorial page no longer launches the per-view scope request while the initial scope is still in flight. This improves request hygiene but does not close performance parity because the cold `advance_summary` build is still the dominant delay.

Iteration 19 changes the first-render contract for `avance/ump`: Mapa y UMP no longer waits for cold `advance_summary` and can render from `route_summary` plus the lazy GPS layer. The measured ACNURCG path avoided `advance_summary` entirely and still reached the real desktop map. This improves perceived performance but does not close parity because `route_summary` itself is still heavy, the first map frame remains progressive, and the historical map inspector/context behavior is still richer than the target.

Iteration 20 restores the canonical territorial loading state inside the modular page and separates active loading from background prefetch. This improves perceived performance during slow scope hydration and protects the miniapp from looking blocked by a background cache fill. It does not close performance parity because the measured `route_summary` cache-hit request still takes about 4.8-4.9 s on ACNURCG.

Iteration 22 repairs the territorial report-cache contract for the `route_summary` path: the lightweight route and advance scopes no longer serialize Kobo schema field and choice lists, and the report cache schema is bumped to `v21` to invalidate old payloads. The direct JSON verification proves the contract, but performance parity remains open because the cold ACNURCG `route_summary` rebuild still takes about 10 s backend / 14 s total and the payload is still dominated by route/cartography data rather than source metadata.

Iteration 25 reduces the current `route_summary` payload again by removing duplicate map/progress branches and source-console-only reconciliation details from the route/advance scopes. The measured ACNURCG route envelope dropped from v21 `size_download=1845831` to v23 `size_download=1129963` while preserving the desktop UMP/GPS map. The final multi-viewport desktop QA passed at 1280, 1440, 1600, and 1920 px widths, and `build:fast` passed. This improves warm/cache behavior, but it still does not close performance parity because cold rebuild time remains dominated by backend computation rather than serialized bytes.

Iteration 21 replaces the simplified Ocurrencias target with a data-backed occurrence workbench. It restores the visible states/UMP/observations surfaces and occurrence command actions, and the ACNURCG visual QA is clean after the UMP row sizing repair. It does not close occurrence parity because source/config selection, upload-Kobo, full log/config surface, and mutating round-trip QA remain pending.

Iteration 23 adds the compact Kobo selector/config surface inside Ocurrencias. It restores the visible asset-selection entry point and config persistence path, but it does not close occurrence parity because upload-Kobo and actual config mutation round-trip QA remain pending.

Iteration 24 expands `ocurrencias/Por UMP` filters to match the canonical operational filter shape more closely. It improves behavior parity for UMP triage, but detail depth and mutating actions remain open.

Iteration 26 restores the remaining visible Ocurrencias command surface for upload/config/log state without executing the external mutation in the real audit project. `Content/actions ocurrencias` moves from mismatch to unverified: the handler is wired and visually present, but the Kobo import/deploy round trip still needs a safe tokened fixture or explicit user confirmation.

Iteration 27 closes one bounded `avance/ump` inspector delta: the modular UMP map now shows a canonical-style `mon-territorial-inspector-card` for selected manzanas and GPS points. The direct GPS click probe captured 9 GPS nodes, 1 selected point, 1 selected response, zoom `4.2x`, and an inspector with Kobo date, coordinates, distance, GPS state, source, nearest block, and no page/API errors. This does not move the tab to done because full original map context layers and acceptable cold performance remain open.

Iteration 28 closes the global loading/error state row. The modular page now uses `TerritorialViewError` with the shared `Alert` chrome, visible retry action, and request guards that stop active/background report hydration after a failed report scope until the user retries. The forced-error probe no longer loops requests in the background, but this does not close phase/cache coherence or any section-specific parity gaps.

Iteration 29 improves the remaining global phase/cache status row. The modular rail no longer uses hard-coded pilot/field hints or a generic cache fallback: it shows live source/coherence badges, active source name, local/snapshot rows, update timestamp, and report-cache status. It remains `unverified` rather than `done` because the original `TerritorialBootPanel` readiness sequence and the full authoritative phase-state behavior are still not extracted.

Iteration 30 improves `ocurrencias/Observaciones`: the tab no longer stops at count cards and a short history excerpt. It now shows reviewable alert rows with local search/filter controls, covers missing UMP, observations, outside-route, and high no-effectivity rows, and keeps a fuller history list in the side rail. It remains `unverified` because the filter interaction and the external Kobo mutation/config round trip still need a safe tokened fixture or explicit confirmation.

Iteration 31 closes the local `ocurrencias/Observaciones` tab after direct interaction evidence. The alert filter and search controls now have a browser proof against ACNURCG real data: `Todos` shows 80 of 148 capped rows, `Sin reporte` shows 68 rows, `0390` narrows to 2 matching rows, and the impossible query renders the empty state. This does not close the separate occurrence action surface because external Kobo upload/config mutation still needs a safe tokened fixture or explicit user confirmation.

Iteration 32 closes the local `ocurrencias/Por UMP` tab after direct detail evidence. The target now exposes the canonical UMP triage depth: complete/incomplete/started missing counters, row messages that distinguish missing-with-advance and unreconciled UMPs, selected drawer placement, advance-without-occurrence notices, attention reasons, source-row facts, and source-record rows. Manual QA against ACNURCG verifies both complete-missing and non-effective detail states without overflow or page/console errors. This still does not close the separate occurrence action surface because external Kobo upload/config mutation needs a safe tokened fixture or explicit user confirmation.

Iteration 33 closes the local `ocurrencias/Estados general` tab after code alignment and direct chart/matrix evidence. The target no longer uses the older composition card; it now matches the canonical `is-state` intent card, state meter, state stats, outcome bars, daily rhythm, and district matrix with `Validas sin ocurrencias` context. Manual QA against ACNURCG verifies the full rendered state surface with no legacy blocks, no overflow, and no page/console errors. Ocurrencias now has its three local tabs closed; only the separate external action surface remains unverified.

Iteration 34 repairs a user-reported visual parity regression in `fuentes/Formulario`. The target already owned the right handlers, but the rendered first screen had drifted away from the original source console: it emphasized a generic asset/source block instead of the operational form workflow. The tab now opens on the same analyst shape as the canonical view: phase selection, Hojas de Ruta source state, selected Kobo form, readiness metrics, and explicit inspect/sync actions, while the asset catalog appears only when changing the form.

Iteration 35 closes `avance/Ritmo diario` after backend and UI alignment. The target no longer shows a simplified or empty rhythm view: it uses canonical `reports.daily` semantics, renders the daily Plotly chart and table with ACNURCG's 13 daily rows, and the scoped `advance_summary` v24 keeps the original audit counts without exposing `response_audit` or GPS/map point payloads. Performance remains a separate debt because the cold canonical audit is still slow.

Iteration 36 reduces the user-reported visual gap in `avance/Mapa y UMP`. The target keeps the route-first first render and lazy GPS layer, but now loads rich cartography only for the selected district and renders streets, context features, route zones, neighbor blocks, canonical GPS state classes, and an always-visible map legend. This is still not a `done` close because the original historical map engine has deeper hierarchical controls and cold `route_summary` performance is still above target.

Iteration 37 reduces the user-reported visual gap in `calidad/Geolocalización`. The target now opens the validation map around the selected UMP, limits visible GPS to the selected UMP when possible, exposes the GPS-state legend inside the map, supports drag/trackpad pan, and zooms directly to a selected GPS point from the case list. This is still not a `done` close because the exact historical map engine includes richer context/street/neighbor layers and virtualized case behavior that are not yet reproduced in the territorial profile.

Iteration 38 further reduces the user-reported visual gap in `calidad/Geolocalización`. The map now shows neighboring manzana texture around the selected UMP, the active district cartography loads before unrelated districts, and the sidebar restores the original hierarchy where selecting a UMP/manzana card focuses the manzana while GPS points remain nested until the accordion is opened. This is still not a `done` close because exact historical street/context layers and virtualized case behavior are still not fully reproduced.

Iteration 39 closes the point-accordion click proof for `calidad/Geolocalización`. The QA helper can now wait for a report-driven intermediate control, and ACNURCG browser evidence proves that opening the nested GPS list and clicking `Punto 1` focuses the map point while keeping the manzana/UMP hierarchy visible in the sidebar. This still does not make the tab `done`: exact historical street/context layers and virtualized case behavior remain open.

Iteration 40 closes the visible street/context layer gap for `calidad/Geolocalización`. The validation map now shares the rich selected-district Hoja de Ruta cartography path already proven in `avance/ump`, without broadening the report scope or touching backend state. This still does not make the tab `done`: original virtualized case behavior and richer case-detail summaries remain open.

Iteration 41 closes the visible sidebar hierarchy gap for `calidad/Geolocalización`. The validation case list now behaves like the original accordion shape: selecting the UMP/manzana card focuses the map block without opening points, opening the accordion shows GPS points as children of the selected UMP, clicking a point focuses the GPS marker, and the group list is virtualized. The tab is still not `done`: exact original district section grouping and richer per-case detail summaries are still not fully extracted.

Iteration 42 closes the visible district-section heading gap for `calidad/Geolocalización`. The validation case list now shows canonical-style district headings over the virtualized UMP groups, including section counts, and preserves the UMP accordion plus point focus behavior. The tab is still not `done`: richer per-case summaries and exact handling of mixed GPS/no-GPS grouping remain incomplete.

Iteration 43 corrects the visible GPS containment semantics for `calidad/Geolocalización`. After rechecking the original monolith and publication helper, the sidebar now communicates same-zone/same-district status (`En zona UMP`, `Fuera zona`, `Fuera distrito`) instead of implying that the main criterion is being inside the selected manzana polygon. The UMP card still focuses the UMP without opening points, and point clicks still focus GPS markers.

Iteration 44 restores the richer original per-case point row summaries inside that same accordion: GPS-only point numbering, date/hour, demographic, responsible, district, UMP, GPS source/reclassification/precision trace, and fallback preservation of GPS audit fields.

Iteration 45 restores the original case-first section split for mixed UMP groups: no-GPS rows can move to `Sin punto geográfico` while GPS rows stay in their territorial route section, and expansion is now scoped to the section item instead of the base UMP only. The tab is still not `done`: broader validation/reconciliation parity and data-rich fixture coverage remain incomplete.

Iteration 46 reduces a structural chrome divergence shared by the monolith and the modular profiles. The workbench header (`mon-workbench-head`, icon, eyebrow/title/detail copy and KPI pills) now comes from `MonitoreoWorkbenchHead` and is reused by `MonitoreoPage.tsx`, `TerritorialMonitoreoPage.tsx`, and `AcreditacionMonitoreoPage.tsx`. This does not close any section body parity gap, but it makes the visible workbench header a shared component instead of three hand-maintained copies. Territorial QA against ACNURCG waited for `.mon-workbench-head` and passed with no overflow, page, API, or resource issues.

Iteration 47 explicitly separates hydrated readiness from visual parity. The ordered comparator now captures every declared Territorial section/tab against the canonical `MonitoreoPage.tsx` original, waits past loading text in both iframes, and saves per-tab PNG evidence. The full ACNURCG run reached 24/24 ready, but the PNGs still showed major parity mismatches, proving that selector hydration is not enough to mark a tab done.

Iteration 48 repairs the first high-impact mismatch from that ordered visual pass: `Avance > Mapa y UMP`. The modular tab now opens with the canonical `Zonas con cierre` map before the UMP detail, restores the same UMP filter row (`Distrito`, `Estado`, `Cuota`, `Zona`, `Responsable`), uses `advance_summary` instead of `route_summary` for Avance, excludes `ocurrencias_campo` from the active source count, and derives the header KPI from `reports.advance` when present. Final side-by-side evidence shows 2/2 active sources, 1,215 validas, 1,200 meta, 124 zonas and 125 UMP completas on both canonical and modular panes.

Iteration 49 repairs the first ordered `Fuente` mismatch: `Fuente > Formulario`. The modular header now uses source-scope effective counts (`1,305 efectivas`) and normalizes missing meta as `S/D meta`; the broken first-viewport readiness pipeline is no longer rendered above the form tab; and the first screen now follows the canonical sequence of active form command, phase cards, route-sheet source, selected Kobo form, source KPIs, and inspect/sync actions. Evidence: `tmp/visual-qa/territorial-parity-fuente-formulario-after-meta-20260628/01-fuente-formulario.png`.

Iteration 50 repairs the next ordered `Fuente` mismatch: `Fuente > Filtro y distritos`. The modular tab now uses the canonical local-response count (`1,598 recibidas`) for the source command, restores the green phase/source status strip between command and configuration, renders the full-width operative configuration card with phase-prefixed form title, exposes the same actions (`Usar sugerencias`, `Descartar cambios`, `Guardar configuracion`) without overlap, and keeps both lower panels (`Variables territoriales` and `Encuesta efectiva`) visible in the first desktop comparison viewport. Evidence: `tmp/visual-qa/territorial-parity-fuente-filtro-final-2-20260628/02-fuente-filtro-y-distritos.png`.

Iteration 51 repairs the next ordered `Fuente` mismatch: `Fuente > Encuestadores`. The modular tab now uses the canonical enumerator roster structure instead of the simplified file-summary cards: phase status strip, left-side code roster command, active code-format toggle, template/code/download/upload actions, and right-side searchable assignment table with response counts and recognized/reconciled badges. Evidence: `tmp/visual-qa/territorial-parity-fuente-encuestadores-after-roster-panel-20260628/03-fuente-encuestadores.png`.

Iteration 52 reduces the next ordered `Fuente` mismatch: `Fuente > Reconciliacion`. The modular tab no longer stops at the simplified batch/route-sheet cards; it now renders the same first-screen hierarchy as the canonical original: phase status strip, reconciliation batch bar, Codigo Pulso review panel, and UMP exacta review panel with populated metrics and hydrated rows from ACNURCG. Evidence: `tmp/visual-qa/territorial-parity-fuente-reconciliacion-after-panels-20260628/04-fuente-reconciliacion.png`. It remains partial because row-level canonical actions (`Copiar/Revisar`, `Agregar respuesta`, `Agregar valor`) are not yet fully wired in the modular panel.

Iteration 53 verifies the last ordered `Fuente` local tab: `Fuente > Historial`. The hydrated modular tab matches the canonical history first viewport: phase status strip, 34-event count, synchronization rows, source/form labels, timestamps, response counts, and OK status badges. Evidence: `tmp/visual-qa/territorial-parity-fuente-historial-current-20260628/05-fuente-historial.png`.

Iteration 54 starts the ordered `UMPs` review with `UMPs > Cobertura`. The modular tab hydrates the real coverage map, route counts, source counts, and district/rail context, but the first visual pass exposed a non-canonical Hoja de Ruta strip above the atlas. That strip was removed from the modular body so the first viewport now opens directly on coverage plus map, matching the original hierarchy more closely. Evidence: `tmp/visual-qa/territorial-parity-umps-cobertura-after-strip-20260628/06-umps-cobertura.png`. It remains partial because metric-card density and exact atlas proportions still differ from the canonical original.

Iteration 55 rechecks the next ordered `UMPs` tab, `UMPs > Manzanas`, against the canonical original using a session-seeded comparator. Earlier selector/DOM readiness was misleading: `tmp/visual-qa/territorial-parity-umps-manzanas-current-20260628/07-umps-manzanas.png` and `tmp/visual-qa/territorial-parity-umps-manzanas-after-button-protect-20260628/07-umps-manzanas.png` showed a striped empty table even though the modular frame contained 150 UMP rows. A no-session rerun under `tmp/visual-qa/territorial-parity-umps-manzanas-after-flex-20260628/report.json` timed out before project/profile hydration and is recorded as a project-loading/session failure, not a valid tab verdict. The final run uses `--session 7a1296ff-1325-4bca-87a7-64cc6daaef6b`; both canonical and modular frames show 150 titulares, 150 reemplazos, UMP 1 expanded, and UMP 2-5 visible in the first viewport. Evidence: `tmp/visual-qa/territorial-parity-umps-manzanas-session-height-20260628/07-umps-manzanas.png`; report: `tmp/visual-qa/territorial-parity-umps-manzanas-session-height-20260628/report.json`.

Iteration 56 reviews the next ordered `Validación` tab, `Validación > Geolocalización`, against the original. The first run proved the old comparator was too permissive because the canonical frame still displayed `Cargando cartografía de Hojas de Ruta`; the loader guards now catch that. After warming the existing ACNURCG session, the final valid run shows both frames hydrated with real GPS data, KPI strips and case cards, and no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-validacion-geolocalizacion-loading-guard-20260628/08-validacion-geolocalizacion.png`; report: `tmp/visual-qa/territorial-parity-validacion-geolocalizacion-loading-guard-20260628/report.json` (`wait_ms=216689`). This is not a visual pass: the modular map still differs from the canonical map in active-zone scale, street/context emphasis, and selected geometry rendering.

Iteration 57 reviews the next ordered `Validación` tab, `Validación > Reconciliación UMP`, against the original. Both frames hydrate the candidate-rich queue: 5 spatial suspicions, 4 patterns, pattern cards, candidate cards, map action buttons, and no loader/error text. Evidence: `tmp/visual-qa/territorial-parity-validacion-reconciliacion-current-20260628/09-validacion-reconciliacion-ump.png`; report: `tmp/visual-qa/territorial-parity-validacion-reconciliacion-current-20260628/report.json` (`wait_ms=216929`). Mutating actions (`Poner patrón en cola`, `Descartar`, final apply) were not clicked on the real ACNURCG project, so the row stays partial rather than done.

Iteration 58 reviews the next ordered `Validación` tab, `Validación > Duración de tiempo`, against the original. The first attempt on the old 8791 stack timed out because the modular frame fell back to `source` and then the backend stopped responding to health while rebuilding `validation_summary`; that is recorded as backend/tab hydration blockage, not visual failure. A fresh 8792/5177 stack reopened ACNURCG with session `4e67e63a-149d-492f-94d9-05c93205845f`; direct `validation_summary` prefetch took 11.815s, and the comparator then hydrated both frames in `wait_ms=56409`. Evidence: `tmp/visual-qa/territorial-parity-validacion-duracion-8792-20260628/10-validacion-duracion-de-tiempo.png`; report: `tmp/visual-qa/territorial-parity-validacion-duracion-8792-20260628/report.json`. The first viewport matches the canonical histogram/rhythm data; map handoff behavior remains unclicked.

Iteration 59 revalidates the next ordered `Validación` tab, `Validación > Cuotas`, against the original on the clean 8792/5177 stack. Both frames hydrate the 300-manzana quota workbench with the replacement toggle, status filters, UMP cards, sex/age quota bars, and observed-fill tables. Evidence: `tmp/visual-qa/territorial-parity-validacion-cuotas-8792-20260628/11-validacion-cuotas.png`; report: `tmp/visual-qa/territorial-parity-validacion-cuotas-8792-20260628/report.json` (`wait_ms=45851`).

Iteration 60 reviews the final ordered `Validación` tab, `Validación > Anulación`, against the original on the clean 8792/5177 stack. Both frames hydrate the audited-annulment surface with 1 active tacha, 311 excluded responses, 13 affected UMPs, selected responsible, preview panel, action buttons, and history row. Evidence: `tmp/visual-qa/territorial-parity-validacion-anulacion-8792-20260628/12-validacion-anulacion.png`; report: `tmp/visual-qa/territorial-parity-validacion-anulacion-8792-20260628/report.json` (`wait_ms=44237`). Mutating preview/apply/revert actions were not clicked on the real project, so behavior remains partial.

Iteration 61 starts the ordered `Consultas` review with `Consultas > Registro` on the clean 8792/5177 stack and ACNURCG session `4e67e63a-149d-492f-94d9-05c93205845f`. The first valid screenshot showed real hydrated tables but exposed two modular mismatches: same-day rows were not ordered by submission time, and consultation counters treated `GPS`, `Duración` and `Cruce responsable` as mutually exclusive categories. The modular workbench now uses the same full submission timestamp sort as the canonical record table and independent review flags for GPS/duration/responsible metrics. Final evidence: `tmp/visual-qa/territorial-parity-consultas-registro-flags-8792-20260628/13-consultas-registro.png`; report: `tmp/visual-qa/territorial-parity-consultas-registro-flags-8792-20260628/report.json` (`wait_ms=37388`). The first viewport now matches the canonical metrics (`0`, `194`, `54`, `14`) and row order (`9:13pm`, `8:18pm`, `7:07pm`, `6:18pm`, `5:27pm`). `Tiempo`/`GPS` row handoffs were not clicked, so behavior remains partial.

Iteration 62 reviews the next ordered `Consultas` tab, `Consultas > GPS por revisar`, on the same clean stack and session. Both frames hydrate the GPS-filtered table with 194 visible rows, the same top counters, the same first response order, and no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-consultas-gps-8792-20260628/14-consultas-gps-por-revisar.png`; report: `tmp/visual-qa/territorial-parity-consultas-gps-8792-20260628/report.json` (`wait_ms=39326`). The non-mutating row handoff to the geolocation validation tab was not clicked in this pass, so behavior remains partial.

Iteration 63 reviews the next ordered `Consultas` tab, `Consultas > Duración por revisar`, on the same clean stack and session. Both frames hydrate the duration-filtered table with 54 visible rows, matching first rows, and matching table summary (`0 sin observación · 54 por revisar · 15 GPS · 54 duración`). Evidence: `tmp/visual-qa/territorial-parity-consultas-duracion-8792-20260628/15-consultas-duracion-por-revisar.png`; report: `tmp/visual-qa/territorial-parity-consultas-duracion-8792-20260628/report.json` (`wait_ms=38283`). The non-mutating row handoff to duration validation was not clicked in this pass, so behavior remains partial.

Iteration 64 reviews the next ordered `Consultas` tab, `Consultas > Cruce responsable`. The first pass hydrated both frames but exposed a real visual mismatch: the modular table had the right 14-row count but sorted `internal_queries.review_cases` by district/UMP because those rows come from `queries_summary` with `row_index: "NA"` and no timestamp. The modular fallback now uses the review-case package index for row number and descending sort. Final evidence: `tmp/visual-qa/territorial-parity-consultas-responsable-order-8792-20260628/16-consultas-cruce-responsable.png`; report: `tmp/visual-qa/territorial-parity-consultas-responsable-order-8792-20260628/report.json` (`wait_ms=37262`). Both frames now open with UMP 149, 143, 139, 131 and 129, with rows `fila 247` through `fila 243`, and no loaders/errors.

Iteration 65 reviews the final ordered `Consultas` tab, `Consultas > Subsanaciones`, on the same clean stack and session. Both frames hydrate the operational remediation workbench with 50 compatible gaps, 69 available surplus cases, 24 cases to close UMPs, 0 complete packages, suggestion cards, and the operational review inspector. Evidence: `tmp/visual-qa/territorial-parity-consultas-subsanaciones-8792-20260628/17-consultas-subsanaciones.png`; report: `tmp/visual-qa/territorial-parity-consultas-subsanaciones-8792-20260628/report.json` (`wait_ms=37214`). Mutating actions such as reset/apply/revert were not clicked on the real project, so behavior remains partial.

Iteration 66 starts the ordered `Avance` review with `Avance > Resumen`. The comparator proves hydration, not visual parity: both frames show real territorial advance data, district cards, UMP status, and no loaders/errors, but the modular first viewport still diverges from the canonical original. The modular frame adds a large advance-objective card before the canonical executive view, uses initials/circular district placeholders instead of the canonical mini district geometry, and changes the density/order of the district board. Evidence: `tmp/visual-qa/territorial-parity-avance-resumen-8792-20260628/18-avance-resumen.png`; report: `tmp/visual-qa/territorial-parity-avance-resumen-8792-20260628/report.json` (`wait_ms=87457`). Status remains mismatch.

Iteration 67 reviews `Avance > Mapa y UMP` again on the clean stack. Both frames hydrate the canonical overview map with 124 zonas and 125 complete UMPs, district outlines, legend chips, and the same filter row, with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-avance-mapa-ump-8792-20260628/19-avance-mapa-y-ump.png`; report: `tmp/visual-qa/territorial-parity-avance-mapa-ump-8792-20260628/report.json` (`wait_ms=38813`). The first viewport is visually aligned, but the lower UMP-detail interactions remain outside the captured/unclicked evidence, so the row stays partial.

Iteration 68 reviews `Avance > Ritmo diario` on the clean stack. Both frames hydrate the valid daily rhythm chart, accumulated line, side metrics, and daily table with matching values and no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-avance-ritmo-8792-20260628/20-avance-ritmo-diario.png`; report: `tmp/visual-qa/territorial-parity-avance-ritmo-8792-20260628/report.json` (`wait_ms=32237`). Minor visual difference retained: the modular x-axis uses full month labels (`Junio`) where the original abbreviates (`jun`), but data/chart/table hydration is verified.

Iteration 69 reviews `Avance > Salidas`. Both frames hydrate the PDF/Sheets outputs state with the same 1,594 records, client pending state, internal published state, destination field and publish controls, with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-avance-salidas-8792-20260628/21-avance-salidas.png`; report: `tmp/visual-qa/territorial-parity-avance-salidas-8792-20260628/report.json` (`wait_ms=32224`). This is not a visual pass: the modular frame changes the PDF action treatment to a prominent filled magenta button and changes card proportions/framing compared with the canonical original.

Iteration 70 starts the ordered `Ocurrencias` review with `Ocurrencias > Estados general`. Both frames hydrate real occurrence data, state totals, non-effective reasons, daily rhythm, and district summary with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-estados-8792-20260628/22-ocurrencias-estados-general.png`; report: `tmp/visual-qa/territorial-parity-ocurrencias-estados-8792-20260628/report.json` (`wait_ms=38257`). This is not a visual pass: the modular frame adds synchronization/XLSForm status cards and a `Subir Kobo` action into the first viewport, shifting the canonical state/reason/rhythm composition down.

Iteration 71 reviews `Ocurrencias > Por UMP`. Both frames hydrate the UMP coverage metrics, filters, territorial coverage list, and first visible UMP cards with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-ump-8792-20260628/23-ocurrencias-por-ump.png`; report: `tmp/visual-qa/territorial-parity-ocurrencias-ump-8792-20260628/report.json` (`wait_ms=38264`). This is not a visual pass for the same reason as `Estados general`: modular synchronization/XLSForm status cards are inserted before the UMP coverage workbench, shifting the canonical first viewport.

Iteration 72 reviews the final declared Territorial tab, `Ocurrencias > Observaciones`. Both frames hydrate occurrence data with no loaders/errors, but this is a clear mismatch: the canonical original shows the compact three-panel summary (`Tipos de ocurrencia`, `Cobertura`, `Historial`), while the modular frame opens an alert-review board plus occurrence types and keeps the synchronization/XLSForm cards above it. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-observaciones-8792-20260628/24-ocurrencias-observaciones.png`; report: `tmp/visual-qa/territorial-parity-ocurrencias-observaciones-8792-20260628/report.json` (`wait_ms=38255`). Status remains mismatch.

Recommended next loop: continue across the full 1 Fuente -> 6 Ocurrencias objective by expanding data-rich fixture coverage for `consultas`/`calidad` or closing spatial reconciliation parity; then return to the remaining `avance/ump` exact map-engine and cold/warm performance deltas. Ocurrencias still needs a safe Kobo mutation round-trip before its action surface can move to done.

## Matrix

| Area | Section | Tab/Subtab | Expected behavior/state/action | Original source | Exists in target | Same hierarchy/order | Same visual language | Same behavior/action | Status | Iteration | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome | global | module chrome | Route `/monitoreo` keeps the Monitoreo module chrome with territorial selected. | `MonitoreoPage.tsx` render + `MonitoreoModuleChrome` | Yes | Yes | Yes | Yes | done | 0 | Target renders `MonitoreoModuleChrome` with `TERRITORIAL_ROUTE`. |
| Chrome | global | workbench chrome | Workbench uses canonical `mon-workbench`, split view, rail, head, and content wrappers. | `MonitoreoPage.tsx` workbench wrapper | Yes | Yes | Yes | Yes | done | 46 | Target renders `MonitoreoWorkbenchChrome isTerritorial`; `mon-workbench-head` now comes from shared `MonitoreoWorkbenchHead` in both monolith and modular profiles. QA: `tmp/visual-qa/monitoreo-head-territorial-ready-20260628/report.json`. |
| Navigation | fuentes | primary section | Primary "Fuente" section appears before modelo and activates the fuentes workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Navigation | modelo | primary section | Primary "UMPs" section appears after fuentes and activates the modelo workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Navigation | calidad | primary section | Primary "Validacion" section appears after modelo and activates the calidad workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Navigation | consultas | primary section | Primary "Consultas internas" section appears after calidad and activates the consultas workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Navigation | avance | primary section | Primary "Avance territorial" section appears after consultas and activates the avance workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Navigation | ocurrencias | primary section | Primary "Ocurrencias de campo" section appears last and activates the ocurrencias workbench. | `TERRITORIAL_WORKBENCH_VIEWS` | Yes | Yes | Yes | Yes | done | 0 | Target uses `TERRITORIAL_WORKBENCH_VIEWS`. |
| Local tabs | fuentes | form | Formulario shows Kobo/cutoff source controls and state. | `localTabsForWorkbenchView(...).fuentes`; `TerritorialSourceConsole` | Yes | Yes | Yes | Yes | done | 49 | `TerritorialSourceConsole` form tab now opens on the canonical active-form workbench: source-scope effective KPI, phase cards, route-sheet source controls, selected form summary, readiness metrics, and inspect/sync actions. Asset catalog remains available behind `Cambiar formulario`; final comparator evidence `tmp/visual-qa/territorial-parity-fuente-formulario-after-meta-20260628/01-fuente-formulario.png` shows the first viewport aligned against the original. |
| Local tabs | fuentes | filter | Filtro y distritos exposes effective-response filters and district scope. | `localTabsForWorkbenchView(...).fuentes`; `TerritorialSourceConsole` | Yes | Yes | Yes | Yes | done | 50 | Ordered visual parity evidence now verifies the hydrated first viewport against the canonical original: command counts, phase status strip, configuration card, actions, variables panel, and effective-survey panel. Evidence: `tmp/visual-qa/territorial-parity-fuente-filtro-final-2-20260628/02-fuente-filtro-y-distritos.png`. |
| Local tabs | fuentes | roster | Encuestadores exposes Pulso code roster behavior. | `localTabsForWorkbenchView(...).fuentes`; source roster blocks | Yes | Yes | Yes | Yes | done | 51 | Ordered visual parity evidence now verifies the hydrated roster first viewport against the canonical original: phase status strip, code roster command, code-format toggle, file/template/code actions, search field, assignment table, and recognized/reconciled badges. Evidence: `tmp/visual-qa/territorial-parity-fuente-encuestadores-after-roster-panel-20260628/03-fuente-encuestadores.png`. |
| Local tabs | fuentes | reconciliation | Reconciliacion exposes code and UMP reconciliation behavior. | `localTabsForWorkbenchView(...).fuentes`; reconciliation handlers | Yes | Yes | Partial | Partial | partial | 52 | Ordered visual parity evidence now verifies the hydrated first-screen hierarchy against the canonical original: batch bar, Codigo Pulso review panel, UMP exacta review panel, populated metrics, and review rows. Evidence: `tmp/visual-qa/territorial-parity-fuente-reconciliacion-after-panels-20260628/04-fuente-reconciliacion.png`. Still partial because row-level canonical actions are not yet fully wired. |
| Local tabs | fuentes | history | Historial shows source/cut event history. | `localTabsForWorkbenchView(...).fuentes`; source history blocks | Yes | Yes | Yes | Yes | done | 53 | Ordered visual parity evidence verifies the hydrated first viewport against the canonical original: phase status strip, event count, synchronization rows, source labels, timestamps, response counts, and OK badges. Evidence: `tmp/visual-qa/territorial-parity-fuente-historial-current-20260628/05-fuente-historial.png`. |
| Local tabs | modelo | resumen | Cobertura shows route, UMP, and responsible coverage summary. | `localTabsForWorkbenchView(...).modelo`; `TerritorialRouteView` | Yes | Yes | Partial | Partial | partial | 54 | Ordered visual parity evidence verifies that map, source counts, route counts, and coverage panels hydrate against ACNURCG. The non-canonical Hoja de Ruta strip was removed from the first viewport. Evidence: `tmp/visual-qa/territorial-parity-umps-cobertura-after-strip-20260628/06-umps-cobertura.png`. Still partial because metric-card density and exact atlas proportions differ from the canonical original. |
| Local tabs | modelo | tabla | Manzanas shows ordered titular/replacement block table behavior. | `localTabsForWorkbenchView(...).modelo`; route table blocks | Yes | Yes | Yes | Yes | done | 55 | Ordered canonical comparator now verifies the hydrated table visually against the original after the false-ready blank-row failure: both panes show 150 titulares, 150 reemplazos, UMP 1 expanded, replacement row, and UMP 2-5 visible. Evidence: `tmp/visual-qa/territorial-parity-umps-manzanas-session-height-20260628/07-umps-manzanas.png`; report `tmp/visual-qa/territorial-parity-umps-manzanas-session-height-20260628/report.json` (`wait_ms=83815`, no loaders/errors). |
| Local tabs | calidad | geolocalizacion | GPS/cartography validation behavior. | `localTabsForWorkbenchView(...).calidad`; `TerritorialValidationView` / `TerritorialValidationGeoWorkbench` | Yes | Yes | Partial | Partial | mismatch | 56 | Ordered visual parity now proves the tab can hydrate in both frames with real ACNURCG data and no loader text: map, GPS points, KPI strip, and UMP case cards are visible. The modular camera now starts at canonical `3.4x`, selected UMP projections no longer include the full district bounds, selected GPS clusters can drive initial focus, and street loading no longer blocks once street/context layers are already visible. Still not a visual pass: active-zone scale, street/context emphasis, and selected geometry rendering differ from the canonical original. Evidence: `tmp/visual-qa/territorial-parity-validacion-geolocalizacion-loading-guard-20260628/08-validacion-geolocalizacion.png`; report `tmp/visual-qa/territorial-parity-validacion-geolocalizacion-loading-guard-20260628/report.json` (`wait_ms=216689`, no page/console errors). Prior proofs remain: point accordion, rich context, virtual containment, section headings, zone criterion, rich rows, and mixed GPS split. |
| Local tabs | calidad | reconciliacion | UMP spatial suspicion reconciliation behavior. | `localTabsForWorkbenchView(...).calidad`; validation reconciliation blocks | Yes | Yes | Yes | Partial | partial | 57 | Ordered visual parity now verifies the candidate-rich first viewport against ACNURCG: 5 spatial suspicions, 4 patterns, pattern cards, candidate cards, map buttons, and queue/dismiss controls render in the same hierarchy as the canonical original with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-validacion-reconciliacion-current-20260628/09-validacion-reconciliacion-ump.png`; report `tmp/visual-qa/territorial-parity-validacion-reconciliacion-current-20260628/report.json` (`wait_ms=216929`). Mutating queue/dismiss/apply actions were not clicked on the real project, so behavior remains partial rather than done. |
| Local tabs | calidad | duracion | Duration outlier review behavior. | `localTabsForWorkbenchView(...).calidad`; duration validation blocks | Yes | Yes | Yes | Partial | partial | 58 | Ordered visual parity now verifies the data-rich first viewport against ACNURCG: 1,215 timed interviews, 54 for review, median 14 min, P95 6h18, duration histogram, threshold markers, out-of-scale note, and valid-response rhythm rail render against the canonical original with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-validacion-duracion-8792-20260628/10-validacion-duracion-de-tiempo.png`; report `tmp/visual-qa/territorial-parity-validacion-duracion-8792-20260628/report.json` (`wait_ms=56409`). Selected-response map handoff remains unclicked, so behavior stays partial rather than done. |
| Local tabs | calidad | cuotas | Quota margin and gap validation behavior. | `localTabsForWorkbenchView(...).calidad`; quota validation blocks | Yes | Yes | Yes | Yes | done | 59 | Ordered visual parity revalidates the data-rich quota workbench on ACNURCG: 300 evaluated manzanas, replacement toggle, status filters, UMP/replacement cards, sex/age quota bars, and observed-fill tables match the canonical original with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-validacion-cuotas-8792-20260628/11-validacion-cuotas.png`; report `tmp/visual-qa/territorial-parity-validacion-cuotas-8792-20260628/report.json` (`wait_ms=45851`). |
| Local tabs | calidad | anulacion | Audited annulment/tacha behavior. | `localTabsForWorkbenchView(...).calidad`; annulment handlers | Yes | Yes | Yes | Partial | partial | 60 | Ordered visual parity now verifies the data-rich audited-annulment surface on ACNURCG: form, 1 active tacha, 311 excluded responses, 13 affected UMPs, selected responsible, preview panel, action buttons, and history row match the canonical original with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-validacion-anulacion-8792-20260628/12-validacion-anulacion.png`; report `tmp/visual-qa/territorial-parity-validacion-anulacion-8792-20260628/report.json` (`wait_ms=44237`). Preview/apply/revert actions remain unclicked on the real project, so behavior stays partial rather than done. |
| Local tabs | consultas | registro | Main internal query table behavior. | `localTabsForWorkbenchView(...).consultas`; `TerritorialQueriesView` | Yes | Yes | Yes | Partial | partial | 61 | Ordered visual parity now verifies the data-rich ACNURCG first viewport: both frames show 247 registros del corte, metrics `0/194/54/14`, filters, hydrated table rows, UUID/action columns, and matching chronological row order. Evidence: `tmp/visual-qa/territorial-parity-consultas-registro-flags-8792-20260628/13-consultas-registro.png`; report `tmp/visual-qa/territorial-parity-consultas-registro-flags-8792-20260628/report.json` (`wait_ms=37388`, no loaders/errors). `Tiempo`/`GPS` row handoffs remain unclicked, so behavior stays partial rather than done. |
| Local tabs | consultas | gps | GPS review query behavior. | `localTabsForWorkbenchView(...).consultas`; review filters | Yes | Yes | Yes | Partial | partial | 62 | Ordered visual parity now verifies the GPS-filtered ACNURCG first viewport: both frames show 194 visible GPS rows, matching top counters, filters, table content, and first-row order with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-consultas-gps-8792-20260628/14-consultas-gps-por-revisar.png`; report `tmp/visual-qa/territorial-parity-consultas-gps-8792-20260628/report.json` (`wait_ms=39326`). The GPS row handoff remains unclicked, so behavior stays partial. |
| Local tabs | consultas | duracion | Duration review query behavior. | `localTabsForWorkbenchView(...).consultas`; review filters | Yes | Yes | Yes | Partial | partial | 63 | Ordered visual parity now verifies the duration-filtered ACNURCG first viewport: both frames show 54 visible duration rows, matching counters, filters, table content, and first-row order with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-consultas-duracion-8792-20260628/15-consultas-duracion-por-revisar.png`; report `tmp/visual-qa/territorial-parity-consultas-duracion-8792-20260628/report.json` (`wait_ms=38283`). The duration row handoff remains unclicked, so behavior stays partial. |
| Local tabs | consultas | responsable | Responsible/UMP/team cross-check behavior. | `localTabsForWorkbenchView(...).consultas`; review case blocks | Yes | Yes | Yes | Partial | partial | 64 | Ordered visual parity now verifies the responsible-filtered ACNURCG first viewport: both frames show 14 visible rows, matching counters, row numbers, UMP/manzana/district/responsible fields, and first-row order with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-consultas-responsable-order-8792-20260628/16-consultas-cruce-responsable.png`; report `tmp/visual-qa/territorial-parity-consultas-responsable-order-8792-20260628/report.json` (`wait_ms=37262`). The first pass `tmp/visual-qa/territorial-parity-consultas-responsable-8792-20260628/16-consultas-cruce-responsable.png` is retained as failure evidence for the old order. Behavior remains partial because no row action/mutation was executed. |
| Local tabs | consultas | subsanaciones | Remediation/excess/gap behavior. | `localTabsForWorkbenchView(...).consultas`; operational adjustment blocks | Yes | Yes | Yes | Partial | partial | 65 | Ordered visual parity now verifies the data-rich remediation first viewport: both frames show 50 compatible gaps, 69 available surplus cases, 24 cases to close UMPs, 0 complete packages, suggestion cards, and the operational review inspector with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-consultas-subsanaciones-8792-20260628/17-consultas-subsanaciones.png`; report `tmp/visual-qa/territorial-parity-consultas-subsanaciones-8792-20260628/report.json` (`wait_ms=37214`). Mutating reset/apply/revert actions remain unclicked on the real project, so behavior stays partial. |
| Local tabs | avance | resumen | Territorial KPI summary behavior. | `localTabsForWorkbenchView(...).avance`; `TerritorialAdvanceSummary` | Yes | Yes | Partial | Partial | mismatch | 66 | Ordered comparator proves data hydration but not visual parity. Both frames show real 1,215/1,200 advance data, district cards and UMP status with no loaders/errors, but the modular first viewport adds a non-canonical advance-objective card, replaces mini district geometry with circular initials, and changes district-board density/order. Evidence: `tmp/visual-qa/territorial-parity-avance-resumen-8792-20260628/18-avance-resumen.png`; report `tmp/visual-qa/territorial-parity-avance-resumen-8792-20260628/report.json` (`wait_ms=87457`). |
| Local tabs | avance | ump | Map and UMP block rhythm behavior. | `localTabsForWorkbenchView(...).avance`; UMP/map components | Yes | Yes | Yes | Partial | partial | 67 | Target opens with the canonical `Zonas con cierre` overview map, uses `advance_summary` for Avance, matches the canonical source/KPI/map counts (`2/2`, `1,215 validas`, `124 zonas`, `125 UMP completas`), restores the same filter row, and keeps the interactive UMP map/detail below. Latest ordered evidence: `tmp/visual-qa/territorial-parity-avance-mapa-ump-8792-20260628/19-avance-mapa-y-ump.png`; report `tmp/visual-qa/territorial-parity-avance-mapa-ump-8792-20260628/report.json` (`wait_ms=38813`, no loaders/errors). It remains partial because exact lower-detail UMP interactions and selected map/detail behavior were not clicked in this pass. |
| Local tabs | avance | ritmo | Daily rhythm trend behavior. | `localTabsForWorkbenchView(...).avance`; rhythm components | Yes | Yes | Yes | Yes | done | 68 | Target renders the canonical daily rhythm chart, accumulated line, side metrics, date controls, and daily table from top-level `reports.daily`. Latest ordered evidence: `tmp/visual-qa/territorial-parity-avance-ritmo-8792-20260628/20-avance-ritmo-diario.png`; report `tmp/visual-qa/territorial-parity-avance-ritmo-8792-20260628/report.json` (`wait_ms=32237`, no loaders/errors). Minor tick-label format difference remains (`Junio` vs `jun`), but data/chart/table hydration is verified. |
| Local tabs | avance | salidas | PDF and Sheets outputs behavior. | `TerritorialAdvanceView` + `MonitoreoOutputsWorkbench` | Yes | Yes | Partial | Partial | mismatch | 69 | Ordered comparator proves hydration of the PDF/Sheets outputs state: 1,594 records, client pending, internal published, destination field and publish controls are present with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-avance-salidas-8792-20260628/21-avance-salidas.png`; report `tmp/visual-qa/territorial-parity-avance-salidas-8792-20260628/report.json` (`wait_ms=32224`). Visual parity fails because the modular frame changes the PDF action to a filled magenta button and changes the output card proportions/framing relative to the original. |
| Local tabs | ocurrencias | states | General effective/non-effective occurrence status behavior. | `localTabsForWorkbenchView(...).ocurrencias`; occurrences section | Yes | Yes | Partial | Partial | mismatch | 70 | Ordered comparator proves data/chart hydration: both frames show 5,112 attempts, 669 effective, 4,443 non-effective, non-effective reasons, daily rhythm and district summary with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-estados-8792-20260628/22-ocurrencias-estados-general.png`; report `tmp/visual-qa/territorial-parity-ocurrencias-estados-8792-20260628/report.json` (`wait_ms=38257`). Visual parity fails because the modular first viewport adds synchronization/XLSForm status cards and `Subir Kobo`, shifting the canonical state/reason/rhythm layout. |
| Local tabs | ocurrencias | ump | UMP occurrence follow-up behavior. | `localTabsForWorkbenchView(...).ocurrencias`; occurrences UMP blocks | Yes | Yes | Partial | Partial | mismatch | 71 | Ordered comparator proves data hydration: both frames show UMP coverage metrics, filters, 151 visible rows, status badges and first UMP cards with no loaders/errors. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-ump-8792-20260628/23-ocurrencias-por-ump.png`; report `tmp/visual-qa/territorial-parity-ocurrencias-ump-8792-20260628/report.json` (`wait_ms=38264`). Visual parity fails because modular synchronization/XLSForm cards are inserted before the UMP coverage workbench, shifting the canonical first viewport; detail interactions remain unclicked. |
| Local tabs | ocurrencias | alerts | Reviewable occurrence observations behavior. | `localTabsForWorkbenchView(...).ocurrencias`; occurrence alerts/logs | Yes | Yes | No | Partial | mismatch | 72 | Ordered comparator proves data hydration but visual/functional parity fails. Canonical `Observaciones` opens with compact `Tipos de ocurrencia`, `Cobertura` and `Historial` panels; modular opens with an alert-review board plus occurrence types and sync/XLSForm cards above. Evidence: `tmp/visual-qa/territorial-parity-ocurrencias-observaciones-8792-20260628/24-ocurrencias-observaciones.png`; report `tmp/visual-qa/territorial-parity-ocurrencias-observaciones-8792-20260628/report.json` (`wait_ms=38255`, no loaders/errors). |
| Content/actions | fuentes | source console | Operable Kobo console, asset selection, filters, roster, reconciliation, and history. | `TerritorialSourceConsole` | Yes | Yes | Yes | Yes | done | 34 | Simplified `SourceView` replaced; batch reconciliation and Kobo job polling/progress are implemented. Iteration 34 restores the canonical first visual state for `Formulario` while preserving asset selection and inspect/sync handlers. Mutating API clicks were not executed against the audit project; handler wiring is type/build validated. |
| Content/actions | modelo | route workbench | UMP dashboard, block table, map, Kobo sync, and route-sheet state. | `TerritorialRouteView` | Yes | Yes | Yes | Yes | done | 5 | Summary/table workbench, Kobo sync handler, route-sheet state, selection, selected-block map, sex/age rail, and district coverage table are extracted. Mutating sync was not clicked against the audit project. |
| Content/actions | calidad | validation workbench | GPS, UMP reconciliation, duration, quota, and annulment correction actions. | `TerritorialValidationView` | Partial | No | Partial | Partial | blocked | 11 | Geolocation, spatial reconciliation, duration, quota, and annulment now have canonical workbenches; the full validation state machine, exact spatial map focus, and data-rich verification for duration/reconciliation/annulment remain incomplete. |
| Content/actions | consultas | review cases | Registro, GPS, duration, responsible, and remediation filters/actions. | `TerritorialQueriesView` / `TerritorialReviewCasesView` | Partial | Partial | Yes | Partial | mismatch | 14 | `TerritorialReviewCasesWorkbench` restores the review table, filters, tab-to-type mapping, UUID copy, and GPS/duration deep links. `TerritorialOperationalAdjustmentsWorkspace` restores apply/revert/reset for `subsanaciones`, but audit data has 0 review rows and the UMP audit drawer remains outside the target. |
| Content/actions | avance | advance content | KPI, UMP/map, daily rhythm, and outputs differentiated by tab. | `TerritorialAdvanceView` | Partial | Partial | Yes | Partial | mismatch | 36 | `TerritorialAdvanceWorkbench` restores summary/UMP/rhythm surfaces, `TerritorialOutputsPanel` covers salidas, and `avance/ritmo` now uses canonical daily audit semantics with a real Plotly chart/table. `avance/ump` has map navigation, manzana selection, lazy GPS layer loading, selected-manzana point filtering, response list, point focus, audited map inspector content for selected block/GPS, selected-district streets/context, route zones, neighbor blocks, canonical GPS color classes, and a visible map legend. Acceptable cold/warm timing and exact historical map-engine parity remain outside parity. |
| Content/actions | ocurrencias | field occurrences | Configure, inspect, sync, upload to Kobo, and generate XLSForm for field occurrences. | `TerritorialFieldOccurrencesSection` | Partial | Partial | Yes | Partial | unverified | 26 | Kobo connection discovery, asset catalog loading, asset config persistence, XLSForm, upload-Kobo, field inspection, occurrence sync, state refresh, field-check display, link copy, config summary, and richer log entries are wired through existing APIs. The external Kobo upload mutation was not executed against ACNURCG because the audit session has no token/safe mutation fixture. |
| Outputs | avance | salidas | Canonical outputs panel with PDF/Sheets publication state and callbacks. | `TerritorialAdvanceView` + `MonitoreoOutputsWorkbench` | Yes | Yes | Yes | Yes | done | 1 | `TerritorialOutputsPanel` is used by both the monolith and the territorial page. |
| State | global | phase/cache status | Rail shows pilot/field, readiness, cache/source coherence, and update status. | Territorial workbench state in `MonitoreoPage.tsx` | Yes | Partial | Yes | Partial | unverified | 29 | Target rail now shows phase badges from `territorial_phase_coherence`, active source/local-vs-snapshot counts, update timestamp, and report cache status/source/scope/size. Fresh-stack QA rendered the rail at 1440x1000 with no overflow. Full `TerritorialBootPanel` readiness and authoritative phase-state parity remain open. |
| State | global | loading/error | Territorial loading/error views per section with historical retry/min-height behavior. | `TerritorialLoadingView` / `TerritorialViewError` | Yes | Yes | Yes | Yes | done | 28 | Target now renders canonical `mon-territorial-loading-*` feedback for active pending scopes and `TerritorialViewError` with `Alert kind="error"`, `mon-territorial-view-error`, and retry. Forced-error QA proved the alert/retry state and the retry guard (`beforeRetry=1`, `afterRetry=2`) with no page errors. |
| Import boundary | territorial | registry | Territorial profile does not import `../../MonitoreoPage`. | `profiles/territorial/index.ts` | Yes | Yes | Yes | Yes | done | 0 | `rg -n "from .*MonitoreoPage" frontend/src/features/monitoreo/profiles/territorial` returns no results. |
