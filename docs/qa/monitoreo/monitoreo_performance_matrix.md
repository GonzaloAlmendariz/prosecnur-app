# Monitoreo performance matrix

Updated: 2026-06-28

Command template:

```bash
node scripts/monitoreo-performance-check.mjs \
  --project-territorial "/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso" \
  --project-acreditacion "/Users/gonzaloalmendariz/Documents/Pulso/ACRD CONTA/monitoreo-acreditacion-contabilidad-multiactor-sheets-readonly-20260606-120147.pulso" \
  --url http://127.0.0.1:5174/ \
  --api-url http://127.0.0.1:8788 \
  --out tmp/perf/monitoreo-performance \
  --timeout-ms 180000 \
  --probe-timeout-ms 30000 \
  --entry-mode bootgate \
  --tab-scope all \
  --tab-probe-timeout-ms 12000
```

The rows below measure hydrated, viewport-visible content. They are not just
route-open timings: each probe waits for required selectors, data counts,
visual/chart/map elements, table rows when applicable, and zero loading
indicators in the measured area.

Latest validated run:
`tmp/perf/monitoreo-loading-vs-tabs-v4-20260628`. The frontend URL used
`http://localhost:5176/`; the API used `http://127.0.0.1:8791`.

Latest ACRDCONTA phone-scope run:
`tmp/perf/acrdconta-phone-summary-20260628`. The frontend URL used
`http://localhost:5174/`; the API used `http://127.0.0.1:8788`.
This run used `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`
and validates the new `phone_summary` scope after restarting the R API.

This matrix separates two different waits:

1. **Project loading screen:** observed browser time from
   `/monitoreo?devPulso=...` until BootGate opens/warms the project and the
   Monitoreo route is visible.
2. **Monitoreo wait after project:** browser time after `/monitoreo` is already
   visually on screen, until declared local tabs are hydrated. A tab is not
   hydrated if it still shows loading indicators, retry/error text, or
   placeholders such as `Preparando vista` / `Leyendo cache local`.

| Project | Profile | Project loading screen | Monitoreo visual | First tab hydrated | Last hydrated tab | Extra wait after visual | Total project + last hydrated tab | Hydrated / declared tabs | Warm return | State requests | Full scope | Status | Evidence |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| ACNURCG.pulso | Territorial | 9.179s | 0ms | 18.260s | 113.590s | 113.590s | 122.769s | 19 / 24 | 501ms | 6 | no | measured-with-failures | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/territorial/territorial.json` |
| Acreditacion Contabilidad | Acreditacion | 17.005s | 0ms | 1.320s | 47.113s | 47.113s | 64.118s | 20 / 22 | 632ms | 9 | yes | measured-with-failures | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/acreditacion/acreditacion.json` |
| ACRDCONTA.pulso | Acreditacion | 91.146s | 0ms | 12.658s | 67.593s | 67.593s | 158.739s | 22 / 22 | 634ms | 8 | no | hydrated-performance-pass | `tmp/perf/acrdconta-phone-summary-20260628/acreditacion/acreditacion.json` |

Every declared local tab is now attempted. The difference between measured and
hydrated tabs is the current failure surface:

| Profile | Declared views | Declared local tabs | Measured tabs | Hydrated tabs | Failed tabs |
|---|---:|---:|---:|---:|---|
| Territorial | 6 | 24 | 24 | 19 | `Validacion/Geolocalizacion`, `Validacion/Reconciliacion UMP`, `Consultas/Registro`, `Consultas/GPS por revisar`, `Avance/Mapa y UMP` |
| Acreditacion | 5 | 22 | 22 | 20 | `Telefono/Resumen`, `Telefono/Dia` |
| Acreditacion ACRDCONTA after `phone_summary` | 5 | 22 | 22 | 22 | none |

## Hydration Probe Detail

