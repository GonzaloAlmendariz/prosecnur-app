# Acreditacion visual parity matrix

## Scope lock - Iteration 24

- Canonical comparison target: original accreditation collector/editor affordances and the independent profile route for `Modelo > Enlaces`.
- Project fixture: `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`.
- Non-mutating visual proof: load local snapshot, inspect first viewport and scroll behavior, avoid source sync or destructive saves on the user project.

## Matrix

| View | Canonical expectation | Independent expectation | Evidence | Status |
| --- | --- | --- | --- | --- |
| `Modelo > Enlaces` header | Compact operational model context with real saved collector count. | Same hierarchy, with collector manager directly visible. | Pending. | In progress |
| Survey selector | Visible source rows with actor, channel badge and editable channel selector. | Present without modal-only dependency. | Pending. | In progress |
| Collector selector | Cards/rows show collector name, source, use, modality/channel, responses and recipients. | Present, compact and keyboard-friendly. | Pending. | In progress |
| Empty/error/loading | No blank panels; errors are actionable and local snapshot mode is explicit. | Present. | Pending. | In progress |
| ACRDCONTA loaded QA | No overflow/overlap, no stuck loading state, no API/resource/page/wait issues. | `ui-quick-check` or browser screenshot evidence. | Pending. | In progress |
