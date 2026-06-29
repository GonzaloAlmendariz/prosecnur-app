# Monitoreo deliverables audit

Date: 2026-06-28

Loop category: Monitoreo deliverables audit and publication QA repair.

Source of truth:

- Acreditacion: official universe/base plus SurveyMonkey responses reconciled to
  a unique canonical official case. ACRDCONTA Egresados current truth is
  `270 / 157 / 5 / 0 / 108`.
- Territorial: validated internal Google Sheet
  `https://docs.google.com/spreadsheets/d/1hDWdoE-yxadwC3EPTXtUB8AWWXsR6dv-Givw9g05hD8/edit?gid=240203097#gid=240203097`.
- Publication tests: `api/tests/testthat/test-monitoreo-publish-qa.R`.

Baseline before this iteration:

- Command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
- Result: 337 passing expectations, 19 failures.
- Failure class: stale territorial publication expectations versus the validated
  internal Sheet structure. The reference includes `UMP no iniciadas`,
  `Subsanadas`, `Reemplazos disponibles`, and replacement rows as first-class
  operational evidence.

Validation after this iteration:

- Command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
- Result: 415 passing expectations, 0 failures.
- Expanded command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::set_max_fails(100); testthat::test_dir("api/tests/testthat", filter="monitoreo.*publish|monitoreo.*engine|sheets|pdf")'`
- Expanded result: 1938 passing expectations, 0 failures after the
  deliverables/evidence-pack/no-base refusal regressions.
- Engine/Sheets publisher command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-engine.R")'`
- Engine/Sheets publisher result: 1353 passing expectations, 0 failures after
  the no-base platform-refusal regression.
- Live disposable Google Sheets evidence:
  ACRDCONTA client and internal native Sheets were written with
  `monitoreo_sheets_publish_tabs()` and read back through Sheets metadata/cells.
  The internal publish first failed on Google Sheets' 50,000-character cell
  limit, then passed after explicit cell sanitization with an audit marker.
- Direct ACRDCONTA `.pulso` verification:
  `load_pulso("/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso")`
  plus `.monitoreo_state_payload(..., report_scope = "advance_summary")`.
  Result: Egresados `270 / 157 / 5 / 0 / 108`, `Avance universo = 0.5815`;
  cold build took about 180s.
- Frontend checks: `pnpm --dir frontend typecheck` passed and
  `pnpm --dir frontend build:fast` passed. Build still reports an existing
  circular chunk warning between `monitoreo-acreditacion` and
  `monitoreo-territorial`.
- Diff hygiene: `git diff --check` passed for the Monitoreo deliverables files
  touched in this continuation.
- Added XLSX hydration contract checks: every generated workbook must pass
  sheet order, non-empty sheets, minimum rows/columns, required section labels,
  freeze panes, filters, styles and missing-relationship checks.
- Added territorial client PDF consistency checks: the PDF must use the same
  observed survey counts as the client Sheets district table, not design-derived
  survey counts.
- Added rejection-source contract checks: telephone refusals remain in internal
  telephone monitoring (`Rechazos telefónicos`), channel/actor telephone views
  and the `telefonico` Monitoreo path. They do not inflate client `Rechazo`;
  client-facing rejection comes from platform/consent refusal
  (`Rechazos plataforma`) only when the response resolves to a valid official
  base case. No-key/no-base consent refusals remain flagged as
  `Rechazos plataforma sin cruce base` for audit, but do not count in official
  actor totals, client daily matrices or channel/source totals. The client
  daily and channel/source matrices also exclude phone-only refusals from
  `Rechazos plataforma`. The phone-path regression now also asserts that
  `Rechazos telefónicos` stays visible by day and by responsible in the
  `monitoreo_telefonico` blocks.

Generated local evidence:

- ACRDCONTA client PDF:
  `tmp/qa/monitoreo-deliverables/acrdconta-client-pdf-20260628/ACRDCONTA-cliente-reporte.pdf`.
- ACRDCONTA client PDF render:
  `tmp/qa/monitoreo-deliverables/acrdconta-client-pdf-20260628/pages/page-1.png`
  through `page-7.png`.
- ACRDCONTA client PDF validation:
  `tmp/qa/monitoreo-deliverables/acrdconta-client-pdf-20260628/pdf-validation.json`.
- ACRDCONTA generation metadata:
  `tmp/qa/monitoreo-deliverables/acrdconta-client-pdf-20260628/generation-meta.json`.
- Territorial ACNURCG hydrated internal XLSX:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/ACNURCG-interno-sheets-hydrated.xlsx`.
- Territorial ACNURCG hydrated PDF:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/ACNURCG-territorial-avance-hydrated.pdf`.
- Territorial ACNURCG XLSX/PDF validation:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/xlsx-validation-hydrated.json`,
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/pdf-validation-hydrated.json`.
- Territorial ACNURCG full-tab performance remeasure:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-performance-remeasure-full/ACNURCG-interno-sheets-precomputed-full.xlsx`,
  `generation-meta-precomputed.json`, `generation-summary-precomputed.md`,
  and `xlsx-validation-precomputed.json`.
- Territorial reference comparison:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-reference-comparison-hydrated.md`.
- Generator contract evidence:
  `tmp/qa/monitoreo-deliverables/generator-contract-20260628/monitoreo-publish-qa-report.json`,
  `tmp/qa/monitoreo-deliverables/generator-contract-20260628/artifact-contract-summary.csv`,
  `tmp/qa/monitoreo-deliverables/generator-contract-20260628/artifact-tab-health.csv`,
  `tmp/qa/monitoreo-deliverables/generator-contract-20260628/territorial-client-pdf-validation.json`,
  plus four generated XLSX workbooks for territorial/acreditacion and
  client/internal audiences and one territorial client PDF fixture.
