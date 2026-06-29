# Monitoreo deliverables acceptance audit

Date: 2026-06-28

Scope: final acceptance check for Monitoreo internal/client Sheets/XLSX, client
PDF, cut/sources, canonical counts and real-project QA.

Current decision: not fully complete. Acreditacion deliverables are protected by
canonical-count tests and real ACRDCONTA evidence. Territorial generator
contracts pass, but exact parity against the validated internal Google Sheet is
blocked because the local `ACNURCG.pulso` state does not contain the same
tachas/subsanadas operational packages that produced that Sheet.

## Evidence commands

- Focal publication QA:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-publish-qa.R")'`
  -> 430 pass, 0 fail.
- Expanded Monitoreo QA:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::set_max_fails(100); testthat::test_dir("api/tests/testthat", filter="monitoreo.*publish|monitoreo.*engine|sheets|pdf|monitoreo.*deliverables")'`
  -> 1938 pass, 0 fail.
- Engine/Sheets publisher QA:
  `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-engine.R")'`
  -> 1353 pass, 0 fail.
- ACRDCONTA direct `.pulso` check:
  `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`
  -> Egresados `270 / 157 / 5 / 0 / 108`, avance universo `58.1%`.
- ACRDCONTA live disposable Google Sheets publish/readback:
  client Sheet `https://docs.google.com/spreadsheets/d/1Qg-jUYB_yu_4cmCmd7PYamEpeJXuN-Oai4RlJWr_G5M`;
  internal Sheet `https://docs.google.com/spreadsheets/d/1cwUUhxr1qop0QL3TCpg87IyXOxb8oStJjjhc3vcLBLQ`.
  Both were written through `monitoreo_sheets_publish_tabs()` and read back with
  native Sheets metadata/cells.
- Territorial reference:
  validated Sheet
  `https://docs.google.com/spreadsheets/d/1hDWdoE-yxadwC3EPTXtUB8AWWXsR6dv-Givw9g05hD8/edit?gid=240203097#gid=240203097`.

## Criteria

| # | Criterion | Status | Evidence / note |
|---:|---|---|---|
| 1 | Current internal/client generators audited | Passed | `monitoreo_deliverables_audit.md`; publication tabs/workbook/PDF helpers covered by tests. |
| 2 | XLSX/Google Sheets audited | Passed for Acreditacion; territorial live write pending until project-state parity | Per-tab XLSX contracts pass. Disposable ACRDCONTA client/internal Google Sheets were written and read back with frozen rows, filters, conditional formats, metadata ownership and values present. |
| 3 | Client PDF audited | Passed | ACRDCONTA PDF and territorial fixture PDF validated against their source models. |
| 4 | Internal vs client separated | Passed | Client excludes internal trace columns; internal keeps phone monitoring, alerts, technical/base sheets. |
| 5 | ACRDCONTA internal uses canonical cross | Passed | Engine and real `.pulso` check use official base + reconciled SurveyMonkey case rollup. |
| 6 | ACRDCONTA client uses canonical cross | Passed | Client rows and PDF come from the same canonical report model. |
| 7 | ACRDCONTA Egresados is `270 / 157 / 5 / 0 / 108` | Passed | Direct `.pulso` verification and QA docs. |
| 8 | Old `145 / 0 / 0 / 125` summary is not used | Passed | PDF/source page names Apps Script viejo as excluded source of truth. |
| 9 | Territorial internal uses validated Sheet as absolute reference | Partial / blocked for exact metric parity | Structure, tab order and occurrence totals pass; local `.pulso` lacks the validated Sheet's full tacha/subsanada state. |
| 10 | Cut and sources exist in internal and client | Passed | Required tabs/pages and PDF `Corte y fuentes` checks. |
| 11 | Formats are professional | Passed for generated XLSX/PDF and ACRDCONTA live Sheets | Freeze, filters, styles, sections, headers, PDF render/text checks and native Google Sheets metadata readback. |
| 12 | Headers, filters, freeze, percentages, widths and styles exist | Passed for generated XLSX and ACRDCONTA live Sheets | Per-sheet workbook contract rejects open-but-underhydrated artifacts; live Sheets readback confirms frozen row, filters, conditional formats and styled headers. |
| 13 | Client PDF is professional and consistent | Passed for Acreditacion and territorial fixture; local territorial parity pending | Territorial real PDF is consistent with local model, not the newer reference Sheet state. |
| 14 | PDF is not used as a data patch | Passed | PDF draws from the same client report model as Sheets/XLSX. |
| 15 | Publication tests pass or failures classified | Passed | 430 focal pass, 1353 engine pass and 1938 expanded pass after the current canonical-count repair. |
| 16 | Missing tests added | Passed | Added canonical counts, workbook hydration, PDF consistency, rejection-source/no-base regressions and publication preflight API/client regressions. |
| 17 | Local QA evidence generated | Passed | `tmp/qa/monitoreo-deliverables/` contains XLSX/PDF/JSON/PNG evidence. |
| 18 | Apps Script viejo is not source of truth | Passed | Canonical engine rules and docs state Prosecnur engine owns the truth. |
| 19 | Territorial not broken | Passed for generator contracts; exact reference parity blocked | Tests pass; real-project exact values depend on updating local `ACNURCG.pulso`. |
| 20 | Acreditacion not broken | Passed | ACRDCONTA canonical counts and deliverables validated. |