| Profile | Probe | Time from route start | Wait inside probe | Data count | Visual count | Rows | Loading | Screenshot |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Territorial | route shell | 18.228s | 18.196s | 9 | 8 | 0 | 0 | n/a |
| Territorial | entry data | 18.260s | 2ms | 6 | 8 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/territorial/screenshots/territorial-entry-hydrated.png` |
| Territorial | advance summary | 34.449s | 15.997s | 14 | 8 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/territorial/screenshots/territorial-advance-summary.png` |
| Territorial | advance map | 39.132s | 4.234s | 12 | 722 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/territorial/screenshots/territorial-interaction.png` |
| Territorial | warm map return | 39.641s | 9ms | 12 | 722 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/territorial/screenshots/territorial-warm-interaction.png` |
| Acreditacion | route shell | 1.253s | 1.217s | 10 | 7 | 0 | 0 | n/a |
| Acreditacion | entry data | 1.320s | 3ms | 5 | 11 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/acreditacion/screenshots/acreditacion-entry-hydrated.png` |
| Acreditacion | advance summary | 1.712s | 260ms | 7 | 5 | 0 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/acreditacion/screenshots/acreditacion-advance-summary.png` |
| Acreditacion | advance detail | 1.861s | 7ms | 6 | 6 | 4 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/acreditacion/screenshots/acreditacion-interaction.png` |
| Acreditacion | warm detail return | 2.499s | 3ms | 6 | 6 | 4 | 0 | `tmp/perf/monitoreo-loading-vs-tabs-v4-20260628/acreditacion/screenshots/acreditacion-warm-interaction.png` |

## Post-change Measurement

| Check | Result | Evidence |
|---|---|---|
| BootGate + all-tab timing script | Passed as harness, not as product acceptance | Combined v4 run: `node scripts/monitoreo-performance-check.mjs --project-territorial "/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso" --project-acreditacion "/Users/gonzaloalmendariz/Documents/Pulso/ACRD CONTA/monitoreo-acreditacion-contabilidad-multiactor-sheets-readonly-20260606-120147.pulso" --url http://localhost:5176/ --api-url http://127.0.0.1:8791 --out tmp/perf/monitoreo-loading-vs-tabs-v4-20260628 --timeout-ms 180000 --probe-timeout-ms 60000 --entry-mode bootgate --tab-scope all --tab-probe-timeout-ms 12000`. |
| Duplicate light state requests | Remaining issue | Territorial duplicated `/api/monitoreo/state?include_reports=0`; Acreditacion duplicated light state plus `advance_summary` and `queries_summary`. |
| Full report scope during all-tab navigation | Remaining issue for Acreditacion | Territorial avoided `report_scope=full`; Acreditacion used `report_scope=full` when Telefonico tabs were measured. |
| Territorial hydrated visual QA | Partial | Entry, summary and map probes passed, but all-tab pass is 19/24 because five tabs still had loading indicators after the strict 12s guard. |
| Acreditacion hydrated visual QA | Updated / partial visual parity | The old 20/22 loader diagnosis is superseded by the `phone_summary` and strict comparator reruns below: ACRDCONTA phone tabs now hydrate 4/4 and combined evidence covers all 22 tabs. Remaining Acreditacion work is visual/data-shape parity and long-run harness stability, not `Telefono/Dia` loader readiness. |
| Territorial canonical-vs-modular visual parity | Separate gate | Full ordered comparator `tmp/visual-qa/territorial-parity-full-20260628/report.json` reached 24/24 ready frames, but the screenshots still showed visual/data mismatches. Repaired proofs include `Avance > Mapa y UMP`, `UMPs > Manzanas`, and the ordered Consultas tabs: `Registro` (`tmp/visual-qa/territorial-parity-consultas-registro-flags-8792-20260628/13-consultas-registro.png`, `wait_ms=37388`), `GPS por revisar` (`tmp/visual-qa/territorial-parity-consultas-gps-8792-20260628/14-consultas-gps-por-revisar.png`, `wait_ms=39326`), `Duración por revisar` (`tmp/visual-qa/territorial-parity-consultas-duracion-8792-20260628/15-consultas-duracion-por-revisar.png`, `wait_ms=38283`), `Cruce responsable` (`tmp/visual-qa/territorial-parity-consultas-responsable-order-8792-20260628/16-consultas-cruce-responsable.png`, `wait_ms=37262`), and `Subsanaciones` (`tmp/visual-qa/territorial-parity-consultas-subsanaciones-8792-20260628/17-consultas-subsanaciones.png`, `wait_ms=37214`). Session-seeded comparator runs are required because `devPulso`-only reruns can conflate project loading with tab hydration. |
| Territorial `Avance > Resumen` | Hydrated but visually mismatched | `tmp/visual-qa/territorial-parity-avance-resumen-8792-20260628/18-avance-resumen.png` shows both frames hydrated after `wait_ms=87457`, but the modular first viewport still diverges from the original: non-canonical objective card, circular district initials instead of mini geometry, and different district-board density/order. |
| Territorial `Avance > Mapa y UMP` | First viewport aligned, lower interactions partial | `tmp/visual-qa/territorial-parity-avance-mapa-ump-8792-20260628/19-avance-mapa-y-ump.png` shows both frames hydrated after `wait_ms=38813` with overview map, 124 zones, 125 complete UMPs, legend and filters; selected/lower UMP interactions were not clicked. |
| Territorial `Avance > Ritmo diario` | Hydrated and visually aligned with minor label delta | `tmp/visual-qa/territorial-parity-avance-ritmo-8792-20260628/20-avance-ritmo-diario.png` shows chart bars, accumulated line, side metrics and daily table after `wait_ms=32237`; only minor x-axis month label formatting differs. |
| Territorial `Avance > Salidas` | Hydrated but visually mismatched | `tmp/visual-qa/territorial-parity-avance-salidas-8792-20260628/21-avance-salidas.png` shows PDF/Sheets output state after `wait_ms=32224`, but modular action/card treatment differs from the canonical original. |
| Territorial `Ocurrencias > Estados general` | Hydrated but visually mismatched | `tmp/visual-qa/territorial-parity-ocurrencias-estados-8792-20260628/22-ocurrencias-estados-general.png` shows occurrence totals/charts after `wait_ms=38257`, but modular sync/XLSForm cards shift the first viewport relative to the original. |
| Territorial `Ocurrencias > Por UMP` | Hydrated but visually mismatched | `tmp/visual-qa/territorial-parity-ocurrencias-ump-8792-20260628/23-ocurrencias-por-ump.png` shows UMP coverage metrics/list after `wait_ms=38264`, but the same modular sync/XLSForm block shifts the canonical layout. |
| Territorial `Ocurrencias > Observaciones` | Hydrated but visually/functionally mismatched | `tmp/visual-qa/territorial-parity-ocurrencias-observaciones-8792-20260628/24-ocurrencias-observaciones.png` shows occurrence data after `wait_ms=38255`, but original compact Types/Coverage/History differs from modular alert-review board plus sync cards. |
| Acreditacion comparator harness | Improved, false-ready guarded | `scripts/monitoreo-visual-parity-check.mjs` now suppresses only the project lifecycle `Cambios sin guardar` dialog inside comparison iframes before reading text/taking screenshots. Invalid modal-covered evidence remains under `tmp/visual-qa/acreditacion-parity-fuentes-sheets-final-8792-20260628` and `tmp/visual-qa/acreditacion-parity-fuentes-sheets-modalfix-8792-20260628`; accepted Sheets evidence is `tmp/visual-qa/acreditacion-parity-fuentes-sheets-qa-dialog-suppressed-8792-20260628/02-fuentes-sheets.png`. |
| Acreditacion `Fuentes > Encuestas` | Hydrated but visually partial | `tmp/visual-qa/acreditacion-parity-fuentes-encuestas-8792-20260628/01-fuentes-encuestas.png` shows 6 sources and 789 records after `wait_ms=23152`, but modular metrics/actions and source-card density differ from the original. |
| Acreditacion `Fuentes > Sheets` | Hydrated but visually partial | `tmp/visual-qa/acreditacion-parity-fuentes-sheets-qa-dialog-suppressed-8792-20260628/02-fuentes-sheets.png` shows 789 records, 6 sources and 5 connected Sheets sources after `wait_ms=12159`, but modular source metrics/actions and Google Sheets block treatment still differ. |
| Acreditacion `Fuentes > Fuentes activas` | Hydrated but content/anchor partial | `tmp/visual-qa/acreditacion-parity-fuentes-activas-8792-20260628/03-fuentes-fuentes-activas.png` shows both panes ready after `wait_ms=12123`, but first viewport remains the source architecture/Sheets body rather than a distinct active-sources status body. |
| Acreditacion `Modelo > Metas y modalidades` | Hydrated but data/parity failure | `tmp/visual-qa/acreditacion-parity-modelo-metas-8792-20260628/04-modelo-metas-y-modalidades.png` shows original `ACTORES 4` and actor meta cards versus modular `ACTORES 0` and a variables/metas form after `wait_ms=13118`. |
| Acreditacion `Modelo > Base de barrido` | Hydrated but visually/data mismatched | `tmp/visual-qa/acreditacion-parity-modelo-base-barrido-8792-20260628/05-modelo-base-de-barrido.png` shows original model/meta cards versus modular barrido mapping form with `ACTORES 0` after `wait_ms=14143`. |
| Acreditacion `Modelo > Enlaces y envios` | Hydrated but visually mismatched | `tmp/visual-qa/acreditacion-parity-modelo-enlaces-envios-8792-20260628/06-modelo-enlaces-y-envios.png` shows modular 6-source mechanisms table after `wait_ms=14119`, while the original first viewport remains on the model/meta body. |
| Acreditacion `Modelo > Estados validos` | Hydrated but visually mismatched | `tmp/visual-qa/acreditacion-parity-modelo-estados-validos-8792-20260628/07-modelo-estados-validos.png` shows modular 8 events and 5 rules after `wait_ms=13148`, while the original first viewport remains on model/meta cards and rejection-rule controls. |
| Acreditacion `Modelo > Calendario` | Hydrated but visually mismatched | `tmp/visual-qa/acreditacion-parity-modelo-calendario-8792-20260628/08-modelo-calendario.png` shows modular calendar/fase rows after `wait_ms=14110`, while the original first viewport remains on model/meta cards. |
| Acreditacion `Consultas > Casos` | Hydrated but visually/data partial | `tmp/visual-qa/acreditacion-parity-consultas-8792-20260628/09-consultas-casos.png` shows 789 visible cases after `wait_ms=14128`, but original first viewport has actor/source donut summaries and `FUENTES 6` while modular has detail table, inspector and `FUENTES 10`. |
| Acreditacion `Consultas > Efectivas` | Hydrated but visually partial | `tmp/visual-qa/acreditacion-parity-consultas-8792-20260628/10-consultas-efectivas.png` shows 0 effectives after `wait_ms=14123`, but original uses chart empty states and modular uses split detail/inspector empty state. |
| Acreditacion `Consultas > Faltantes` | Hydrated but visually/functionally mismatched | `tmp/visual-qa/acreditacion-parity-consultas-8792-20260628/11-consultas-faltantes.png` shows original `Sin flujo disponible`/0-row detail versus modular actor table totaling 789 missing cases after `wait_ms=17429`. |
| Acreditacion `Consultas > Duplicados` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-consultas-8792-20260628/12-consultas-duplicados.png` shows 0 duplicates, 0 alerts and empty duplicate audit after `wait_ms=16115`; only inspector proportions differ. |
| Acreditacion `Consultas > Diferencias` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-consultas-8792-20260628/13-consultas-diferencias.png` shows 0 difference alerts, linked-case table and inspector after `wait_ms=15148`; remaining differences are density/proportions. |
| Acreditacion `Telefono > Resumen` | Hydrated but visually partial | `tmp/visual-qa/acreditacion-parity-telefono-8792-20260628/14-telefono-resumen.png` shows 270 phone-base people, 233 barridos, 65 effectives and 168 without effective outcome after `wait_ms=14107`, but top KPI semantics and progress treatment differ. |
| Acreditacion `Telefono > Dia` | Hydrated; latest canonical undated parity passed | Initial `tmp/visual-qa/acreditacion-parity-telefono-8792-20260628/15-telefono-dia.png` and keyfix evidence are superseded by the canonical daily-trend repair. Latest strict evidence `tmp/visual-qa/acreditacion-parity-telefono-dia-undated-canonical-20260629/report.json` has both frames hydrated with no blockers/errors and the screenshot shows both panes at `TOTAL PERIODO 145` / `14 cortes diarios`, preserving the valid `Sin fecha` row. |
| Acreditacion `Telefono > Responsables` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-telefono-8792-20260628/16-telefono-responsables.png` shows the same six responsible cards and effective counts after `wait_ms=13092`; only proportions/chips differ. |
| Acreditacion `Telefono > Alertas` | Hydrated but visually/functionally mismatched | `tmp/visual-qa/acreditacion-parity-telefono-8792-20260628/17-telefono-alertas.png` shows original active alert/control-sample priority panels versus modular pending/insistence by responsible after `wait_ms=14111`. |
| Acreditacion `Avance > Resumen` | Hydrated but visually/data partial | Clean rerun `tmp/visual-qa/acreditacion-parity-avance-resumen-rerun-8792-20260628/18-avance-resumen.png` has no page/console errors and `wait_ms=13135`; original shows `EFECTIVAS 0`, while modular shows `EFECTIVAS S/D` and different progress/date treatment. |
| Acreditacion `Avance > Actores` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-avance-8792-20260628/19-avance-actores.png` shows actor cards with matching universe/meta/effective values after `wait_ms=13136`; remaining differences are hero/card proportions. |
| Acreditacion `Avance > Encuestas` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-avance-8792-20260628/20-avance-encuestas.png` shows 1 source, 65 effectives, 0 partials and 3 rejections after `wait_ms=13107`; modular adds a daily mini table in the first viewport. |
| Acreditacion `Avance > Detalle` | Hydrated and near parity | `tmp/visual-qa/acreditacion-parity-avance-8792-20260628/21-avance-detalle.png` shows no-control-variables state and report block after `wait_ms=14105`; remaining differences are report-tab hierarchy/proportions. |
| Acreditacion `Avance > Salidas` | Hydrated but visually partial | `tmp/visual-qa/acreditacion-parity-avance-8792-20260628/22-avance-salidas.png` shows PDF/Sheets output state after `wait_ms=13158`, but modular action/card treatment differs from the original. |
| ACRDCONTA strict full pass after model repair | Superseded by stricter reruns | `tmp/visual-qa/acrconta-parity-full-after-model-8792-20260628/report.json` was the old 21/22 snapshot. It is retained as historical evidence only. Later strict phone evidence passes `Telefono/Dia`, and full strict v2 plus isolated `Avance/Actores`/`Avance/Encuestas` reruns provide combined 22/22 hydration coverage. |
| ACRDCONTA `Modelo > Calendario` field planning | Hydrated with real tab wait and date-ready contract | `tmp/visual-qa/acrconta-parity-modelo-calendario-dates-8792-20260628/08-modelo-calendario.png` has `wait_ms=41331`, `total_ms=52448`, 1/1 ready and no page/console errors. The tab separates week windows from actual persisted field dates (`strategy_phases.start_date/end_date`). |
| ACRDCONTA strict hydration guard | Improved measurement, not product acceptance | `scripts/monitoreo-visual-parity-check.mjs` now writes per-frame `hydration.ready/blockers` and waits for target-specific visible data, not only frame opening. It treats `Resumen pendiente`, missing project/cut, and phone daily chart/table absence as blockers; broad false positives such as a Fuentes card named `Barrido telefónico` were removed. |
| ACRDCONTA `Telefono > Dia` strict rerun | Hydrated; visual parity still pending | Isolated strict evidence `tmp/visual-qa/acrconta-parity-phone-dia-strict-8792-20260628/15-telefono-dia.png` shows both original and modular frames hydrated (`wait_ms=52369`, `total_ms=58472`, no blockers/errors). Continuous full strict run also passed the tab: `tmp/visual-qa/acrconta-parity-full-strict2-8792-20260628/15-telefono-dia.png` (`wait_ms=54240`). The remaining issue is visual/data-shape parity: original large daily chart vs modular compact daily table/mini surface. |
| ACRDCONTA full strict run v2 | Continuous 20/22; combined 22/22 hydrated evidence | `tmp/visual-qa/acrconta-parity-full-strict2-8792-20260628/report.json` captured all 22 tabs: Fuentes 3/3, Modelo 5/5, Consultas 5/5, Telefono 4/4, Avance 3/5. `Avance/Actores` stalled before the comparator (`frame_count=0`, project loading screen) and `Avance/Encuestas` had a modular empty-session frame. Direct `advance_summary` API returned 1,189 rows, 12 sources, 4 actors and 6 report sources in 3.335s. Isolated rerun `tmp/visual-qa/acrconta-parity-avance-actores-encuestas-strict-8792-20260628/report.json` passed both missing tabs (`Actores wait_ms=39244`, `Encuestas wait_ms=35177`). |

## Backend Scope Timings From Latest Run

These timings came from the API process logs while running
`tmp/perf/monitoreo-loading-vs-tabs-v4-20260628`.

| Profile | Scope | Cache | Total time | Note |
|---|---|---|---:|---|
| Territorial | `light` | none | 1.685s / 804ms | duplicated route-entry light state |
| Territorial | `source` | build | 14.178s | source warmup/report build |
| Territorial | `route_summary` | build | 14.806s | route/UMP data |
| Territorial | `validation_summary` | build | 23.998s | validation data; failed tabs still timed out with loading indicators |
| Territorial | `queries_summary` | build | 25.138s | consultation data; failed tabs still timed out with loading indicators |
| Acreditacion | `light` | dashboard cache | 236ms / 184ms | duplicated route-entry light state |
| Acreditacion | `source` | build | 703ms | source package |
| Acreditacion | `advance_summary` | dashboard cache | 193ms / 213ms / 191ms | reused cache; duplicated in all-tab traversal |
| Acreditacion | `queries_summary` | build/cache | 3.400s / 219ms | cold then warm |
| Acreditacion | `full` | build | 34.525s | Telefonico trigger; explains `Preparando vista` failures |
| Acreditacion ACRDCONTA | `phone_summary` | build/cache | observed in browser run without `full` | `Telefono/Resumen`, `Telefono/Dia`, `Telefono/Responsables`, and `Telefono/Alertas` hydrated with `loading_count=0`; performance script reported `full_scope_used=false`. |

## ACRDCONTA Phone Summary Evidence

Run:

```bash
node scripts/monitoreo-performance-check.mjs \
  --project-acreditacion "/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso" \
  --url http://localhost:5174/ \
  --api-url http://127.0.0.1:8788 \
  --out tmp/perf/acrdconta-phone-summary-20260628 \
  --timeout-ms 240000 \
  --probe-timeout-ms 90000 \
  --entry-mode bootgate \
  --tab-scope all \
  --tab-probe-timeout-ms 45000