- Live Google Sheets readback:
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-result.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-metadata-summary.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-client-readback-summary.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-internal-before-sanitizer.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-internal-result.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-internal-metadata-summary.json`,
  `tmp/qa/monitoreo-deliverables/google-sheets-readback-20260628/prosecnur-publish-internal-truncation-readback.json`.

| Profile | Audience | Artifact | Generator | Source of truth | Data status | Format status | QA project | Status | Next repair |
|---|---|---|---|---|---|---|---|---|---|
| Acreditacion | Client | Google Sheets / XLSX tabs: `Reporte`, `Detalle del avance`, `Corte y fuentes` | `monitoreo_publication_sheets_tabs()`, `monitoreo_publication_workbook()`, `monitoreo_sheets_publish_tabs()` | ACRDCONTA `.pulso` updated from official base + SurveyMonkey; Egresados `270 / 157 / 5 / 0 / 108` | Canonical for Egresados and aligned with internal base indicators. Client `Rechazo` is platform/consent only; phone-only refusals stay out of client totals and matrices but remain in telephone monitoring | XLSX has ordered tabs, freeze, filters, styles, non-empty sheets, required sections and no missing package parts. Disposable native Sheet `https://docs.google.com/spreadsheets/d/1Qg-jUYB_yu_4cmCmd7PYamEpeJXuN-Oai4RlJWr_G5M` was written and read back with values, styled headers, frozen row, filters and conditional formats | `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso` plus generator contract fixture and live Sheet readback | Passed publication QA and live Sheets readback | Add permanent real-project fixture or snapshot contract for ACRDCONTA counts if acceptable for CI cost. |
| Acreditacion | Internal | Google Sheets / XLSX tabs: `Resumen`, `Avance por encuesta`, `Seguimiento`, `Alertas`, `Corte y fuentes` | `monitoreo_publication_sheets_tabs()`, `monitoreo_publication_workbook()`, `monitoreo_sheets_publish_tabs()` | Same canonical case rollup; internal keeps channels, collector/responsible fields and traceability, including telephone-specific operational states | Canonical counts pass; collector type preserved through case rollup. Telephone states remain first-class internal/phone-path evidence | XLSX hydration contract passes. Disposable native Sheet `https://docs.google.com/spreadsheets/d/1cwUUhxr1qop0QL3TCpg87IyXOxb8oStJjjhc3vcLBLQ` was written and read back: `Resumen` 51x12, `Avance por encuesta` 213x11, `Seguimiento` 1058x108, `Alertas` 508x27, `Corte y fuentes` 23x7; every tab has frozen row, filter, conditional formats and owner metadata. Long Google cells are explicitly truncated with marker; XLSX remains full-fidelity | ACRDCONTA `.pulso` plus publication fixture and live Sheet readback | Passed publication QA and live Sheets readback | Consider adding an optional compact trace-export attachment if users need full long JSON traces outside XLSX. |
| Territorial | Internal | Google Sheets / XLSX internal workbook: `Portada`, `Resumen territorial`, `Ritmo diario`, `Tabla maestra`, `Manzanas y responsables`, `Responsables y rutas`, `Cuotas sexo y edad`, `Validación de tiempos`, `GPS y territorio`, `Ocurrencias de campo`, `Base técnica`, `Auditoría técnica`, `Casos accionables`, `Anulaciones` | `monitoreo_publication_sheets_tabs()`, territorial publication helpers, `monitoreo_publication_workbook()` | Validated Sheet `Monitoreo de campo` with 14 tabs and frozen header rows | Generator now uses the same tab order and row/section contract for territorial internal XLSX as the validated Sheet. Real ACNURCG occurrences hydrate and match reference occurrence totals `84 / 5112 / 669 / 4443`; exact advance/anulaciones parity is blocked because local `ACNURCG.pulso` has 1 persisted tacha and 0 persisted UMP subsanadas while the validated Sheet has 2 tachas and 30 UMP subsanadas. P446 is reconstructable in memory; the 30 subsanadas are not fully reconstructable from current local packages because only 18/30 Sheet rows match engine suggestions | XLSX has 14 sheets in validated order, freeze in every expected sheet, required filters by sheet contract, professional section blocks, required sections by tab, minimum rows/columns and no missing package parts | `/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso` plus live Sheet metadata/ranges | Passed generator QA; reference metric parity blocked by local project state drift | Save/update the `.pulso` only with the exact operational packages that produced the validated Sheet before asserting exact metric parity. |
| Territorial | Client | PDF / advance export | `monitoreo_territorial_advance_report_pdf()` through `/api/monitoreo/client-report/pdf` | Territorial dashboard model and client Sheets district rows from the same publication model | Fixture PDF now matches client Sheets observed survey counts: total `22` and district counts `6 / 9 / 7`; real ACNURCG PDF remains consistent with local model, not with the newer validated Sheet state | Rendered 2 A4-landscape pages; title, cut, source footer, map and district cards render without overlap and no internal traces | Publication fixture plus `/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso` | Passed publication QA and local render QA; reference parity blocked by local project state drift | Re-render after the `.pulso` is updated to the validated Sheet state. |
| Acreditacion | Client | PDF ejecutivo | `monitoreo_acreditacion_client_report_pdf()` through `/api/monitoreo/client-report/pdf` | ACRDCONTA canonical client report model | Canonical and consistent with XLSX/Sheets; Egresados `270 / 157 / 5 / 0 / 108` and `58.1%` | Rendered 7 A4 pages; page 7 declares `Corte y fuentes`, `Fuente de verdad`, SurveyMonkey sources, base official rule and Apps Script exclusion | `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso` | Passed PDF QA | Optimize model build time before repeated operational use; PDF drawing is fast but model preparation is slow. |

Iteration record:

- Failure or bottleneck 1: the publication test suite still failed on
  territorial expectations that predated the validated internal Sheet.
- Focused change 1: update the territorial publication QA contract to the live
  validated structure: `UMP no iniciadas`, `Subsanadas`,
  `Reemplazos disponibles`, planned replacement columns, and replacement state
  split between `Tipo = Reemplazo` and `Estado reemplazo = Reemplazo sin uso`.
- Failure or bottleneck 2: the Acreditacion PDF had correct canonical counts
  and professional charts, but did not explicitly expose `Corte y fuentes`.
- Focused change 2: add a final PDF page with cut date, source table,
  SurveyMonkey source labels, official-base rule, canonical dedupe rule, and
  a clear note that the Apps Script viejo is not the source of truth.
- Failure or bottleneck 3: territorial internal XLSX used the flatter workbook
  frame path, so real sections such as `Ocurrencias de campo` did not preserve
  the same sectioned row contract used by Google Sheets publication.
- Focused change 3: route territorial internal XLSX through
  `monitoreo_publication_sheets_tabs()` and add a regression check that the
  occurrence workbook sheet contains summary, ranking and UMP-state sections
  instead of an empty placeholder.
- Failure or bottleneck 4: a direct real-project generation missed field
  occurrences because the API endpoint injects `field_occurrences` from the
  `.pulso` occurrence snapshot before publishing.
- Focused change 4: regenerate ACNURCG evidence with the occurrence snapshot
  hydrated. The local generator now matches the validated Sheet occurrence
  totals; remaining differences are classified as local `.pulso` state drift.
- Failure or bottleneck 5: publication QA still treated XLSX creation and a
  global freeze/filter check as enough evidence, so a workbook could open while
  individual tabs were under-hydrated.
- Focused change 5: add per-profile/per-audience XLSX contracts for internal
  and client reports. The contract now checks non-empty sheets, minimum
  rows/columns and required section labels for each tab before a generated
  artifact can pass QA.
- Failure or bottleneck 6: the QA still accepted freeze/filter when at least
  one worksheet had the XML marker, instead of checking the expected tabs one
  by one.
- Focused change 6: make freeze/filter a per-sheet contract. All expected tabs
  must have freeze panes; filters are required per tab except explicit sectioned
  exceptions such as `Anulaciones`.
- Failure or bottleneck 7: the territorial client PDF used design-derived
  survey counts for the `ENCUESTAS` KPI and district cards, so it could
  contradict the client Sheets `Avance por distrito` observed counts.
- Focused change 7: make the PDF use observed/effective survey counts for
  `ENCUESTAS` and add a regression test comparing the PDF text against the
  client Sheets district rows.
