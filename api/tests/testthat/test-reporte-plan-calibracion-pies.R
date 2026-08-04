source("setup-load-all.R")

# La calibracion geometrica de pies/iconos (.ppt_calibrar_pies_iconos) existe
# porque los type_idx del contrato asumen la numeracion de plantilla_16_9 y la
# plantilla ACNUR corre todos los body en un indice (no tiene body-logo). El
# fallback por tipo colocaba el footer dentro del texto narrativo, el texto
# principal en el cajon inferior y el pie de poblacion en el hueco del icono.
# GOAL loop: docs/qa/goal-loop-motor-ppt-2026-08-03.md (P3).

.calibrar_para_test <- function(template) {
  path <- file.path("..", "..", "inst", "plantillas", template)
  doc <- officer::read_pptx(path)
  dims <- officer::slide_size(doc)
  info <- officer::layout_summary(doc)
  .ppt_calibrar_pies_iconos(
    .PPT_CONTRACT, doc,
    master = info$master[[1]],
    slide_dims = dims,
    layout_exists = function(nm) nm %in% info$layout
  )
}

test_that("en ACNUR el footer narrativo va al cajon inferior derecho, no al texto", {
  skip_if_not_installed("officer")
  contract <- .calibrar_para_test("plantilla_acnur_16_9.pptx")

  loc <- contract$slide_1_narrativo$slots$footer$loc
  expect_true(is.list(loc))
  expect_gt(loc$left, 7)      # cajon inferior derecho (8.17), no el narrativo (0.35)
  expect_gt(loc$top, 6)       # franja inferior, no la franja del texto (1.25)
})

test_that("en ACNUR el texto principal de grafico+texto queda en su panel lateral", {
  skip_if_not_installed("officer")
  contract <- .calibrar_para_test("plantilla_acnur_16_9.pptx")

  loc_r <- contract$text_r$slots$text$loc
  expect_gt(loc_r$left, 6)    # panel derecho (6.75), no el cajon inferior (0.35)
  expect_lt(loc_r$top, 2)
  expect_gt(loc_r$height, 3)

  loc_l <- contract$text_l$slots$text$loc
  expect_lt(loc_l$left, 1)    # panel izquierdo
  expect_gt(loc_l$height, 3)
})

test_that("en ACNUR el pie de poblacion_5 va al cajon inferior y el icono al cuadrado central", {
  skip_if_not_installed("officer")
  contract <- .calibrar_para_test("plantilla_acnur_16_9.pptx")

  pie <- contract$poblacion_5$slots$footer$loc
  expect_gt(pie$top, 6)       # franja inferior, no el hueco del icono (3.45)
  expect_lt(pie$left, 1)

  icono <- contract$poblacion_2$slots$icon$loc
  expect_gt(icono$left, 4)    # cuadrado central (5.78), no el panel izquierdo (0.39)
  expect_lt(icono$left, 8)
  expect_lt(abs(icono$width - icono$height), 0.7)
})

test_that("la plantilla generica conserva sus posiciones historicas", {
  skip_if_not_installed("officer")
  contract <- .calibrar_para_test("plantilla_16_9.pptx")

  expect_gt(contract$slide_1_narrativo$slots$footer$loc$left, 7)
  expect_gt(contract$text_r$slots$text$loc$left, 6)
  expect_lt(contract$text_l$slots$text$loc$left, 1)
  expect_gt(contract$slide_1$slots$right$loc$left, 8)
  expect_lt(contract$slide_1$slots$base$loc$left, 1)
  expect_false(isTRUE(contract$slide_1_narrativo$slots$footer$suppress))
})

test_that("sin cajon inferior utilizable el pie se suprime en vez de reubicarse", {
  skip_if_not_installed("officer")
  path <- file.path("..", "..", "inst", "plantillas", "plantilla_16_9.pptx")
  doc <- officer::read_pptx(path)
  dims <- officer::slide_size(doc)
  info <- officer::layout_summary(doc)

  contrato_falso <- list(
    slide_1_narrativo = list(
      layout = "Indice",  # layout sin cajones inferiores de texto
      slots = list(
        base   = list(type = "body", type_idx = 3, ph_label = "prosecnur:slide_1_narrativo:base"),
        footer = list(type = "body", type_idx = 4, ph_label = "prosecnur:slide_1_narrativo:footer")
      )
    )
  )
  out <- .ppt_calibrar_pies_iconos(
    contrato_falso, doc,
    master = info$master[[1]],
    slide_dims = dims,
    layout_exists = function(nm) nm %in% info$layout
  )
  expect_true(isTRUE(out$slide_1_narrativo$slots$footer$suppress))
})
