# Monitoreo Sheets/PDF matrix

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-29
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de entregables de Monitoreo](../historico/monitoreo-entregables-2026-06.md)

Date: 2026-06-29

This matrix separates data correctness, formatting and professional quality for
Monitoreo deliverables. PDF rows are marked as passed only when a PDF was
generated, rendered and checked against the same canonical data used by
Sheets/XLSX.

Continuation note 2026-06-29: a minimum backend preflight/scorecard and
evidence pack now exists, and the preflight is exposed through
`/api/monitoreo/publication/preflight` plus the Salidas Sheets workbench. The
ACNURCG territorial internal sample preflight is `blocked`, score `50`, not
ready: it now separates `critical_reference_drift` from
`territorial_operational_package_not_ready`, because the validated Sheet
reference still has critical state drift against the local `.pulso` and the
partial package covers only 18/30 UMP subsanadas plus P446. A 2026-06-29
read-only connector confirmation of exact `Cuotas sexo y edad` rows still shows
`Subsanadas = 30` and the same 12 unresolved rows as `Subsanada`, so the
remaining territorial block is current metric/state parity, not workbook
structure. The generator tab order now matches the validated internal Sheet
order. Later focal regressions
also harden rejection-source handling:
client `Rechazo` now falls back to generic `Rechazos` only when no
telephone-specific rejection column exists, and platform refusals without an
official-base cross stay as audit-only `Rechazos plataforma sin cruce base`
instead of official/client rejections. The 2026-06-29 fallback-only regression
forces the same rule when `case_rollup` is unavailable: summary, daily,
channel/source and control-distribution helpers count `Rechazos plataforma`
only after an official-base cross, while telephone states remain scoped to
phone monitoring. The ACNURCG full internal XLSX
writer now reuses precomputed tabs and validates the workbook contract. Common
publication caching plus the observed-summary map brought the measured hydrated
path under the 90s total target: dashboard `6.631s`, occurrences `4.257s`,
tabs `34.121s`, workbook `5.745s`, total `50.754s`. The evidence pack is now a
product API: `/api/monitoreo/publication/evidence-pack` reuses the same
preflight/tabs bundle, generates `generated.xlsx`, writes validation JSON/MD,
registers a local ZIP `file_id`, and does not publish to Sheets or mutate
`.pulso`. The Salidas workbench now exposes both `Paquete QA` and the
territorial/internal `Revisar paquete operacional` action; the latter downloads
template/review/report artifacts only and does not apply any `.pulso` changes.
The `telefonico` path now has a publication-level regression: telephone states
remain in `monitoreo_telefonico` for internal/phone monitoring and as the
primary state surface of the standalone telephone workflow, while client models
still exclude `monitoreo_telefonico` and `Rechazos telefónicos`. For
`telefonico`, those statuses are the monitoring path itself, not a platform
rejection source: status distribution, phone refusals by day, phone advance by
actor/day and phone responsible blocks must remain hydrated by actor. The phone
operation contract now keeps responsible views scoped by `Actor + Responsable`,
so the same caller/operator is not merged across Egresados, Docentes or any
other actor.
Publication QA also has a compact ACRDCONTA fixture that validates
`270 / 157 / 5 / 0 / 108` through client/internal publication models with
auxiliary bridges, duplicate channels and no-base responses. The same fixture
now verifies the final client tabs `Reporte`, `Detalle del avance` and
`Corte y fuentes`, including executive progress text, rhythm rows and source
rows for official base, SurveyMonkey web, telephone and email. It also verifies
the final internal tabs `Resumen`, `Avance por encuesta`, `Seguimiento`,
`Alertas` and `Corte y fuentes`. The compact fixture now writes both final
client and internal XLSX artifacts and runs the professional workbook contract:
ordered sheets, hydrated rows/columns, required sections, freeze panes, filters,
styles and package integrity. Sparse internal cuts keep contract columns such
as `Canal operativo`, `Responsable de carga`, `Mínimo esperado` and
`Brecha mínimo` through structured empty-state rows, so compact workbooks pass
format validation without inventing progress data. The real ACRDCONTA contract
was regenerated from
`/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`:
client and internal preflights are `ready`, all client/internal XLSX checks are
true, the PDF text/render checks pass, and internal `Seguimiento` reads back as
1086 rows x 110 columns with `Brecha mínimo`, `Rechazos plataforma`,
`Rechazos telefónicos` and `Egresados`. The remaining Acreditacion XLSX caveat
is now closed for workbook generation: very long internal trace cells are
truncated with an explicit `[Truncado para XLSX: ...]` marker after checking
both visible and XML-escaped length, and the real ACRDCONTA sanitized XLSX
writes with 0 `openxlsx` warnings. Complete long traces remain available in
the internal model JSON/evidence.