```

Result:

- Project loading screen: 91.146s.
- Monitoreo after project: 67.593s until all declared tabs hydrated.
- Total project loading plus measured tabs: 158.739s.
- Declared tabs: 22/22 measured, 22/22 hydrated.
- `full_scope_used=false`.
- `/api/monitoreo/state` requests: 8.
- Duplicate state requests remain: `include_reports=0`,
  `advance_summary`, and `queries_summary`.
- Slowest tab: `Consultas/Casos`, wait 44.438s. This is the next
  performance target; it is not a phone loader failure.

Phone tab detail from the same run:

| Tab | At route ms | Wait | Data | Visual | Rows | Loading | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Telefono/Resumen | 65.561s | 2ms | 35 | 17 | 0 | 0 | `tmp/perf/acrdconta-phone-summary-20260628/acreditacion/screenshots/tabs/14-telefono-resumen.png` |
| Telefono/Dia | 65.799s | 4ms | 183 | 15 | 12 | 0 | `tmp/perf/acrdconta-phone-summary-20260628/acreditacion/screenshots/tabs/15-telefono-dia.png` |
| Telefono/Responsables | 66.041s | 2ms | 63 | 11 | 2 | 0 | Harness PNG was blank; direct repro `tmp/visual-qa/acrdconta-phone-responsables-direct-20260628.png` confirms render. |
| Telefono/Alertas | 66.161s | 6ms | 53 | 1 | 0 | 0 | `tmp/perf/acrdconta-phone-summary-20260628/acreditacion/screenshots/tabs/17-telefono-alertas.png` |

Visual parity remains separate from hydration. The comparator evidence
`tmp/visual-qa/acrdconta-phone-summary-visual-20260628/14-telefono-resumen.png`
timed out because the original canonical frame still showed `Sin monitoreo
telefónico`, while the independent Acreditacion frame rendered real phone
data. This is a parity difference to resolve, not a modular hydration failure.

## Baseline Checks Before Edits

| Check | Result | Evidence |
|---|---|---|
| Monitoreo frontend tests | Passed | `pnpm --dir frontend test -- src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts` -> 32 files / 207 tests passed. |
| R report cache tests | Passed | `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-report-cache.R")'` -> 56 expectations passed. |
| Frontend build fast | Passed with warning | `pnpm --dir frontend build:fast`; warning: circular chunk `monitoreo-acreditacion -> monitoreo-territorial -> monitoreo-acreditacion`. |
| Frontend typecheck | Passed | `pnpm --dir frontend typecheck`. |
| Diff hygiene | Passed | `git diff --check`. |

