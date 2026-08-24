# Monitoreo deliverables audit

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-29
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de entregables de Monitoreo](../historico/monitoreo-entregables-2026-06.md)

Date: 2026-06-29

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
- Engine/Sheets publisher result: 1359 passing expectations, 0 failures after
  the no-base platform-refusal and telephone-monitoring scope regressions.
- Current publication QA continuation:
  `test-monitoreo-publish-qa.R` passes with 515 expectations after adding the
  `telefonico` path publication regression and compact ACRDCONTA canonical
  publication fixture, including final client/internal tab checks plus compact
  client/internal XLSX artifact checks for order, hydration, required sections,
  freeze panes, filters, styles, package integrity and stale-summary exclusion.
- Latest ACRDCONTA real-contract continuation:
  `test-monitoreo-publish-qa.R` passes with 521 expectations after adding the
  internal `Seguimiento` regression that keeps `Brecha mínimo`,
  `Rechazos plataforma` and `Rechazos telefónicos` as separate internal
  concepts. The regenerated real ACRDCONTA evidence marks both client and
  internal preflights `ready`, with canonical Egresados
  `270 / 157 / 5 / 0 / 108` and client PDF text/render checks passing.
- Live disposable Google Sheets evidence:
  ACRDCONTA client and internal native Sheets were written with
  `monitoreo_sheets_publish_tabs()` and read back through Sheets metadata/cells.
  The internal publish first failed on Google Sheets' 50,000-character cell
  limit, then passed after explicit cell sanitization with an audit marker.
- Direct ACRDCONTA `.pulso` verification:
  `load_pulso("<ruta de trabajo local>")`
  plus `.monitoreo_state_payload(..., report_scope = "advance_summary")`.
  Result: Egresados `270 / 157 / 5 / 0 / 108`, `Avance universo = 0.5815`;
  cold build took about 180s.
- Direct ACRDCONTA deliverables contract:
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/acrdconta-real-deliverables-contract.json`.
  Result: client preflight `ready`, internal preflight `ready`, client and
  internal XLSX checks all true, PDF text validation true for title,
  cut/sources, Egresados counts and SurveyMonkey mention. Rendered PDF pages 1
  and 7 show the canonical counts and `Corte y fuentes`.
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
  and the `telefonico` Monitoreo path. These states are operational telephone
  states, important inside telephone monitoring by actor and exhaustive for the
  standalone telephone workflow. In the `telefonico` profile this is the path's
  main state surface, not a secondary client metric; they do not inflate client
  `Rechazo`.
  Client-facing rejection comes from platform/consent refusal
  (`Rechazos plataforma`) only when the response resolves to a valid official
  base case. No-key/no-base consent refusals remain flagged as
  `Rechazos plataforma sin cruce base` for audit, but do not count in official
  actor totals, client daily matrices or channel/source totals. The client
  daily and channel/source matrices also exclude phone-only refusals from
  `Rechazos plataforma`. The phone-path regression now also asserts that
  telephone states stay visible in `estatus_telefonico`, and that
  `Rechazos telefónicos` stays visible by day and by responsible in the
  `monitoreo_telefonico` blocks for both `acreditacion` and `telefonico`.

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
- Territorial live reference confirmation:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-live-reference-confirmation-20260629.md`
  and `.csv` confirm on 2026-06-29 that the validated Sheet still reports
  `Subsanadas = 30` and the same 12 unresolved rows remain `Subsanada`.
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
- ACRDCONTA real contract evidence:
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-cliente-real.xlsx`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-interno-real.xlsx`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-interno-real-sanitized.xlsx`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-cliente-real.pdf`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-cliente-real-page-1.png`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-cliente-real-page-7.png`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/acrdconta-real-deliverables-contract.json`,
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/acrdconta-real-deliverables-contract.md`,
  and `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/xlsx-sanitizer-validation.json`.

