# Monitoreo deliverables roadmap

Date: 2026-06-29

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
| Publication preflight gate | A report can be generated while data, format, audience, source, reference review, operational package review or PDF consistency is still unsafe. | 5 | 3 | 2 | 2 | Minimum backend/API/UI contract implemented. `monitoreo_deliverables_preflight()` now blocks critical drift, missing territorial/internal reference review, missing operational-package review, partial/not endpoint-ready packages, and reviewed-but-not-applied packages. It uses explicit `publication_ready=true` as the operational-package pass signal when present. The current ACNURCG sample is `blocked`, score `50`, with `critical_reference_drift` plus `territorial_operational_package_not_ready`. |
| Canonical snapshot by cut and audience | Client/internal artifacts must be reproducible and comparable by cut, without re-reading volatile live sources. | 5 | 4 | 3 | 3 | Minimum pack-level snapshot implemented: each evidence pack now writes `cut-snapshot.json` with project/audience/family/cut/source, status, scorecard, checks, blocking/warning codes, row/tab evidence, artifact names, validation file names and explicit no-raw-data/no-secrets persistence flags. It also writes `manifest.json` with file inventory, total bytes and per-file SHA-256 plus `reference-validation.json` with publication reference/canonical checks, while keeping generated deliverables outside `.pulso`. Roadmap remainder: promote snapshots into a durable compact history only when historical comparisons must survive beyond the local evidence pack. |
| Audience contracts: client vs internal | Client reports must not leak PII/internal trace columns; internal reports need warnings, channels and operational traceability. | 5 | 2 | 2 | 4 | Implemented in generator tests and workbook contracts; keep expanding fixtures. |
| Report quality scorecard | Users need a clear "ready / incomplete / review / stale" signal instead of reading raw logs. | 4 | 3 | 2 | 5 | Minimum scorecard implemented as `status`, `score`, blocking count and warning count in preflight. Evidence packs now also include `publication-decision.json`, which derives `ready_to_publish`, `requires_review` or `blocked` from the authoritative gates and refuses optimistic override metadata when blockers remain. UI badges/API next. |
| Evidence pack export | Reviewers need a reproducible package: XLSX, PDF, validation JSON, reference comparison and logs. | 4 | 2 | 2 | 6 | Minimum backend/API/UI implemented: `/api/monitoreo/publication/evidence-pack` reuses the real preflight bundle, writes `report.json`, `report.md`, `manifest.json`, `cut-snapshot.json`, `operational-package-status.json`, `operational-package-request.json`, `operational-package-request.csv`, `publication-decision.json`, `generated.xlsx`, validation JSON, `reference-validation.json` and `performance.json`, registers a local ZIP `file_id`, exposes `apiMonitoreoPublicationEvidencePack()` with `download_url`, and Salidas now has a per-audience `Paquete QA` control with blocked/warnings/ready state plus ZIP download. Salidas also highlights `Solicitud de payload operacional` when the pack contains `operational-package-request.csv/json`, explicitly labeling it as non-mutating request evidence rather than an applyable payload, and now exposes direct download buttons for the request CSV/JSON, operational status and publication decision files registered by the backend. `operational-package-status.json` makes the territorial/internal unblocker explicit, and `operational-package-request.csv/json` turns missing UMP/tacha blockers into a fillable endpoint-payload request with `would_mutate_pulso=false`, while `manifest.json` carries project/audience/cut/status/score and per-file size/SHA-256 for integrity checks. |
| Sheet/PDF consistency comparator | PDF should never contradict client Sheets on key metrics. | 5 | 3 | 2 | 7 | Implemented for territorial fixture; extend to ACRDCONTA real-project artifacts. |
| Territorial reference diff classifier | Differences against the validated Sheet need labels: error, justified improvement, cut drift, source drift or blocker. | 4 | 2 | 2 | 8 | Minimum drift report implemented in `monitoreo_deliverables_territorial_drift_report()`. It now records the 12/18 UMP breakdown, missing tacha, required operational package and `critical_reference_drift` gate; exact parity remains blocked by local `.pulso` state drift. |
| ACRDCONTA canonical-count fixture | CI should guard Egresados `270 / 157 / 5 / 0 / 108` without reopening the full heavy project every run. | 5 | 3 | 2 | 9 | Implemented minimum: compact publication fixture exercises official base, the nine auxiliary bridges, duplicate channels and no-base responses through client/internal publication models, final client/internal tabs and generated client/internal XLSX artifacts. It now also protects sparse internal workbooks by keeping empty-but-contractual channel, minimum/progress and tracking columns. Roadmap remainder: persist a cut snapshot if reproducible historical comparisons are needed. |
| PII and technical-column validator | Client workbooks must exclude raw IDs, phones, GPS internals and technical fields unless explicitly allowed. | 5 | 2 | 2 | 10 | Implemented as generator forbidden checks plus preflight warning for client PII/internal columns; formalize per audience in UI. |
| Professional formatting validator | A generated workbook is not publishable if it lacks freeze panes, filters, widths, styles, percentages or clear sections. | 4 | 2 | 1 | 11 | Implemented in XLSX contract checks, including compact ACRDCONTA client/internal workbooks and structured internal empty-state rows; extend to live Google Sheets batchUpdate readback. |
| PDF render verifier | PDF must prove pages, title, cut, sources, metrics and no truncated tables. | 4 | 3 | 2 | 12 | Partially implemented through generated renders and text checks; add page-image geometry checks. |
| Publication changelog between cuts | Client and internal audiences need a concise "what changed since last cut" summary. | 4 | 3 | 2 | 13 | Roadmap: depends on canonical snapshots. |
| Source freshness matrix | Reports need visible source timestamps, channels, sync freshness and stale badges. | 4 | 3 | 2 | 14 | Roadmap: build on existing `Corte y fuentes` and Monitoreo source scopes. |
| Heavy report cache policy | Real projects are slow to rebuild and persisted cache keys can invalidate first-open warm paths. | 4 | 4 | 3 | 15 | Current measured heavy paths pass: Acreditacion now reuses a precomputed canonical `case_rollup`; real ACRDCONTA `advance_summary` is `63.524s` under the 90s threshold, second session-cache call is `2.070s`, and PDF endpoint total is `65.354s` under the 120s threshold. Territorial hydrated XLSX now totals `50.754s` after common-cache and observed-summary-map reuse. Keep compact snapshot/cache policy as roadmap for future cuts, but performance is not the current closure blocker. |
| Dry-run publication mode | Analysts should validate destination, permissions, format and payload before writing to Google Sheets. | 4 | 3 | 2 | 16 | Roadmap: reuse current generator QA without external writes. |
| Reference-safe reconciliation workflow for ACNURCG | Exact territorial parity is blocked until local project state matches the validated Sheet's tachas/subsanadas packages. | 4 | 3 | 4 | 17 | Minimum read-only review/template is now productized end to end: `monitoreo_deliverables_territorial_operational_package_review()` plus `/api/monitoreo/territorial/operational-package/review` validate inline rows or uploaded CSV/XLSX `file_id` inputs, return downloadable review/template files, and Salidas exposes `Revisar paquete operacional` only for territorial/internal confirmed output. Salidas can upload both `Drift / referencia validada` (`monitoreo_reference_drift`, passed as `drift_file_id`) and `Paquete operacional completado` (`monitoreo_operational_package`, passed as `package_file_id`), so the UI now matches the backend requirement for explicit drift evidence before review. Preflight, evidence-pack and Sheets publish now also accept `reference_drift_file_id` plus `operational_package_review`, and Salidas forwards the reviewed evidence to those gates. The review separates documentary coverage, endpoint payload readiness and publication readiness through `application_plan`, `apply_ready`, `requires_revalidation` and `publication_ready`: `review_ready` is not publishable unless the UMP movements include source/target blocks, district, sex, age group and response IDs, tachas include responsible identity plus reason, the package has been applied/revalidated, and `publication_ready=true`. Salidas also separates `applicable` from `ready`: endpoint-ready packages stay amber until applied and revalidated. The UI downloads evidence and never applies changes. Applying the completed package must still happen only through safe Monitoreo operational-adjustment/tacha flows and then be revalidated. |
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
  `territorial_reference_drift_not_checked`. When drift is blocking, it also
  accepts `operational_package_review` and separates missing review, partial
  package, and reviewed-but-not-applied states into distinct blocking issues.
