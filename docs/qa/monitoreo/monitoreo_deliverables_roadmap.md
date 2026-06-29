# Monitoreo deliverables roadmap

Date: 2026-06-28

Scope: Entregables / Publicacion / Control de salida for Monitoreo.

Source of truth:

- Acreditacion ACRDCONTA: official base plus SurveyMonkey responses reconciled
  to canonical cases. Current Egresados truth is `270 / 157 / 5 / 0 / 108`.
- Territorial ACNURCG: validated internal Google Sheet
  `https://docs.google.com/spreadsheets/d/1hDWdoE-yxadwC3EPTXtUB8AWWXsR6dv-Givw9g05hD8/edit?gid=240203097#gid=240203097`.
- Generator QA: `api/tests/testthat/test-monitoreo-publish-qa.R`.

## Prioritized recommendations

| Recommendation | Problem solved | Impact | Effort | Risk | Priority | Implement now |
|---|---|---:|---:|---:|---:|---|
| Deliverables Center for Monitoreo | Analysts need one place to see client/internal Sheets, XLSX, PDF, cut, sources, QA evidence and publication state before sending anything out. | 5 | 4 | 3 | 1 | Roadmap: build UI after backend contracts remain green. |
| Publication preflight gate | A report can be generated while data, format, audience, source, reference review or PDF consistency is still unsafe. | 5 | 3 | 2 | 2 | Minimum backend/API/UI contract implemented. `monitoreo_deliverables_preflight()` now blocks both critical drift and missing territorial/internal reference review; evidence-pack export remains next. |
| Canonical snapshot by cut and audience | Client/internal artifacts must be reproducible and comparable by cut, without re-reading volatile live sources. | 5 | 4 | 3 | 3 | Roadmap: persist compact manifest outside generated deliverables; keep large files outside `.pulso`. |
| Audience contracts: client vs internal | Client reports must not leak PII/internal trace columns; internal reports need warnings, channels and operational traceability. | 5 | 2 | 2 | 4 | Implemented in generator tests and workbook contracts; keep expanding fixtures. |
| Report quality scorecard | Users need a clear "ready / incomplete / review / stale" signal instead of reading raw logs. | 4 | 3 | 2 | 5 | Minimum scorecard implemented as `status`, `score`, blocking count and warning count in preflight; UI badges/API next. |
| Evidence pack export | Reviewers need a reproducible package: XLSX, PDF, validation JSON, reference comparison and logs. | 4 | 2 | 2 | 6 | Minimum backend/API/UI implemented: `/api/monitoreo/publication/evidence-pack` reuses the real preflight bundle, writes `report.json`, `report.md`, `generated.xlsx`, validation JSON and `performance.json`, registers a local ZIP `file_id`, exposes `apiMonitoreoPublicationEvidencePack()` with `download_url`, and Salidas now has a per-audience `Paquete QA` control with blocked/warnings/ready state plus ZIP download. |
| Sheet/PDF consistency comparator | PDF should never contradict client Sheets on key metrics. | 5 | 3 | 2 | 7 | Implemented for territorial fixture; extend to ACRDCONTA real-project artifacts. |
| Territorial reference diff classifier | Differences against the validated Sheet need labels: error, justified improvement, cut drift, source drift or blocker. | 4 | 2 | 2 | 8 | Minimum drift report implemented in `monitoreo_deliverables_territorial_drift_report()`. It now records the 12/18 UMP breakdown, missing tacha, required operational package and `critical_reference_drift` gate; exact parity remains blocked by local `.pulso` state drift. |
| ACRDCONTA canonical-count fixture | CI should guard Egresados `270 / 157 / 5 / 0 / 108` without reopening the full heavy project every run. | 5 | 3 | 2 | 9 | Roadmap: add a compact fixture/snapshot derived from the saved `.pulso`. |
| PII and technical-column validator | Client workbooks must exclude raw IDs, phones, GPS internals and technical fields unless explicitly allowed. | 5 | 2 | 2 | 10 | Implemented as generator forbidden checks plus preflight warning for client PII/internal columns; formalize per audience in UI. |
| Professional formatting validator | A generated workbook is not publishable if it lacks freeze panes, filters, widths, styles, percentages or clear sections. | 4 | 2 | 1 | 11 | Implemented in XLSX contract checks; extend to live Google Sheets batchUpdate readback. |
| PDF render verifier | PDF must prove pages, title, cut, sources, metrics and no truncated tables. | 4 | 3 | 2 | 12 | Partially implemented through generated renders and text checks; add page-image geometry checks. |
| Publication changelog between cuts | Client and internal audiences need a concise "what changed since last cut" summary. | 4 | 3 | 2 | 13 | Roadmap: depends on canonical snapshots. |
| Source freshness matrix | Reports need visible source timestamps, channels, sync freshness and stale badges. | 4 | 3 | 2 | 14 | Roadmap: build on existing `Corte y fuentes` and Monitoreo source scopes. |
| Heavy report cache policy | Real projects are slow to rebuild and persisted cache keys can invalidate first-open warm paths. | 4 | 4 | 3 | 15 | Current measured heavy paths pass: Acreditacion now reuses a precomputed canonical `case_rollup`; real ACRDCONTA `advance_summary` is `63.524s` under the 90s threshold, second session-cache call is `2.070s`, and PDF endpoint total is `65.354s` under the 120s threshold. Territorial hydrated XLSX now totals `50.754s` after common-cache and observed-summary-map reuse. Keep compact snapshot/cache policy as roadmap for future cuts, but performance is not the current closure blocker. |
| Dry-run publication mode | Analysts should validate destination, permissions, format and payload before writing to Google Sheets. | 4 | 3 | 2 | 16 | Roadmap: reuse current generator QA without external writes. |
| Reference-safe reconciliation workflow for ACNURCG | Exact territorial parity is blocked until local project state matches the validated Sheet's tachas/subsanadas packages. | 4 | 3 | 4 | 17 | Minimum read-only review/template is now productized end to end: `monitoreo_deliverables_territorial_operational_package_review()` plus `/api/monitoreo/territorial/operational-package/review` validate inline rows or an uploaded CSV/XLSX `file_id`, return downloadable review/template files, and Salidas exposes `Revisar paquete operacional` only for territorial/internal confirmed output. The review now separates documentary coverage from endpoint payload readiness through `application_plan`: `review_ready` is not `safe_to_apply` unless the UMP movements include source/target blocks, district, sex, age group and response IDs, and tachas include responsible identity plus reason. The UI downloads evidence and never applies changes. Applying the completed package must still happen only through safe Monitoreo operational-adjustment/tacha flows and then be revalidated. |
| Live Google Sheets format readback | XLSX contract is strong, but live Sheets formatting can drift after batchUpdate. | 3 | 4 | 3 | 18 | Roadmap: use disposable spreadsheet readback before production destinations. |