| Profile | Audience | Artifact | Generator | Source of truth | Data status | Format status | QA project | Status | Next repair |
|---|---|---|---|---|---|---|---|---|---|
| Acreditacion | Client | Google Sheets / XLSX tabs: `Reporte`, `Detalle del avance`, `Corte y fuentes` | `monitoreo_publication_sheets_tabs()`, `monitoreo_publication_workbook()`, `monitoreo_sheets_publish_tabs()` | ACRDCONTA `.pulso` updated from official base + SurveyMonkey; Egresados `270 / 157 / 5 / 0 / 108` | Canonical for Egresados and aligned with internal base indicators. Client `Rechazo` is platform/consent only; phone-only refusals stay out of client totals and matrices but remain in telephone monitoring | XLSX has ordered tabs, freeze, filters, styles, non-empty sheets, required sections and no missing package parts. Disposable native Sheet `https://docs.google.com/spreadsheets/d/1Qg-jUYB_yu_4cmCmd7PYamEpeJXuN-Oai4RlJWr_G5M` was written and read back with values, styled headers, frozen row, filters and conditional formats. Real ACRDCONTA client contract preflight is `ready` | `<ruta de trabajo local>` plus generator contract fixture, live Sheet readback and `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/acrdconta-real-deliverables-contract.json` | Passed publication QA, live Sheets readback and real-contract preflight | Add permanent real-project fixture or snapshot contract for ACRDCONTA counts if acceptable for CI cost. |
| Acreditacion | Internal | Google Sheets / XLSX tabs: `Resumen`, `Avance por encuesta`, `Seguimiento`, `Alertas`, `Corte y fuentes` | `monitoreo_publication_sheets_tabs()`, `monitoreo_publication_workbook()`, `monitoreo_sheets_publish_tabs()` | Same canonical case rollup; internal keeps channels, collector/responsible fields and traceability, including telephone-specific operational states | Canonical counts pass; collector type preserved through case rollup. Telephone states remain first-class internal/phone-path evidence, and internal `Seguimiento` keeps `Rechazos plataforma` separate from `Rechazos telefónicos` | XLSX hydration contract passes. Disposable native Sheet `https://docs.google.com/spreadsheets/d/1cwUUhxr1qop0QL3TCpg87IyXOxb8oStJjjhc3vcLBLQ` was written and read back: `Resumen` 51x12, `Avance por encuesta` 213x11, `Seguimiento` 1058x108, `Alertas` 508x27, `Corte y fuentes` 23x7; every tab has frozen row, filter, conditional formats and owner metadata. Real ACRDCONTA internal XLSX now has `Seguimiento` 1086x110 with `Brecha mínimo`, `Rechazos plataforma`, `Rechazos telefónicos` and `Egresados`; preflight is `ready`. Long Google and Excel cells are explicitly truncated with marker; the sanitized real XLSX writes with 0 `openxlsx` warnings, 170 explicit markers, max visible cell length 21,132 and max XML-encoded length 32,702 | ACRDCONTA `.pulso` plus publication fixture, live Sheet readback, real-contract evidence and `xlsx-sanitizer-validation.json` | Passed publication QA, live Sheets readback and real-contract preflight | Optional: add a sidecar trace export if reviewers need the complete long JSON traces outside `internal-publication-model.json`. |
| Territorial | Internal | Google Sheets / XLSX internal workbook: `Portada`, `Resumen territorial`, `Ritmo diario`, `Tabla maestra`, `Manzanas y responsables`, `Responsables y rutas`, `Cuotas sexo y edad`, `Validación de tiempos`, `GPS y territorio`, `Ocurrencias de campo`, `Base técnica`, `Auditoría técnica`, `Casos accionables`, `Anulaciones` | `monitoreo_publication_sheets_tabs()`, territorial publication helpers, `monitoreo_publication_workbook()` | Validated Sheet `Monitoreo de campo` with 14 tabs and frozen header rows | Generator now uses the same tab order and row/section contract for territorial internal XLSX as the validated Sheet. Real ACNURCG occurrences hydrate and match reference occurrence totals `84 / 5112 / 669 / 4443`; exact advance/anulaciones parity is blocked because local `ACNURCG.pulso` has 1 persisted tacha and 0 persisted UMP subsanadas while the validated Sheet has 2 tachas and 30 UMP subsanadas. P446 is reconstructable in memory; the 30 subsanadas are not fully reconstructable from current local packages because only 18/30 Sheet rows match engine suggestions | XLSX has 14 sheets in validated order, freeze in every expected sheet, required filters by sheet contract, professional section blocks, required sections by tab, minimum rows/columns and no missing package parts | `<ruta de trabajo local> ACNUR/ACNURCG.pulso` plus live Sheet metadata/ranges | Passed generator QA; reference metric parity blocked by local project state drift | Save/update the `.pulso` only with the exact operational packages that produced the validated Sheet before asserting exact metric parity. |
| Territorial | Client | PDF / advance export | `monitoreo_territorial_advance_report_pdf()` through `/api/monitoreo/client-report/pdf` | Territorial dashboard model and client Sheets district rows from the same publication model | Fixture PDF now matches client Sheets observed survey counts: total `22` and district counts `6 / 9 / 7`; real ACNURCG PDF remains consistent with local model, not with the newer validated Sheet state | Rendered 2 A4-landscape pages; title, cut, source footer, map and district cards render without overlap and no internal traces | Publication fixture plus `<ruta de trabajo local> ACNUR/ACNURCG.pulso` | Passed publication QA and local render QA; reference parity blocked by local project state drift | Re-render after the `.pulso` is updated to the validated Sheet state. |
| Acreditacion | Client | PDF ejecutivo | `monitoreo_acreditacion_client_report_pdf()` through `/api/monitoreo/client-report/pdf` | ACRDCONTA canonical client report model | Canonical and consistent with XLSX/Sheets; Egresados `270 / 157 / 5 / 0 / 108` and `58.1%` | Rendered 7 A4 pages; page 7 declares `Corte y fuentes`, `Fuente de verdad`, SurveyMonkey sources, base official rule and Apps Script exclusion | `<ruta de trabajo local>` | Passed PDF QA | Optimize model build time before repeated operational use; PDF drawing is fast but model preparation is slow. |

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
  focused engine/Sheets publisher validation now passes with 1359 expectations;
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
| 9 | Performance repair | Removed redundant Acreditacion `case_rollup` recomputation inside `advance_summary` and `full` report builds by passing a precomputed rollup through summary, daily, source and client-sheet helpers. | `test-monitoreo-engine.R`: current 1359 pass, including 1-call `internal_queries` regression for `advance_summary` and `full`; updated `performance-summary.*`. | partial | No |
| 10 | ACRDCONTA remeasurement | Remeasured the real ACRDCONTA `.pulso` in read-only mode after the rollup repair. `advance_summary` rebuild is now `63.524s` under the 90s threshold; second session-cache call is `2.070s`; forced no-session-cache rebuild is `63.893s`. Direct full report proxy is `81.610s`; PDF endpoint was moved to attempt 11 for direct endpoint evidence. | `acrdconta-performance-remeasure.*`; `performance-summary.*`. | partial | No |
| 11 | ACRDCONTA PDF endpoint | Remeasured the product PDF endpoint path: model build, `job_save_rds()`, `job_submit()`, background PDF job runner and text validation. Total until PDF done is `65.354s` under the 120s threshold; endpoint response path is `60.772s`; render job is `4.582s`. The generated PDF has 7 pages, 249,709 bytes, and text validation for Egresados `270 / 157 / 5 / 0 / 108`, `58.1%`, `Corte y fuentes`, SurveyMonkey, base oficial and Apps Script exclusion. | `acrdconta-pdf-endpoint-remeasure/*`; `performance-summary.*`. | fixed | No |
| 12 | Territorial XLSX common cache | Added an in-memory publication cache for territorial internal model assembly so repeated route blocks, route rows, audit groups, UMP quota and valid-audit frames are reused while building the same cut. This does not persist generated deliverables or mutate `.pulso`. | `test-monitoreo-publish-qa.R`: 430 pass. ACNURCG tabs improved from `118.625s` to `84.056s`; workbook from precomputed tabs `6.786s`; total dashboard + occurrences + tabs + workbook `118.067s`; XLSX contract valid. | partial | No |
| 13 | Territorial drift evidence contract | Hardened `monitoreo_deliverables_territorial_drift_report()` so the blocking report explains why the 30 Sheet UMP subsanadas are missing, separates 12 rows absent from local state from 18 engine suggestions not persisted, records the 1 missing active tacha, declares the exact operational package required and stamps every CSV row with `critical_reference_drift`. | `test-monitoreo-deliverables.R`: 55 pass. Regenerated `territorial-drift-report.md/csv` with `missing_in_local_project=12`, `operational_suggestion_not_persisted=18`, `tachas=1`. | partial | No |
| 14 | Territorial XLSX observed-summary cache | Added `observed_summary_map` to the territorial publication cache and reused it in quota, routes and sex-age helpers with fallback-safe semantics. This does not persist generated deliverables or mutate `.pulso`. | `test-monitoreo-deliverables.R`: 65 pass; `test-monitoreo-publish-qa.R`: 430 pass; `test-monitoreo-engine.R`: current 1359 pass. ACNURCG total dashboard + occurrences + tabs + workbook improved to `50.754s` and the XLSX contract is valid. | fixed | No |
| 15 | Territorial operational package review | Added a read-only package review/template contract for the exact subsanadas/tachas package needed before safe synchronization. It validates coverage and required fields but never writes operational adjustments, tachas, generated deliverables or caches into `.pulso`. | `test-monitoreo-deliverables.R`: 85 pass. Current real ACNURCG review artifact is `blocked`, gate `critical_reference_drift`, with 19 endpoint-ready candidate rows, 12 missing UMP movement rows, and the full 30 UMP + 1 tacha template. | partial | No |
| 16 | Territorial reference-review gate | Hardened `monitoreo_deliverables_preflight()` so territorial internal publication cannot become `ready` when no validated-reference drift review is attached. `confirmed_full_data = TRUE` is no longer enough by itself. | `test-monitoreo-deliverables.R`: 92 pass. Current `preflight-sample.json` is blocked by `critical_reference_drift` plus `territorial_operational_package_not_ready` with score 50; `preflight-reference-gate-sample.json` is blocked by `territorial_reference_drift_not_checked`. | fixed | No |
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
  expectations; `test-monitoreo-engine.R` now passes with 1359 expectations.
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
  ACNURCG preflight sample is now superseded by the operational-package gate:
  the current sample is `blocked`, score `50`, with
  `critical_reference_drift`, `territorial_operational_package_not_ready`, and
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
  Salidas now reads `application_plan` too, so a package that is reviewable but
  missing apply payload appears as blocked instead of visually ready.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  this QA evidence,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: baseline before change:
  `test-monitoreo-deliverables.R` 122 pass. After the focused change:
  `test-monitoreo-deliverables.R` 136 pass,
  `test-monitoreo-publish-qa.R` 430 pass,
  `pnpm --dir frontend typecheck` passed, and
  `pnpm --dir frontend test -- src/api/client.test.ts` passed with 218 tests.
  Follow-up UI regression:
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 2 tests, proving `review_ready` plus missing apply payload renders
  as blocked and payload-complete packages remain ready.
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

## Focused change 28 - ACNURCG partial operational package split

Iteration 25

- Failure or bottleneck: the ACNURCG territorial review still treated the
  entire operational package as absent, even though current local state can
  reconstruct part of the validated Sheet drift. That hid the distinction
  between endpoint-ready evidence and the remaining unreconstructable UMP rows.
- Focused change: loaded `ACNURCG.pulso` read-only, regenerated full local
  operational suggestions, matched them against the validated Sheet subsanadas,
  and produced a partial package candidate. The candidate contains 18 UMP
  subsanadas with full movement payload from the Monitoreo engine plus the
  reconstructable P446 tacha payload. The 12 unmatched UMP rows were written to
  a separate missing-rows artifact so they cannot be mistaken for label-only
  package coverage.