| Profile | Audience | Sheet/PDF section | Expected content | Current content | Data match | Format match | Professional quality | Errors | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Acreditacion | Client | `Reporte` | Executive cut, actor progress, daily progress, sources; no internal trace columns or PII-heavy operational fields | Generated from canonical client model, published to disposable native Google Sheet, and regenerated from real ACRDCONTA `.pulso` | Pass for ACRDCONTA Egresados `270 / 157 / 5 / 0 / 108`; client `Rechazo` comes from platform/consent refusal only after crossing the official base, while telephone refusals remain internal. Compact CI fixture proves the same count after auxiliary bridges, duplicate channels and no-base responses, and verifies the visible `Reporte` text `157 de 270 respuestas esperadas (58.1%)` in both tab rows and generated XLSX. Real-contract preflight is `ready` | Pass: ordered sheet, filter, freeze, styles, required sections, minimum rows/columns, no missing XLSX parts; native Sheet readback confirms styled headers, frozen row, filters and conditional formats; real client XLSX checks are all true | Good workbook and live Sheet quality | None in publication QA, live write/readback or real-contract preflight | Passed | `test-monitoreo-publish-qa.R` 521 pass; engine publisher test 1390 pass; client Sheet `https://docs.google.com/spreadsheets/d/1Qg-jUYB_yu_4cmCmd7PYamEpeJXuN-Oai4RlJWr_G5M`; real evidence in `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/`. |
| Acreditacion | Client | `Detalle del avance` | Daily rhythm, actor/source breakdown and enough detail for client review | Generated from client report and publication rows | Pass for canonical count basis | Pass: filter/freeze/styles; dates normalized | Good workbook quality | None in publication QA | Passed | `ACRDCONTA-cliente-sheets.xlsx` readback: `Detalle del avance` 192 rows, 11 cols, `freeze=A3`, `filter=A2:J2`. |
| Acreditacion | Client | `Avance por canal/fuente` | Client-readable platform/channel progress without operational telephone rejection leakage | Generated from client source summary | Pass: phone-only refusals are not accumulated into `Rechazos plataforma`; platform no-consent remains reportable only when it crosses the official base; generic `Rechazos` does not override `Rechazos telefónicos`; telephone states remain preserved by actor and responsible in internal phone monitoring and the `telefonico` path | Pass: included in the professional workbook contract with required headers and formatting | Good | None after regression | Passed | Regressions `rechazos solo telefonicos quedan fuera de matrices cliente`, `fallback generico de rechazo no pisa estados telefonicos`, `rechazo de consentimiento sin cruce base queda solo como auditoria`, `path telefonico conserva estados operativos sin pasarlos al cliente`, `monitoreo telefonico conserva estados por actor y responsable`, and the hardened `phone_summary`/`telefonico` path check; `test-monitoreo-publish-qa.R` 521 pass; `test-monitoreo-engine.R` 1390 pass. |
| Acreditacion | Client | `Corte y fuentes` | Source list, cut timestamp, processed records and no secrets | Generated and included | Pass | Pass: required `FUENTES DEL CORTE` and processed-record fields | Good | None | Passed | Publication QA checks no secret-like strings, required tabs and hydrated sheets. |
| Acreditacion | Internal | `Resumen` | Internal cut summary with canonical actor indicators | Generated and published to disposable native Google Sheet | Pass | Pass: required internal sections and minimum rows/columns; native Sheet readback confirms 51 rows, 12 columns, frozen row, filter, owner metadata and 327 conditional formats | Good | None after long-cell sanitizer | Passed | Internal Sheet `https://docs.google.com/spreadsheets/d/1cwUUhxr1qop0QL3TCpg87IyXOxb8oStJjjhc3vcLBLQ`; `prosecnur-publish-internal-result.json`; `prosecnur-publish-internal-metadata-summary.json`. |
| Acreditacion | Internal | `Avance por encuesta` | Channel/source/collector/responsible progress, including collector type labels | Generated with `Tipo de responsable` from `collector_type`; compact cuts with no channel rows keep structured empty-state columns including `Canal operativo` and `Responsable de carga` | Pass | Pass: full and compact XLSX contracts keep required sections, minimum columns, freeze and filters | Good | None after compact empty-state repair | Passed | Targeted test `Sheets acreditacion jala responsables de carga y normaliza fechas`: 25 passes, 0 failures. Full `test-monitoreo-publish-qa.R` passed with 515 expectations after compact-workbook repair. |
| Acreditacion | Internal | `Seguimiento` | Operational tracking rows and traceability without client overexposure | Generated and published to disposable native Google Sheet; sparse tracking cuts and real tracking frames keep `Brecha mínimo` instead of collapsing to a one-column placeholder. Internal tracking keeps `Rechazos plataforma` separate from `Rechazos telefónicos` | Pass for publication fixture, real ACRDCONTA workbook and live Sheet readback | Pass: filter/freeze/styles plus hydrated-sheet check; live native metadata has 1058 rows, 108 cols, frozen row, filter and 54 conditional formats; real ACRDCONTA XLSX reads back as 1086 rows, 110 cols and contains `Brecha mínimo`, `Rechazos plataforma`, `Rechazos telefónicos`, `Egresados`; compact and real XLSX required-section checks pass. The sanitized real XLSX writes with 0 `openxlsx` warnings, 170 explicit truncation markers, max visible cell length 21,132 and max XML-encoded length 32,702 | Dense but usable; key operational columns are visible and hydrated; long traces are explicitly marked and remain complete in the internal model JSON/evidence | Initial live write failed on Google Sheets 50,000-character cell limit; repaired by explicit sanitizer with audit marker. Compact empty-state format repaired. Real XLSX long trace warnings repaired by XML-aware truncation marker. | Passed | Before/after: `prosecnur-publish-internal-before-sanitizer.json` failed; `prosecnur-publish-internal-result.json` passed. Real evidence: `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-interno-real.xlsx`, `ACRDCONTA-interno-real-sanitized.xlsx`, `acrdconta-real-deliverables-contract.json` and `xlsx-sanitizer-validation.json`. Full `test-monitoreo-publish-qa.R` passed with 525 expectations. |
| Acreditacion | Internal | `Alertas` | Review points and warnings for internal operation | Generated and published to disposable native Google Sheet; compact cuts emit structured `Sin alertas` rows with detail columns | Pass for fixture and live Sheet | Pass: required attention section and detail columns; native metadata has 508 rows, 27 cols, frozen row, filter and 216 conditional formats | Good | None in publication QA or live readback | Passed | ACRDCONTA internal Sheet readback: `Alertas` 508 rows, 27 cols; evidence in `prosecnur-publish-internal-metadata-summary.json`. Full `test-monitoreo-publish-qa.R` passed with 515 expectations. |
| Acreditacion | Client | PDF ejecutivo | Professional PDF with title, cut, metrics, charts, notes and sources consistent with Sheets | Generated 7-page PDF from `monitoreo_acreditacion_client_report_pdf()` with page 7 `Corte y fuentes`; product endpoint remeasured through model build + background PDF job; real ACRDCONTA PDF regenerated on 2026-06-29 | Pass: Egresados `270 / 157 / 5 / 0 / 108`, `58.1%`; page text contains `SurveyMonkey`, `base oficial`, `Apps Script viejo` exclusion | Pass: rendered A4 pages; real PDF validation has 7 pages, 249,679 bytes and required text checks; rendered page 1 shows actor cards with canonical counts and page 7 has clean `Corte y fuentes` layout without overlap | Good; client-readable and consistent with XLSX/Sheets | Product generation is acceptable for cold QA, but model/PDF generation still merits performance follow-up before repeated operational use. | Passed | `tmp/qa/monitoreo-deliverables/acrdconta-real-contract-20260629/ACRDCONTA-cliente-real.pdf`; rendered `ACRDCONTA-cliente-real-page-1.png` and `ACRDCONTA-cliente-real-page-7.png`; `acrdconta-real-deliverables-contract.json`; `test-monitoreo-publish-qa.R` 521 pass. |
| Territorial | Internal | `Portada` | Report metadata, cut, records, coverage, team and general reading | Real ACNURCG local XLSX: cut `26 Junio`, coverage `6 distritos · 300 UMP · 300 manzanas`, `1,594 registros`, `81.8%`; reference Sheet has `1,646 registros`, `81.9%` | Structure pass; values differ because local `.pulso` snapshot/state is not the same as the validated Sheet | Pass: freeze `A2`, filter `A1:B1`, professional header | Good | Local project state drift | Blocked for exact parity | `Portada` in `ACNURCG-interno-sheets-hydrated.xlsx`; live reference `Portada!A1:B9`. |
| Territorial | Internal | `Resumen territorial` | Quick reading cards: UMP efectivas, subsanadas, meta, encuestas válidas, brecha, UMP en campo, pendientes, no iniciadas, reemplazos usados; executive cards; district and enumerator summaries | Real ACNURCG local XLSX has all sections, but metrics differ: local `118` UMP efectivas, `0` subsanadas, `1210` válidas; reference has `133`, `30`, `1193` | Structure and tab order pass; exact values blocked by local `.pulso` missing validated subsanadas/tacha state | Pass: filter `A52:P52`, freeze `A53`, status labels, date labels, required section labels and minimum rows/columns | Good workbook structure | Local project state drift | Blocked for exact metric parity | `territorial-reference-comparison-hydrated.md`; full publication QA pass plus generator contract evidence. |
| Territorial | Internal | Preflight / scorecard | Publishing gate must prevent a ready state when reference drift is critical, when the validated-reference review has not been attached, or when the operational package review is partial/not applied, even if XLSX/PDF generation succeeds | `monitoreo_deliverables_preflight()` returns `blocked` for ACNURCG territorial internal with score `50`: `critical_reference_drift` blocks publication and `territorial_operational_package_not_ready` records that the current package review is partial (`missing_ump_items=12`, `missing_tachas=0`, `safe_to_apply=false`, `publication_ready=false`, `ready_rows=19`). It also returns `blocked` with `territorial_reference_drift_not_checked` when `territorial/internal` is reviewed without explicit reference evidence. Latest performance evidence is no longer over threshold: dashboard `6.631s`, occurrences `4.257s`, tabs `34.121s`, workbook from precomputed tabs `5.745s`, total dashboard + occurrences + tabs + workbook `50.754s`. | Pass: blocks instead of warning-only, blocks absent reference review, blocks partial operational package review, requires explicit `publication_ready=true` for the package check, and `/publication/sheets` stops on `E_MONITOREO_PREFLIGHT_BLOCKED` | N/A | Good minimum product contract; evidence-pack/export UI is tracked in the separate Evidence pack row | Critical drift: 30 UMP subsanadas not persisted locally, split as 12 absent from local state and 18 suggestions not persisted; P446 is endpoint-ready in the partial package, but the validated state is not complete/applied | Blocked | `tmp/qa/monitoreo-deliverables/preflight-sample.json`; `preflight-sample.md`; `preflight-reference-gate-sample.json`; `preflight-reference-gate-sample.md`; `territorial-drift-report.md`; `territorial-drift-report.csv`; `territorial-operational-package-review.json`; tests in `test-monitoreo-deliverables.R`; API client regression in `frontend/src/api/client.test.ts`; `tmp/qa/monitoreo-deliverables/territorial-acnur-performance-remeasure-full/generation-meta-cache.json`; `tmp/qa/monitoreo-deliverables/performance-summary.json`. |
| Territorial | Internal | Operational package review | Before mutating `.pulso`, the validated Sheet drift must become an exact reviewable package with row/range, target UMP/replacement or tacha, source cut, safe action, owner, reason, validation timestamp and endpoint-ready apply payload | `monitoreo_deliverables_territorial_operational_package_review()` is read-only and generated the current ACNURCG review/template. The contract is exposed through `/api/monitoreo/territorial/operational-package/review`, accepting inline rows or uploaded CSV/XLSX `file_id` inputs and returning downloadable template/review JSON/MD/CSV files. It also accepts a `reference_audit_probe` payload and folds it into the review as `monitoreo_deliverables_territorial_reference_audit_probe_v1`, so Salidas/API evidence can explain audit-row presence without treating it as an applyable package. Salidas now has two explicit local handoff controls: `Drift / referencia validada` uploads `monitoreo_reference_drift` and sends `drift_file_id`, while `Paquete operacional completado` uploads `monitoreo_operational_package` and sends `package_file_id`. Review stays disabled until the reference is attached, and the endpoint remains non-mutating. Preflight, evidence-pack and Sheets publish now resolve `reference_drift_file_id` into explicit drift evidence and consume the normalized `operational_package_review` from Salidas, so a reviewed but unapplied package blocks as `territorial_operational_package_not_applied` instead of disappearing as missing evidence. Current ACNURCG review is `blocked`, not `missing_package`: a read-only partial candidate contains 18 matched UMP subsanadas with endpoint payload plus the reconstructable P446 tacha, while the 12 missing rows are diagnosed as local cut/package conflicts or no-payload states. A 2026-06-29 live connector confirmation of exact `Cuotas sexo y edad` rows confirms the Sheet still has `Subsanadas = 30` and all 12 unresolved rows remain `Subsanada`. A bounded live probe of `Auditoría técnica!BM1:BM2414` confirms every remaining UMP has visible audit rows, but only 7/12 audit row counts match reference `validas`; 2 have fewer visible rows and 3 have more. Review-level `blocks_publication` now also incorporates `reference_audit_probe$blocks_publication`, and the payload exposes `apply_ready`, `requires_revalidation` and `publication_ready`; even a reconstructible, endpoint-ready probe reaches only `apply_ready=true`, `requires_revalidation=true`, `publication_ready=false` until the package is applied and revalidated. Salidas mirrors this as amber `applicable`, not green `ready`, while publication remains blocked. | Partial improvement only: P446 is no longer a missing tacha and 19 candidate rows are `ready_to_apply`; the missing-row diagnostic proves the remaining 12 cannot be safely inferred because 7 still act as local donors after P446, 1 donor disappears after P446, 2 are complete without target payload, 1 is not started, and 1 is pending/replacement without payload. The visible Sheet confirms final status/counts and audit-row presence but not source-response movement history. The review preserves that probe as `diagnostic_only` and states that UMP-level audit rows must not be applied as an operational package | N/A | Good handoff/product contract; `review_ready` is still not a publishable state unless `application_plan.payload_ready=true`, coverage is complete, and the package is applied/revalidated until `publication_ready=true` | 12 UMP package rows still have no source-response movement payload; publication remains gated by `critical_reference_drift` | Blocked | `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/territorial-live-reference-confirmation-20260629.*`; `territorial-operational-package-partial-candidate.*`; `territorial-operational-package-missing-rows.csv`; `territorial-operational-package-missing-diagnostics.*`; `territorial-missing-ump-reference-audit-probe.*`; root `territorial-operational-package-review.json`; `territorial-operational-package-review.md`; `territorial-operational-package-review.csv`; `territorial-operational-package-template.csv`; endpoint/client regressions in `test-monitoreo-deliverables.R` and `frontend/src/api/client.test.ts`; upload kind/file-id regression in `test-monitoreo-deliverables.R`; UI regression in `MonitoreoOutputsWorkbench.test.ts`; latest focal validation: deliverables 345 pass, frontend api/workbench 67 pass; UI change in `MonitoreoOutputsWorkbench.tsx`. |
| Territorial | Internal | Evidence pack | Reproducible package with report, XLSX/PDF if applicable, cut snapshot, operational package status/request, publication decision, data validation, reference validation, format validation, performance evidence and an auditable file manifest, generated from the same reviewed publication cut | Product wrapper now generates a local pack through `/api/monitoreo/publication/evidence-pack`: `report.json`, `report.md`, `manifest.json`, `cut-snapshot.json`, `operational-package-status.json`, `operational-package-request.json`, `operational-package-request.csv`, `publication-decision.json`, `generated.xlsx`, `format-validation.json`, `data-validation.json`, `reference-validation.json`, `performance.json`, and a ZIP registered in the session file store. `operational-package-status.json` extracts the territorial/internal package gate into a standalone diagnostic artifact: applicable/status, `missing_ump_items`, `missing_tachas`, ready/blocked rows, apply/revalidation/publication flags, reference audit probe and a guardrail that audit rows must not be applied or used to mutate `.pulso` from the pack. `operational-package-request.csv/json` turns unresolved UMP/tacha blockers into a fillable payload request with `package_item`, target, payload requirement, required endpoint fields, source/cut, publication gate and `would_mutate_pulso=false`; it is a request, not an applyable payload. `publication-decision.json` computes `ready_to_publish`, `requires_review` or `blocked` from the authoritative preflight/reference gates and refuses optimistic override metadata when blockers remain. `cut-snapshot.json` captures project/audience/family/cut/source, status, scorecard, checks, blocking/warning codes, source row/tab evidence, artifact names, validation file names and explicit `generated_deliverables_outside_pulso=true`, `secrets_included=false`, `raw_data_included=false`. `reference-validation.json` materializes the preflight reference/canonical/PDF-vs-Sheets checks as a standalone artifact, while `manifest.json` records project, audience, cut, preflight status/score, file count, total bytes, and per-file path/size/SHA-256. Salidas exposes it as a per-audience `Paquete QA` action, can capture a blocked preflight instead of pretending the publication is ready, highlights `Solicitud de payload operacional` when the request CSV/JSON exists, shows direct download buttons for the request CSV/JSON, operational status and publication decision files registered outside the ZIP for handoff, and now provides the complementary completed-package upload path before review | Pass for reproducibility, operational-package status/request, computed publication decision, cut snapshot, checksum manifest, explicit reference-validation artifact, visible request highlight, direct request-file downloads, completed-package upload path and ZIP download contract; data/reference/decision validation records blocked drift when preflight is blocked | Pass for generated files, validation references, operational-package status/request, publication decision, cut snapshot, manifest and ZIP entries | Adequate backend/API/UI contract for minimum evidence export | Does not solve drift; captures it and keeps Sheets publication blocked | Partial | `api/R/router_monitoreo.R`; `apiMonitoreoPublicationEvidencePack()`; `MonitoreoOutputsWorkbench.tsx`; latest `test-monitoreo-deliverables.R` 334 pass; `test-monitoreo-publish-qa.R` 525 pass; `frontend/src/api/client.test.ts` + `MonitoreoOutputsWorkbench.test.ts` 66 pass; visual QA `tmp/visual-qa/monitoreo-territorial-operational-review-20260629/report.json`. |
| Territorial | Internal | `Ritmo diario` | Finalized UMP by day, cumulative progress, district/day and enumerator/day rhythms with human date labels | Generated and tested for key labels and dates | Pass for fixture | Pass | Good | None | Passed for fixture | Publication QA checks `UMP FINALIZADAS POR DÍA`, district and enumerator matrices, and no raw ISO dates. |
| Territorial | Internal | `Manzanas y responsables` | Summary cards, replacement availability/usage, and UMP/manzana/responsible relationship including replacement state | Generated with `RESUMEN UMP Y RESPONSABLES` and `RELACIÓN UMP · MANZANAS DE REFERENCIA · RESPONSABLES` | Pass for fixture and live reference structure | Pass: filter starts on correct header | Good | None | Passed | Live reference `Manzanas y responsables!A14:T18`; publication QA pass. |
| Territorial | Internal | `Responsables y rutas` | Observed responsible production plus planned assignment with replacement columns and `Encuesta 1`..`Encuesta 15` | Generated with observed and planned blocks | Pass for fixture structure | Pass: filter, date labels, no auto-resize | Good | None | Passed | Live reference `Responsables y rutas!A44:AD50`; publication QA pass. |
| Territorial | Internal | `Cuotas sexo y edad` | Summary status including `Subsanadas`, UMP compliance rows, expected matrix and missing categories | Generated; fixture includes titular/replacement rows, quota status, and missing matrix | Pass for fixture structure | Pass: conditional formatting, number formats, filter, frozen row | Good | None | Passed | Live reference `Cuotas sexo y edad!A1:AC16`; publication QA pass. |
| Territorial | Internal | `Validación de tiempos` | Operational duration classifications without technical rule leakage | Generated and tested | Pass for fixture | Pass | Good | None | Passed | Publication QA checks `Normal`, `Corto`, `Muy corto`, and excludes retired labels/rules. |
| Territorial | Internal | `GPS y territorio` | GPS state by response, outside-zone/outside-district/sin-GPS classifications | Generated and tested | Pass for fixture | Pass: GPS conditional formatting labels | Good | None | Passed | Publication QA checks `ID respuesta`, `Estado GPS por respuesta`, `Fuera de zona`, `Fuera de distrito`, `Sin GPS`. |
| Territorial | Internal | `Ocurrencias de campo` | Occurrence summary, category ranking, daily rhythm, district/day reports, state by UMP | Generated from real ACNURCG `.pulso` with `monitoreo_territorial_occurrences_snapshot` injected into the dashboard before publishing | Pass against validated Sheet occurrence totals: `84` reports, `5112` attempts, `669` effective, `4443` non-effective, `86.9%` non-effective rate | Pass: sectioned rows, freeze `A222`, filter `A221:S221`, 373 rows x 19 cols; QA now requires all six occurrence sections | Good; no empty placeholder | Direct evidence generation must mimic API hydration step for field occurrences | Passed | `tmp/qa/monitoreo-deliverables/territorial-acnur-20260628/ACNURCG-interno-sheets-hydrated.xlsx`; `xlsx-validation-hydrated.json`. |
| Territorial | Internal | `Anulaciones` | Active production annulments and impact by UMP/response | Local ACNURCG `.pulso` publishes 1 active tacha: P702, 311 responses, 88 valid, 13 UMP. P446 was reconstructed in memory and matches the Sheet's annulment totals when applied: 2 active tachas, 342 responses, 18 UMP | Diff vs validated Sheet until persisted; P446 itself is explainable, but not enough for full advance parity | Pass for local state formatting; `Anulaciones` is an explicit sectioned-sheet exception to the filter requirement | Good, but not exact reference parity until local state is updated with complete operational packages | Local `.pulso` lacks persisted P446 tacha and the validated Sheet's 30 UMP subsanadas state | Blocked by project state drift | `territorial-reference-comparison-hydrated.md`; `territorial-operational-state-sync.md`; `p446-memory-effect-on-subsanadas.json`. |
| Territorial | Internal | PDF territorial | Professional territorial advance PDF consistent with internal sheets | Generated 2-page A4 PDF from real ACNURCG local model: map/state page and district cards | Pass against local model; not expected to match validated Sheet metrics while `.pulso` state differs | Pass: rendered PNG pages, title/cut/source text extracted | Good visual quality; no overlap in rendered pages | Text labels differ from generic validator expectations, now checked as `Documento de avance` / `Avance del recojo territorial` | Passed local render QA | `ACNURCG-territorial-avance-hydrated.pdf`; `pdf-pages-hydrated/page-1.png`, `page-2.png`; `pdf-validation-hydrated.json`. |
| Territorial | Client | PDF territorial fixture | Professional territorial advance PDF consistent with client Sheets observed counts | Generated 2-page PDF fixture from `monitoreo_territorial_advance_report_pdf()` | Pass: PDF `ENCUESTAS` total is `22` and district values are `6 / 9 / 7`, matching client Sheets `Avance por distrito`; previous design-derived values `11 / 6 / 5 / S/D` are repaired | Pass: title, subtitle, cut and source text extracted; no internal trace strings | Good fixture coverage for PDF-vs-Sheets consistency | None after repair | Passed | `territorial-client-pdf-fixture.pdf`; `territorial-client-pdf-validation.json`; `test-monitoreo-publish-qa.R` 515 pass. |

