# Acreditacion multibase en Carga/Procesamiento

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-07-02
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de Carga y acreditación](../historico/carga-acreditacion-2026-07.md)

Fecha: 2026-07-02

## Loop de reparacion

Categoria/source of truth: Carga/SurveyMonkey multibase, backend R en
`api/R/surveymonkey_multibase.R`, cliente `frontend/src/api/client.ts`, UI
`frontend/src/features/carga/BasesPanel.tsx`, y evidencia visual con
`ACRDCONTA.pulso`.

Scope lock:

- Module: SurveyMonkey multibase independiente para procesamiento por actor.
- Files planned: `api/R/surveymonkey_multibase.R`,
  `api/tests/testthat/test-acreditacion-multi-actor-processing.R`,
  `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`,
  `frontend/src/features/carga/BasesPanel.tsx`,
  `frontend/src/features/carga/BasesPanel.test.ts`,
  `frontend/src/app/theme.css`.
- Files excluded: Kobo, Monitoreo engine, PPT/reportes, graficadores,
  credenciales, datos reales persistidos en `.pulso`.
- Main risk: aplicar reglas SurveyMonkey globales cuando un actor necesita una
  regla distinta por desplazamiento de Q1/Q2/Q3.
- Minimum validation command: R multi-actor, traductor SurveyMonkey, pruebas
  focales frontend, typecheck, diff check y QA visual en ACRDCONTA.

## Iteracion 1

- Failure or bottleneck: el flujo podia validar una regla directa comun de
  SurveyMonkey, pero no podia expresar excepciones por actor/base cuando una
  encuesta tiene una pregunta adicional como Codigo Pulso y cambia la
  indexacion Q/P.
- Focused change: se agrego `logic_rules_by_survey` al importador independiente
  de SurveyMonkey, se registra si la regla aplicada fue global o por encuesta,
  la UI permite capturar reglas especificas por actor y el preview etiqueta el
  origen de cada regla.
- Files changed: los archivos listados en el scope lock.
- Validation command:
  - `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-acreditacion-multi-actor-processing.R", reporter="summary")'`
  - `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-engine-surveymonkey-logica.R", reporter="summary")'`
  - `pnpm --dir frontend test src/features/carga/BasesPanel.test.ts src/api/client.test.ts`
  - `pnpm --dir frontend typecheck`
  - `git diff --check -- api/R/surveymonkey_multibase.R api/tests/testthat/test-acreditacion-multi-actor-processing.R frontend/src/api/client.ts frontend/src/api/client.test.ts frontend/src/features/carga/BasesPanel.tsx frontend/src/features/carga/BasesPanel.test.ts frontend/src/app/theme.css`
  - QA visual manual Playwright con
    `<ruta de trabajo local>`.
- Result: todos los comandos pasaron. Evidencia visual:
  - `tmp/visual-qa/manual/acrconta-sm-actor-logic/report.json`
  - `tmp/visual-qa/manual/acrconta-sm-actor-logic/carga-sm-actor-logic-1440x1000.png`
  - `tmp/visual-qa/manual/acrconta-sm-actor-logic/carga-sm-actor-logic-1280x800.png`
  - `tmp/visual-qa/manual/acrconta-sm-actor-logic/actor-field-report-after-css.json`
  - `tmp/visual-qa/manual/acrconta-sm-actor-logic/carga-sm-actor-logic-field-1440x1000-after-css.png`
- Better/worse/same: mejor. El preview muestra `Regla comun` y `Actor
  Estudiantes`; el campo especifico queda dentro del area util en desktop
  (`x=439`, sin overflow).
- Next action: continuar con el siguiente corte del objetivo amplio:
  integracion analitica/reporte/PPT por actor y validacion con credenciales o
  exportaciones SurveyMonkey reales cuando esten disponibles.

## Iteracion 2

- Failure or bottleneck: el motor PPT ya podia renderizar referencias
  `actor$variable`, pero el plan sugerido de Graficos seguia armando el informe
  desde la base activa y no proponia comparativos automaticos entre actores.
- Focused change: el plan sugerido detecta proyectos multibase/acreditacion,
  lee el inventario completo solo para reporte, agrupa preguntas `select_one`
  equivalentes por etiqueta y firma de escala, y crea slides
  `p_barras_multiapiladas(modo = "var_cruce")` con varios actores. La opcion se
  puede desactivar con `multi_actor_comparisons = FALSE`.
- Files changed: `api/R/graficos_plan_coverage.R` y
  `api/tests/testthat/test-graficos-plan-coverage.R`.
- Validation command:
  - `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-graficos-plan-coverage.R", reporter = "summary")'`
  - `Rscript -e 'pkgload::load_all("api", quiet = TRUE); testthat::test_file("api/tests/testthat/test-engine-plan-ppt-var-cruce.R", reporter = "summary")'`
  - Render sintetico del plan sugerido reconstruyendo slides editables con el
    adaptador del router y ejecutando `reporte_ppt_plan(..., solo_lista = TRUE)`
    sobre tres fuentes: estudiantes, docentes y administrativos.
  - `git diff --check`
- Result: todos los comandos pasaron. El render sintetico genero 4 slides
  renderizadas y el primer comparativo incluyo las etiquetas `Estudiantes`,
  `Docentes` y `Administrativos`.
- Better/worse/same: mejor. El informe sugerido ya puede mostrar una pregunta
  comun con tres actores en un mismo slide y evita comparar preguntas con igual
  etiqueta si la escala interna no es compatible.
- Next action: validar con un `.pulso` real de ACRCONTA/ACRDCONTA cuando esten
  las cuatro exportaciones finales de SurveyMonkey y la matriz de
  estandarizacion de preguntas.