- Files changed: this QA evidence and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`. Generated read-only
  artifacts under `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/`
  and regenerated root
  `tmp/qa/monitoreo-deliverables/territorial-operational-package-review.*`.
- Validation command: read-only extraction from `ACNURCG.pulso` through
  `.monitoreo_state_payload(..., report_scope = "advance_summary")` produced 23
  full suggestions in 5.659s. The package review reports `status=blocked`,
  `publication_gate=critical_reference_drift`, `safe_to_apply=false`,
  `ready_rows=19`, `blocked_rows=0`, `missing_umps=12`,
  `missing_tachas=0`. A direct JSON contract assertion passed with
  `package_contract_ok`; `test-monitoreo-deliverables.R` passed with 145
  expectations, including the regression for endpoint-ready partial coverage
  that must remain blocked until missing UMP rows are supplied;
  `git diff --check` passed.
- Result: better. The missing tacha is now explainable and endpoint-ready in
  the package review, and 18/30 subsanadas have concrete source-response
  movement payload. Publication remains blocked because coverage is incomplete.
- Better/worse/same: better for handoff precision and safe-apply readiness;
  same for exact territorial parity and publication status.
- Next action: obtain or reconstruct the 12 missing UMP movement packages
  (`UMP 101`, `UMP 112`, `R 116`, `UMP 117`, `UMP 121`, `UMP 122`,
  `R 134`, `UMP 147`, `UMP 150`, `UMP 23`, `UMP 73`, `UMP 83`) before any
  whole-package apply or ready-to-publish claim.

## Focused change 29 - missing UMP diagnostic classification

Iteration 26

- Failure or bottleneck: after the partial package split, the remaining 12
  ACNURCG UMP rows were still a flat missing list. That was insufficient to
  decide whether they were absent, contradicted by local state, or merely
  waiting for endpoint payload.
- Focused change: cross-checked the 12 missing rows against the hydrated local
  territorial workbook tabs and operational suggestions before/after P446. The
  new diagnostic artifact classifies each row without mutating `.pulso` and
  explicitly marks the evidence as non-applicable payload. A follow-up Google
  Drive connector read checked the same 12 rows in the live validated
  `Cuotas sexo y edad` tab and added reference-vs-local status/count deltas.
- Files changed: this QA evidence,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`. Generated read-only
  artifacts:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-operational-package-missing-diagnostics.csv`,
  `.json`, and `.md`.
- Validation command: diagnostic generation read the current hydrated tabs and
  suggestion files and produced 12/12 rows. Classification counts:
  7 local surplus sources still donate after P446, 1 local surplus source is
  removed by P446, 2 local UMP are complete without target payload, 1
  replacement is not started, and 1 replacement/pending row has no movement
  payload. Live connector read: all 12 rows are `Subsanada` in the validated
  Sheet; 7 rows have the same count but status differs locally, and 5 rows have
  count or responsible differences. `missing_diagnostics_contract_ok` passed,
  `test-monitoreo-deliverables.R` passed with 145 expectations, and
  `git diff --check` passed.
- Result: better. The remaining blocker is now a concrete cut/package conflict:
  current local state often treats Sheet-subsanada UMP as complete surplus
  donors, so generating label-only subsanadas would be wrong.
- Better/worse/same: better for evidence strength and reviewer handoff; same
  for publication status (`critical_reference_drift` remains blocking).
- Next action: obtain the validated operational movement package for those 12
  rows from the source/cut that produced the Sheet, or provide the exact
  `.pulso` from that cut; then rerun package review before any apply.

## Focused change 30 - telephone states remain operational, not client rejections

Iteration 27

- Failure or bottleneck: the canonical rejection split was already protected on
  the client side, but the complementary rule was not explicit enough in the
  regression suite: telephone states are not disposable technical columns.
  They are the operational state surface for Acreditacion telephone channels by
  actor and the main evidence surface for the `telefonico` Monitoreo path.
- Focused change: strengthened the existing `phone_summary` regression so a
  telephone refusal stays visible in `estatus_telefonico`, daily
  `Rechazos telefónicos`, and responsible-level `Rechazos telefónicos`. The
  same fixture is now also exercised with `family = "telefonico"` to prove that
  the path preserves phone monitoring as first-class output.
- Files changed: `api/tests/testthat/test-monitoreo-engine.R` and this QA
  evidence.
- Validation command: baseline `test-monitoreo-engine.R` passed with 1353
  expectations before the test hardening. After the focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-engine.R")'`
  passed with 1359 expectations and 0 failures. The earlier attempted
  `test_file(..., filter=...)` command failed because this installed
  `testthat` API does not accept `filter` on `test_file`; it did not run the
  tests and was replaced by the full file command.
- Result: better. Client-facing reports still exclude phone-only refusals from
  platform rejection buckets, while internal Acreditacion phone monitoring and
  the `telefonico` path keep status distributions, daily refusal counts and
  responsible-level refusal counts hydrated and test-covered.
- Better/worse/same: better for regression coverage and documentation; same for
  territorial exact parity, which remains blocked by the ACNURCG operational
  package conflict.
- Next action: continue with visual/data parity for Acreditacion `Telefono/Dia`
  and `Telefono/Alertas`, then click-test source/collector saves on a
  disposable `.pulso` fixture.

## Focused change 31 - telephone path publication contract

Iteration 28

- Failure or bottleneck: phone-only states were already separated from client
  rejection buckets, and engine tests covered the lightweight `phone_summary`
  payload. The publication layer still lacked a direct regression for the
  `telefonico` path itself: internal/phone monitoring must retain
  `estatus_telefonico` and `Rechazos telefónicos`, while client publication
  models must not expose `monitoreo_telefonico` or telephone rejection columns.
- Focused change: added a publication QA fixture with `family = "telefonico"`.
  It verifies the `monitoreo_telefonico` sheet contains `Efectivo`,
  `No contesta` and `Rechazo`, keeps `Rechazos telefónicos` in the phone daily
  blocks, includes phone monitoring in the internal workbook model, and keeps
  the client workbook model free of `monitoreo_telefonico` and
  `Rechazos telefónicos`.
- Files changed: `api/tests/testthat/test-monitoreo-publish-qa.R`,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_audit.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed before the change with 430 expectations and 0 failures, and after the
  change with 437 expectations and 0 failures.
- Result: better. The rule is now protected at both the engine/report-scope
  level and the publication/workbook model level: phone states are operational
  evidence for telephone monitoring, not official/client rejection totals.
- Better/worse/same: better for Acreditacion/Telefonico deliverable safety;
  same for ACRDCONTA canonical counts and same for territorial exact parity,
  which remains blocked by the ACNURCG operational package conflict.
- Next action: continue section-by-section visual/data QA for Acreditacion
  telephone tabs and keep the remaining territorial blocker scoped to the 12
  missing UMP movement packages.

## Focused change 32 - compact ACRDCONTA canonical publication fixture

Iteration 29

- Failure or bottleneck: ACRDCONTA real-project evidence and preflight guards
  already protected Egresados `270 / 157 / 5 / 0 / 108`, but the regular
  publication suite did not yet have a compact generator-level fixture for that
  exact contract. The roadmap still listed this as a CI gap because reopening
  the full ACRDCONTA `.pulso` is too expensive for every normal test run.
- Focused change: added a compact ACRDCONTA-style fixture to
  `test-monitoreo-publish-qa.R`. It builds 270 official Egresados records,
  157 canonical completions, 5 partials, the nine documented auxiliary bridge
  pairs, duplicate response channels by operational code/email, and no-base
  completed/partial/rejection responses. The test validates the canonical
  client report model, both client/internal publication actor rows, and the
  final client tabs `Reporte`, `Detalle del avance`, and `Corte y fuentes`.
  A follow-up extension now checks final internal tabs `Resumen`,
  `Avance por encuesta`, `Seguimiento`, `Alertas`, and `Corte y fuentes`.
- Files changed: `api/tests/testthat/test-monitoreo-publish-qa.R`,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`.
  The first run exposed a test-expectation mismatch: the compact client
  publication path labels the effective column as `Efectivas`, while another
  client sheet path labels it `Completas`. The expectation was corrected to use
  the actual effective column without relaxing any counts. A follow-up extension
  added visible-tab checks for executive text, rhythm rows and source rows. The
  final run passed with 485 expectations and 0 failures.
- Result: better. ACRDCONTA canonical counts are now guarded in normal
  publication QA without needing the heavy `.pulso`: client/internal generated
  rows stay at Universo `270`, Efectivas/Completas `157`, Parciales `5`,
  Rechazo `0`, Sin respuesta/Pendientes `108`, and `58.1%` advance despite
  duplicate channels and no-base responses. The client tabs also show
  `157 de 270 respuestas esperadas (58.1%)`, `RITMO GENERAL`,
  `FUENTES DEL CORTE`, `BBDD oficial - Egresados`,
  `SurveyMonkey - Egresados - Web`,
  `SurveyMonkey - Egresados - Telefonico`, and
  `SurveyMonkey - Egresados - Correo`; the internal tabs show the same
  canonical progress, internal view labels, rhythm by actor and cut-source
  fields in the internal audience contract.
- Better/worse/same: better for CI-grade canonical count coverage and
  Apps Script independence; same for real ACRDCONTA live Sheet/PDF evidence,
  which was already green; same for territorial exact parity, still blocked by
  ACNURCG operational package drift.
- Next action: if historical cut-to-cut reproducibility becomes necessary, add
  a persisted compact cut snapshot. For now, keep the synthetic fixture green
  and continue the remaining territorial package unblocker.

## Focused change 33 - territorial preflight operational-package gate

Iteration 30

- Failure or bottleneck: ACNURCG territorial internal preflight could expose
  `critical_reference_drift`, but it did not separately explain whether the
  required operational package was missing, partial, endpoint-ready but not
  applied, or fully revalidated. That made the publication blocker less
  actionable after the 18/30 UMP + P446 partial package was generated.
- Focused change: `monitoreo_deliverables_preflight()` now accepts an
  `operational_package_review` contract. For `territorial` + `internal` with
  blocking drift, the preflight adds a distinct blocking issue when the review
  is missing (`territorial_operational_package_review_missing`), partial or not
  endpoint-ready (`territorial_operational_package_not_ready`), or reviewed but
  still not applied/revalidated (`territorial_operational_package_not_applied`).
  The publication bundle passes `operational_package_review` through from API
  requests, and the evidence list carries the review when present.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  this QA evidence, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`. Regenerated
  `tmp/qa/monitoreo-deliverables/preflight-sample.*` and
  `tmp/qa/monitoreo-deliverables/evidence-pack-sample/`.
- Validation command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 152 expectations and 0 failures. Baseline
  `test-monitoreo-publish-qa.R` passed with 430 expectations before this
  focused change.
