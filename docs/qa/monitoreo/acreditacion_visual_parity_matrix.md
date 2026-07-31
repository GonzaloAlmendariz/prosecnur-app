# Acreditacion visual parity matrix

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-30
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Monitoreo de acreditación](../historico/monitoreo-acreditacion-2026-06.md)

## Scope lock - Iteration 24

- Canonical comparison target: original accreditation collector/editor affordances and the independent profile route for `Modelo > Enlaces`.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: load local snapshot, inspect first viewport and scroll behavior, avoid source sync or destructive saves on the user project.

## Scope lock - Iteration 25

- Canonical comparison target: original `PhoneDailyTrend` chart grammar and independent `Telefono > Dia`.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: direct `Telefono > Dia` route QA, screenshot inspection, and comparator capture; no `.pulso` writes or mutating actions.
- Data source of truth: raw `monitoreo_telefonico.avance_efectivo_dia` block, including the `Sin fecha` row.

## Scope lock - Iteration 26

- Canonical comparison target: original and independent `Telefono > Alertas` first viewport.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: comparator target deep-link, screenshot inspection, and hydration blockers; no `.pulso` writes or mutating actions.
- Source of truth: phone supervision workflow (`Casos telefónicos por revisar`, alert counters, priority cards and control sample) must hydrate in both panes before scoring visual parity.

## Scope lock - Iteration 27

- Canonical comparison target: independent `Telefono > Alertas` alert-count semantics against the canonical `Alertas` sheet.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: direct `Telefono > Alertas` route QA, screenshot inspection, and a comparator attempt; no `.pulso` writes or mutating actions.
- Source of truth: `phone_summary` must expose `monitoreo_telefonico` plus `alertas`, and the independent supervision board must prefer canonical active alerts over pending/insistence fallback rows.

## Scope lock - Iteration 28

- Canonical comparison target: original and independent `Telefono > Alertas` readiness after `phone_summary` cache and scope interleaving.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: strict side-by-side comparator with a fresh session, target-scope prefetch and screenshot inspection; no `.pulso` writes or mutating actions.
- Source of truth: once a valid `phone_summary` has loaded, later non-phone report scopes must not replace the visible phone alert workbook while the active view remains `Telefono`.

## Scope lock - Iteration 29

- Canonical comparison target: original and independent `Consultas > Casos` first viewport.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: strict side-by-side comparator, screenshot inspection and baseline direct QA; no `.pulso` writes or case-reconciliation mutations.
- Source of truth: `queries_summary` must expose official cases, audit cases and source counts, and both frames must keep that report while the active view remains `Consultas`.

## Scope lock - Iteration 30

- Canonical comparison target: independent `Consultas > Efectivas` and `Consultas > Faltantes` first viewport against the query explorer grammar.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: direct ACRDCONTA QA screenshots for both tabs, no `.pulso` writes and no case-reconciliation mutations.
- Source of truth: `queries_summary` official cases, `internal_queries.pending_exit`, filterable date/channel/collector facets and empty-state behavior for missing pending exits.

## Scope lock - Iteration 31

- Canonical comparison target: `Consultas` direct-route QA harness readiness for `queries_summary` prefetch and session reuse.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: same-session ACRDCONTA screenshots/logs, no `.pulso` writes, no case-reconciliation mutations, no product UI changes.
- Source of truth: one seeded session must be used by prefetch and page navigation; heavy report scopes may wait long enough for cold ACRDCONTA builds, but reports must distinguish cache-readiness from true product performance.

## Matrix