- Failure or bottleneck 8: responses without canonical key and without
  `response_id` were deduplicated together as `response:`, so a partial response
  could hide a platform no-consent rejection before the summary.
- Focused change 8: deduplicate no-key/no-response-id events by real response
  row, keep platform consent refusals as platform rejection events, and add a
  publication regression test proving telephone refusals stay internal while the
  client model exposes only the platform rejection count.
- User-rule continuation: after reviewer feedback, harden the client report
  model so phone-only refusal rows are skipped before building client daily and
  channel/source `Rechazos plataforma` matrices. Added a regression where two
  phone refusals and zero platform non-consents produce client `Rechazo = 0`,
  daily `Rechazos = 0`, and channel/source `Rechazos plataforma = 0`.
- User-rule continuation 2: telephone states are not discarded globally. They
  remain critical in internal telephone monitoring, actor/channel telephone
  views and the `telefonico` path; only client/platform rejection buckets exclude
  phone-only refusal states.
- User-rule continuation 3: harden the `telefonico` path regression so a real
  telephone refusal appears as `Rechazos telefónicos` in both daily and
  responsible phone-monitoring blocks.
- Focused change 9: extend the daily case-rollup matrices so platform consent
  refusals without canonical key appear on their response date, while anonymous
  partials remain out of client-facing response counts.
- Failure or bottleneck 10: the expanded engine suite still carried stale
  expectations from the Apps Script/barrido era and the canonical
  `case_rollup` path did not apply configured human collector names when
  building daily collector tables.
- Focused change 10: keep barrido metrics as operational trace, but assert that
  canonical advance uses reconciled cases; count exact official-base email
  matches as crossed/effective; keep anonymous partials out of actor totals;
  and make collector labels idempotently prefer configured names
  (`Nombre (collector_id)`) in the rollup path.
- Failure or bottleneck 11: ACRDCONTA internal native Google Sheets publication
  failed even though the XLSX opened, because `Seguimiento` column 43 contains
  long JSON trace cells above Google Sheets' 50,000-character cell limit.
- Focused change 11: sanitize Google Sheets cell payloads at the common
  serialization boundary. Values over 50,000 characters are truncated with an
  explicit marker that states the original size; the XLSX artifact retains the
  full value. Live readback of `Seguimiento!AQ656` confirms exactly 50,000
  characters, the marker and the original 55,465-character size.
- Failure or bottleneck 12: local metadata evidence omitted `frozenRowCount`, so
  the product helper could under-report frozen rows even when native Google
  Sheets metadata had them.
- Focused change 12: include `frozenRowCount` in `.monitoreo_sheets_metadata()`
  and `.monitoreo_sheets_tab_map()`, with a mock publisher regression that
  verifies the field mask requests it.
- Focused change 13: align territorial internal generated tab order with the
  validated Sheet order: `Portada`, `Resumen territorial`, `Ritmo diario`,
  `Tabla maestra`, route/quota/validation tabs, `GPS y territorio`,
  `Ocurrencias de campo`, `Base técnica`, `Auditoría técnica`,
  `Casos accionables`, `Anulaciones`.
- Product roadmap added:
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`, this QA doc,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Result: full publication QA passed with 430 expectations; expanded
  monitoreo engine/publish/Sheets/PDF validation passed with 1938 expectations;
  focused engine/Sheets publisher validation passed with 1353 expectations;
  ACRDCONTA PDF render/text validation passed; ACNURCG XLSX/PDF rendered and
  hydrated occurrences passed; generator contract evidence passed for four XLSX
  artifacts, including per-tab freeze/filter contracts; territorial client PDF
  fixture validation passed with `22` total surveys and `6 / 9 / 7` district
  surveys matching client Sheets; ACRDCONTA client/internal native Google Sheets
  write/readback passed on disposable spreadsheets.
- Better/worse/same: better; the suite now protects the current reference
  structure, cut/source contract and per-tab hydration/formatted workbook
  contract instead of only checking that files open or have one styled tab.
- Next action: obtain the exact operational package state behind the validated
  Sheet's 30 subsanadas before writing those states into the local
  `ACNURCG.pulso`; P446 alone is reconstructable but would only partially
  synchronize the project.

## Corrected continuation - 2026-06-29

Previous status:

- Claimed: completed.
- Correct classification: `PARTIAL_SUCCESS`.
- Reason: the previous pass proved stronger generator, XLSX, PDF and Google
  Sheets behavior, but still left critical work inside the same goal:
  territorial internal parity is blocked by local `.pulso` state drift, the
  validated Sheet has 30 UMP subsanadas and one additional tacha not persisted
  locally, cold generation remains slow, and preflight/scorecard/evidence pack
  had not yet existed as executable backend contracts.

Scope lock:

- Module: Monitoreo deliverables / publication / output control.
- Touched in this continuation: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`, this QA doc,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `tmp/qa/monitoreo-deliverables/*`.
- Explicitly excluded: `.pulso` mutation, production Google Sheet writes,
  secrets, Electron packaging and unrelated modules.
- Main risk: publishing or presenting territorial internal output as ready
  while the validated reference and local project state differ.

New mandatory artifacts:

- Territorial drift report:
  `tmp/qa/monitoreo-deliverables/territorial-drift-report.md` and
  `tmp/qa/monitoreo-deliverables/territorial-drift-report.csv`.
- Preflight sample:
  `tmp/qa/monitoreo-deliverables/preflight-sample.json` and
  `tmp/qa/monitoreo-deliverables/preflight-sample.md`.
- Evidence pack sample:
  `tmp/qa/monitoreo-deliverables/evidence-pack-sample/report.json`,
  `report.md`, `generated.xlsx`, `generated.pdf`,
  `format-validation.json`, `data-validation.json`, and
  `performance.json`.
- Performance summary:
  `tmp/qa/monitoreo-deliverables/performance-summary.json` and
  `tmp/qa/monitoreo-deliverables/performance-summary.md`.
- ACRDCONTA performance remeasurement:
  `tmp/qa/monitoreo-deliverables/acrdconta-performance-remeasure.json` and
  `tmp/qa/monitoreo-deliverables/acrdconta-performance-remeasure.md`.
- ACRDCONTA PDF endpoint remeasurement:
  `tmp/qa/monitoreo-deliverables/acrdconta-pdf-endpoint-remeasure/generation-meta-endpoint.json`,
  `pdf-validation-endpoint.json`, `ACRDCONTA-cliente-reporte-endpoint.pdf`,
  and `tmp/qa/monitoreo-deliverables/acrdconta-pdf-endpoint-remeasure.md`.

Corrected loop attempts:

| Attempt | Area | Repair or unblock | Evidence | Status | Allows final closure |
|---:|---|---|---|---|---|
| 1 | Reclassification | Re-read the corrected and original objectives and reclassified the previous report as `PARTIAL_SUCCESS`. | This section and the required objective files. | fixed | No |
| 2 | Baseline | Re-ran the focused publication QA baseline after the corrected objective. | `test-monitoreo-publish-qa.R`: 415 pass, 0 fail. | fixed | No |
| 3 | Preflight | Added `monitoreo_deliverables_preflight()` with status, score, blocking issues, warnings, evidence and scorecard. | `api/R/monitoreo_engine.R`; `test-monitoreo-deliverables.R`. | fixed | No |
| 4 | Preflight gates | Covered internal `confirmed_full_data`, critical territorial drift, cold performance warnings, missing PDF/Sheets evidence and client PII/internal-column warnings. | `test-monitoreo-deliverables.R`: 38 pass, 0 fail. | fixed | No |
| 5 | Territorial drift | Generated a blocking drift report from the validated Sheet comparison and local ACNURCG evidence. It distinguishes 18 local suggestions not persisted from 12 UMP absent in local state. | `territorial-drift-report.csv`; `territorial-drift-report.md`. | partial | No |
| 6 | Evidence pack | Added `monitoreo_deliverables_evidence_pack()` and generated a reproducible sample pack with XLSX/PDF references and validation JSON. | `tmp/qa/monitoreo-deliverables/evidence-pack-sample/`. | fixed | No |
| 7 | Performance | Added `monitoreo_deliverables_performance_summary()` and generated a summary for ACRDCONTA advance summary, ACRDCONTA PDF metadata and Territorial XLSX hydrated timings. | `performance-summary.json`; `performance-summary.md`. | partial | No |
| 8 | ACRDCONTA guard | Added canonical preflight tests for ACRDCONTA Egresados `270 / 157 / 5 / 0 / 108`, old summary rejection and partial-not-complete mismatch. | `test-monitoreo-deliverables.R`: ACRDCONTA preflight test. | fixed | No |
| 9 | Performance repair | Removed redundant Acreditacion `case_rollup` recomputation inside `advance_summary` and `full` report builds by passing a precomputed rollup through summary, daily, source and client-sheet helpers. | `test-monitoreo-engine.R`: current 1353 pass, including 1-call `internal_queries` regression for `advance_summary` and `full`; updated `performance-summary.*`. | partial | No |
| 10 | ACRDCONTA remeasurement | Remeasured the real ACRDCONTA `.pulso` in read-only mode after the rollup repair. `advance_summary` rebuild is now `63.524s` under the 90s threshold; second session-cache call is `2.070s`; forced no-session-cache rebuild is `63.893s`. Direct full report proxy is `81.610s`; PDF endpoint was moved to attempt 11 for direct endpoint evidence. | `acrdconta-performance-remeasure.*`; `performance-summary.*`. | partial | No |
| 11 | ACRDCONTA PDF endpoint | Remeasured the product PDF endpoint path: model build, `job_save_rds()`, `job_submit()`, background PDF job runner and text validation. Total until PDF done is `65.354s` under the 120s threshold; endpoint response path is `60.772s`; render job is `4.582s`. The generated PDF has 7 pages, 249,709 bytes, and text validation for Egresados `270 / 157 / 5 / 0 / 108`, `58.1%`, `Corte y fuentes`, SurveyMonkey, base oficial and Apps Script exclusion. | `acrdconta-pdf-endpoint-remeasure/*`; `performance-summary.*`. | fixed | No |
| 12 | Territorial XLSX common cache | Added an in-memory publication cache for territorial internal model assembly so repeated route blocks, route rows, audit groups, UMP quota and valid-audit frames are reused while building the same cut. This does not persist generated deliverables or mutate `.pulso`. | `test-monitoreo-publish-qa.R`: 430 pass. ACNURCG tabs improved from `118.625s` to `84.056s`; workbook from precomputed tabs `6.786s`; total dashboard + occurrences + tabs + workbook `118.067s`; XLSX contract valid. | partial | No |
| 13 | Territorial drift evidence contract | Hardened `monitoreo_deliverables_territorial_drift_report()` so the blocking report explains why the 30 Sheet UMP subsanadas are missing, separates 12 rows absent from local state from 18 engine suggestions not persisted, records the 1 missing active tacha, declares the exact operational package required and stamps every CSV row with `critical_reference_drift`. | `test-monitoreo-deliverables.R`: 55 pass. Regenerated `territorial-drift-report.md/csv` with `missing_in_local_project=12`, `operational_suggestion_not_persisted=18`, `tachas=1`. | partial | No |
| 14 | Territorial XLSX observed-summary cache | Added `observed_summary_map` to the territorial publication cache and reused it in quota, routes and sex-age helpers with fallback-safe semantics. This does not persist generated deliverables or mutate `.pulso`. | `test-monitoreo-deliverables.R`: 65 pass; `test-monitoreo-publish-qa.R`: 430 pass; `test-monitoreo-engine.R`: current 1353 pass. ACNURCG total dashboard + occurrences + tabs + workbook improved to `50.754s` and the XLSX contract is valid. | fixed | No |
| 15 | Territorial operational package review | Added a read-only package review/template contract for the exact subsanadas/tachas package needed before safe synchronization. It validates coverage and required fields but never writes operational adjustments, tachas, generated deliverables or caches into `.pulso`. | `test-monitoreo-deliverables.R`: 85 pass. Real ACNURCG review artifact is `missing_package`, gate `critical_reference_drift`, template has 30 UMP package rows plus 1 tacha row. | partial | No |
| 16 | Territorial reference-review gate | Hardened `monitoreo_deliverables_preflight()` so territorial internal publication cannot become `ready` when no validated-reference drift review is attached. `confirmed_full_data = TRUE` is no longer enough by itself. | `test-monitoreo-deliverables.R`: 92 pass. `preflight-sample.json` is blocked only by `critical_reference_drift` with score 75; `preflight-reference-gate-sample.json` is blocked by `territorial_reference_drift_not_checked`. | fixed | No |
| 17 | Evidence pack API | Added `/api/monitoreo/publication/evidence-pack` and `apiMonitoreoPublicationEvidencePack()` so the pack is generated from the real preflight/tabs bundle, zipped and registered as a local `file_id` without publishing Sheets or mutating `.pulso`. | `test-monitoreo-deliverables.R`: 107 pass; `frontend/src/api/client.test.ts`: 217 pass. | fixed | No |
| 18 | Operational package review API | Added `/api/monitoreo/territorial/operational-package/review` and `apiMonitoreoTerritorialOperationalPackageReview()` so a completed package can be reviewed from inline rows or uploaded CSV/XLSX `file_id` before any safe apply flow. The endpoint registers template/review files and keeps `would_mutate_pulso=false`. | `test-monitoreo-deliverables.R`: package CSV upload review regression; `frontend/src/api/client.test.ts`: API/download URL regression. | fixed | No |

Current corrected status:

- `PARTIAL_SUCCESS_CONTINUE`.
- Publication must remain blocked for territorial internal reference parity
  until the exact operational packages behind the validated Sheet are available
  and applied through the safe Monitoreo adjustment flow.
