# Acreditacion channel selector matrix

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-29
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Monitoreo de acreditación](../historico/monitoreo-acreditacion-2026-06.md)

Fecha: 2026-06-29

## Scope lock

- Module: Monitoreo / Acreditacion / Consultas.
- Product files touched: `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`.
- QA docs touched: this file.
- Explicit exclusions: backend R, `.pulso` projects, Territorial, Aulas, Telefonico, source sync clicks and case reconciliation mutations.
- Main risk: a selector can hide valid cases if it targets a display label that differs from the backend filter key.
- Minimum validation command: `pnpm --dir frontend typecheck`; `pnpm --dir frontend test -- src/features/monitoreo/profiles/profileImports.test.ts src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts`; `git diff --check`; `node scripts/ui-quick-check.mjs --project <ruta de trabajo local> --route /monitoreo --viewport 1440x1000 --layout-preset portable --click-tab Consultas --post-click-wait-selector .mon-case-filterbar --out tmp/visual-qa/acreditacion-consultas-channel-filter-20260629 --prefetch-route-data --fail-on-issues`.

## Selector contract

| Selector | Backend/query field | UI source | Count behavior | State |
| --- | --- | --- | --- | --- |
| Busqueda | `search` | codigo, nombre, correo, `response_id` via `filterInternalQueryCases` | Filters all facets | Existing |
| Actor | `actor` | `item.actor` | Facet count excludes current actor filter | Existing |
| Canal | `channel` | `item.channel` | Facet count excludes current canal filter | Added 2026-06-29 |
| Fuente | `source` | `item.source_label`, fallback `source_id` / `base_source` | Facet count excludes current fuente filter | Added 2026-06-29 |
| Recopilador | `collector` | `internalQueryCollectorDisplayLabel(item)`, fallback `collector_id` | Facet count excludes current recopilador filter | Added 2026-06-29 |
| Respuesta | `response` | `internalCaseResponseStateValue` | Facet count excludes current respuesta filter | Existing |
| Cruce | `crossing` | `internalCaseCrossingValue` | Facet count excludes current cruce filter | Existing |

## Iteration contract

Iteration 58

- Failure or bottleneck: `Consultas` had the explicit case explorer, but the visible filters only exposed search, actor, response and crossing. The objective requires selector coverage by canal, fuente/recopilador/collector and related source dimensions.
- Focused change: extended `AcreditacionCaseFilters` with `channel`, `source` and `collector`; wired those fields into `filterInternalQueryCases`; added count-aware toolbar selectors and facet option lists.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `docs/qa/monitoreo/acreditacion_channel_selector_matrix.md`.
- Validation command: `pnpm --dir frontend typecheck`; `pnpm --dir frontend test -- src/features/monitoreo/profiles/profileImports.test.ts src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts`; `git diff --check`; `node scripts/ui-quick-check.mjs --project <ruta de trabajo local> --route /monitoreo --viewport 1440x1000 --layout-preset portable --click-tab Consultas --post-click-wait-selector .mon-case-filterbar --out tmp/visual-qa/acreditacion-consultas-channel-filter-20260629 --prefetch-route-data --fail-on-issues`.
- Result: all validation checks passed. Visual QA on ACRDCONTA returned `ok=true`, `issues=0`, `scrollJails=0`, `overflow=0`, `pageErrors=0`, `apiErrors=0`, `resourceErrors=0`, `projectMisses=0`, `waitSelectorMisses=0`. Screenshot: `tmp/visual-qa/acreditacion-consultas-channel-filter-20260629/quick-monitoreo-1440x1000-portable.png`.
- Better/worse/same: better; Acreditacion now exposes case-level filtering by channel, source and collector without backend mutations.
- Next action: run visual QA on ACRDCONTA `Consultas/Casos` and `Consultas/Diferencias` to verify the expanded filterbar wraps cleanly at desktop sizes, then continue with the documented Telefonico/Dia and Telefonico/Alertas parity gaps.

## Residual risks

- Mutating case reconciliation actions remain intentionally unclicked on the real ACRDCONTA project.
- Channel/source/collector option labels depend on `internal_queries` payload quality; backend normalization was not changed in this iteration.
- Browser QA passed for `Consultas/Casos` at 1440x1000. `Consultas/Diferencias` should still be rechecked if a future iteration changes reconciliation rows or the assisted-review inspector.

## Modelo / Enlaces collector-channel matrix

Fecha: 2026-06-29

### Scope lock