Continuation validation 2026-06-29: after the completed-package upload path was
added to Salidas, the current tree passed
`test-monitoreo-deliverables.R` with 334 expectations,
`test-monitoreo-publish-qa.R` with 525 expectations,
`frontend/src/api/client.test.ts` plus
`MonitoreoOutputsWorkbench.test.ts` with 66 tests,
`pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast` in 40.64s,
and `git diff --check`.

Open issues:

- Exact territorial metric parity remains blocked until the local
  `ACNURCG.pulso` is saved with the same operational state as the validated
  Sheet. P446 can be reconstructed, but the 30 UMP subsanadas cannot be copied
  as labels: the current local engine reconstructs only 18/30 Sheet rows from
  operational suggestions. The current drift report now records this as 12 rows
  absent from local state, 18 suggestions not persisted, 1 missing active tacha
  and a `critical_reference_drift` publication gate.
- The package review/template makes the next unblocker explicit:
  `territorial-operational-package-template.csv` requires 30 UMP package rows
  and 1 active tacha row. The current partial candidate is `blocked`,
  `would_mutate_pulso=false`, `safe_to_apply=false`; it proves 18 UMP rows plus
  P446 have endpoint-ready payload, while 12 UMP rows still need exact movement
  packages. The missing-row diagnostic classifies those 12 as local cut/package
  conflicts or no-payload states; a live reference read confirms the final
  `Subsanada` status, and the live `Auditoría técnica` probe confirms all 12
  have visible audit rows. Those rows still do not provide the source-response
  movement trail, so they must come from the validated operational source. A
  future `review_ready` package still remains blocked for publication unless
  `application_plan` confirms endpoint payload readiness, coverage is complete,
  and the review serializes `publication_ready=true` after safe application and
  revalidation.
