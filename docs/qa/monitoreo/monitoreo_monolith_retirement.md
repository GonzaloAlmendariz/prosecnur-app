# Monitoreo monolith retirement map

Updated: 2026-06-29

Scope lock for this repair loop:

- Module: Monitoreo profile retirement, Acreditacion/Territorial hydration, and Acreditacion phone scope.
- Intended files: `frontend/src/features/monitoreo/profiles/**`, `frontend/src/api/client.ts`, `frontend/src/app/warmupRegistry.ts`, `api/R/router_monitoreo.R`, `api/R/monitoreo_engine.R`, `api/R/project_warmup.R`, `api/tests/testthat/test-monitoreo-engine.R`, `frontend/src/features/monitoreo/profiles/profileImports.test.ts`, `docs/qa/monitoreo/**`.
- Explicitly excluded files: portable `.pulso` schema migrations, secrets, PDF manual patches, sampling engines, and deprecated `../prosecnur/`.
- Main risk: declaring a profile independent because it opens, while tabs still depend on `MonitoreoPage`, request `report_scope="full"` unnecessarily, or show incomplete visual/data states.
- Minimum validation command: `rg -n "from .*MonitoreoPage|../../MonitoreoPage|import\\(\"../../MonitoreoPage\"|import\\('../../MonitoreoPage'" frontend/src/features/monitoreo/profiles`, focused frontend tests, targeted R validation when R is touched, and real-project QA evidence.

| Profile | Current entrypoint | Imports MonitoreoPage | Independent page exists | Canonical UI parity | Backend parity | Cache/perf parity | QA project | Status | Next extraction |
|---|---|---|---|---|---|---|---|---|---|
| Acreditacion | `profiles/acreditacion/AcreditacionMonitoreoPage.tsx` | No | Yes | Partial | Partial | Partial | `ACRDCONTA.pulso` | partially independent | Repair remaining visual/data parity in `Modelo`, `Consultas/Faltantes`, `Telefono/Alertas` comparator readiness, mutating QA, and backend count/control cases. |
| Territorial | `profiles/territorial/TerritorialMonitoreoPage.tsx` | No | Yes | Partial | Partial | Partial | `ACNURCG.pulso` | partially independent | Continue ordered tab parity for map/geolocation, occurrence action surfaces, outputs, and row-to-map interactions. |
| Aulas universitarias | `profiles/aulas/AulasMonitoreoPage.tsx` | No | Yes | Unverified | Partial | Partial | Pending real aulas project | superficial independent | Validate against a real Aulas project and replace any generic dashboard blocks with canonical workbenches. |
| Telefonico | `profiles/telefonico/TelefonicoMonitoreoPage.tsx` -> `AcreditacionProfilePage mode="telefonico"` | No | Wrapper only | Partial | Partial | Partial | `ACRDCONTA.pulso` | partially independent | Extract a true phone profile surface from Acreditacion once phone visual/data parity is closed. |

## Import Audit

Command:

```bash
rg -n "from .*MonitoreoPage|../../MonitoreoPage|import\\(\"../../MonitoreoPage\"|import\\('../../MonitoreoPage'" frontend/src/features/monitoreo/profiles
```

Result on 2026-06-29: no matches.

Guardrail added:

```text
frontend/src/features/monitoreo/profiles/profileImports.test.ts
```

The guardrail recursively scans `territorial`, `acreditacion`, `aulas`, and
`telefonico` profile folders and fails on static or dynamic `MonitoreoPage`
imports.

Validation on 2026-06-29:

```bash
pnpm --dir frontend exec vitest run src/features/monitoreo/profiles/profileImports.test.ts src/features/monitoreo/profiles/registry.test.ts
```

Result: 2 files passed, 7 tests passed. The direct `rg` import audit above
returned no matches.

Revalidation in the current working tree on 2026-06-29: the same Vitest command
passed again with 2 files / 7 tests, and the direct `rg` audit returned no
matches. This proves the profile folders still have no static or dynamic
`MonitoreoPage` import after the latest QA-harness changes.

Entrypoint cleanup on 2026-06-29: removed the tracked duplicate
`profiles/telefonico/TelefonicoMonitoreoPage 2.tsx` after confirming the
registry imports only `./TelefonicoMonitoreoPage`. This does not make
Telefonico a true standalone surface yet; it only keeps the remaining wrapper
entrypoint unambiguous for the next extraction. Follow-up validation passed:
`pnpm --dir frontend typecheck` and `git diff --check`.

## Current Evidence

- Acreditacion no longer needs `report_scope="full"` for the `Telefono` view.
  The backend now accepts `phone_summary`; the profile and warmup registry use
  `phone_summary` for phone tabs.
- `Telefono/Dia` is no longer listed as a current monolith-retirement gap:
  canonical and independent panes now preserve the undated daily cut and show
  `TOTAL PERIODO 145` / `14 cortes diarios` in the strict comparator evidence
  documented in `docs/qa/monitoreo/acreditacion_parity_matrix.md`.
- ACRDCONTA performance evidence:
  `tmp/perf/acrdconta-phone-summary-20260628/report.md`.
  Result: 22/22 declared Acreditacion tabs hydrated, `full_scope_used=false`.
- ACRDCONTA visual evidence:
  `tmp/visual-qa/acrdconta-phone-summary-visual-20260628/14-telefono-resumen.png`
  shows the canonical original still empty for phone summary while the modular
  profile renders phone data. This is not visual parity.
- `tmp/perf/acrdconta-phone-summary-20260628/acreditacion/screenshots/tabs/16-telefono-responsables.png`
  was a false automatic screenshot because it captured a blank transition.
  Direct repro evidence
  `tmp/visual-qa/acrdconta-phone-responsables-direct-20260628.png`
  shows the tab rendered with responsible cards and no loader.

## Stopping Rule

Do not mark any row `validated independent` until the profile has:

- no `MonitoreoPage` import,
- real-project QA,
- section-by-section and tab-by-tab hydration,
- canonical visual parity or documented intentional improvement,
- backend parity for counts/actions/states,
- cache/performance evidence without unnecessary `full`,
- guardrail coverage.