- Module: Monitoreo / Acreditacion / Modelo / Enlaces.
- Product files touched: `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`, `frontend/src/features/monitoreo/profiles/profilePage.css`.
- QA docs touched: `docs/qa/monitoreo/acreditacion_ui_deep_audit.md`, `docs/qa/monitoreo/acreditacion_channel_selector_matrix.md`, `docs/qa/monitoreo/acreditacion_visual_parity_matrix.md`, `docs/qa/monitoreo/acreditacion_ui_audit.md`, `docs/qa/monitoreo/acreditacion_parity_matrix.md`.
- Explicit exclusions: backend R, `.pulso` project writes, deprecated `../prosecnur/`, Territorial, Aulas, Telefonico, source sync clicks and mutating saves on the real ACRDCONTA project.
- Main risk: controls could look editable while dropping `channel` from `operational_model.link_collectors`, or local snapshot discovery could block on remote SurveyMonkey credentials.
- Minimum validation command: `pnpm --dir frontend typecheck`; `pnpm --dir frontend build:fast`; `pnpm --dir frontend test`; `git diff --check`; monolith import audit; loaded `ui-quick-check` on ACRDCONTA for `Modelo > Enlaces`.

### Selector contract

| Surface | Required behavior | Persistence target | Evidence | Status |
| --- | --- | --- | --- | --- |
| Survey source channel | Show every SurveyMonkey source with actor, external ID, channel badge and editable channel selector. | `MonitoreoSource.dimensions.canal` through `apiMonitoreoSource`. | ACRDCONTA loaded QA shows 6 survey sources and channel selectors. Save was intentionally not clicked on the user project. | Wired, non-mutating QA passed |
| Collector operational use | Show every local/saved collector with operational use selector. | `MonitoreoLinkCollector.operational_use` through `apiMonitoreoCollectorsConfig`. | ACRDCONTA loaded QA shows 19 collector rows with use selectors and real response metrics. | Wired, non-mutating QA passed |
| Collector channel | Let analyst label channel independently from use. | `MonitoreoLinkCollector.channel`. | `collectorConfigFromDiscovery` includes `channel`, and the UI exposes channel badges/selectors per collector. | Wired, non-mutating QA passed |
| Local-first discovery | Load from snapshot/config by default; make remote SurveyMonkey read explicit. | `apiMonitoreoSurveyMonkeyCollectors(sourceIds, { remote: false })`. | Final visual QA reports `Snapshot local`; no API/resource/page errors. | Passed |
| Visual density | Avoid horizontal overflow and keep first viewport useful at 1440x900. | Profile CSS. | First loaded pass caught 14 select overflows; second caught card overflow; final pass has 0 visual issues and 0 overflow. | Passed |

### Iteration contract

Iteration 58

- Failure or bottleneck: `Modelo > Enlaces` exposed a passive saved-collector table, but not the requested professional selector by survey and collector. The analyst could not classify source channel and collector channel/use in one local-first workbench.
- Focused change: added `AcreditacionChannelSelectorMatrix`, shared channel/use option vocabularies, `desconocido`/`web` channel normalization, local snapshot collector refresh, source channel save wiring and collector config save wiring.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, QA docs.
- Validation command: baseline plus final `pnpm --dir frontend typecheck`; `pnpm --dir frontend build:fast`; `pnpm --dir frontend test`; `git diff --check`; monolith import audit; `UI_QA_PREFETCH_TIMEOUT_MS=60000 node scripts/ui-quick-check.mjs --project "<ruta de trabajo local>" --route /monitoreo --viewport 1440x900 --layout-preset auto --timeout-ms 240000 --click-tab Modelo --click-tab Enlaces --post-click-wait-selector ".mon-collector-card, .mon-collector-body--matrix .mon-sm-empty" --out tmp/visual-qa/monitoreo-acreditacion-channel-selector-iteration24-loaded-final --name acreditacion-channel-selector-loaded-final`.
- Result: all final checks passed. Frontend tests passed 34 files / 220 tests. Final ACRDCONTA visual QA returned `ok=true`, `issues=0`, `scrollJails=0`, `overflow=0`, `pageErrors=0`, `apiErrors=0`, `resourceErrors=0`, `projectMisses=0`, `waitSelectorMisses=0`.
- Better/worse/same: better; `Modelo > Enlaces` now has a real survey/collector channel matrix and no longer depends on a passive table.
- Next action: click-test `Guardar canales`, `Guardar recopiladores` and source/collector mutations on a disposable `.pulso` fixture, then reconcile exact canonical model anchor behavior.