## Product direction

The next product step is not another isolated export button. Monitoreo should
promote publication to a small control center with:

- one cut selector;
- audience toggle (`client` / `internal`);
- artifact list with status badges;
- preflight results;
- source freshness;
- quality score;
- evidence pack;
- reference comparison when a validated reference exists;
- dry-run and publish actions.

The backend repair already gives this future UI useful contracts: separated
audiences, professional workbook checks, PDF consistency checks, ACRDCONTA
canonical counts, territorial reference evidence, and local QA artifacts.

## Minimum implemented backend contracts - 2026-06-29

- `monitoreo_deliverables_preflight()` returns `ready`, `warnings` or
  `blocked`, a 0-100 score, blocking issues, warnings, evidence and a minimal
  scorecard. It covers audience, project, cut, source, completeness, canonical
  counts, sheets, format validation, PDF evidence, critical drift, cold
  performance, client PII/internal columns and `confirmed_full_data`. For
  territorial internal publication, it also requires an explicit validated
  reference-drift review; omitting that review now blocks with
  `territorial_reference_drift_not_checked`.
- `monitoreo_deliverables_territorial_drift_report()` writes the mandatory
  territorial drift CSV/MD and blocks publication when validated Sheet state is
  not persisted locally. The current ACNURCG artifact explains 30 missing
  Sheet UMP subsanadas as 12 rows absent from local project state plus 18 engine
  suggestions not persisted, records 1 missing active tacha, and stamps the
  blocking rows with `critical_reference_drift`.
