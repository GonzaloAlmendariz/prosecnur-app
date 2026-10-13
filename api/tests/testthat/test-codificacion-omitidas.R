# ADR 0100, pieza P1: `/aplicar` dice qué preguntas del catálogo omitió y por
# qué, y cuántos textos quedaron sin código.
#
# Medido sobre una copia de HSyVBG 2026 (2026-10-13): quitando `P66_otro` de la
# base, `.bridge_grupos_to_plantilla()` devolvía P66 en `$skipped`, no se creaba
# `P66_recod` y la respuesta de `/aplicar` no lo decía. P29_10 —opción única sin
# modo, con un catálogo de texto que no le corresponde— se omitía igual. Y un
# texto sin grupo («Hombre» en P4_otro) se quedaba en 88 sin aviso.

.omit_grupo <- function(codigo, etiqueta, respuestas = character(0)) {
  list(codigo = codigo, etiqueta = etiqueta, respuestas = as.list(respuestas))
}

.omit_rows <- function() {
  list(
    list(parent = "P29_10", tipo = "select_one", modo_so = "", text_col = "", parent_col = ""),
    list(parent = "P66", tipo = "select_multiple", modo_so = "", text_col = "P66_otro", parent_col = ""),
    list(parent = "P4", tipo = "select_one", modo_so = "padre", text_col = "P4_otro", parent_col = ""),
    list(parent = "P30_otro", tipo = "text", modo_so = "", text_col = "", parent_col = "")
  )
}

.omit_grupos <- function() {
  list(
    P29_10 = list(.omit_grupo("1", "Sí", c("psicologia y psiquiatria"))),
    P66 = list(.omit_grupo("9", "Visitas presenciales", c("en clase."))),
    P4 = list(
      .omit_grupo("4", "Pansexual / Queer", c("pansexual", "queer")),
      .omit_grupo("5", "Asexual", c("asexual"))
    ),
    P30_otro = list(.omit_grupo("1", "Satisfacción general", c("muy bien")))
  )
}

test_that("P29_10 sin modo y P66 sin su columna de texto se declaran con su motivo", {
  data_cols <- c("P29_10", "P66", "P4", "P4_otro", "P30_otro")  # sin P66_otro
  out <- .codif_omitidas(c("P29_10", "P66"), .omit_grupos(), .omit_rows(), data_cols)

  expect_length(out, 2L)
  por <- stats::setNames(out, vapply(out, `[[`, "", "pregunta"))
  expect_identical(por$P29_10$motivo, "sin_modo")
  expect_identical(por$P66$motivo, "sin_columna_texto")
  expect_match(por$P66$mensaje, "P66_otro", fixed = TRUE)
})

test_that("una omitida cuyo motivo no se reconoce no inventa uno", {
  data_cols <- c("P4", "P4_otro")
  out <- .codif_omitidas("P4", .omit_grupos(), .omit_rows(), data_cols)
  expect_identical(out[[1]]$motivo, "no_se_pudo_aplicar")
})

test_that("una pregunta fuera de familias o con catálogo vacío se distingue", {
  grupos <- c(.omit_grupos(), list(P99 = list(.omit_grupo("1", "x", "y")), P98 = list()))
  out <- .codif_omitidas(c("P99", "P98"), grupos, .omit_rows(), character(0))
  por <- stats::setNames(out, vapply(out, `[[`, "", "pregunta"))
  expect_identical(por$P99$motivo, "sin_fila")
  expect_identical(por$P98$motivo, "sin_grupos")
})

test_that("sin omitidas no hay nada que declarar", {
  expect_identical(.codif_omitidas(character(0), .omit_grupos(), .omit_rows(), "P4"), list())
})

test_that("los textos sin código se cuentan con la normalización de Codificación", {
  data_df <- data.frame(
    P4_otro = c("Pansexual", "QUEER", "Hombre", "hombre ", NA, "", "asexual"),
    P30_otro = c("Muy bien", "regular", NA, NA, NA, NA, NA),
    stringsAsFactors = FALSE
  )
  out <- .codif_textos_sin_codigo(c("P4", "P30_otro"), .omit_grupos(), .omit_rows(), data_df)
  por <- stats::setNames(out, vapply(out, `[[`, "", "pregunta"))

  # «Pansexual» y «QUEER» casan normalizados; «Hombre» y «hombre » son un solo
  # texto en dos casos.
  expect_identical(por$P4$columna, "P4_otro")
  expect_identical(por$P4$casos, 2L)
  expect_identical(por$P4$textos, 1L)
  # Una pregunta de texto sin `text_col` se mide en su propia columna.
  expect_identical(por$P30_otro$casos, 1L)
  expect_identical(unlist(por$P30_otro$ejemplos), "regular")
})

test_that("una pregunta con todo codificado no aparece", {
  data_df <- data.frame(P4_otro = c("pansexual", "asexual"), stringsAsFactors = FALSE)
  expect_identical(.codif_textos_sin_codigo("P4", .omit_grupos(), .omit_rows(), data_df), list())
})

test_that("una agrupación cuya madre ya no está en la base se declara omitida", {
  specs <- list(
    list(parent = "P8", target = "P8_agr", categorias = list(list(codigo = "1"))),
    list(parent = "P5", target = "P5_agr", categorias = list(list(codigo = "1")))
  )
  out <- .codif_agrupaciones_omitidas(specs, c("P8", "P8_otro"))
  expect_length(out, 1L)
  expect_identical(out[[1]]$pregunta, "P5")
  expect_identical(out[[1]]$motivo, "sin_variable_madre")
  expect_identical(out[[1]]$variable_nueva, "P5_agr")
  expect_match(out[[1]]$mensaje, "«P5»", fixed = TRUE)
  expect_identical(.codif_agrupaciones_omitidas(list(), "P5"), list())
})

test_that("el plan y /aplicar usan la misma regla de columna faltante", {
  rows <- .omit_rows()
  sm <- rows[[2]]  # P66, SM con text_col P66_otro
  expect_identical(.codif_columna_faltante(sm, c("P66", "P66_otro"))$motivo, "")
  falta <- .codif_columna_faltante(sm, "P66")
  expect_identical(falta$motivo, "sin_columna_texto")
  expect_match(falta$mensaje, "P66_otro", fixed = TRUE)
  so <- rows[[3]]  # P4 padre
  expect_identical(.codif_columna_faltante(so, "P4_otro")$motivo, "sin_columna_padre")
  txt <- rows[[4]]  # P30_otro sin text_col
  expect_identical(.codif_columna_faltante(txt, character(0))$motivo, "sin_columna_texto")
})