| View | Canonical expectation | Independent expectation | Evidence | Status |
| --- | --- | --- | --- | --- |
| `Modelo > Enlaces` header | Compact operational model context with real saved collector count. | Same hierarchy, with collector manager directly visible. | `tmp/visual-qa/monitoreo-acreditacion-channel-selector-iteration24-loaded-final/acreditacion-channel-selector-loaded-final-monitoreo-1440x900-auto.png` shows the matrix directly under the model summary. | Passed for this slice |
| Survey selector | Visible source rows with actor, channel badge and editable channel selector. | Present without modal-only dependency. | Final ACRDCONTA screenshot shows 6 connected surveys with Ficha QR/Telefonico/Web-link/WhatsApp badges and selectors. | Passed |
| Collector selector | Cards/rows show collector name, source, use, modality/channel, responses and recipients. | Present, compact and keyboard-friendly. | Final ACRDCONTA screenshot shows 19 collector cards with use/channel/modality controls and response/recipient/link/effective metrics. | Passed |
| Empty/error/loading | No blank panels; errors are actionable and local snapshot mode is explicit. | Present. | Initial attached QA exposed the loading state; final loaded QA waited for collector card/empty state. Status chips report `Snapshot local`. | Passed |
| ACRDCONTA loaded QA | No overflow/overlap, no stuck loading state, no API/resource/page/wait issues. | `ui-quick-check` or browser screenshot evidence. | `tmp/visual-qa/monitoreo-acreditacion-channel-selector-iteration24-loaded-final/report.json`: ok true, 1 capture, 0 visual issues, 0 scroll jails, 0 overflow, 0 page/API/resource/project/wait issues. | Passed |
| `Telefono > Dia` chart grammar | Canonical chart surface: trend header, legend chips, KPI row, stacked bars and accumulated line. | Independent profile should render the same grammar without importing `MonitoreoPage.tsx`. | `tmp/visual-qa/acreditacion-telefono-dia-phone-trend-14cuts-20260629/acreditacion-telefono-dia-phone-trend-14cuts-monitoreo-1440x1000-portable.png` shows `Ritmo diario y acumulado`, legend chips, four KPI cards and Plotly bars/line. | Passed for direct route |
| `Telefono > Dia` data clarity | Daily block totals remain traceable and do not drop valid rows. | Preserve `Sin fecha` as a visible category because it exists in the raw ACRDCONTA block. | Direct QA screenshot shows `TOTAL PERIODO 145`, `14 cortes diarios`, final `Sin fecha` category, 141 effective and 4 rejection counts; R readback of `.pulso` found 14 rows in `avance_efectivo_dia`. | Passed for independent profile |
| Header artifact | No clipped `ECHA` / sticky table header fragment in the first viewport. | Mini-table artifact removed by replacing table-first surface with chart-first surface. | Direct QA screenshot and report `tmp/visual-qa/acreditacion-telefono-dia-phone-trend-14cuts-20260629/report.json` show the chart surface, 0 overflow and no visible `ECHA`. | Passed |
| Comparator `Telefono/Dia` | Both panes should hydrate and expose comparable daily trend surfaces. | Capture should show the remaining exact parity gap, not block direct route approval. | `tmp/visual-qa/acreditacion-parity-telefono-dia-phone-trend-20260629/report.json` captured two frames but `ready=0` because the harness daily-series heuristic does not recognize `TOTAL PERIODO`; screenshot `15-telefono-dia.png` shows original 144/13 vs independent 145/14. | Partial / heuristic timeout |
| Comparator `Telefono/Dia` undated parity | Both panes hydrate and preserve the raw undated row in the daily trend. | Original and independent should both show `TOTAL PERIODO 145` and `14 cortes diarios`. | `tmp/visual-qa/acreditacion-parity-telefono-dia-undated-canonical-20260629/report.json`: `ready=1`, both frames `hydration.ready=true`, no blockers/errors; screenshot `15-telefono-dia.png` shows both panes at 145/14 with the same chart grammar. | Passed |
| `Telefono > Alertas` target hydration | Comparator must open both iframes directly on `Telefono > Alertas`, not on the default source view or an empty phone fallback. | Independent and original must both expose real phone alert metrics before screenshotting. | `tmp/visual-qa/acreditacion-alertas-target-url-comparator-20260629/report.json`: `ready=1`, both frames `hydration.ready=true`, no blockers/errors, `wait_ms=80327`; screenshot `17-telefono-alertas.png` shows both panes on the alert board. | Passed for hydration |
| `Telefono > Alertas` visual/data parity | Original alert counters, priority cards and control-sample hierarchy should match or intentionally diverge with documentation. | Independent should not inflate/relabel alert counts without a documented canonical source. | The same screenshot shows residual mismatch: original reports 48 active alerts and 2 focos, while independent reports 76 active alerts and 5 focos with a different first-viewport hierarchy. | Partial / data parity open |
| `Telefono > Alertas` canonical alert count | Independent alert counters should use the same canonical alert sheet as the original instead of deriving active counts from pending/insistence rows. | Show 48 active alerts, 2 focos and canonical priority cards on ACRDCONTA. | `tmp/visual-qa/acreditacion-telefono-alertas-alert-sheet-session-guard-20260629/report.json` passed with 0 visual/overflow/page/API/resource/wait issues; screenshot `quick-monitoreo-1600x1000-auto.png` shows 48 active alerts and 2 focos. | Passed for direct route |
| `Telefono > Alertas` comparator after alert-sheet repair | Both frames should be screenshot-ready and show the same alert count source. | Modular frame should retain 48/2 without page errors. | `tmp/visual-qa/acreditacion-parity-telefono-alertas-alert-sheet-20260629/report.json` captured both frames; modular frame hydrated and text sample includes `ALERTAS ACTIVAS 48`, but the legacy frame stayed on `Sin monitoreo telefónico`, so `ready=0`. This is a legacy-frame readiness/harness limit, not an independent count regression. | Partial / comparator blocked |
| `Telefono > Alertas` comparator after legacy preservation | Both frames should stay on the phone alert workbook even when `source`, `advance_summary` or `queries_summary` responses arrive after `phone_summary`. | Original and independent should both show real alert counters from ACRDCONTA before capture. | `tmp/visual-qa/acreditacion-parity-telefono-alertas-preserve-fresh-20260629/report.json`: `ready=1`, two frames, both `hydration.ready=true`, no blockers/errors, `environment_issues=0`, `wait_ms=36616`; screenshot `17-telefono-alertas.png` shows both panes with 48 active alerts and 2 focos. | Passed |
| `Consultas > Casos` distribution first viewport | Before the table, the analyst should see distribution by actor and source/base, with query status and active filters visible. | Independent profile should not jump directly from filters to table/detail; it should expose the same executive distribution grammar. | `tmp/visual-qa/acreditacion-parity-consultas-casos-distribution-preserve-20260629/report.json`: `ready=1`, both frames hydrated, no blockers/errors, `environment_issues=0`; screenshot `09-consultas-casos.png` shows both panes with `Por actor` and `Por fuente/base` donut/table cards, 519 cases and 12 sources. | Passed for this slice |
| `Consultas > Efectivas` chart facets | The first viewport should expose the effective-count answer, visible date/channel/collector filters and chart/empty panels before the case table. | Independent profile should not jump directly from KPI strip to case detail; chart cards must be real filter controls. | `tmp/visual-qa/acreditacion-consultas-efectivas-prefetch-stable-iteration31-20260629/report.json`: direct ACRDCONTA QA produced `ok=true`, 0 wait misses, 0 visual/overflow/page/API/resource issues and screenshot `quick-monitoreo-1440x1000-portable.png` with `Por fecha` / `Por canal` cards plus the visible `Fecha` filter. Caveat: this screenshot was taken before the no-`devPulso` same-session patch and used a second page session; the same-session rerun confirmed `queries_summary` cache reuse in API logs but stalled before writing the screenshot. | Passed direct route visually / same-session screenshot pending |
| `Consultas > Faltantes` empty pending-exit flow | If there are no cases that actually leave pending, the view should show `Sin flujo disponible`, a compact local detail with 0 rows and no inflated actor table. | Independent profile must not summarize the whole 519-case universe as recovered/missing flow. | `tmp/visual-qa/acreditacion-consultas-faltantes-same-session-iteration31-20260629/report.json`: direct ACRDCONTA QA produced `ok=true`, 0 wait misses, matching stack/result session, URL without `devPulso`, 0 visual/overflow/page/API/resource issues and screenshot `quick-monitoreo-1440x1000-portable.png` showing 156 still without response, `0 casos` leaving pending, compact `Sin flujo disponible`, and local detail `0 filas`. API log shows `queries_summary` cache reuse after cold prefetch. | Passed direct route same-session / comparator pending |
| `Consultas` QA harness session reuse | Prefetch and browser navigation should share the same loaded `.pulso` session so cold `queries_summary` is not built twice. | The harness should still surface real slowness rather than hiding it behind a short timeout or duplicate session. | `scripts/ui-quick-check.mjs` now gives heavy Monitoreo scopes a 90s default prefetch budget, uses configurable click timeout, and omits `devPulso` when `stack.session` exists. Faltantes report confirms URL/session reuse; API log shows cold `queries_summary build_ms=65176` followed by cached `build_ms=0 total_ms=1953`. The Efectivas rerun log also shows cold `build_ms=61834` followed by repeated cached `build_ms=0` responses. | Harness fixed for this failure; product cold performance still open |
