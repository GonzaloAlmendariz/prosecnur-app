source("setup-load-all.R")

# B56/W-8 — la nota de Base declara el criterio cuando el denominador se
# redujo por exclusión de opciones («Base: 47 docentes (respuestas válidas)»
# vs «Base: 52 docentes»). Veredicto metodológico CAMBIAR; helper nuevo en
# reporte_plan_base_criterio.R, hooks en .base_auto_from_var/.base_auto_from_refs
# (reporte_plan_ppt.R, congelado a crecimiento).

.bc_inst <- function(survey, choices) {
  list(survey = survey, choices = choices, orders_list = NULL)
}

.bc_acuerdo_choices <- function() {
  data.frame(
    list_name = "acuerdo",
    name = c("1", "2", "3", "4", "9"),
    label = c(
      "Totalmente en desacuerdo", "En desacuerdo",
      "De acuerdo", "Totalmente de acuerdo", "SIN INF"
    ),
    stringsAsFactors = FALSE
  )
}

.bc_survey_p1 <- function() {
  data.frame(
    name = "p1", type = "select_one acuerdo", list_name = "acuerdo",
    stringsAsFactors = FALSE
  )
}

# 52 docentes: 47 con respuesta válida + 5 SIN INF (el caso real Conta 47/52).
.bc_docentes <- function() {
  data.frame(
    p1 = c(rep("4", 30), rep("3", 15), rep("1", 2), rep("9", 5)),
    grupo = rep(c("A", "B"), 26),
    stringsAsFactors = FALSE
  )
}

.bc_meta <- function(data, instrumento, plan, presets = NULL) {
  reporte_ppt_plan(
    data = data, instrumento = instrumento, plan = plan, presets = presets,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )$render_meta
}

.bc_bases <- function(meta) {
  vapply(meta, function(e) e$base %||% NA_character_, character(1))
}

.bc_plan_var <- function(overrides = list(), filtros = list()) {
  list(diapo_001 = p_slide_1_grafico(
    grafico = p_barras_multiapiladas(
      modo = "var", vars = "p1", overrides = overrides, filtros = filtros
    )
  ))
}

test_that("exclusion activa marca la base con el criterio (var unica)", {
  meta <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(overrides = list(excluir_opciones = "SIN INF"))
  )
  expect_identical(.bc_bases(meta), "Base: 47 (respuestas válidas)")
})

test_that("exclusion activa compone sufijo_auto antes de la marca", {
  meta <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(overrides = list(excluir_opciones = "SIN INF")),
    presets = list(base = list(args = list(sufijo_auto = "docentes")))
  )
  expect_identical(.bc_bases(meta), "Base: 47 docentes (respuestas válidas)")
})

test_that("sin exclusion la nota de Base queda byte-identica a la historica", {
  meta <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var()
  )
  expect_identical(.bc_bases(meta), "Base: 52")

  # Con sufijo_auto declarado tampoco cambia un byte.
  meta_suf <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(),
    presets = list(base = list(args = list(sufijo_auto = "docentes")))
  )
  expect_identical(.bc_bases(meta_suf), "Base: 52 docentes")
})

test_that("multiactor prorrateado marca una sola vez al final", {
  estudiantes <- data.frame(p1 = rep(c("3", "4"), 75), stringsAsFactors = FALSE)
  data_multi <- list(docentes = .bc_docentes(), estudiantes = estudiantes)
  inst_multi <- list(
    docentes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    estudiantes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices())
  )

  meta <- .bc_meta(
    data_multi, inst_multi,
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(acuerdo = c("docentes$p1", "estudiantes$p1")),
        overrides = list(excluir_opciones = "SIN INF")
      )
    ))
  )
  # Solo docentes pierde casos (47 de 52); estudiantes queda entero (150).
  # La marca es global y una sola: los N mostrados son los validos por parte.
  expect_identical(
    .bc_bases(meta),
    "Base: 47 docentes y 150 estudiantes (respuestas válidas)"
  )

  # Paridad prorrateada: sin exclusion, ni marca ni cambio alguno.
  meta_sin <- .bc_meta(
    data_multi, inst_multi,
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var_cruce",
        vars = list(acuerdo = c("docentes$p1", "estudiantes$p1"))
      )
    ))
  )
  expect_identical(.bc_bases(meta_sin), "Base: 52 docentes y 150 estudiantes")
})

test_that("reporte multibase con grafico de una fuente marca la base rotulada", {
  # La forma exacta del deck Conta: reporte multiactor, lamina de docentes.
  estudiantes <- data.frame(p1 = rep(c("3", "4"), 75), stringsAsFactors = FALSE)
  data_multi <- list(docentes = .bc_docentes(), estudiantes = estudiantes)
  inst_multi <- list(
    docentes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    estudiantes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices())
  )

  meta <- .bc_meta(
    data_multi, inst_multi,
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var", vars = "docentes$p1",
        overrides = list(excluir_opciones = "SIN INF")
      )
    ))
  )
  expect_identical(.bc_bases(meta), "Base: 47 docentes (respuestas válidas)")

  meta_sin <- .bc_meta(
    data_multi, inst_multi,
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(modo = "var", vars = "docentes$p1")
    ))
  )
  expect_identical(.bc_bases(meta_sin), "Base: 52 docentes")
})