- `monitoreo_deliverables_territorial_operational_package_review()` writes a
  read-only review JSON/MD/CSV plus
  `territorial-operational-package-template.csv`. The current ACNURCG review is
  `missing_package`: 30 UMP rows and 1 tacha row are required, no `.pulso`
  mutation is performed, and publication remains gated by
  `critical_reference_drift`. The product endpoint
  `/api/monitoreo/territorial/operational-package/review` now exposes the same
  review contract for inline package rows or uploaded CSV/XLSX `file_id`s and
  registers the template/review JSON/MD/CSV as local downloadable files. A
  `review_ready` result still keeps `blocks_publication = true`; `safe_to_apply`
  is true only when the new `application_plan` confirms endpoint-ready movement
  payload for subsanadas and responsible/reason payload for tachas. The package
  must then be applied through safe Monitoreo flows and the report regenerated.
- The territorial/internal Salidas workbench now exposes that same review as a
  safe UI action: `Revisar paquete operacional` requires internal confirmation,
  calls the review endpoint for the active cut, and downloads the template,
  review CSV, report JSON and report MD without mutating `.pulso`.
- `monitoreo_deliverables_evidence_pack()` writes the minimum reproducible
  evidence pack with `report.json`, `report.md`, generated XLSX/PDF copies or
  references, format validation, data validation and performance JSON. The
  product wrapper `/api/monitoreo/publication/evidence-pack` now builds the
  pack from the same precomputed publication tabs used by preflight/Sheets,
  registers a local session ZIP as `monitoreo_publication_evidence_pack`, and
  returns `file_id`, filename, size, tabs, preflight and pack metadata without
  writing Google Sheets or mutating `.pulso`.
- `monitoreo_deliverables_performance_summary()` writes JSON/Markdown
  performance evidence for cold generation thresholds.
- Acreditacion report generation now passes one precomputed `case_rollup`
  through the client report and full report builders, avoiding redundant
  `internal_queries` recomputation in summary, daily and source helpers.
- ACRDCONTA real-project performance was remeasured after that repair:
  `advance_summary` first rebuild `63.524s`, forced no-session-cache rebuild
  `63.893s`, second cache call `2.070s`, and direct full report proxy
  `81.610s`. The PDF endpoint path was then remeasured directly: endpoint
  response `60.772s`, background PDF render `4.582s`, total until PDF done
  `65.354s`.
- ACNURCG territorial full internal XLSX was remeasured with precomputed tabs,
  a common in-memory publication cache and an observed-summary map: dashboard
  `6.631s`, occurrences hydration `4.257s`, tab construction `34.121s`,
  workbook writing `5.745s`, total `50.754s`. The workbook contract passes,
  the hydrated path is under the 90s target, and `performance-summary.json`
  reports `passed` with zero items over threshold.
- The regenerated preflight evidence reflects the current state:
  `preflight-sample.json` is blocked only by `critical_reference_drift` with
  score `75`, while `preflight-reference-gate-sample.json` proves that
  `confirmed_full_data=true` cannot bypass a missing territorial reference
  review.

These contracts unblock the future Deliverables Center API/UI, but do not close
the goal: ACNURCG still has critical reference drift. Publication cannot move
to ready until the exact operational package behind the validated Sheet is
available and applied through a safe Monitoreo review/import flow, or the
remaining differences are proven harmless with evidence.