- Result: better. The ACNURCG sample preflight is now `blocked`, score `50`,
  with `critical_reference_drift` plus
  `territorial_operational_package_not_ready`; it records
  `missing_ump_items=12`, `missing_tachas=0`, `ready_rows=19`,
  `blocked_rows=0`, and `safe_to_apply=false`.
- Better/worse/same: better for publication safety and reviewer handoff; same
  for exact territorial parity because the remaining 12 UMP movement packages
  still do not exist in current local evidence.
- Next action: obtain the validated movement package for those 12 UMP rows, or
  the exact `.pulso` from the validated cut, then rerun review/preflight before
  any safe apply flow.

## Focused change 34 - missing UMP live audit-row probe

Iteration 31

- Failure or bottleneck: the remaining 12 ACNURCG UMP rows were classified
  against local state and the validated `Cuotas sexo y edad` tab, but the
  handoff still lacked a direct read-only probe against `Auditoría técnica`.
  Without that, a reviewer could not tell whether the reference Sheet lacked
  response-level rows or whether it had rows that still were not sufficient for
  an endpoint-ready movement package.
- Focused change: read the live Google Sheet metadata for `Monitoreo de campo`
  and queried only `Auditoría técnica!BM1:BM2414` for the 12 missing UMP
  numbers. Wrote a read-only CSV/JSON/MD probe that records exact row numbers,
  false positives for the `23` query, reference-vs-audit row-count relation,
  local diagnostic classification, and whether the rows can reconstruct an
  endpoint payload.
- Files changed:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-missing-ump-reference-audit-probe.csv`,
  `.json`, `.md`, this QA evidence, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: live connector reads were bounded to one column
  (`BM1:BM2414`, 2,414 cells) after metadata confirmed the exact tab
  (`Auditoría técnica`, `sheetId=79188828`). Structural artifact validation
  and `git diff --check` are recorded with this iteration.
- Result: better. All 12 remaining UMP rows have visible audit rows in the
  validated reference, but only 7 match the `validas` count exactly; 2 are
  fewer (`R 116`, `R 134`) and 3 are more (`UMP 117`, `UMP 147`, `UMP 83`).
  The probe confirms the blocker is no longer "maybe no reference rows"; it is
  "reference rows exist but do not encode source-response movement intent".
- Better/worse/same: better for drift diagnosis and reviewer handoff; same for
  exact territorial parity, safe apply readiness, and publication status.
- Next action: obtain the exact validated source-response movement payload, or
  the exact `.pulso` from the validated cut. Do not infer movement packages
  from `Auditoría técnica` row counts alone.

## Focused change 35 - operational review accepts reference audit probe

Iteration 32

- Failure or bottleneck: the live audit-row probe existed as QA evidence, but
  the product review contract could not receive it. That left a subtle gap:
  the Salidas/API review could say a package was missing while the newest
  evidence explaining "reference rows exist but are diagnostic only" lived
  outside the returned review JSON/MD.
- Focused change: `monitoreo_deliverables_territorial_operational_package_review()`
  now accepts `reference_audit_probe` and normalizes it into
  `monitoreo_deliverables_territorial_reference_audit_probe_v1`. The review
  JSON and Markdown include row count matches/fewer/more, rows with live audit
  rows, and whether audit rows can reconstruct endpoint payload. The router
  forwards `reference_audit_probe`, `referenceAuditProbe`, `audit_probe` or
  `auditProbe` from review requests.
- Files changed: `api/R/monitoreo_engine.R`, `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: baseline before product edits:
  `test-monitoreo-deliverables.R` passed with 152 expectations and
  `test-monitoreo-publish-qa.R` passed with 485 expectations. After the change,
  `test-monitoreo-deliverables.R` passed with 161 expectations.
- Result: better. The review can now carry the ACNURCG audit-row probe as
  first-class evidence while preserving the guardrail: audit-row presence is
  `diagnostic_only` and "must not be applied as an operational package" unless
  it explicitly carries endpoint-ready movement payload.
- Better/worse/same: better for reproducible handoff and API evidence; same
  for territorial exact parity, because the remaining 12 UMP source-response
  movement packages still do not exist.
- Next action: when the validated movement payload is supplied, run the review
  with both package rows and the probe, then rerun preflight and reference
  comparison before any safe apply flow.

## Focused change 36 - compact ACRDCONTA XLSX artifact contract

Iteration 33

- Failure or bottleneck: the compact ACRDCONTA fixture protected canonical
  counts and final tab text, but it still stopped before the real XLSX artifact.
  A workbook could therefore open with the right counts while compact internal
  `Seguimiento` or `Alertas` degraded into one-column empty-state sheets that
  were not professionally filterable or section-complete.
- Focused change: the compact ACRDCONTA fixture now writes client and internal
  XLSX artifacts from the final publication tabs. It validates sheet order,
  hydrated rows/columns, required sections, freeze panes, filters, styles,
  package integrity, the visible `157 de 270 respuestas esperadas (58.1%)`
  text, and absence of the stale `145 de 270` summary. The engine now preserves
  contractual internal columns for sparse cuts and emits structured empty-state
  rows for seguimiento operativo, seguimiento telefonico, casos accionables,
  canales/fuentes and alertas.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_audit.md`,
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`.
  The first artifact run exposed compact internal workbook failures in
  `sheet_min_cols`, `required_sections` and `has_filter`; after structured
  empty-state rows and preserving `Mínimo esperado` for `avance_general`, the
  final run passed with 515 expectations and 0 failures.
- Result: better. ACRDCONTA compact QA now proves not only that client/internal
  tabs have the right canonical data, but that the generated XLSX artifacts are
  hydrated, professional and safe against the old Apps Script summary.
- Better/worse/same: better for Acreditacion client/internal XLSX safety and
  report-generator regression coverage; same for telephone semantics, now
  documented as operational/path-specific evidence; same for territorial exact
  parity, still blocked by the 12 ACNURCG UMP movement packages.
- Next action: keep this compact artifact contract green while the remaining
  closeout focuses on the territorial operational package needed to match the
  validated internal Sheet exactly.

## Focused change 37 - compact ACRDCONTA internal workbook keeps contract columns

Iteration 34

- Failure or bottleneck: after the audit-probe contract change, the compact
  ACRDCONTA publication fixture exposed a real XLSX contract gap in the
  internal audience. Sheets with no live channel/tracking rows could collapse
  required empty-but-contractual columns such as `Canal operativo`,
  `Responsable de carga`, `Mínimo esperado` and `Brecha mínimo`, causing the
  professional workbook validator to fail required-section checks even though
  the underlying canonical counts were correct.
- Focused change: the Acreditacion workbook row builder now preserves those
  empty contractual columns for channel, minimum/progress and tracking
  sections, and emits structured empty-state rows for channel, tracking,
  phone, cases and alerts instead of a one-column placeholder. This keeps the
  internal workbook auditable for sparse cuts without relaxing the validator.
- Files changed: `api/R/monitoreo_engine.R`, this QA evidence and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the repair,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 515 expectations and 0 failures. The deliverables regression
  suite also passed:
  `test-monitoreo-deliverables.R` with 161 expectations and 0 failures.
  `git diff --check` passed before the documentation update.
- Result: better. Compact ACRDCONTA internal XLSX validation now passes
  `required_sections`, `sheet_min_cols`, `has_filter`, `has_freeze`,
  `hydrated_sheets` and `no_missing_parts` without fabricating progress data.
- Better/worse/same: better for professional internal XLSX robustness and
  sparse-cut reproducibility; same for canonical ACRDCONTA counts, which remain
  `270 / 157 / 5 / 0 / 108`; same for territorial exact parity, still blocked
  by the missing 12 UMP movement packages.
- Next action: continue the territorial unblocker with a complete validated
  operational package. Do not treat compact-workbook validation as evidence
  that ACNURCG publication is ready.

## Focused change 38 - reference audit probe participates in publication gate

Iteration 35

- Failure or bottleneck: the territorial operational-package review preserved
  `reference_audit_probe` evidence, but `blocks_publication` still depended
  only on the drift object. That left an edge case where a caller could attach
  a probe that explicitly blocks publication and, if the drift payload was
  marked non-blocking, the review-level publication flag would not reflect the
  probe.
- Focused change: the review now computes `review_blocking` from both
  validated-reference drift and `reference_audit_probe$blocks_publication`.
  The Markdown report prints `Probe blocks publication: yes/no`, and a
  regression proves that even a `payload_reconstructible` probe with
  endpoint-ready package rows moves only to `operational_package_review_ready`,
  not `ready`. Publication still requires applying through safe Monitoreo
  flows and regenerating/revalidating the report.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: baseline before this focused change,
  `test-monitoreo-deliverables.R` passed with 161 expectations. After the
  focused change, the same suite passed with 167 expectations and 0 failures.
