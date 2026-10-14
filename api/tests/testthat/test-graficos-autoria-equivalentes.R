source("setup-load-all.R")

# Enmienda al ADR 0103 «la matriz sugiere, la lámina decide» (P21 del checklist
# docs/qa/checklist-importacion-sm-arte-2026-10-14.md).
#
# El radar entre públicos, la brecha entre dos bases y la serie temporal se
# arman en la lámina con los MISMOS args de ranura:
#   { vars: {key: ["base$var", ...]}, titulos_grupo?: {key: título},
#     corte: "3,4" (o arreglo, que se une), corte_etiqueta? }
# Lo que estas pruebas cuidan es la frontera constructor/rebuild: lo que la
# tarjeta guarda tiene que llegar al elemento sin perder códigos ni títulos.

.ae_radar_vars <- list(
  Clima = c("docentes$p1", "estudiantes$p1"),
  Trato = c("docentes$p2", "estudiantes$p2"),
  Apoyo = c("docentes$p3", "estudiantes$p3")
)
.ae_brecha_vars <- list(Clima = c("docentes$p1", "estudiantes$p1"))
.ae_serie_vars <- list(Clima = c("ola1$p1", "ola2$p1"))

# ---- 1. El corte declarado como arreglo conserva TODOS sus códigos ----------

test_that("p_radar(modo = 'publicos') une el corte en arreglo en una sola cadena", {
  el <- p_radar(modo = "publicos", vars = .ae_radar_vars, corte = c("3", "4"))
  expect_identical(el$corte, "3,4")
})

test_that("p_dumbbell entre dos bases une el corte en arreglo en una sola cadena", {
  el <- p_dumbbell(vars = .ae_brecha_vars, corte = c("3", "4"))
  expect_null(el$cruce)
  expect_identical(el$corte, "3,4")
})

test_that("p_serie_temporal une el corte en arreglo en una sola cadena", {
  el <- p_serie_temporal(vars = .ae_serie_vars, corte = c("3", "4"))
  expect_identical(el$corte, "3,4")
})

test_that("el corte en cadena no cambia (regresión de la forma canónica)", {
  expect_identical(p_radar(modo = "publicos", vars = .ae_radar_vars, corte = "3,4")$corte, "3,4")
  expect_identical(p_dumbbell(vars = .ae_brecha_vars, corte = "3,4")$corte, "3,4")
  expect_identical(p_serie_temporal(vars = .ae_serie_vars, corte = "3,4")$corte, "3,4")
})

test_that("el corte llega como arreglo JSON por el rebuild y sale unido", {
  radar <- .graficos_rebuild_graf_json(list(
    graficador = "p_radar",
    args = list(modo = "publicos", vars = .ae_radar_vars, corte = list("3", "4"))
  ))
  brecha <- .graficos_rebuild_graf_json(list(
    graficador = "p_dumbbell",
    args = list(vars = .ae_brecha_vars, corte = list("3", "4"))
  ))
  serie <- .graficos_rebuild_graf_json(list(
    graficador = "p_serie_temporal",
    args = list(vars = .ae_serie_vars, corte = list("3", "4"), orden_periodos = list("ola1", "ola2"))
  ))
  expect_identical(radar$corte, "3,4")
  expect_identical(brecha$corte, "3,4")
  expect_identical(serie$corte, "3,4")
})

# ---- 2. titulos_grupo renombra las claves internas antes de validar ---------

.ae_rebuild <- function(graficador, vars, titulos_grupo, extra = list()) {
  .graficos_rebuild_graf_json(list(
    graficador = graficador,
    args = c(list(vars = vars, titulos_grupo = titulos_grupo, corte = "3,4"), extra)
  ))
}