- `monitoreo_deliverables_territorial_drift_report()` writes the mandatory
  territorial drift CSV/MD and blocks publication when validated Sheet state is
  not persisted locally. The current ACNURCG artifact explains 30 missing
  Sheet UMP subsanadas as 12 rows absent from local project state plus 18 engine
  suggestions not persisted, records 1 missing active tacha, and stamps the
  blocking rows with `critical_reference_drift`.
- `monitoreo_deliverables_territorial_operational_package_review()` writes a
  read-only review JSON/MD/CSV plus
  `territorial-operational-package-template.csv`. The current ACNURCG review is
  `blocked`, not publishable: 30 UMP rows and 1 tacha row are required, no
  `.pulso` mutation is performed, 19 candidate rows are endpoint-ready, 12 UMP
  movement rows are still missing, and publication remains gated by
  `critical_reference_drift`. The product endpoint
  `/api/monitoreo/territorial/operational-package/review` now exposes the same
  review contract for inline package rows or uploaded CSV/XLSX `file_id`s and
  registers the template/review JSON/MD/CSV as local downloadable files. A
  `review_ready` result still keeps `blocks_publication = true`; `safe_to_apply`
  is true only when the new `application_plan` confirms endpoint-ready movement
  payload for subsanadas and responsible/reason payload for tachas. The package
  must then be applied through safe Monitoreo flows and the report regenerated.