- Territorial internal preflight now requires an explicit validated-reference
  review. If the caller omits drift evidence, publication is blocked with
  `territorial_reference_drift_not_checked`; `confirmed_full_data=true` cannot
  make the report ready by itself.
- Territorial internal tab order now follows the validated Sheet:
  `Portada`, `Resumen territorial`, `Ritmo diario`, `Tabla maestra`,
  `Manzanas y responsables`, `Responsables y rutas`, `Cuotas sexo y edad`,
  `Validación de tiempos`, `GPS y territorio`, `Ocurrencias de campo`,
  `Base técnica`, `Auditoría técnica`, `Casos accionables`, `Anulaciones`.
- The local generator now hydrates field occurrences and preserves sectioned
  internal XLSX rows; direct evidence scripts must keep mimicking the endpoint
  hydration step.
- Publication QA now rejects XLSX artifacts that merely open but lack hydrated
  per-tab content: `xlsx_hydrated_sheets`, `xlsx_sheet_min_rows`,
  `xlsx_sheet_min_cols`, `xlsx_required_sections`, `xlsx_has_freeze` and
  `xlsx_has_filter` must all pass. Freeze/filter are checked per expected tab;
  filters are required by sheet contract, not by a single global marker.
- Acreditacion client/internal disposable Google Sheets were written and read
  back. The territorial Google Sheet reference was read only; no production
  Sheet, Apps Script or `.pulso` state was modified.
- Minimum preflight/scorecard helpers are now exposed through a product API and
  the Salidas Sheets workbench. Evidence-pack helpers remain backend/documented
  and still need a product control if the workflow should generate bundles from
  the UI.
- Performance is no longer a current closure blocker for the measured heavy
  routes. ACRDCONTA `advance_summary` first rebuild is `63.524s` under the 90s
  threshold, forced no-session-cache rebuild is `63.893s`, and second
  session-cache call is `2.070s`. Direct full report proxy is `81.610s`; PDF
  endpoint total is `65.354s` under the 120s threshold. Territorial hydrated
  XLSX now totals `50.754s` after observed-summary caching: dashboard
  `6.631s`, occurrences `4.257s`, tabs `34.121s`, workbook `5.745s`; workbook
  contract passes and `performance-summary.json` has status `passed` with zero
  items over threshold. Evidence:
  `tmp/qa/monitoreo-deliverables/performance-summary.md`,
  `tmp/qa/monitoreo-deliverables/acrdconta-performance-remeasure.md`, and
  `tmp/qa/monitoreo-deliverables/territorial-acnur-performance-remeasure-full/generation-meta-cache.json`.