- Result: better. Diagnostic/audit evidence can no longer be separated from
  the review gate when it explicitly marks itself blocking, but it also cannot
  short-circuit the apply/revalidate requirement.
- Better/worse/same: better for publication safety and handoff semantics; same
  for ACNURCG exact parity, because the 12 missing UMP movement packages still
  do not exist in current evidence.
- Next action: obtain the completed validated movement package or exact
  validated-cut `.pulso`, then apply only through safe Monitoreo operational
  flows and rerun drift/preflight/reference comparison.

## Focused change 39 - Salidas separates applicable package from publish-ready

Iteration 36

- Failure or bottleneck: the Salidas workbench exposed the operational package
  review as a UI status, but a `review_ready` package with `safe_to_apply=true`
  could render as `ready` even when `blocks_publication=true`. The message said
  publication remained blocked, but the green state risked conflating
  endpoint-apply readiness with publication readiness.
- Focused change: `MonitoreoOutputsWorkbench` now uses a distinct
  `applicable` status for packages whose endpoint payload is complete but still
  require safe application and revalidation before publication. `ready` is
  reserved for packages that no longer block publication. The operational
  status card uses an amber treatment for `applicable`, and the detail text now
  says `payload aplicable; falta aplicar/revalidar` instead of
  `payload aplicable listo`.
- Files changed:
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: baseline backend before this UI repair,
  `test-monitoreo-deliverables.R` passed with 167 expectations. Baseline
  frontend workbench test passed with 3 tests. After the repair,
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 4 tests and 0 failures.
- Result: better. Salidas now makes the same distinction as the backend review:
  "safe to apply through endpoints" is not the same as "publish-ready".
- Better/worse/same: better for operator safety and visual semantics; same for
  ACNURCG exact parity, because the 12 missing UMP movement packages still do
  not exist in current evidence.
- Next action: once the complete package exists, apply it through safe
  Monitoreo flows, regenerate the territorial internal report, and confirm the
  UI moves from `applicable`/blocked to true publish-ready only after
  revalidation.

## Focused change 40 - territorial live reference blocker confirmation

Iteration 37

- Failure or bottleneck: the territorial blocker was documented from prior
  local diagnostics and a bounded audit-row probe, but the validated Google
  Sheet is an external live reference and can change. Before claiming the gate
  was still current, the exact unresolved `Cuotas sexo y edad` rows needed a
  fresh read-only confirmation.
- Focused change: re-read spreadsheet metadata for `Monitoreo de campo`, then
  read only `Cuotas sexo y edad!A1:AB16` and the exact rows for the 12 unresolved
  UMP package items. Wrote a compact local CSV/MD confirmation with row number,
  district, UMP/replacement id, titular, manzana, responsible, efectivas,
  avance, `Estado cuota`, latest ingress and local payload status.
- Files changed:
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-live-reference-confirmation-20260629.csv`,
  `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-live-reference-confirmation-20260629.md`,
  this QA evidence,
  `docs/qa/monitoreo/monitoreo_deliverables_acceptance_audit.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: Google Sheets connector metadata confirmed the validated
  spreadsheet still has 14 tabs; `Cuotas sexo y edad` has 1292 rows, 28 columns
  and frozen header row. The exact-row read confirms the tab still reports
  `Subsanadas = 30` and all 12 unresolved rows remain `Subsanada`. Local
  validation for this docs/evidence-only change is `git diff --check`.
- Result: better. The blocker is no longer relying on stale reference evidence:
  as of 2026-06-29, the Sheet still requires those 12 subsanada states, while
  local Prosecnur still lacks source-response movement payload to apply them
  safely.
- Better/worse/same: better for current reference confidence and reviewer
  handoff; same for exact territorial parity, because visible Sheet rows still
  do not encode endpoint-ready movement payload.
- Next action: obtain the completed validated movement package or exact
  validated-cut `.pulso`; do not publish territorial internal as ready from row
  labels alone.

## Focused change 41 - operational review exposes explicit publication readiness

Iteration 38

- Failure or bottleneck: backend, preflight and Salidas all distinguished
  endpoint-apply readiness from publication readiness, but the review payload
  still exposed that distinction indirectly through `safe_to_apply`,
  `blocks_publication` and `publication_gate`. That made downstream callers
  infer whether a package was merely applicable or actually publishable.
- Focused change: `monitoreo_deliverables_territorial_operational_package_review()`
  now returns explicit `apply_ready`, `requires_revalidation` and
  `publication_ready` flags. The router passes those flags through, preflight
  uses `publication_ready` as the package check, and Salidas treats
  `publication_ready=false` as binding even when endpoint payload exists. The
  Markdown review also prints the three readiness states.
- Files changed: `api/R/monitoreo_engine.R`, `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: baseline before the focused change,
  `test-monitoreo-deliverables.R` passed with 167 expectations and
  `MonitoreoOutputsWorkbench.test.ts` passed with 4 tests. After the focused
  change, `test-monitoreo-deliverables.R` passed with 192 expectations and
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 4 tests.
- Result: better. A complete endpoint-ready package now serializes as
  `apply_ready=true`, `requires_revalidation=true`,
  `publication_ready=false` while reference drift or audit-probe blockers
  remain unresolved. Only an already applied/revalidated package with
  `publication_gate=ready` serializes `publication_ready=true`.
- Better/worse/same: better for product safety and future automation; same for
  exact ACNURCG parity because 12 UMP movement packages still lack safe
  source-response payload.
- Next action: obtain the completed validated movement package or exact
  validated-cut `.pulso`, apply through safe Monitoreo flows, then regenerate
  the review and preflight so `publication_ready=true` is earned by evidence.

## Focused change 42 - evidence pack manifest with checksums

Iteration 39

- Failure or bottleneck: the evidence pack produced the required JSON, Markdown
  and generated artifact files, but the ZIP had no first-class manifest for
  reviewers to verify which files belonged to the pack or whether the workbook
  copied into the pack was the same artifact referenced by the report.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `manifest.json` with schema
  `monitoreo_deliverables_evidence_manifest_v1`, project, audience, cut,
  status, score, file count, total bytes, and per-file path/size/SHA-256. The
  report points to `manifest.json`, and the publication evidence ZIP includes
  the manifest alongside `report.json`, `report.md`, generated artifacts and
  validation JSON.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: baseline before the focused change,
  `test-monitoreo-deliverables.R` passed with 192 expectations. After the
  focused change, `test-monitoreo-deliverables.R` passed with 204 expectations,
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 4 tests, and `git diff --check` passed.
- Result: better. Evidence packs are now auditable as reproducible bundles:
  reviewers can inspect `manifest.json` and verify generated XLSX/PDF copies,
  validation files and report files by checksum.
- Better/worse/same: better for evidence-pack reproducibility and future
  handoff; same for exact ACNURCG parity because the validated movement package
  is still absent.
- Next action: use the manifest-backed evidence pack when rerunning ACNURCG
  after the completed operational package is applied and revalidated.

## Focused change 43 - evidence pack reference-validation artifact

Iteration 40

- Failure or bottleneck: the evidence pack could preserve the preflight and
  data-validation payloads, but reference validation was not a first-class file
  in the bundle. Reviewers had to inspect nested `report.json` content to see
  whether reference drift, canonical counts, old-summary blockers or
  PDF-vs-Sheets gates were checked.
- Baseline evidence: before this focused change,
  `test-monitoreo-deliverables.R` had 203 passes and 1 failure because the
  publication evidence-pack fixture crossed the cold performance threshold and
  returned `warnings` instead of the test's hard-coded `ready`. That behavior is
  valid product evidence, not a data blocker, so the fixture should assert
  "not blocked" while preserving the performance warning in the pack.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `reference-validation.json` with schema
  `monitoreo_deliverables_reference_validation_v1`. The artifact is derived
  from the preflight reference/canonical/PDF checks by default and can be
  overridden by the publication payload when a caller supplies a stronger
  reference-validation object. The evidence report points to
  `reference-validation.json`, the ZIP includes it, and `manifest.json`
  inventories it with size and SHA-256.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 216 expectations. `pnpm --dir frontend exec vitest run
  src/api/client.test.ts
  src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts` passed with
  60 tests.
- Result: better. Evidence packs now expose reference validation as an
  auditable artifact rather than a nested report detail, while performance
  warnings remain visible instead of being mistaken for publication blockers.
- Better/worse/same: better for reproducible QA handoff; same for exact ACNURCG
  territorial parity because the 12 unresolved UMP movement packages are still
  absent from current safe evidence.
- Next action: when the completed operational package or validated-cut `.pulso`
  is available, regenerate the pack and verify that `reference-validation.json`
  moves from blocked/not-applied evidence to publish-ready evidence only after
  safe application and revalidation.

## Focused change 44 - telephone monitoring stays actor-scoped

Iteration 41

- Failure or bottleneck: telephone states were already excluded from
  client/platform rejection buckets, but the telephone monitoring blocks could
  still collapse the same responsible/caller across actors. That made the phone
  operation view weaker for Acreditacion, where telephone work is read by actor,
  and for the standalone `telefonico` path, where phone states are the whole
  monitoring surface.
- Baseline evidence: the existing phone regressions proved that
  `Rechazos telefónicos` stay internal and that client models do not expose
  `monitoreo_telefonico`, but they did not prove actor separation in responsible
  blocks, field-vs-platform blocks, no-barrido blocks or actor/day phone
  advance.
- Focused change: `.monitoreo_report_phone_blocks()` now builds phone operation
  summaries by `Actor + Responsable`, carries `Actor` into responsible,
  field-vs-platform, status, insistence, retry, no-barrido and effective blocks,
  and adds `avance_efectivo_actor_dia`. The Acreditacion and shared Monitoreo
  UIs now display/merge responsible rows as `Responsable · Actor` when actor is
  available, so one caller is not merged across Egresados, Docentes or another
  actor.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-engine.R`,
  `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`,
  `frontend/src/features/monitoreo/MonitoreoPage.tsx`, this QA evidence and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-engine.R")'`
  passed with 1390 expectations,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 515 expectations, and `pnpm --dir frontend typecheck` passed.