## Rejection-source rule

Phone statuses are operational telephone evidence. They remain essential in
telephone monitoring surfaces, channel/actor telephone views and the
`telefonico` Monitoreo path, where `Rechazos telefónicos` is the correct
operational bucket.

Client-facing rejection counts come from platform consent refusal only when the
response resolves to a valid official-base case: `Rechazos plataforma`. The regression
`rechazos solo telefonicos quedan fuera de matrices cliente` verifies that two
phone refusals and zero platform non-consents produce client `Rechazo = 0`,
daily `Rechazos = 0`, and channel/source `Rechazos plataforma = 0`.
The regression `fallback generico de rechazo no pisa estados telefonicos`
covers legacy/publication tables that contain both `Rechazos` and
`Rechazos telefónicos`: client reports still read the visible rejection as zero
unless `Rechazos plataforma` is present.
The regression `rechazo de consentimiento sin cruce base queda solo como
auditoria` verifies that no-key/no-base platform refusals remain visible as
`Rechazos plataforma sin cruce base`, but do not count as official/client
`Rechazos plataforma`, daily progress or source totals.
The `telefonico` path regression also verifies a real phone refusal remains
visible as `Rechazos telefónicos` by day and by responsible.

## Publication preflight gate

The Sheets workbench now separates the preflight wait from the actual publish
wait. `Revisar preflight` calls `/api/monitoreo/publication/preflight` and shows
`ready`, `warnings` or `blocked` with score and issues. `Publicar Sheets` runs
the same preflight first and `/api/monitoreo/publication/sheets` reuses that
contract before writing; a blocked preflight stops with
`E_MONITOREO_PREFLIGHT_BLOCKED`.

## Live Google Sheets readback

- Client disposable Sheet:
  `https://docs.google.com/spreadsheets/d/1Qg-jUYB_yu_4cmCmd7PYamEpeJXuN-Oai4RlJWr_G5M`.
  Controlled write produced `Reporte` 67 rows, `Detalle del avance` 192 rows
  and `Corte y fuentes` 15 rows. Native readback confirms ACRDCONTA Egresados
  `270 / 157 / 5 / 0 / 108 / 58.1%`, frozen row, filters, conditional formats
  and styled headers.
- Internal disposable Sheet:
  `https://docs.google.com/spreadsheets/d/1cwUUhxr1qop0QL3TCpg87IyXOxb8oStJjjhc3vcLBLQ`.
  Controlled write produced `Resumen` 51 rows, `Avance por encuesta` 213 rows,
  `Seguimiento` 1058 rows, `Alertas` 508 rows and `Corte y fuentes` 23 rows.
  Native metadata readback confirms each tab has frozen row, filter,
  conditional formats and owner metadata.
- Internal long-cell repair:
  before the sanitizer, the internal Sheet failed with Google Sheets' 50,000
  character cell limit. The ACRDCONTA internal workbook has 157 over-limit cells,
  all in `Seguimiento` column 43. After the repair, live readback of
  `Seguimiento!AQ656` returns 50,000 characters, includes the truncation marker
  and mentions the original 55,465-character size. XLSX remains the full-fidelity
  artifact for those trace cells.

## Remaining closeout

- Update or provide the exact `ACNURCG.pulso` state that produced the validated
  internal Sheet before asserting exact territorial metric parity.
- Run territorial live Google Sheets publish/readback only after the local
  `ACNURCG.pulso` state matches the validated Sheet; Acreditacion client/internal
  live readback is now covered.
- Add a compact ACRDCONTA fixture if the full real-project build remains too
  expensive for regular CI.