## Known Performance Risks

- `advance_summary`, `route_summary`, `validation_summary` and
  `queries_summary` are still cold-load hotspots on large real projects.
- Both measured profiles still duplicate the light
  `/api/monitoreo/state?include_reports=0` request once on route entry.
- Territorial visual route entry is fast after BootGate, but it is not
  meaningfully hydrated until 18.260s, and five declared tabs still fail the
  strict hydration guard.
- Acreditacion source, phone and advance tabs can hydrate with strict visual
  evidence, but long continuous comparator runs can still lose the seeded
  session or sit on the project loading screen for an iframe/page. The next
  harness repair should reassert session/project readiness per opened page
  before judging tab hydration.
- The all-tab probe now covers every declared tab for Territorial and
  Acreditacion, but several tabs fail; this is a product issue, not a missing
  measurement issue.
- Acreditacion all-tab navigation currently uses `report_scope=full` for
  Telefonico. Hydration is now correct for `Telefono/Dia`, but the next
  performance pass must decide whether a narrower phone scope can replace full
  without losing daily chart/table data.
- The build reports a circular chunk between accreditation and territorial
  chunks; no direct profile import was found, so the next loop should inspect
  shared dependencies and manual chunk boundaries.
- Acreditacion source/add/sync mutation clicks still need a disposable fixture
  before they can be validated safely.
- Visual QA for Acreditacion depends on the available
  `ACRD CONTA` project path above; if the path moves, pass
  `--project-acreditacion` explicitly.
