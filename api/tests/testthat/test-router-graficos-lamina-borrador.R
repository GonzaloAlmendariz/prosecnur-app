# B36/G-12: un plan con laminas a medio armar (grafico vacio) no puede matar
# el export completo. jsonlite rectangulariza los slides al parsear el body
# del job: la lamina sin grafico llega como graficador = NA, y nzchar(NA) es
# TRUE, asi que el guard "sin graficador" no la atrapaba y el deck entero
# moria con "Graficador no registrado: NA".

test_that("graficador NA (lamina borrador rectangularizada) rebuilds a NULL", {
  expect_null(.rebuild_graf(list(graficador = NA)))
  expect_null(.rebuild_graf(list(graficador = NA_character_, args = list())))
  expect_null(.graficos_rebuild_graf_json(list(graficador = NA)))
})

test_that("graficador vacio o ausente sigue rebuildeando a NULL", {
  expect_null(.rebuild_graf(NULL))
  expect_null(.rebuild_graf(list()))
  expect_null(.rebuild_graf(list(graficador = "")))
  expect_null(.rebuild_graf(list(graficador = "   ")))
  expect_null(.graficos_rebuild_graf_json(list()))
})

test_that("la fila rectangularizada por jsonlite (graficador NA) rebuilds a NULL", {
  # Cuando el plan trae varias laminas y jsonlite las rectangulariza a
  # data.frame, la lamina borrador queda como fila con graficador = NA.
  grafico_df <- data.frame(graficador = c("p_barras_apiladas", NA_character_))
  fila_borrador <- as.list(grafico_df[2, , drop = FALSE])
  expect_true(is.na(fila_borrador$graficador[[1]]))
  expect_null(.rebuild_graf(fila_borrador))
  expect_null(.graficos_rebuild_graf_json(fila_borrador))
})

test_that("un graficador desconocido REAL conserva su error legible", {
  expect_error(
    .rebuild_graf(list(graficador = "p_no_existe")),
    "Graficador no registrado"
  )
})

test_that("una lamina borrador completa (p_slide_1_grafico sin grafico) se arma con canvas en blanco", {
  slide <- list(
    tipo = "p_slide_1_grafico",
    payload = list(titulo = "Borrador pendiente", grafico = list())
  )
  out <- .graficos_rebuild_slide_json(slide)
  expect_false(is.null(out))
})

test_that("el relleno de slots respeta los formals opcionales", {
  fn_fake <- function(grafico, extra = NULL) list(grafico = grafico, extra = extra)
  payload <- list(titulo = "x")
  filled <- .graficos_fill_blank_graf_slots(payload, fn_fake, c("grafico", "extra"))
  expect_false(is.null(filled$grafico))
  expect_null(filled$extra)
})

# --- G-15: refs vacias con formas exoticas (informe conjunto a medio armar) ---

test_that("var como lista vacia o NA cuenta como ref en blanco", {
  expect_true(.graficos_blank_ref_value(list()))
  expect_true(.graficos_blank_ref_value(character(0)))
  expect_true(.graficos_blank_ref_value(NA_character_))
  expect_true(.graficos_blank_ref_value(list(NULL)))
  expect_true(.graficos_blank_ref_value(list("", "  ")))
  expect_false(.graficos_blank_ref_value("docentes$p13_1"))
  expect_false(.graficos_blank_ref_value(list("docentes$p13_1")))
  expect_false(.graficos_blank_ref_value(NULL))
})

test_that("un graficador con var vacio ([] de la UI) degrada a canvas en blanco", {
  out <- .rebuild_graf(list(graficador = "p_barras_apiladas", args = list(var = list())))
  expect_s3_class(out, "ppt_element")
  out2 <- .rebuild_graf(list(graficador = "p_barras_agrupadas", args = list(var = "")))
  expect_s3_class(out2, "ppt_element")
})

test_that("un graficador SIN var (formal requerido ausente) degrada a canvas en blanco", {
  out <- .rebuild_graf(list(graficador = "p_barras_apiladas", args = list(titulo = "x")))
  expect_s3_class(out, "ppt_element")
})

test_that("vars presente pero vacio tambien degrada", {
  expect_true(.graficos_args_missing_required_ref(list(vars = list())))
})

test_that("multiapiladas sin var sigue funcionando (var es opcional ahi)", {
  el <- .rebuild_graf(list(
    graficador = "p_barras_multiapiladas",
    args = list(modo = "var_cruce", vars = list(bloque = c("p1", "p2")))
  ))
  expect_s3_class(el, "ppt_element")
})

test_that("una ref valida envuelta en list() por la rectangularizacion se desenvuelve", {
  # Plan mixto (borrador + valida): var de la lamina valida llega como
  # list("fuente$var") — antes moria con "`var` debe ser character(1)".
  args <- .graficos_unwrap_scalar_refs(list(var = list("estudiantes$p7"), overrides = list(a = 1)))
  expect_identical(args$var, "estudiantes$p7")
  expect_true(is.list(args$overrides))
})

test_that("el rebuild con var en lista-de-1 produce el elemento real, no un blank", {
  el <- .rebuild_graf(list(graficador = "p_barras_agrupadas", args = list(var = list("p7"))))
  expect_s3_class(el, "ppt_element")
  expect_identical(el$.element_type, "barras_agrupadas")
})