- The current drift evidence now names that package explicitly: 30 validated
  UMP subsanada rows, split into 12 not reconstructable from local project state
  and 18 engine suggestions not persisted, plus 1 active tacha record. The
  internal publication gate remains `critical_reference_drift`.
- A read-only operational package review now turns that required package into a
  concrete template: 30 `ump_subsanada:*` rows plus 1 `tacha:*` row with
  validated Sheet row/range, target UMP/replacement, source cut, safe action,
  owner, reason and validation timestamp. The current real ACNURCG review is
  still `missing_package`; it does not mutate `.pulso` and it does not unblock
  publication.
- The preflight now blocks territorial internal publication when the reference
  drift review is absent. A caller may only bypass that requirement by making
  the absence of a validated reference explicit (`not_applicable` /
  `no_reference`), which keeps the ACNURCG path safely gated by the validated
  Sheet comparison.
- Performance is no longer the current measured closure blocker for the three
  tracked heavy routes. Acreditacion report builds reuse the canonical
  `case_rollup`: ACRDCONTA `advance_summary` passes the 90s cold threshold
  (`63.524s`, forced no-session-cache rebuild `63.893s`, second session-cache
  call `2.070s`) and the PDF endpoint passes the 120s threshold (`65.354s`
  total until PDF done). Territorial XLSX now passes the 90s threshold after
  the observed-summary cache: dashboard `6.631s`, occurrences `4.257s`, tabs
  `34.121s`, workbook from precomputed tabs `5.745s`, total `50.754s`, and the
  XLSX contract is valid. `performance-summary.json` is `passed` with
  `over_threshold_count = 0`.
- The goal remains partial because territorial internal publication still has
  `critical_reference_drift` against the validated Sheet and must not be marked
  ready without the exact operational package or harmless-difference evidence.

## Focused change 14 - publication preflight API/UI

Iteration 11

- Failure or bottleneck: the backend had a tested
  `monitoreo_deliverables_preflight()` contract, but Salidas still allowed the
  user to publish through the Sheets route without first seeing that contract in
  the product. This made it too easy to confuse "file generated" with "safe to
  publish".
- Focused change: added `/api/monitoreo/publication/preflight`, reused the same
  dashboard/tabs/preflight bundle inside `/api/monitoreo/publication/sheets`,
  and made the Sheets workbench run/show preflight before publication. A
  blocked preflight now stops the write with `E_MONITOREO_PREFLIGHT_BLOCKED`.
- Files changed: `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`, and
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`.
- Validation command: baseline before changes:
  `test-monitoreo-publish-qa.R` 415 pass; `test-monitoreo-deliverables.R` 38
  pass; `pnpm --dir frontend test -- src/api/client.test.ts` 214 pass;
  `pnpm --dir frontend typecheck` pass. After changes:
  `test-monitoreo-deliverables.R` 44 pass; `test-monitoreo-publish-qa.R` 415
  pass; expanded `test_dir(filter="monitoreo.*publish|monitoreo.*engine|sheets|pdf|monitoreo.*deliverables")`
  1828 pass; frontend API test 215 pass; `pnpm --dir frontend typecheck` pass;
  `pnpm --dir frontend build:fast` pass with the pre-existing circular chunk
  warning.
- Result: better. The product surface now distinguishes preflight review from
  the actual write to Sheets, and publication reuses the same preflight result
  that was reviewed.
- Better/worse/same: better for publication safety; same for territorial exact
  metric parity, which remains blocked by local `.pulso` state drift.
- Next action: add evidence-pack generation/download controls in the same
  Salidas area after deciding the exact command/API shape for local artifact
  bundles.

## Focused change 15 - telephone statuses stay operational

Iteration 12

- Failure or bottleneck: phone refusals are valid operational evidence for
  telephone monitoring, but a legacy `Rechazos` column could be misread as
  client/platform rejection when the same table also exposed
  `Rechazos telefónicos`.
- Focused change: centralized platform-refusal extraction for accreditation
  publication/PDF models. The helper now uses `Rechazos plataforma` when present,
  keeps `Rechazos telefónicos` scoped to telephone monitoring, and only falls
  back to generic `Rechazos` when there is no telephone-specific rejection
  column.
- Files changed: `api/R/monitoreo_engine.R` and
  `api/tests/testthat/test-monitoreo-publish-qa.R`.
- Validation command: baseline before changes:
  `test-monitoreo-publish-qa.R` 415 pass. Current superseding validation:
  `test-monitoreo-publish-qa.R` 430 pass; expanded
  `test_dir(filter="monitoreo.*publish|monitoreo.*engine|sheets|pdf|monitoreo.*deliverables")`
  1938 pass.
- Result: better. Client-facing `Rechazo` remains platform/no-consent only;
  telephone refusals remain visible in internal/phone monitoring blocks.
- Better/worse/same: better for rejection-source safety; same for territorial
  exact metric parity, which remains blocked by local `.pulso` state drift.

## Focused change 16 - territorial XLSX avoids duplicate tab rebuild

Iteration 13

- Failure or bottleneck: the full ACNURCG territorial workbook path could
  rebuild `monitoreo_publication_sheets_tabs()` during XLSX writing after the
  preflight/dashboard path had already computed the same internal tabs. A first
  comparable full measurement showed direct workbook generation at `139.673s`
  and total dashboard + occurrences + tabs + workbook at `327.148s`.
- Focused change: `monitoreo_publication_workbook()` now accepts precomputed
  `sheets`/tabs, writes them through the same professional row-sheet formatter,
  and does not call `monitoreo_publication_sheets_tabs()` again. The technical
  row-header detector now recognizes `row_index`, and the territorial internal
  QA contract accepts real-project technical identifiers (`_id` in `Base
  técnica`, normalized `age` in `Auditoría técnica`).
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`,
  `tmp/qa/monitoreo-deliverables/performance-summary.*`, and this QA evidence.
- Validation command: `test-monitoreo-publish-qa.R` now passes with 424
  expectations; the expanded Monitoreo filter
  `monitoreo.*publish|monitoreo.*engine|deliverables|preflight|evidence|sheets|pdf`
  passes with 1837 expectations. The regenerated ACNURCG workbook passes all
  XLSX checks: ordered tabs, hydrated sheets, minimum rows/columns, required
  sections, freeze panes, filters, styles and no missing package parts.
- Result: better. Workbook writing from precomputed tabs was `7.246s` under the
  90s XLSX write target, down from the comparable direct workbook path at
  `139.673s`. At that point, the remaining blocker was full territorial
  internal tab construction at `118.625s`, so the total path remained over
  threshold (`152.849s`) and the goal stayed partial.
- Better/worse/same: better for XLSX serialization and contract safety; same
  for territorial exact metric parity and same/partial for end-to-end
  performance because tab construction still needs a compact snapshot/cache
  repair by cut.

## Focused change 17 - territorial XLSX common publication cache

Iteration 14

- Failure or bottleneck: after avoiding duplicate XLSX tab rebuilds, the real
  ACNURCG internal tab construction still took `118.625s`, leaving the total
  dashboard + occurrences + tabs + workbook path at `152.849s`.
