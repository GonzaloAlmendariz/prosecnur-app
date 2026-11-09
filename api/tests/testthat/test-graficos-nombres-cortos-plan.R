source("setup-load-all.R")

# E4 (prueba con Arte, 2026-11-09): el nombre corto que el analista escribió para una pregunta en un gráfico del plan
# vale por defecto en las láminas de resumen. Precedencia: lo de ese gráfico > el nombre corto del plan > el enunciado.

.ncp_plan <- function() list(slides = list(
  list(id = "s1", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_categoricas",
       args = list(var = "docentes$p2", overrides = list(etiquetas_vars = list(`docentes$p2` = "Biblioteca")))))),
  list(id = "s2", tipo = "p_slide_1_grafico", payload = list(grafico = list(graficador = "p_barras_categoricas",
       args = list(var = "p2", overrides = list(etiquetas_vars = list(p2 = "Otra"))))))))

test_that("el mapa del plan junta los nombres cortos de todos los gráficos; gana el primero", {
  m <- .plan_nombres_cortos(.ncp_plan())
  expect_identical(m$`docentes$p2`, "Biblioteca")
  expect_identical(m$p2, "Otra")
  expect_length(.plan_nombres_cortos(list(slides = list())), 0L)
  ctx <- .nombres_cortos_en_contexto(NULL, .ncp_plan())
  expect_identical(ctx$nombres_cortos$`docentes$p2`, "Biblioteca")
  expect_null(.sig_informe_vigente())   # un contexto con sólo nombres cortos no inventa una regla de diferencias
  expect_null(.nombres_cortos_en_contexto(NULL, list(slides = list())))
})

test_that("precedencia en las láminas de resumen: gráfico > nombre corto del plan > enunciado", {
  inst <- list(survey = data.frame(name = c("p1", "p2"), type = "select_one lk", label = c("Conozco los reglamentos de la Facultad",
                                   "La biblioteca atiende bien y a tiempo a los estudiantes"), stringsAsFactors = FALSE))
  instrument_sources <- list(docentes = inst)
  withr::local_options(prosecnur.sig_informe = .nombres_cortos_en_contexto(NULL, .ncp_plan()))
  enunciado <- "La biblioteca atiende bien y a tiempo a los estudiantes"
  # Sin nombre corto en este gráfico: el del plan (la calificada gana a la de la variable sola).
  expect_identical(.resumen_rotulo_corto("docentes$p2", enunciado), "Biblioteca")
  # Un rótulo escrito en este gráfico (no es el enunciado) se respeta.
  expect_identical(.resumen_rotulo_corto("docentes$p2", "Mi rótulo"), "Mi rótulo")
  # Sin nombre corto en ningún lado: el enunciado.
  expect_identical(.resumen_rotulo_corto("docentes$p1", "Conozco los reglamentos de la Facultad"), "Conozco los reglamentos de la Facultad")
  # El «Nombre corto de la pregunta» de este gráfico manda sobre el del plan.
  withr::local_options(prosecnur.plan_etiquetas_cortas = list(`docentes$p2` = "Biblio (este gráfico)"))
  expect_identical(.resumen_rotulo_corto("docentes$p2", enunciado), "Biblio (este gráfico)")
})

test_that("el export lleva los nombres cortos del plan al contexto del informe", {
  sig <- list(graficos_config = list(plan = .ncp_plan()), analitica_config = list(), equivalencias_publicos = NULL)
  ds <- list(docentes = data.frame(p1 = c("1", "2")), estudiantes = data.frame(p1 = c("1", "2")))
  is <- list(docentes = list(survey = data.frame(name = "p1", type = "select_one lk", label = "x")), estudiantes = list(survey = data.frame(name = "p1", type = "select_one lk", label = "x")))
  previa <- suppressMessages(.sig_informe_preparar(sig, ds, is, base = "docentes")); on.exit(options(previa), add = TRUE)
  expect_identical(getOption("prosecnur.sig_informe")$nombres_cortos$`docentes$p2`, "Biblioteca")
})