- `territorial-missing-ump-reference-audit-probe.*` adds the latest read-only
  live evidence for the remaining 12 UMP rows. It confirms each UMP has visible
  `Auditoría técnica` rows in the validated Sheet, but 5/12 do not match the
  validated `validas` count and none can reconstruct a safe endpoint payload
  without the source-response movement trail.
- `territorial-live-reference-confirmation-20260629.*` re-checks the validated
  Sheet on 2026-06-29. `Cuotas sexo y edad` still reports `Subsanadas = 30`,
  and the same 12 unresolved rows remain `Subsanada`; this confirms the blocker
  is current, not a stale diagnostic snapshot.
- The operational package review now accepts that probe as request evidence
  (`reference_audit_probe`, `referenceAuditProbe`, `audit_probe` or
  `auditProbe`) and returns it as
  `monitoreo_deliverables_territorial_reference_audit_probe_v1`. This
  productizes the distinction between "reference audit rows exist" and
  "endpoint-ready movement payload exists". The probe's own
  `blocks_publication` flag now participates in the review gate. The review
  also serializes `apply_ready`, `requires_revalidation` and
  `publication_ready`, so a reconstructible endpoint-ready probe still remains
  `publication_ready=false` until safe application and revalidation happen.
- The territorial/internal Salidas workbench now exposes that same review as a
  safe UI action: `Revisar paquete operacional` requires internal confirmation,
  calls the review endpoint for the active cut, and downloads the template,
  review CSV, report JSON and report MD without mutating `.pulso`.
- `monitoreo_deliverables_evidence_pack()` writes the minimum reproducible
  evidence pack with `report.json`, `report.md`, `manifest.json`, generated
  XLSX/PDF copies or references, `cut-snapshot.json`,
  `operational-package-status.json`, `operational-package-request.json`,
  `operational-package-request.csv`, `publication-decision.json`, format
  validation, data validation, reference validation and performance JSON.
  `operational-package-status.json` extracts the territorial/internal package
  gate into a diagnostic artifact with missing UMP/tacha counts, readiness
  flags, reference audit probe and a guardrail against mutating `.pulso` from
  audit rows. `operational-package-request.csv/json` converts unresolved UMP
  and tacha gaps into a fillable endpoint-payload request while still declaring
  `would_mutate_pulso=false`. `cut-snapshot.json` captures the reviewed
  cut/audience contract, row/tab evidence, artifact names and
  no-raw-data/no-secrets persistence flags. `publication-decision.json`
  converts the preflight/reference gates into `ready_to_publish`,
  `requires_review` or `blocked` and preserves conflicting requested decisions
  as metadata instead of letting them approve publication. `reference-validation.json`
  materializes reference drift, canonical-count, old-summary and
  PDF-vs-Sheets gates as a standalone artifact. `manifest.json` records the
  pack inventory, total bytes and per-file SHA-256 for integrity checks. The
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
- Publication QA now includes a compact ACRDCONTA canonical fixture. It builds
  270 official Egresados, 157 canonical completions, 5 partials, the nine
  auxiliary bridge pairs, duplicate response channels and no-base responses,
  then verifies both client and internal publication models stay at
  `270 / 157 / 5 / 0 / 108`. It also checks the final client tabs `Reporte`,
  `Detalle del avance`, and `Corte y fuentes` plus final internal tabs
  `Resumen`, `Avance por encuesta`, `Seguimiento`, `Alertas`, and
  `Corte y fuentes` for executive/internal progress text, rhythm rows and
  source rows. The same fixture now writes client/internal XLSX artifacts from
  those final tabs and validates sheet order, hydrated rows/columns, required
  sections, freeze panes, filters, styles, package integrity and absence of the
  stale `145 de 270` summary. Sparse internal workbook sections keep
  empty-but-contractual columns such as `Canal operativo`,
  `Responsable de carga`, `Mínimo esperado` and `Brecha mínimo` through
  structured empty-state rows.
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
  `preflight-sample.json` is blocked by `critical_reference_drift` plus the
  partial operational-package blocker with score `50`, while
  `preflight-reference-gate-sample.json` proves that
  `confirmed_full_data=true` cannot bypass a missing territorial reference
  review.

These contracts unblock the future Deliverables Center API/UI, but do not close
the goal: ACNURCG still has critical reference drift. Publication cannot move
to ready until the exact operational package behind the validated Sheet is
available and applied through a safe Monitoreo review/import flow, or the
remaining differences are proven harmless with evidence.