- Result: better. Telephone statuses remain operational telephone evidence,
  including telephone refusals, no-contesta and retry states, while
  client/platform counts still use only official-base-crossed platform consent
  refusals.
- Better/worse/same: better for Acreditacion phone monitoring and the
  standalone `telefonico` path; same for canonical client counts and the
  territorial ACNURCG publication blocker.
- Next action: use the real ACRDCONTA phone tabs for visual QA after the
  remaining hydration/tab walkthrough, verifying section by section that
  `Actor + Responsable` labels and the actor/day trend render without loaders.

## Focused change 45 - cut snapshot inside evidence pack

Iteration 42

- Failure or bottleneck: the roadmap still treated canonical snapshots by cut
  and audience as mostly future work. The evidence pack had a manifest and
  reference validation, but it did not yet contain a compact reviewed-cut
  snapshot that could be inspected without reopening live sources or session
  state.
- Baseline evidence: before this focused change,
  `test-monitoreo-deliverables.R` passed with 216 expectations.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `cut-snapshot.json` with schema `monitoreo_deliverables_cut_snapshot_v1`.
  The snapshot records project, audience, family, cut, source, status, score,
  scorecard, checks, blocking/warning codes, source row/tab evidence, artifact
  names, validation file names and explicit persistence flags:
  `generated_deliverables_outside_pulso=true`, `secrets_included=false`, and
  `raw_data_included=false`. The publication wrapper can accept an explicit
  `cut_snapshot` override when a caller has stronger snapshot metadata, and the
  TypeScript API type exposes `cut_snapshot`.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 240 expectations.
- Result: better. Evidence packs now have a compact per-cut/audience snapshot
  that captures the reviewed publication contract without raw data, secrets or
  `.pulso` mutations.
- Better/worse/same: better for reproducible cut review and future historical
  comparison; same for exact ACNURCG parity because the 12 unresolved UMP
  movement packages are still absent from current safe evidence.
- Next action: rerun the publication pack after a complete operational package
  or validated-cut `.pulso` is available, and compare the new
  `cut-snapshot.json` against the blocked one before allowing territorial
  internal publication to become ready.

## Focused change 46 - stale hydration evidence marked superseded

Iteration 43

- Failure or bottleneck: several QA matrices still described
  ACRDCONTA `Telefono/Dia` as a current loader/readiness failure even though
  later strict evidence and the Acreditacion parity matrix already showed the
  tab hydrated, with undated daily rows preserved. That contradiction made the
  section-by-section status hard to trust.
- Baseline evidence: the required publication baseline passed before this
  documentation repair:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  returned 515 expectations, 0 failures. The focused frontend phone tests also
  passed:
  `pnpm --dir frontend exec vitest run src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.test.ts`
  returned 3 tests, 0 failures.
- Focused change: marked the old ACRDCONTA 21/22 comparator and early
  `Telefono/Dia` mismatch rows as historical/superseded in the performance and
  parity documentation. The current status now points to the stricter evidence:
  `Telefono/Dia` hydrates and the later canonical undated parity run shows both
  panes at `TOTAL PERIODO 145` / `14 cortes diarios`; remaining work is
  visual/data-shape parity, alert workflow parity and long-run harness
  stability, not a phone-day loader failure.
- Files changed: `docs/qa/monitoreo/monitoreo_performance_matrix.md`,
  `docs/qa/monitoreo/performance_hydration_plan.md`,
  `docs/qa/monitoreo/acreditacion_parity_matrix.md`, and this QA evidence.
- Validation command: documentation grep confirmed the old wording is now
  either absent or explicitly marked as historical/superseded, and
  `git diff --check` passed.
- Result: better. QA evidence is now internally consistent: it no longer
  contradicts the current `phone_summary`/strict comparator status for
  `Telefono/Dia`.
- Better/worse/same: better for auditability and section-by-section planning;
  same for product behavior and same for the unresolved ACNURCG territorial
  operational-package blocker.
- Next action: continue with the real remaining Acreditacion gaps in order:
  `Telefono/Alertas` parity, `Consultas` first-viewport/source-count parity,
  and long-run comparator session reassertion.

## Focused change 47 - publication decision artifact blocks optimistic overrides

Iteration 44

- Failure or bottleneck: the evidence pack already included report, manifest,
  reference validation and cut snapshot artifacts, but it still lacked an
  explicit publication decision ledger. A reviewer-provided or caller-provided
  decision could therefore be confused with an authoritative gate unless the
  preflight and reference statuses were inspected manually.
- Baseline evidence: the cut snapshot evidence pack contract was already
  covered by `test-monitoreo-deliverables.R`; before this focused change, the
  latest recorded pass for that file had 240 expectations.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `publication-decision.json` with schema
  `monitoreo_deliverables_publication_decision_v1`. The artifact computes
  `ready_to_publish`, `requires_review` or `blocked` from the authoritative
  preflight, reference validation and cut snapshot gates; records blocking and
  warning codes; exposes `may_publish` and `requires_review`; and marks
  `requested_decision_conflict=true` when caller metadata tries to override a
  blocked state optimistically.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 264 expectations,
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 60 tests, and `git diff --check` passed.
- Result: better. Evidence packs now contain a standalone, auditable
  publication decision that refuses optimistic approval while blockers remain.
- Better/worse/same: better for publication control and reviewer traceability;
  same for exact ACNURCG parity because the 12 unresolved UMP movement packages
  are still absent from the safe operational payload and `ACNURCG.pulso` was not
  mutated.
- Next action: continue the larger goal by obtaining or constructing the exact
  operational package for `UMP 101`, `UMP 112`, `R 116`, `UMP 117`, `UMP 121`,
  `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`, `UMP 73` and `UMP 83`,
  then rerun territorial reference validation before allowing internal
  publication to become ready.

## Focused change 48 - operational package status artifact in evidence pack

Iteration 45

- Failure or bottleneck: the evidence pack captured the blocked territorial
  preflight and reference validation, but the exact operational-package blocker
  still lived nested inside preflight evidence. That made the pack reproducible
  but less directly actionable for the ACNURCG unblocker: reviewers had to know
  where to look for missing UMP movement rows, tacha gaps, apply readiness and
  the "diagnostic only" guardrail.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 264 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 60 tests.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `operational-package-status.json` with schema
  `monitoreo_deliverables_operational_package_status_v1`. The artifact extracts
  the territorial/internal package gate into a standalone diagnostic: applicable
  status, `blocks_publication`, `diagnostic_only`, coverage completeness,
  `apply_ready`, `requires_revalidation`, `publication_ready`, missing UMP
  items, missing tachas, application-plan readiness, reference-audit probe,
  blocking/warning codes, next action and a guardrail that audit rows must not
  be applied or used to mutate `.pulso` from the evidence pack.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 288 expectations,
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 60 tests, and `git diff --check` passed.
- Result: better. A blocked pack now carries the exact operational-package
  status as its own artifact and manifest/ZIP entry, while preserving that it is
  diagnostic-only and not an applyable `.pulso` mutation recipe.
- Better/worse/same: better for ACNURCG handoff and publication auditability;
  same for exact territorial parity because the 12 unresolved UMP movement
  packages are still absent from the endpoint-ready operational payload and
  `ACNURCG.pulso` was not mutated.
- Next action: continue toward the remaining blocker by obtaining endpoint
  payload rows for `UMP 101`, `UMP 112`, `R 116`, `UMP 117`, `UMP 121`,
  `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`, `UMP 73` and `UMP 83`,
  then rerun review/preflight/evidence-pack before allowing publication to
  become ready.

## Focused change 49 - endpoint payload request inside evidence pack

Iteration 46