- Focused change: the territorial internal publication model now attaches a
  local `.publication_cache` while building one cut and reuses common route
  blocks, route rows, audit groups, UMP quota and valid response audit frames
  across the slow internal sections. The cache is process-local only and is not
  written into `.pulso`.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`,
  `tmp/qa/monitoreo-deliverables/performance-summary.*`, and this QA evidence.
- Validation command: `test-monitoreo-publish-qa.R` passes with 430
  expectations, including a cache-equivalence contract for common territorial
  tables. ACNURCG was remeasured read-only: dashboard `23.866s`, occurrences
  `3.359s`, tabs `84.056s`, workbook from precomputed tabs `6.786s`, total
  `118.067s`; generated workbook validation passes all checks. A separate
  row-vectorization attempt measured `84.093s` tabs / `120.535s` total, so it
  was not retained as product code.
- Result: better. Internal tab construction passed the individual 90s target
  and the total path was down by about `34.782s` from the prior comparable
  precomputed run. At that point, the full cold path still exceeded 90s, so the
  goal remained partial.
- Better/worse/same: better for publication-model reuse and XLSX generation
  evidence; same for territorial exact metric parity; partial for end-to-end
  performance because dashboard + occurrences + tabs + workbook still total
  `118.067s`.
- Next action: target the remaining cold path with either a compact
  model/tabs snapshot by cut or a focused dashboard/report-scope reduction,
  while preserving the same XLSX contract and without storing generated XLSX
  inside `.pulso`.

## Focused change 18 - territorial drift evidence contract

Iteration 15

- Failure or bottleneck: the generated territorial drift report correctly
  blocked publication, but it did not yet explain the operational reason strongly
  enough for a safe handoff. It counted 30 missing/subsanada rows and one tacha
  gap, but did not state the 12/18 breakdown, the package required to reconcile
  the local `.pulso`, or the exact preflight gate that must stay closed.
- Focused change: expanded `monitoreo_deliverables_territorial_drift_report()`
  to add local-state breakdown, tacha gap details, required operational-package
  metadata, per-row `evidence_status`, and per-row `publication_gate =
  critical_reference_drift`. The Markdown now has sections for local project
  diagnosis, tacha gap, exact operational package required and publish gate.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `tmp/qa/monitoreo-deliverables/territorial-drift-report.md`,
  `tmp/qa/monitoreo-deliverables/territorial-drift-report.csv`, and this QA
  evidence.
- Validation command: `test-monitoreo-deliverables.R` passes with 55
  expectations. The regenerated real ACNURCG drift artifact is `blocked` with
  30 UMP rows, breakdown `12 / 18 / 0`, one missing active tacha, and all 30 CSV
  rows stamped with `critical_reference_drift`.
- Result: better. The generator/preflight evidence now prevents a reader from
  treating local ACNURCG output as ready and states what must be obtained before
  any safe `.pulso` synchronization.
- Better/worse/same: better for publication safety and evidence quality; same
  for exact territorial parity because the operational package has not been
  applied and should not be invented from labels.
- Next action: continue with the remaining cold territorial path or implement a
  safe operational-package import/review flow before mutating `ACNURCG.pulso`.

## Focused change 19 - territorial XLSX observed-summary cache

Iteration 16

- Failure or bottleneck: after common publication caching and drift evidence,
  the real ACNURCG internal XLSX path still carried stale documentation and
  earlier timing evidence that showed total dashboard + occurrences + tabs +
  workbook at `118.067s`. The remaining measured bottleneck was repeated
  observed-summary filtering by UMP in quota, route and sex-age sections.
- Focused change: the territorial publication cache now stores an
  `observed_summary_map` by UMP/group and the internal consumers reuse that map
  with the same fallback behavior for missing groups. The cache remains
  ephemeral in memory for one publication build; no generated XLSX, large cache
  or operational state is written into `.pulso`.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `tmp/qa/monitoreo-deliverables/performance-summary.*`,
  `tmp/qa/monitoreo-deliverables/territorial-acnur-performance-remeasure-full/*`,
  and this QA evidence.
- Validation command: `test-monitoreo-deliverables.R` passes with 65
  expectations, including cache equivalence for the observed UMP summary and
  fallback behavior; `test-monitoreo-publish-qa.R` passes with 430
  expectations; `test-monitoreo-engine.R` passes with 1353 expectations.
  ACNURCG was remeasured read-only from local `.pulso` state: dashboard
  `6.631s`, occurrences `4.257s`, tabs `34.121s`, workbook from precomputed
  tabs `5.745s`, total `50.754s`; generated workbook validation passes ordered
  tabs, hydrated sheets, section labels, freeze panes, filters, styles and
  package integrity.
- Result: better. Territorial XLSX performance now passes the 90s threshold for
  the measured hydrated path, and `performance-summary.json` is `passed` with
  zero items over threshold.
- Better/worse/same: better for cold XLSX generation; same for exact
  territorial metric parity because the operational package behind the
  validated Sheet is still missing from local project state.
- Next action: keep the publication gate blocked by
  `critical_reference_drift` and continue with either a safe operational-package
  review/import flow or stronger harmless-difference proof for the 30 UMP
  subsanadas plus one active tacha gap.

## Focused change 20 - territorial operational package review contract

Iteration 17

- Failure or bottleneck: drift evidence named the missing package, but there was
  no machine-readable review contract that could say whether a supplied package
  covers the exact 30 UMP subsanadas and one active tacha before any safe
  `.pulso` synchronization.
- Focused change: added
  `monitoreo_deliverables_territorial_operational_package_review()`. The helper
  reads a package candidate, validates required fields and drift coverage,
  writes review JSON/MD/CSV plus a template CSV, and remains read-only. Even a
  `review_ready` package keeps `blocks_publication = TRUE` until the package is
  actually applied through the safe Monitoreo adjustment/tacha flow and the
  deliverable is revalidated.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `tmp/qa/monitoreo-deliverables/territorial-operational-package-review.*`,
  `tmp/qa/monitoreo-deliverables/territorial-operational-package-template.csv`,
  and this QA evidence.
- Validation command: baseline before changes: `test-monitoreo-deliverables.R`
  65 pass and `test-monitoreo-publish-qa.R` 430 pass. After changes:
  `test-monitoreo-deliverables.R` passes with 85 expectations. The generated
  real ACNURCG package review is `missing_package` with
  `publication_gate = critical_reference_drift`, `would_mutate_pulso = false`,
  30 missing UMP package rows and 1 missing tacha row.
- Result: better. The next unblocker is now an explicit package file/template
  rather than prose in the drift report.
- Better/worse/same: better for safe handoff and auditability; same for exact
  territorial metric parity because no operational package has been supplied or
  applied.
- Next action: wire this review contract into the product/API evidence-pack
  flow or obtain the completed package and apply it only through the existing
  safe operational-adjustment and tacha APIs, then regenerate parity evidence.

## Focused change 21 - territorial reference-review preflight gate

Iteration 18

- Failure or bottleneck: the preflight blocked a supplied critical drift report,
  but a territorial internal publication could still be treated as ready if the
  caller omitted drift evidence and merely set `confirmed_full_data = TRUE`.
  That left a gap between "data complete" and "validated-reference comparison
  completed".
- Focused change: `monitoreo_deliverables_preflight()` now requires explicit
  reference-drift review for `territorial` + `internal`. If the drift status is
  `not_checked`, `unchecked` or unknown, the preflight adds blocking issue
  `territorial_reference_drift_not_checked`. Projects without a validated
  reference can only pass by declaring the reference not applicable
  (`not_applicable`, `no_reference` or equivalent evidence).
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `tmp/qa/monitoreo-deliverables/preflight-sample.*`,
  `tmp/qa/monitoreo-deliverables/preflight-reference-gate-sample.*`, and this
  QA evidence.
- Validation command: baseline before changes: `test-monitoreo-deliverables.R`
  85 pass and `test-monitoreo-publish-qa.R` 430 pass. After changes:
  `test-monitoreo-deliverables.R` passes with 92 expectations. The regenerated
  ACNURCG preflight sample is `blocked`, score `75`, with
  `critical_reference_drift`, no performance warning, and
  `drift_reference_checked = true`; the separate reference-gate sample is
  `blocked` by `territorial_reference_drift_not_checked` with
  `drift_reference_checked = false`.
- Result: better. The publication gate now blocks both known critical drift and
  missing reference review, so a generated territorial internal workbook cannot
  be presented as ready without the validated Sheet comparison contract.
- Better/worse/same: better for publication safety; same for exact territorial
  parity because the operational package has not been supplied or applied.
- Next action: connect the evidence-pack/export flow to the same preflight
  result, then obtain or import the completed operational package only through
  safe Monitoreo adjustment/tacha flows.

## Focused change 22 - publication evidence pack API

Iteration 19

- Failure or bottleneck: `monitoreo_deliverables_evidence_pack()` could write a
  local sample, but the product still had no publication endpoint or API client
  that generated a reproducible evidence bundle from the exact preflight/tabs
  reviewed before a Sheets publish. That left evidence pack as a helper/roadmap
  item instead of a usable deliverable control.
- Focused change: added `/api/monitoreo/publication/evidence-pack` and
  `apiMonitoreoPublicationEvidencePack()`. The endpoint reuses
  `.monitoreo_publication_preflight_bundle()`, writes `generated.xlsx` from the
  already computed publication tabs, calls
  `monitoreo_deliverables_evidence_pack()`, zips the pack, registers it in the
  local session file store as `monitoreo_publication_evidence_pack`, and returns
  `file_id`, filename, size, tabs, full preflight and pack metadata. It does
  not publish to Google Sheets and does not mutate `.pulso`; blocked preflights
  are allowed so reviewers can download the evidence explaining why publication
  is unsafe.
- Files changed: `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and this QA evidence.
- Validation command: baseline before changes:
  `test-monitoreo-deliverables.R` 92 pass,
  `test-monitoreo-publish-qa.R` 430 pass, and
  `pnpm --dir frontend test -- src/api/client.test.ts` 216 pass. After the
  focused change, `test-monitoreo-deliverables.R` passes with 107 expectations
  and the frontend API suite passes with 217 expectations.
- Result: better. Evidence pack is now a real local publication contract and
  downloadable artifact, not only a documented helper.
- Better/worse/same: better for auditability and product readiness; same for
  exact territorial parity because ACNURCG still has critical reference drift
  until the exact 30 UMP subsanadas plus one active tacha package is supplied
  and applied through safe Monitoreo flows.
- Next action: expose the evidence-pack action in the Salidas UI and continue
  the territorial parity unblocker; do not mark the goal complete while
  `critical_reference_drift` remains.

## Focused change 23 - territorial operational package review API

Iteration 20

- Failure or bottleneck: the exact ACNURCG unblocker was known, but the product
  still lacked a safe API step for reviewing a completed 30 UMP + 1 tacha
  package before any operational-adjustment/tacha apply flow. Without that
  step, the next action risked jumping from evidence directly to mutation.
- Focused change: added
  `/api/monitoreo/territorial/operational-package/review` and
  `apiMonitoreoTerritorialOperationalPackageReview()`. The endpoint accepts
  inline package rows or an uploaded CSV/XLSX `file_id`, validates them against
  a provided/generated territorial drift contract, writes the same read-only
  JSON/MD/CSV/template artifacts as the engine helper, registers each artifact
  as a downloadable local file, and returns `would_mutate_pulso = false`.
  During implementation, the route helper also switched from R partial `$`
  matching to exact `[[...]]` reads for package/drift payload fields, preventing
  `package_file_id` from being misread as an inline `package` row.
- Files changed: `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and this QA evidence.
- Validation command: baseline before changes:
  `test-monitoreo-deliverables.R` 107 pass,
  `test-monitoreo-publish-qa.R` 430 pass, and
  `pnpm --dir frontend test -- src/api/client.test.ts` 217 pass. Focused
  post-change validation added a CSV upload/file-store review regression and a
  frontend API/download URL regression.
- Result: better. The missing package can now enter the product as evidence and
  be reviewed before application; `review_ready` remains separate from
  publication readiness.
- Better/worse/same: better for the territorial drift unblocker and mutation
  safety; same for exact parity because no completed real ACNURCG package has
  been supplied or applied yet.
- Next action: expose this review endpoint in the territorial/Salidas UI or
  obtain the completed operational package, run this review, then apply only
  through the existing safe adjustment/tacha flows and regenerate preflight.

## Focused change 24 - evidence pack control in Salidas

Iteration 21

- Failure or bottleneck: the evidence pack endpoint and API client existed, but
  the analyst still had to call it indirectly. Salidas showed preflight and
  Sheets publication, yet it did not expose the reproducible QA ZIP as a
  first-class control beside the audience-specific publication workflow.
- Focused change: added a per-audience `Paquete QA` action to
  `MonitoreoOutputsWorkbench`. The action calls
  `apiMonitoreoPublicationEvidencePack()`, reuses the active audience,
  `include_targets`, internal confirmation and local config, mirrors the
  returned preflight in the existing preflight panel, and shows a compact
  evidence panel with `ready`, `warnings`, `blocked`, `generating` or `error`
  state plus a ZIP download link when `file_id` is returned. Blocked preflight
  remains visibly blocked; the control generates audit evidence and does not
  imply publication readiness.
- Files changed: `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and this QA evidence.
- Validation command: baseline before UI change:
  `test-monitoreo-publish-qa.R` 430 pass and
  `pnpm --dir frontend typecheck` passed. After the focused change,
  `pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast`,
  `pnpm --dir frontend test -- src/api/client.test.ts`, and targeted
  `git diff --check` passed. Visual QA with real
  `ACRDCONTA.pulso` passed at `1440x1000` after `advance_summary` prefetch:
  `tmp/visual-qa/monitoreo-salidas-evidence-pack-20260629-ready/report.json`
  reports `ok=true`, zero visual issues, zero overflow, zero page/API errors
  and zero wait selector misses. A follow-up helper attempt to click
  `Paquete QA` timed out before Salidas finished hydrating between scripted
  clicks; that is recorded as a harness timing limitation, not a product
  runtime error.
- Result: better. Evidence pack is now a visible product action in Salidas,
  tied to the same audience/preflight model as Sheets publication and separated
  from the actual write to Google Sheets.
- Better/worse/same: better for auditability and reviewer handoff; same for
  exact territorial parity because ACNURCG still has critical reference drift
  until the completed operational package is reviewed, applied through safe
  flows and regenerated.
- Next action: run final frontend build/diff hygiene for this UI iteration,
  then either expose the operational package review path in the UI or obtain
  the completed real ACNURCG package to unblock the remaining drift.

## Focused change 25 - operational package review control in Salidas

Iteration 22

- Failure or bottleneck: the territorial operational-package review endpoint
  existed, but the analyst still had no in-app control to generate the required
  template/review files from the internal Salidas workflow. That left the
  ACNURCG drift unblocker discoverable only from API/tests/docs.
- Focused change: added a territorial-only, internal-only
  `Revisar paquete operacional` action to `MonitoreoOutputsWorkbench`. The
  action requires `confirmed_full_data`, calls
  `apiMonitoreoTerritorialOperationalPackageReview()` with the active cut,
  project label and config, shows `missing`, `blocked`, `ready`, `reviewing`
  or `error` state, and exposes downloads for the template, review CSV, report
  JSON and report MD. The panel explicitly remains review-only:
  `would_mutate_pulso=false` from the backend contract is preserved by having
  no apply action in this UI.
- Files changed: `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and this QA evidence.
- Validation command: baseline before UI change:
  `test-monitoreo-deliverables.R` 122 pass,
  `test-monitoreo-publish-qa.R` 430 pass, and
  `pnpm --dir frontend typecheck` passed. After the focused change,
  `pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast`,
  `pnpm --dir frontend test -- src/api/client.test.ts`,
  `test-monitoreo-deliverables.R`, `test-monitoreo-publish-qa.R`, and
  `git diff --check` passed. Visual QA with real `ACNURCG.pulso` passed at
  `1440x1000`: `tmp/visual-qa/monitoreo-territorial-operational-review-20260629/report.json`
  reports `ok=true`, zero issues, zero overflow, zero page/API/resource
  errors and zero wait selector misses. The screenshot confirms the
  `Revisar paquete operacional` control appears only in the territorial
  internal Salidas flow and is disabled until internal confirmation.
- Result: better. The exact territorial unblocker is now reachable from
  Salidas as a safe evidence/review step before any future operational
  adjustment or active-tacha application.
- Better/worse/same: better for product workflow and mutation safety; same for
  exact territorial parity because no completed real ACNURCG package has been
  supplied or applied yet.
- Next action: obtain or construct the real operational package and apply it
  only through safe Monitoreo flows before regenerating preflight.

## Focused change 26 - no-base platform refusals stay audit-only

Iteration 23

- Failure or bottleneck: the case rollup already excluded unlinked completes and
  partials from official advance, but a platform consent refusal without a valid
  official-base cross could still enter `Rechazos plataforma` in the summary,
  daily matrix and client model. That contradicted the canonical rule that the
  official base is the strict source of truth for totals.
- Focused change: changed the accreditation/telefonico case-rollup summary,
  daily and source matrices so no-base platform refusals remain as
  `Rechazos plataforma sin cruce base` audit evidence only. They no longer
  increment official `Rechazos plataforma`, `Respondidas plataforma`,
  `Sin respuesta plataforma` complements, client actor totals, daily totals or
  channel/source totals. Telephone refusals are unaffected: they remain
  `Rechazos telefónicos` in internal phone monitoring and the `telefonico` path.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-engine.R`, this QA evidence.
- Validation command: baseline before the change:
  `test-monitoreo-publish-qa.R` 430 pass. After the focused change:
  `test-monitoreo-engine.R` 1353 pass and `test-monitoreo-publish-qa.R`
  430 pass. Expanded Monitoreo deliverables filter
  `monitoreo.*publish|monitoreo.*engine|sheets|pdf|monitoreo.*deliverables`
  passed with 1938 expectations.
- Result: better. The official/client reporting surface now follows the base
  strictness rule for completes, partials and platform refusals, while internal
  QA still preserves the unlinked refusal count for investigation.
- Better/worse/same: better for canonical counts and client/internal
  consistency; same for territorial exact parity, which remains blocked by
  ACNURCG operational-state drift.
- Next action: keep the no-base refusal rule in the acceptance matrix and carry
  the remaining ACNURCG operational-package blocker into the next territorial
  parity loop.

## Focused change 27 - operational package application-readiness guard

Iteration 24

- Failure or bottleneck: the territorial operational-package review could mark
  a package as `safe_to_apply` when it covered the required Sheet rows and
  review fields, but still lacked the endpoint payload required by the safe
  Monitoreo apply flows. That was too optimistic for ACNURCG because the 30
  subsanadas must be backed by source-response movements, not copied as labels.
- Focused change: extended
  `monitoreo_deliverables_territorial_operational_package_review()` with an
  `application_plan` read-only contract. The plan checks UMP rows for
  operational-adjustment payload readiness (`source_block_id`,
  `target_block_id`, `district`, `sex`, `age_group`,
  `source_response_ids`, or equivalent JSON payload) and tacha rows for
  active-annulment payload readiness (`responsible_key`/label plus reason, or
  equivalent JSON payload). `review_ready` still means the package is complete
  enough to review; `safe_to_apply` now becomes true only when endpoint payload
  is also ready. The template CSV now includes the endpoint payload columns.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: baseline before change:
  `test-monitoreo-deliverables.R` 122 pass. After the focused change:
  `test-monitoreo-deliverables.R` 136 pass,
  `test-monitoreo-publish-qa.R` 430 pass,
  `pnpm --dir frontend typecheck` passed, and
  `pnpm --dir frontend test -- src/api/client.test.ts` passed with 218 tests.
  Additional direct empty-template smoke check passed for
  `missing_package missing_package FALSE`. `git diff --check` and a targeted
  trailing-whitespace scan over the touched files also passed. The local
  ACNURCG review/template artifacts in `tmp/qa/monitoreo-deliverables/` were
  regenerated read-only; the template header now includes the endpoint payload
  fields required by `application_plan`.
- Result: better. A package with only documentary coverage remains
  `review_ready` but blocked for apply payload; a package with response
  movement fields and tacha responsible/reason becomes
  `safe_to_apply=true` and moves to `operational_package_review_ready`.
- Better/worse/same: better for mutation safety and traceability; same for
  exact territorial parity because no completed real ACNURCG package has been
  supplied or applied yet.
- Next action: obtain the completed operational package with actual movement
  payload/response IDs for the 30 subsanadas and the P446 tacha, then apply it
  only through safe Monitoreo flows and regenerate preflight.