test_that("filtro + exclusion marcan sobre el universo ya filtrado", {
  meta <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(
      overrides = list(excluir_opciones = "SIN INF"),
      filtros = list(grupo = "A")
    )
  )
  # Grupo A: 26 casos, 2 SIN INF => 24 validas.
  expect_identical(.bc_bases(meta), "Base: 24 (respuestas válidas)")

  # Filtro SOLO (sin exclusion) es una decision de disenio declarada del
  # estudio: no activa la marca y queda byte-identico al historico.
  meta_filtro <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(filtros = list(grupo = "A"))
  )
  expect_identical(.bc_bases(meta_filtro), "Base: 26")
})

test_that("no-respuesta del item (NA) marca la base sin excluir_opciones", {
  # El mecanismo REAL del deck Conta: Limpieza remapeo SIN INF a NA, asi que
  # el plan no declara exclusion alguna y aun asi el Total valido (47) es
  # menor que el universo de la fuente (52).
  docentes_na <- data.frame(
    p1 = c(rep("4", 30), rep("3", 15), rep("1", 2), rep(NA_character_, 5)),
    stringsAsFactors = FALSE
  )
  meta <- .bc_meta(
    docentes_na, .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var()
  )
  expect_identical(.bc_bases(meta), "Base: 47 (respuestas válidas)")

  # En reporte multibase, la lamina de una fuente rotulada tambien marca.
  estudiantes <- data.frame(p1 = rep(c("3", "4"), 75), stringsAsFactors = FALSE)
  meta_multi <- .bc_meta(
    list(docentes = docentes_na, estudiantes = estudiantes),
    list(
      docentes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
      estudiantes = .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices())
    ),
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(modo = "var", vars = "docentes$p1")
    ))
  )
  expect_identical(.bc_bases(meta_multi), "Base: 47 docentes (respuestas válidas)")
})

test_that("select_multiple con no-marcadores tampoco lleva marca", {
  sm_choices <- data.frame(
    list_name = "serv",
    name = c("A", "B"),
    label = c("Biblioteca", "Laboratorio"),
    stringsAsFactors = FALSE
  )
  survey_sm <- data.frame(
    name = "sm1", type = "select_multiple serv", list_name = "serv",
    stringsAsFactors = FALSE
  )
  base_sm <- data.frame(
    sm1 = c(rep("A", 20), rep("A B", 20), rep("B", 12), rep(NA_character_, 4)),
    stringsAsFactors = FALSE
  )
  meta <- .bc_meta(
    base_sm, .bc_inst(survey_sm, sm_choices),
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(modo = "var", vars = "sm1")
    ))
  )
  # 52 marcaron algo de 56 filas: la base sm sigue siendo su Total canonico
  # (quienes respondieron) y la marca queda reservada a select_one.
  expect_identical(.bc_bases(meta), "Base: 52")
})

test_that("select_multiple conserva base Total y sin marca aunque oculte opciones", {
  sm_choices <- data.frame(
    list_name = "serv",
    name = c("A", "B", "C"),
    label = c("Biblioteca", "Laboratorio", "SIN INF"),
    stringsAsFactors = FALSE
  )
  survey_sm <- data.frame(
    name = "sm1", type = "select_multiple serv", list_name = "serv",
    stringsAsFactors = FALSE
  )
  base_sm <- data.frame(
    sm1 = c(rep("A", 10), rep("A B", 20), rep("B", 10), rep("C", 8), rep("A C", 4)),
    stringsAsFactors = FALSE
  )

  meta <- .bc_meta(
    base_sm, .bc_inst(survey_sm, sm_choices),
    list(diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var", vars = "sm1",
        overrides = list(excluir_opciones = "SIN INF")
      )
    ))
  )
  # Invariante intocable: en select_multiple el N valido es cuantos marcaron
  # algo (52), NO la suma de las opciones visibles; la marca no aparece.
  expect_identical(.bc_bases(meta), "Base: 52")
})

test_that("todas las opciones excluidas degrada a lamina sin caption", {
  meta <- .bc_meta(
    .bc_docentes(), .bc_inst(.bc_survey_p1(), .bc_acuerdo_choices()),
    .bc_plan_var(overrides = list(excluir_opciones = .bc_acuerdo_choices()$label))
  )
  expect_length(meta, 1L)
  expect_null(meta[[1]]$base)
})

test_that("la marca de criterio es idempotente y con paridad exacta", {
  componer <- prosecnurapp:::.reporte_plan_base_componer_nota
  marcar <- prosecnurapp:::.reporte_plan_base_marca_criterio

  expect_identical(componer(52), "Base: 52")
  expect_identical(componer(52, sufijo_auto = "docentes"), "Base: 52 docentes")
  expect_identical(
    componer(47, sufijo_auto = "docentes", reducida = TRUE),
    "Base: 47 docentes (respuestas válidas)"
  )
  expect_identical(componer(1500, reducida = TRUE), "Base: 1,500 (respuestas válidas)")
  expect_identical(
    componer(47, formato = "N = %s", reducida = TRUE),
    "N = 47 (respuestas válidas)"
  )

  # Idempotencia: recomponer/re-sellar no duplica la marca.
  una_vez <- marcar("47 docentes", reducida = TRUE)
  expect_identical(marcar(una_vez, reducida = TRUE), una_vez)
})