- Failure or bottleneck: `operational-package-status.json` made the territorial
  package blocker visible, but a reviewer still needed to translate missing UMP
  items into a concrete handoff file for the validated operational source. That
  kept the unblocker one step too implicit for ACNURCG, where the remaining 12
  UMP rows need endpoint-ready movement payload and must not be inferred from
  audit rows alone.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 288 expectations.
- Focused change: `monitoreo_deliverables_evidence_pack()` now writes
  `operational-package-request.json` and `operational-package-request.csv`.
  The CSV/JSON request turns unresolved UMP/tacha blockers into explicit rows
  with `package_item`, type, target, request status, payload requirement,
  required endpoint fields, source/cut, recommended action, publication gate,
  `diagnostic_only=true` and `would_mutate_pulso=false`. It is a fillable
  request for the missing endpoint payload, not an applyable payload itself.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, this QA evidence,
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 317 expectations,
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 60 tests, and `git diff --check` passed.
- Result: better. A blocked evidence pack now contains both the diagnostic
  package status and a concrete endpoint-payload request CSV/JSON, so the next
  handoff can be completed without reading nested preflight internals or
  risking `.pulso` mutation from audit evidence.
- Better/worse/same: better for ACNURCG handoff and auditability; same for
  exact territorial parity because the 12 UMP movement payloads still have to
  be supplied and applied through safe Monitoreo flows.
- Next action: use the request artifact as the contract for obtaining
  endpoint-ready rows for `UMP 101`, `UMP 112`, `R 116`, `UMP 117`, `UMP 121`,
  `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`, `UMP 73` and `UMP 83`,
  then rerun review/preflight/evidence-pack before allowing publication to
  become ready.

## Focused change 50 - evidence pack request highlighted in Salidas

Iteration 47

- Failure or bottleneck: the evidence pack ZIP contained
  `operational-package-request.csv/json`, but the Salidas UI still summarized
  the pack only as a generic `Paquete QA`. That made the next operational
  handoff too easy to miss and risked users treating the request artifact as a
  hidden backend detail rather than the concrete payload contract for the 12
  unresolved UMP rows.
- Baseline evidence: before this focused change,
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 4 tests.
- Focused change: `MonitoreoOutputsWorkbench` now derives visible evidence-pack
  highlights from returned pack metadata. When the backend includes
  `operational_package_request` or `operational_package_request_csv`, Salidas
  shows `Solicitud de payload operacional` and states that the CSV/JSON is a
  handoff request that does not apply changes or mutate `.pulso`. The same
  summary can also surface `operational-package-status.json` and
  `publication-decision.json`.
- Files changed: `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`, this QA
  evidence, `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `pnpm --dir frontend exec vitest run src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 6 tests;
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 62 tests; `pnpm --dir frontend typecheck` passed;
  `pnpm --dir frontend build:fast` passed;
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 521 expectations; `git diff --check` passed.
- Result: better. The UI now makes the operational request artifact visible as
  non-mutating handoff evidence while keeping publication blocked when
  preflight/reference gates fail.
- Better/worse/same: better for reviewer handoff and product clarity; same for
  exact territorial parity because the 12 endpoint-ready movement payloads
  still have to be supplied and applied through safe Monitoreo flows.
- Next action: obtain endpoint-ready rows for `UMP 101`, `UMP 112`, `R 116`,
  `UMP 117`, `UMP 121`, `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`,
  `UMP 73` and `UMP 83`, then rerun review/preflight/evidence-pack before
  allowing publication to become ready.

## Focused change 51 - ACRDCONTA real Seguimiento contract and phone semantics

Iteration 48

- Failure or bottleneck: the regenerated real ACRDCONTA evidence initially
  opened and hydrated, but internal preflight was blocked because
  `Seguimiento` did not expose the required `Brecha mínimo` section text. The
  same audit also confirmed the semantic risk raised by review: Egresados had
  `Rechazos plataforma = 0` and `Rechazos telefónicos = 4`, so telephone
  operational states had to remain visible without becoming client/platform
  refusals.
- Baseline evidence: before the focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 515 expectations. The real ACRDCONTA contract generated
  `ACRDCONTA-cliente-real.xlsx`, `ACRDCONTA-interno-real.xlsx` and
  `ACRDCONTA-cliente-real.pdf`, but internal preflight was `blocked` by
  `format_validation_failed` on `Seguimiento`.
- Focused change: the Acreditacion presenter now materializes
  `Brecha mínimo` for internal `control_seguimiento` rows even when the real
  tracking frame arrives without that column, and keeps
  `Rechazos plataforma` / `Sin respuesta plataforma` unmerged in internal
  tracking. A regression asserts that `Brecha mínimo`,
  `Rechazos plataforma` and `Rechazos telefónicos` remain separate.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`, this QA evidence, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 521 expectations. The regenerated real ACRDCONTA contract marks
  client and internal preflights `ready`, all XLSX checks true, PDF text checks
  true, and `Seguimiento` in the real internal XLSX reads back as 1086 rows x
  110 columns with `Brecha mínimo`, `Rechazos plataforma`,
  `Rechazos telefónicos` and `Egresados`.
- Result: better. ACRDCONTA client/internal/PDF deliverables now validate
  against the updated `.pulso` and canonical Egresados count
  `270 / 157 / 5 / 0 / 108`, while telephone statuses remain operational
  telephone evidence by actor/responsible instead of platform/client
  refusals.
- Better/worse/same: better for Acreditacion real-project publication and
  telephone semantics; same for exact territorial parity because the 12
  endpoint-ready movement payloads are still absent from the ACNURCG package.
  The XLSX traceability risk noted here is closed by Focused change 53: long
  internal trace cells now carry explicit truncation markers and write without
  `openxlsx` warnings.
- Next action: continue the territorial operational package unblocker for the
  12 unresolved UMP movement payloads; add a trace sidecar only if reviewers
  need complete long JSON traces outside the internal model JSON.

## Focused change 52 - direct evidence-pack request downloads

Iteration 49

- Failure or bottleneck: Salidas could highlight that the evidence pack
  contained `operational-package-request.csv/json`, but the only downloadable
  product artifact was still the full ZIP. That added friction to the handoff
  for the 12 unresolved ACNURCG UMP rows and made reviewers open the archive
  before sending the exact request file to the operational source.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 317 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 62 tests.
- Focused change: `.monitoreo_publication_evidence_pack()` now registers
  `operational-package-request.csv`, `operational-package-request.json`,
  `operational-package-status.json` and `publication-decision.json` as
  individual file-store downloads in a new `files` payload while keeping the
  full ZIP as the canonical pack. `apiMonitoreoPublicationEvidencePack()` adds
  `download_url` to those files, and Salidas renders direct buttons for the
  request CSV/JSON, diagnostic status and publication decision. The request
  remains non-mutating handoff evidence, not an applyable payload.
- Files changed: `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`, this QA
  evidence, `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, and
  `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 332 expectations;
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 63 tests; `pnpm --dir frontend typecheck` passed;
  `pnpm --dir frontend build:fast` passed;
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 525 expectations; `git diff --check` passed.
- Result: better. The next reviewer can download the exact operational request
  CSV/JSON directly from Salidas while still retaining the reproducible ZIP,
  manifest and blocked preflight evidence.
- Better/worse/same: better for handoff speed and auditability; same for exact
  territorial parity because the 12 endpoint-ready movement payloads still
  have to be supplied and applied through safe Monitoreo flows.
- Next action: obtain endpoint-ready rows for `UMP 101`, `UMP 112`, `R 116`,
  `UMP 117`, `UMP 121`, `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`,
  `UMP 73` and `UMP 83`, then rerun review/preflight/evidence-pack before
  allowing publication to become ready.

## Focused change 53 - XLSX long trace sanitizer

Iteration 50

- Failure or bottleneck: the real ACRDCONTA internal workbook could hydrate and
  read back correctly, but `openxlsx` still emitted warnings for very long
  trace cells because JSON quotes expanded as XML entities and exceeded Excel's
  32,767-character cell limit after escaping. That made the truncation noisy
  and not explicit enough for audit handoff.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 525 expectations after the first XLSX marker test, but the real
  ACRDCONTA sanitizer evidence still had `write_warnings_count = 170` in
  `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/xlsx-sanitizer-validation.json`.
- Focused change: XLSX cell sanitization now checks both visible character
  length and XML-escaped length before writing. If a value is too long, it uses
  a binary search to keep the largest safe prefix and appends
  `[Truncado para XLSX: ...]`. The full trace remains in
  `internal-publication-model.json` / internal evidence, not hidden inside a
  too-large Excel cell.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-publish-qa.R`, this QA evidence, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 525 expectations and 0 warnings. Real ACRDCONTA evidence from
  the saved internal model rewrote
  `ACRDCONTA-interno-real-sanitized.xlsx` with `write_warnings_count = 0`,
  `marker_count = 170`, `max_read_cell_chars = 21132`,
  `max_encoded_read_cell_chars = 32702`, `Seguimiento = 1086 x 110`, and
  `checks_ok = true`.