test_that("titulos_grupo da el nombre visible al tema en el radar entre públicos", {
  el <- .ae_rebuild(
    "p_radar",
    vars = list(
      tema_1 = list("docentes$p1", "estudiantes$p1"),
      tema_2 = list("docentes$p2", "estudiantes$p2"),
      tema_3 = list("docentes$p3", "estudiantes$p3")
    ),
    titulos_grupo = list(tema_1 = "Clima", tema_2 = "Trato", tema_3 = "Apoyo"),
    extra = list(modo = "publicos")
  )
  expect_identical(names(el$vars), c("Clima", "Trato", "Apoyo"))
  expect_identical(el$vars$Clima, c("docentes$p1", "estudiantes$p1"))
})

test_that("titulos_grupo da el nombre visible al tema en la brecha entre dos bases", {
  el <- .ae_rebuild(
    "p_dumbbell",
    vars = list(tema_1 = list("docentes$p1", "estudiantes$p1")),
    titulos_grupo = list(tema_1 = "Clima")
  )
  expect_null(el$cruce)
  expect_identical(names(el$vars), "Clima")
})

test_that("titulos_grupo da el nombre visible al tema en la serie temporal", {
  el <- .ae_rebuild(
    "p_serie_temporal",
    vars = list(tema_1 = list("ola1$p1", "ola2$p1")),
    titulos_grupo = list(tema_1 = "Clima"),
    extra = list(orden_periodos = list("ola1", "ola2"))
  )
  expect_identical(names(el$vars), "Clima")
})

test_that("sin título declarado, la clave del tema queda como nombre", {
  el <- .ae_rebuild(
    "p_dumbbell",
    vars = list(tema_1 = list("docentes$p1", "estudiantes$p1"),
                tema_2 = list("docentes$p2", "estudiantes$p2")),
    titulos_grupo = list(tema_1 = "Clima")
  )
  expect_identical(names(el$vars), c("Clima", "tema_2"))
})

test_that("dos temas con el mismo título se rechazan en los tres graficadores", {
  dup <- list(tema_1 = "Clima", tema_2 = "Clima")
  expect_error(
    .ae_rebuild(
      "p_radar",
      vars = list(tema_1 = list("docentes$p1", "estudiantes$p1"),
                  tema_2 = list("docentes$p2", "estudiantes$p2"),
                  tema_3 = list("docentes$p3", "estudiantes$p3")),
      titulos_grupo = dup,
      extra = list(modo = "publicos")
    ),
    class = "pulso_plan_spec_error"
  )
  expect_error(
    .ae_rebuild(
      "p_dumbbell",
      vars = list(tema_1 = list("docentes$p1", "estudiantes$p1"),
                  tema_2 = list("docentes$p2", "estudiantes$p2")),
      titulos_grupo = dup
    ),
    class = "pulso_plan_spec_error"
  )
  expect_error(
    .ae_rebuild(
      "p_serie_temporal",
      vars = list(tema_1 = list("ola1$p1", "ola2$p1"),
                  tema_2 = list("ola1$p2", "ola2$p2")),
      titulos_grupo = dup,
      extra = list(orden_periodos = list("ola1", "ola2"))
    ),
    class = "pulso_plan_spec_error"
  )
})

# ---- 3. La serie se arma en la lámina: el registry ya no la manda a la matriz

test_that("metadata: la serie temporal es de autoría directa y ninguna remite a la matriz", {
  reg <- .graficos_registry_payload()
  by_name <- stats::setNames(
    reg$graficadores,
    vapply(reg$graficadores, `[[`, character(1), "name")
  )
  serie <- by_name$p_serie_temporal
  expect_identical(serie$authoring_mode, "direct")
  expect_identical(serie$capability_key, "")
  expect_identical(serie$data_requirement, "named_vars")
  for (name in c("p_serie_temporal", "p_dumbbell")) {
    label <- by_name[[name]]$requirement_label
    expect_false(grepl("no se arma desde aqu", label, ignore.case = TRUE), label = name)
    expect_false(grepl("sale de la matriz", label, ignore.case = TRUE), label = name)
  }
})
