# Acreditacion UI deep audit

## Scope lock - Iteration 24

- Module: `Monitoreo > Acreditacion > Modelo > Enlaces`.
- Product files intended: `frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx`, `frontend/src/features/monitoreo/profiles/profilePage.css`.
- QA files intended: `docs/qa/monitoreo/acreditacion_ui_deep_audit.md`, `docs/qa/monitoreo/acreditacion_channel_selector_matrix.md`, `docs/qa/monitoreo/acreditacion_visual_parity_matrix.md`, `docs/qa/monitoreo/acreditacion_ui_audit.md`, `docs/qa/monitoreo/acreditacion_parity_matrix.md`.
- Explicit exclusions: `api/`, `frontend/src/features/monitoreo/MonitoreoPage.tsx`, `.pulso` project data, secrets, deprecated `../prosecnur/`, territorial/aulas profiles, destructive source syncs on `ACRDCONTA.pulso`.
- Main risk: adding a channel/collector classifier that looks complete but does not persist to `operational_model.link_collectors` or source dimensions.
- Minimum validation command: `pnpm --dir frontend typecheck`, `pnpm --dir frontend build:fast`, `git diff --check`, import audit for monolith coupling, and ACRDCONTA visual QA for `Modelo > Enlaces`.
- Category/source of truth: Prosecnur local-first desktop UI, `docs/adrs/0022-monitoreo-perfiles-frontend-dinamicos.md`, `docs/arquitectura-prosecnur.md`, the canonical collector contract already present in the monolith, and ACRDCONTA visual evidence.

## Iteration log

| Iteration | Failure / bottleneck | Focused change | Evidence | Status |
| --- | --- | --- | --- | --- |
| 24 | `Modelo > Enlaces` in the independent Acreditacion profile lists saved collectors but does not expose the professional channel selector by survey and collector requested by the repair prompt. | Pending. Add local-first SurveyMonkey collector discovery, source channel editing, collector use/channel classification, compact metrics and persistence through existing APIs. | Pending baseline and post-change validation. | In progress |