- Result: better. Internal XLSX traceability is now explicit and quiet: Excel
  no longer truncates implicitly, `openxlsx` no longer warns, and the workbook
  still hydrates all operational columns.
- Better/worse/same: better for XLSX audit quality; same for canonical counts
  and phone semantics. Telephone states remain operational telephone-monitoring
  statuses by actor/responsible/canal and do not become client/platform
  refusals unless the platform consent rule crosses the official base.
- Next action: continue the territorial operational package unblocker for the
  12 unresolved ACNURCG UMP movement payloads before claiming exact territorial
  reference parity.

## Focused change 54 - completed operational package upload in Salidas

Iteration 51

- Failure or bottleneck: the evidence pack could produce the exact
  `operational-package-request.csv/json` files and Salidas could review an
  operational package, but the product surface still had no intake step for the
  completed CSV/XLSX returned by the operational source. Reviewers had to rely
  on API-level `file_id` plumbing instead of a visible, auditable handoff in
  the deliverables workflow.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 332 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 64 tests.
- Focused change: the file store now accepts
  `kind = "monitoreo_operational_package"` with CSV fallback when a reviewer
  uploads a package without an extension. `apiUpload()` exposes the same kind,
  and territorial/internal Salidas now shows a compact `Paquete operacional
  completado` upload control after internal confirmation. Uploaded CSV/XLSX
  files are stored as local session files and their `file_id` is passed to
  `/api/monitoreo/territorial/operational-package/review`; the review remains
  read-only and keeps `would_mutate_pulso=false`.
- Files changed: `api/R/io.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  `frontend/src/features/monitoreo/salidas/outputsWorkbench.css`, this QA
  evidence, `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 334 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 66 tests. Continuation validation also passed:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  with 525 expectations, `pnpm --dir frontend typecheck`,
  `pnpm --dir frontend build:fast` in 40.64s, and `git diff --check`.
- Result: better. The evidence-pack request can now make a full round trip:
  generate request, download request, receive completed CSV/XLSX, upload it in
  Salidas, and review it through the existing non-mutating operational gate.
- Better/worse/same: better for handoff completeness and traceability; same for
  exact territorial parity because the 12 endpoint-ready movement payloads are
  still absent and must be supplied by the validated operational source before
  the review can become complete.
- Next action: obtain endpoint-ready rows for `UMP 101`, `UMP 112`, `R 116`,
  `UMP 117`, `UMP 121`, `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`,
  `UMP 73` and `UMP 83`, upload the completed package through Salidas, rerun
  operational review/preflight/evidence pack, and only then apply through safe
  Monitoreo operational-adjustment/tacha endpoints.

## Focused change 55 - reference drift upload in Salidas

Iteration 52

- Failure or bottleneck: the review endpoint already required explicit
  reference drift evidence and could accept `drift_file_id`, but the product
  surface only uploaded the completed operational package. From Salidas, a
  reviewer could produce a `package_file_id` without any matching
  `drift_file_id`, which left the non-mutating review exposed to
  `E_TERRITORIAL_PACKAGE_DRIFT_REQUIRED`.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 334 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 66 tests.
- Focused change: the file store now accepts
  `kind = "monitoreo_reference_drift"` with CSV fallback. The frontend upload
  contract exposes the same kind, and
  `apiMonitoreoTerritorialOperationalPackageReview()` can send `drift_file_id`
  plus optional `required_tachas`. Territorial/internal Salidas now shows a
  separate `Drift / referencia validada` upload before review, passes the
  uploaded reference as `driftFileId`, and keeps the review disabled until a
  reference file is present. The completed package upload remains optional for
  request/template review and required for package coverage review; neither
  path mutates `.pulso`.
- Files changed: `api/R/io.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  this QA evidence, `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 336 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 66 tests.
- Result: better. The review handoff now has two explicit artifacts: the
  reference drift file that defines what must be reconciled, and the completed
  operational package file that attempts to cover it. This matches the backend
  gate and removes the previous Salidas-only dead end.
- Better/worse/same: better for traceability and product ergonomics; same for
  exact territorial parity. The 12 endpoint-ready ACNURCG movement payloads are
  still missing and publication remains gated by `critical_reference_drift`.
- Next action: collect or reconstruct only through a validated operational
  source the endpoint-ready payload rows for `UMP 101`, `UMP 112`, `R 116`,
  `UMP 117`, `UMP 121`, `UMP 122`, `R 134`, `UMP 147`, `UMP 150`, `UMP 23`,
  `UMP 73` and `UMP 83`; then upload the drift/reference and completed package,
  rerun review, apply through safe Monitoreo adjustment/tacha endpoints, and
  revalidate preflight/evidence pack.

## Focused change 56 - platform refusals require official-base cross in fallbacks

Iteration 53

- Failure or bottleneck: the canonical case-rollup path already keeps
  platform no-consent/refusal rows out of official counts when they do not
  cross the base, and phone-only states already stay in telephone monitoring.
  The fallback helpers used when `case_rollup` is unavailable still had an
  older exception: `Rechazo` from platform was counted without applying the
  same reconciliation mask used for `Completa` and `Parcial`.
- Focused change: hardened the fallback summary, daily, channel/source and
  control-distribution helpers so platform refusals count as
  `Rechazos plataforma` only when the response crosses the official base.
  Rows without base cross remain audit-only as
  `Rechazos plataforma sin cruce base`. Telephone states are unchanged:
  `Rechazos telefónicos`, no-contesta and other call outcomes remain scoped to
  `monitoreo_telefonico`, internal phone views and the standalone `telefonico`
  path.
- Files changed: `api/R/monitoreo_engine.R`,
  `api/tests/testthat/test-monitoreo-engine.R`, this QA evidence and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-engine.R")'`
  passed with 1425 expectations and 0 failures, and
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  passed with 525 expectations and 0 failures. During the iteration, an initial
  fixture using a non-canonical custom control variable returned no control
  rows; it was replaced with the built-in Docentes `Dedicación` control so the
  regression also exercises control-distribution counts.
- Result: better. The fallback path now follows the same strict source of
  truth as the canonical rollup: official base first, platform response only if
  it crosses that base, and phone outcomes only inside phone monitoring.
- Better/worse/same: better for Acreditacion client/internal report safety and
  the standalone `telefonico` path; same for territorial exact parity, which
  remains blocked by the 12 missing ACNURCG UMP movement payloads.
- Next action: keep any future telephone UI/report work anchored to this split:
  phone statuses are operational states for call monitoring, while client
  effective/refusal totals must be unique official-base cases only.

## Focused change 57 - publication gates consume reviewed operational evidence

Iteration 54

- Failure or bottleneck: Salidas could upload `Drift / referencia validada` and
  review a completed operational package, but preflight, evidence-pack and
  publish requests still did not carry that reviewed evidence. The backend gate
  already understood `drift` and `operational_package_review`, so the UI could
  show a review while the next publication gate still saw missing reference or
  missing package evidence.
- Baseline evidence: before this focused change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 336 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 66 tests.
- Focused change: publication preflight now resolves
  `reference_drift_file_id` / `drift_file_id` through the same local upload
  reader used by operational review, producing explicit drift evidence instead
  of `not_checked`. The frontend publication request contract now accepts
  `referenceDriftFileId` and `operationalPackageReview`, and Salidas passes the
  uploaded drift file plus the normalized review payload to preflight,
  evidence-pack and Sheets publish. This keeps the gate non-mutating: reviewed
  but unapplied packages still block as
  `territorial_operational_package_not_applied`, while missing/partial packages
  remain blocked with their precise reason.
- Files changed: `api/R/router_monitoreo.R`,
  `api/tests/testthat/test-monitoreo-deliverables.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx`,
  `frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`,
  this QA evidence, `docs/qa/monitoreo/monitoreo_deliverables_roadmap.md`, and
  `docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`.
- Validation command: after the change,
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-deliverables.R")'`
  passed with 345 expectations, and
  `pnpm --dir frontend exec vitest run src/api/client.test.ts src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.test.ts`
  passed with 67 tests.
- Result: better. The operational review is now part of the publication
  control plane, not just a visible side workflow in Salidas. A reviewer can
  attach the reference, review the package, and have the next preflight/QA pack
  explain the true gate state.
- Better/worse/same: better for publication traceability and gate consistency;
  same for exact territorial parity. The 12 ACNURCG UMP movement payloads are
  still absent and no `.pulso` state was mutated.
- Next action: obtain the endpoint-ready movement payloads for `UMP 101`,
  `UMP 112`, `R 116`, `UMP 117`, `UMP 121`, `UMP 122`, `R 134`, `UMP 147`,
  `UMP 150`, `UMP 23`, `UMP 73` and `UMP 83`, then rerun review/preflight after
  applying only through safe Monitoreo adjustment/tacha endpoints.
