# Acreditacion channel selector matrix

Fecha: 2026-06-29

## Scope lock

- Module: Monitoreo / Acreditacion / Consultas.
- Product files touched: `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`.
- QA docs touched: this file.
- Explicit exclusions: backend R, `.pulso` projects, Territorial, Aulas, Telefonico, source sync clicks and case reconciliation mutations.
- Main risk: a selector can hide valid cases if it targets a display label that differs from the backend filter key.
- Minimum validation command: `pnpm --dir frontend typecheck`; `pnpm --dir frontend test -- src/features/monitoreo/profiles/profileImports.test.ts src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts`; `git diff --check`; `node scripts/ui-quick-check.mjs --project /Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso --route /monitoreo --viewport 1440x1000 --layout-preset portable --click-tab Consultas --post-click-wait-selector .mon-case-filterbar --out tmp/visual-qa/acreditacion-consultas-channel-filter-20260629 --prefetch-route-data --fail-on-issues`.

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

Iteration 57

- Failure or bottleneck: `Consultas` had the explicit case explorer, but the visible filters only exposed search, actor, response and crossing. The objective requires selector coverage by canal, fuente/recopilador/collector and related source dimensions.
- Focused change: extended `AcreditacionCaseFilters` with `channel`, `source` and `collector`; wired those fields into `filterInternalQueryCases`; added count-aware toolbar selectors and facet option lists.
- Files changed: `AcreditacionMonitoreoPage.tsx`, `docs/qa/monitoreo/acreditacion_channel_selector_matrix.md`.
- Validation command: `pnpm --dir frontend typecheck`; `pnpm --dir frontend test -- src/features/monitoreo/profiles/profileImports.test.ts src/features/monitoreo/profiles/registry.test.ts src/features/monitoreo/core/reportScopeCache.test.ts`; `git diff --check`; `node scripts/ui-quick-check.mjs --project /Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso --route /monitoreo --viewport 1440x1000 --layout-preset portable --click-tab Consultas --post-click-wait-selector .mon-case-filterbar --out tmp/visual-qa/acreditacion-consultas-channel-filter-20260629 --prefetch-route-data --fail-on-issues`.
- Result: all validation checks passed. Visual QA on ACRDCONTA returned `ok=true`, `issues=0`, `scrollJails=0`, `overflow=0`, `pageErrors=0`, `apiErrors=0`, `resourceErrors=0`, `projectMisses=0`, `waitSelectorMisses=0`. Screenshot: `tmp/visual-qa/acreditacion-consultas-channel-filter-20260629/quick-monitoreo-1440x1000-portable.png`.
- Better/worse/same: better; Acreditacion now exposes case-level filtering by channel, source and collector without backend mutations.
- Next action: run visual QA on ACRDCONTA `Consultas/Casos` and `Consultas/Diferencias` to verify the expanded filterbar wraps cleanly at desktop sizes, then continue with the documented Telefonico/Dia and Telefonico/Alertas parity gaps.

## Residual risks

- Mutating case reconciliation actions remain intentionally unclicked on the real ACRDCONTA project.
- Channel/source/collector option labels depend on `internal_queries` payload quality; backend normalization was not changed in this iteration.
- Browser QA passed for `Consultas/Casos` at 1440x1000. `Consultas/Diferencias` should still be rechecked if a future iteration changes reconciliation rows or the assisted-review inspector.
