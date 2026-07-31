# Reparación: flujo aulas, fichas QR y monitoreo

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-28
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Monitoreo territorial](../historico/monitoreo-territorial-2026-06.md)

Fecha: 2026-06-28

## Scope lock

- Module: Cálculo de muestra de aulas, Fichas QR/PDF y Monitoreo de aplicación en aulas.
- Files touched: `frontend/src/features/aulasFlow/*`, `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, `frontend/src/features/recopiladores/*`, `frontend/src/features/monitoreo/profiles/aulas/*`, `frontend/src/features/monitoreo/core/monitoreoRegistry.ts`, `frontend/src/features/monitoreo/MonitoreoPage.tsx`, `frontend/src/app/App.tsx`, `frontend/src/lib/modules.ts`, `frontend/src/api/client.ts`, `api/R/monitoreo_aulas_universitarias.R`, `api/tests/testthat/test-monitoreo-aulas-universitarias.R`.
- Files excluded: `.pulso` schemas, Kobo credentials, Google/Drive integration, real PDF generation backend.
- Main risk: abrir el calculador equivocado cuando el proyecto mantiene una mesa de acreditación.
- Minimum validation command: `pnpm --dir frontend build` plus `scripts/ui-quick-check.mjs` for `/muestra-aulas`, `/recopiladores` and `/monitoreo`.

## Iteration 1

- Failure or bottleneck: Fichas QR/PDF and Monitoreo de aulas were visually connected, but the copy could still read as a generic or accreditation-adjacent flow.
- Focused change: added a shared Aulas application flow that explains muestra de aulas -> Kobo/QR -> PDF/Word -> Monitoreo, grounded in the notebook PDF/QR motor.
- Files changed: `frontend/src/features/aulasFlow/*`, `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`, `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, metadata files.
- Validation command: `pnpm --dir frontend typecheck`; `node scripts/ui-quick-check.mjs --route /recopiladores --route /monitoreo`.
- Result: passed; visual QA showed no overflow or page errors.
- Better/worse/same: better, but `/calc-muestra` links still depended on the last active desk.
- Next action: make the sample route explicit for aulas.

## Iteration 2

- Failure or bottleneck: links from Fichas QR and Monitoreo could open an existing Acreditación desk.
- Focused change: added `/calc-muestra?mesa=aulas` support and routed `/muestra-aulas` plus all new flow CTAs through it. If another desk exists, the calculator opens the reset confirmation instead of silently overwriting work.
- Files changed: `frontend/src/app/App.tsx`, `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`, `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`.
- Validation command: `pnpm --dir frontend build`; `node scripts/ui-quick-check.mjs --route /muestra-aulas --route /recopiladores --route /monitoreo`.
- Result: passed; `/muestra-aulas` showed "Acreditación institucional -> Muestra de aulas" confirmation, not the accreditation desk.
- Better/worse/same: better.
- Next action: remove backend-like labels from the visible notebook strip.

## Iteration 3

- Failure or bottleneck: the QR/PDF strip exposed notebook folder names such as `Fichas_pdf/{seleccion}`.
- Focused change: replaced internal paths with user-facing outputs: QR por selección, Ficha Word, Ficha PDF, Consolidado and Links guardados.
- Files changed: `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`, `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`, metadata files.
- Validation command: `pnpm --dir frontend build`; `node scripts/ui-quick-check.mjs --route /recopiladores`.
- Result: passed; screenshot showed human labels, no overflow and no page errors.
- Better/worse/same: better.
- Next action: continue deeper data/engine integration only when Kobo/Drive/PDF runtime contracts are in scope.

## Iteration 4

- Failure or bottleneck: the fichas QR/PDF flow still behaved too much like a visual bridge; Word/PDF links and package labels were not part of the Monitoreo de aulas agenda contract.
- Focused change: preserved Word/PDF links, package label and package status in the R normalization/update path; added the same fields to the frontend API type; made Fichas QR group output by selection with QR, Word, PDF, consolidated and Monitoreo status.
- Files changed: `api/R/monitoreo_aulas_universitarias.R`, `api/tests/testthat/test-monitoreo-aulas-universitarias.R`, `frontend/src/api/client.ts`, `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`, `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`.
- Validation command: `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-monitoreo-aulas-universitarias.R")'`; `pnpm --dir frontend typecheck`; `pnpm --dir frontend build`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /muestra-aulas --route /recopiladores --route /monitoreo`.
- Result: targeted R test passed with 24 expectations; frontend typecheck and build passed; final quick-check passed with 3 captures, 0 visual issues, 0 overflow, 0 page/API/resource errors. Screenshot shows the package engine as a hostigamiento classroom application flow rather than an accreditation flow.
- Better/worse/same: better.
- Next action: validate full frontend build and final quick-check, then stop unless the next step is a real PDF/Drive/Kobo execution contract.

## Iteration 5

- Failure or bottleneck: the printable package still looked like a generic QR preview and did not clearly encode the hostigamiento classroom-application contract from the notebook. The print CSS also produced blank pages in the generated A4 package.
- Focused change: redesigned the printable ficha around the notebook fields (`cursohorario`, `curso_nombre`, `facultad`, `horario`, `pabellon_aula`) and changed the package action to prepare a local PDF package before returning to Monitoreo. The visible language now says hostigamiento en aulas, not accreditation. The returned agenda can mark the package as `pdf_preparado` after print preparation.
- Files changed: `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`.
- Validation command: `pnpm --dir frontend typecheck`; Playwright export on `/recopiladores?devPulso=tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso`; `pdfinfo output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`; `pdftoppm` render of pages 1-4 and 9.
- Result: frontend typecheck passed; Playwright generated 8 QR images and 8 fichas; the PDF is A4 with 9 pages exactly: 1 cover + 8 fichas, no blank page between cover and first ficha; rendered pages show QR, ID, faculty, schedule, room, course, contact, selection and backup URL.
- Better/worse/same: better.
- Next action: when real Kobo/Drive is in scope, replace the local print-prepared status with backend-generated Word/PDF/QR file links while preserving the same aula-monitoring contract.

## Iteration 6

- Failure or bottleneck: `/muestra-aulas` could still open the type picker as if the current desk were Acreditación institucional, even when the project already contained classroom sample state, selection rows and the QR/Monitoreo aula flow. Once recovered, the first view also landed on Definición instead of the actual selected aulas, and an internal value (`prescribed_design`) leaked into the UI.
- Focused change: added explicit classroom-desk recovery for the `mesa=aulas` route when `calc_muestra.aulas` exists; the recovered route now opens the classroom desk and lands on `Aulas > Aulas titulares` when a selection is present. Added a frontend label translator for probability-source values so backend method codes are presented as readable methodological text.
- Files changed: `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`.
- Validation command: `pnpm --dir frontend typecheck`; `node scripts/ui-quick-check.mjs --url http://127.0.0.1:5174/ --api real --api-url http://127.0.0.1:8789 --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /muestra-aulas --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-integration-iteration6-final`.
- Result: typecheck passed; visual QA passed with 1 capture, 0 visual issues, 0 overflow, 0 page/API/resource errors. Screenshot shows `Tipo Estudiantes`, active `Aulas`, sidebar tab `Aulas titulares`, and the probability source rendered as `Diseño definido por el cálculo`.
- Better/worse/same: better.
- Next action: continue aligning downstream state after links are generated so `Fichas QR` and `Monitoreo de aula` share the same package/link status without manual interpretation.

## Iteration 7

- Failure or bottleneck: Monitoreo de aplicación en aulas did not visibly consume the QR/PDF handoff. After Fichas QR prepared and saved links, Monitoreo still summarized only plan/aulas/aplicadas/brechas, exposed `PATH ACTIVO`, and the agenda view could leak technical values such as `package_status`/`pdf_preparado`.
- Focused change: Monitoreo Aulas now derives flow metrics from the real agenda (`link`, `pdf_link`, `package_status`): `Kobo + QR`, `Fichas PDF`, `Aplicadas` and `Brechas`. The Agenda tab adds a compact trace panel for the hostigamiento classroom workflow and translates table headers/statuses into user-facing Spanish.
- Files changed: `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`, `frontend/src/features/monitoreo/profiles/profilePage.css`, `frontend/src/features/monitoreo/core/monitoreoRegistry.ts`.
- Validation command: `pnpm --dir frontend typecheck`; Playwright on `/monitoreo` with `1440x1000`; direct API POST/readback for `/api/monitoreo/aulas/agenda`; `pnpm --dir frontend build`.
- Result: typecheck passed; API readback confirmed 8 agenda links and 8 config links after agenda update; visual QA passed with `Kobo + QR 8/8 aulas`, `Fichas PDF 8/8 fichas`, `SECCIÓN ACTIVA`, `PDF preparado`, no `PATH ACTIVO`, no `pdf_preparado`, no `OPERATIONAL CODE`, and no `PACKAGE STATUS`; production build passed with the pre-existing circular chunk warning.
- Better/worse/same: better.
- Next action: if real Drive/Kobo export is enabled later, replace local `PDF preparado` with actual PDF/Word file links while preserving the same Monitoreo status surface.

## Iteration 8

- Failure or bottleneck: `Calc-Muestra > Salida > Seguimiento` showed the methodological handoff but did not yet behave like the first step of the same operational circuit used by Fichas QR and Monitoreo. The user could see titular/reserve rows, but the route to QR/PDF and classroom monitoring was not explicit enough.
- Focused change: reused the shared `AulasApplicationFlow` inside the calculator's seguimiento output, added clear actions to `Preparar fichas QR` and `Ver monitoreo`, exposed the notebook motor outputs with user-facing labels, and added three compact bridge cards: agenda de aulas, ficha QR por aula, and seguimiento sin rediseño. Also changed `Links guardados` to `Enlaces guardados` and removed `link/QR` copy from the calculator.
- Files changed: `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, `frontend/src/features/calcMuestra/calcMuestra.css`, `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`.
- Validation command: `pnpm --dir frontend typecheck`; Playwright on `/muestra-aulas` with `1440x1000` navigating to `Salida > Seguimiento`; `pnpm --dir frontend build`.
- Result: typecheck passed; visual QA passed with `Plan listo para fichas QR`, `Preparar fichas QR`, `Enlaces guardados`, `Agenda de aulas`, `Ficha QR por aula`, `Seguimiento sin rediseño`, and no `Links guardados`, `link/QR`, `PATH ACTIVO`, `handoff`, or `workbook`; production build passed with the pre-existing circular chunk warning.
- Better/worse/same: better.
- Next action: continue tightening data coherence in `Aulas titulares` where coverage/repetition metrics can still read as pending even after a selection exists.

## Iteration 9

- Failure or bottleneck: the classroom QR/PDF and monitoring flow still needed a stronger product contract: it must read as sample-calculation for hostigamiento classroom application, not as an accreditation-adjacent workflow. In `Aulas titulares`, the coverage panel could still say `pendiente` after a selection existed because exact overlap metrics were absent.
- Focused change: tightened visible copy across the shared aulas flow, Fichas QR, Monitoreo Aulas and module metadata so the route reads as `Estudio de hostigamiento`, `Monitoreo de aulas` and `aplicación en aulas`. Removed visible notebook/backend terminology from the ficha engine and replacement route strip. Added selection-based fallback metrics to `CoverageOverlapPanel`: when exact student-overlap metrics are missing, it shows expected eligible students and explains that repeated-student loss requires the student-classroom key.
- Files changed: `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`, `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`, `frontend/src/features/monitoreo/core/monitoreoRegistry.ts`, `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, `frontend/src/lib/modules.ts`.
- Validation command: `pnpm --dir frontend typecheck` before changes; `pnpm --dir frontend typecheck` after changes; `pnpm --dir frontend build`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /muestra-aulas --route /recopiladores --route /monitoreo --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-hostigamiento-contract-iteration9`.
- Result: typecheck passed before and after; production build passed with the known circular chunk warning; visual QA passed with 3 captures, 0 issues, 0 scroll jails, 0 overflow, 0 page/API/resource errors. Screenshots show `Estudio de hostigamiento`, `Fichas QR para hostigamiento en aulas`, `Seguimiento del estudio de hostigamiento en aulas`, and the coverage panel now displays `Elegibles esperados en titulares` instead of a false pending state.
- Better/worse/same: better.
- Next action: if the backend later exposes exact duplicate metrics consistently for recovered selections, keep the frontend fallback but prefer the exact `selected_unique_students`, `coverage_efficiency` and `duplicate_loss` rows.

## Iteration 10

- Failure or bottleneck: the circuit was closer, but the calculator chrome could still say `Tipo Estudiantes`, Fichas QR/PDF emphasized QR status before personalized Kobo links, and the package engine did not surface the notebook's field contract. This left room to misread the flow as a generic/student module instead of the hostigamiento classroom-application flow.
- Focused change: changed the calculator desk token to `Mesa / Muestra de aulas`; renamed the shared flow output to `QR individual`, `Ficha Word`, `Ficha PDF`, `Consolidado por selección` and `Tabla de enlaces`; changed Fichas QR/PDF metrics to `Plan de aulas`, `Enlaces Kobo`, `Fichas PDF` and `Monitoreo`; exposed the ficha fields `ID curso-horario`, `Enlace Kobo`, `Curso`, `Facultad`, `Horario` and `Aula`; and clarified in Monitoreo that it reads agenda and links without recalculating the sample.
- Files changed: `frontend/src/features/aulasFlow/AulasApplicationFlow.tsx`, `frontend/src/features/aulasFlow/aulasFlow.css`, `frontend/src/features/calcMuestra/CalcMuestraPage.tsx`, `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`, `frontend/src/features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx`.
- Validation command: `pnpm --dir frontend typecheck` before changes; `pnpm --dir frontend typecheck` after changes; `pnpm --dir frontend build`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /muestra-aulas --route /recopiladores --route /monitoreo --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-circuit-contract-iteration10`; `git diff --check`.
- Result: typecheck passed before and after; production build passed with the known circular chunk warning; visual QA passed with 3 captures, 0 issues, 0 scroll jails, 0 overflow, 0 page/API/resource errors; `git diff --check` passed. Screenshots confirm `Mesa / Muestra de aulas`, `Fichas QR para hostigamiento en aulas`, `Kobo + QR enlace personalizado`, `Fichas PDF/Word individual y consolidado`, and `Seguimiento del estudio de hostigamiento en aulas`.
- Better/worse/same: better.
- Next action: when the real Kobo/Drive/PDF execution contract enters scope, keep this hostigamiento-aulas surface and replace local/package placeholders with backend file links.

## Iteration 11

- Failure or bottleneck: the printable ficha still looked like a technical preview: it exposed `ID en base`, `Selección`, `Docente o contacto` and a raw backup URL, used too little of the A4 canvas, and did not carry the professional Pulso PDF identity used by other reports.
- Focused change: redesigned the printable cover and ficha with the Pulso PUCP logo, a clean report-like header, a larger centered QR, and only the visible classroom application fields: course, aula, horario and facultad. Removed internal metadata from the ficha body and copied the existing Pulso logo into `frontend/public` so Chromium can embed it in local PDF generation.
- Files changed: `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`, `frontend/public/pulso-pucp-logo.png`, `output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`.
- Validation command: `pnpm --dir frontend typecheck`; Playwright-generated PDF from `/recopiladores` after generating 8 Kobo links; `pdfinfo output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`; `pdftoppm -png -f 1 -l 9 output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf tmp/pdfs/ficha-polished-v2`; `pdftotext ... | rg "ID en base|URL de respaldo|Selección|Docente|contacto|cursohorario|package|metadata|Motor QR|M1|M2|https://"`; `git diff --check`; `pnpm --dir frontend build`.
- Result: typecheck passed; generated PDF has 9 A4 pages exactly (cover + 8 fichas), no blank pages, no internal text matches, and rendered PNG inspection confirmed no overlap. Build passed with the known circular chunk warning.
- Better/worse/same: better.
- Next action: if real Drive/Kobo generation later replaces local Chromium print, reuse this same published ficha layout and keep operational identifiers out of the student-facing PDF.

## Iteration 12

- Failure or bottleneck: Iteration 11 over-cleaned the ficha. It removed fields present in the original model that are still needed operationally: code, teacher/contact, selection group and backup URL.
- Focused change: restored every original ficha field while keeping the professional Pulso layout. The visible ficha now includes QR, code, faculty, schedule, classroom, course, teacher/contact, selection and backup link, using a two-column A4 composition so the QR remains readable and the fields do not overlap.
- Files changed: `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`, `output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`.
- Validation command: `pnpm --dir frontend typecheck`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /recopiladores --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-ficha-all-fields-check --keep-servers`; Playwright-generated PDF after 8 Kobo links; `pdfinfo`; `pdftoppm`; `pdftotext`.
- Result: typecheck passed; visual quick-check passed with 0 issues; generated PDF has 9 A4 pages exactly; text extraction confirms `Código de ficha`, `Aula`, `Horario`, `Facultad`, `Curso`, `Docente o contacto`, `Selección` and `Enlace de respaldo`; rendered PNG inspection confirmed no clipping or overlap.
- Better/worse/same: better.
- Next action: preserve this full-field ficha when replacing local print with a backend Drive/Word/PDF generator.

## Iteration 13

- Failure or bottleneck: the full-field ficha preserved all required data, but the QR still competed visually with the right-hand information column. For field use, the scan action must be the dominant element on the printed sheet.
- Focused change: restructured the ficha into a QR-first A4 hierarchy: logo and study context at the top, large centered QR as the primary block, scan instruction directly below it, and all original operational fields kept in a compact information area underneath.
- Files changed: `frontend/src/features/recopiladores/recopiladores.css`, `output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`.
- Validation command: `pnpm --dir frontend typecheck`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /recopiladores --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-ficha-qr-hero-check --keep-servers`; Playwright PDF generation after 8 Kobo links; `pdfinfo`; `pdftoppm`; `pdftotext`; `pnpm --dir frontend build`.
- Result: typecheck passed; visual quick-check passed with 0 issues, 0 overflow and 0 page/API/resource errors; generated PDF has 9 A4 pages exactly; text extraction confirms `Código de ficha`, `Aula`, `Horario`, `Facultad`, `Curso`, `Docente o contacto`, `Selección` and `Enlace de respaldo`; rendered PNG inspection confirms the QR is now the dominant visual block and fields remain legible on first and last ficha.
- Better/worse/same: better.
- Next action: keep this QR-first print structure as the PDF contract when the local Chromium print path is replaced by a backend Word/PDF/Drive generator.

## Iteration 14

- Failure or bottleneck: the QR-first ficha looked polished, but a real expected field case showed the printed sheet is also used as a classroom application log. The current ficha lacked writable spaces for in-class counts, rejections, applicator, date, time and observations.
- Focused change: incorporated the reference structure without copying its scanned style: the QR remains the dominant top block, aula/course/faculty/teacher/link data remain prefilled, and a new `Registro de aplicación` section adds printable writing lines for `N° total de alumnos`, `N° de alumnos en aula`, `Rechazos`, `Aplicador/a`, `Fecha`, `Hora de aplicación` and `Observaciones`. The print-only footer was removed to avoid competing with the field log.
- Files changed: `frontend/src/features/recopiladores/RecopiladoresPage.tsx`, `frontend/src/features/recopiladores/recopiladores.css`, `output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`.
- Validation command: `pnpm --dir frontend typecheck`; `node scripts/ui-quick-check.mjs --project tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso --route /recopiladores --viewport 1440x1000 --layout-preset auto --out tmp/visual-qa/aulas-ficha-reference-form-check --keep-servers`; Playwright PDF generation after 8 Kobo links; `pdfinfo`; `pdftoppm`; `pdftotext`; `git diff --check`; `pnpm --dir frontend build`.
- Result: typecheck passed; visual quick-check passed with 0 issues, 0 overflow and 0 page/API/resource errors; generated PDF has 9 A4 pages exactly; text extraction confirms the new field-log labels; rendered PNG inspection confirms first and last fichas fit on one page with no footer collision and the QR remains the strongest visual element.
- Better/worse/same: better.
- Next action: when the backend PDF/Word generator is implemented, preserve this dual purpose: student QR first, field application log second.

## Evidence

- Build: `pnpm --dir frontend build` passed. Existing warning remains: circular chunk between monitoreo-acreditacion and monitoreo-territorial.
- Visual QA: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-flow-hostigamiento-route/report.json`
- Final QR screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-flow-final-human-labels/quick-recopiladores-1280x800-auto.png`
- Package engine screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-fichas-package-engine/recopiladores-paquete-pdf-final-1280x800-v4.png`
- Final hostigamiento flow report: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-fichas-final-hostigamiento/report.json`
- Printable package PDF: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`
- Printable package screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-fichas-iteration5/recopiladores-paquete-preparado-1280x800-v4.png`
- Rendered PDF pages: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/aulas-fichas-iteration5/ficha-qr-hostigamiento-1.png`, `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/aulas-fichas-iteration5/ficha-qr-hostigamiento-2.png`, `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/aulas-fichas-iteration5/ficha-qr-hostigamiento-last-9.png`
- Recovered classroom sample screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-integration-iteration6-final/quick-muestra-aulas-1440x1000-auto.png`
- Monitoreo handoff Avance screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-integration-iteration7-baseline/monitoreo-avance-final.png`
- Monitoreo handoff Agenda screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-integration-iteration7-baseline/monitoreo-agenda-final-copy.png`
- Calc-Muestra Salida handoff screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-integration-iteration8-baseline/calc-salida-seguimiento-final-v2.png`
- Hostigamiento contract report: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-hostigamiento-contract-iteration9/report.json`
- Hostigamiento sample screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-hostigamiento-contract-iteration9/quick-muestra-aulas-1440x1000-auto.png`
- Hostigamiento fichas screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-hostigamiento-contract-iteration9/quick-recopiladores-1440x1000-auto.png`
- Hostigamiento monitoring screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-hostigamiento-contract-iteration9/quick-monitoreo-1440x1000-auto.png`
- Aulas circuit contract report: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-circuit-contract-iteration10/report.json`
- Aulas circuit sample screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-circuit-contract-iteration10/quick-muestra-aulas-1440x1000-auto.png`
- Aulas circuit fichas screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-circuit-contract-iteration10/quick-recopiladores-1440x1000-auto.png`
- Aulas circuit monitoring screenshot: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-circuit-contract-iteration10/quick-monitoreo-1440x1000-auto.png`
- Polished QR ficha PDF: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`
- Polished QR ficha cover render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-polished-v2-1.png`
- Polished QR ficha first render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-polished-v2-2.png`
- Polished QR ficha last render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-polished-v2-9.png`
- Fichas QR UI after link generation: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-ficha-pdf-polish-check/recopiladores-after-links-v2.png`
- Full-field QR ficha PDF: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/output/pdf/ejemplo-ficha-qr-hostigamiento-pucp.pdf`
- Full-field QR ficha cover render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-all-fields-1.png`
- Full-field QR ficha first render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-all-fields-2.png`
- Full-field QR ficha last render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-all-fields-9.png`
- QR-first ficha UI after link generation: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-ficha-qr-hero-check/recopiladores-after-links.png`
- QR-first ficha print preview: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-ficha-qr-hero-check/recopiladores-print-preview.png`
- QR-first ficha cover render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-qr-hero-1.png`
- QR-first ficha first render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-qr-hero-2.png`
- QR-first ficha last render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-qr-hero-9.png`
- Reference scanned ficha render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/reference-ficha/reference-1.png`
- Reference-form UI after link generation: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-ficha-reference-form-check/recopiladores-after-links.png`
- Reference-form print preview: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/aulas-ficha-reference-form-check/recopiladores-print-preview-v2.png`
- Reference-form ficha first render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-reference-form-v2-2.png`
- Reference-form ficha last render: `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/pdfs/ficha-reference-form-v2-9.png`
