source("setup-load-all.R")

# Geometria adaptativa del indice (.indice_fit_layout): H16/H17 del GOAL loop
# del motor PPT (docs/qa/goal-loop-motor-ppt-2026-08-03.md, P6).

.subdf <- function(n) {
  if (n == 0L) return(data.frame(seccion = character(0), item = character(0)))
  data.frame(seccion = rep("S", n), item = paste("Item", seq_len(n)), stringsAsFactors = FALSE)
}

test_that("un titulo corto conserva la geometria historica", {
  fit <- .indice_fit_layout(list(), "INDICE", c("A", "B", "C"), .subdf(0))
  expect_equal(fit$title_height, 0.62)
  expect_equal(fit$table_top, 2.14)
  expect_equal(fit$row_height, 0.55)
  expect_equal(fit$style$subtopic_badge_width, 0.26)
})

test_that("un titulo que envuelve corre la tabla hacia abajo (H17)", {
  titulo <- toupper("Titulo largo que envuelve en dos lineas completas")
  fit <- .indice_fit_layout(list(), titulo, c("A", "B", "C"), .subdf(0))
  expect_gt(fit$title_height, 0.62)
  expect_gt(fit$table_top, 2.14)
  expect_equal(fit$table_top - 2.14, fit$title_height - 0.62)
})

test_that("con 10 secciones y subtemas el bloque se comprime al presupuesto (H16)", {
  fit <- .indice_fit_layout(list(), "K2", paste("Seccion", 1:10), .subdf(6))
  requerido <- 10 * fit$row_height +
    ceiling(6 / 2) * fit$style$subtopic_row_height + 0.5
  expect_lte(requerido, 7.05 - fit$table_top + 1e-6)
  expect_lt(fit$row_height, 0.34)            # comprimido bajo el minimo historico
  expect_lt(fit$style$subtopic_row_height, 0.76)
  expect_gte(fit$row_height, 0.26)           # pero nunca bajo el piso
})

test_that("el badge de subtema crece con la numeracion de dos digitos (H16)", {
  fit <- .indice_fit_layout(list(), "K2", paste("Seccion", 1:10), .subdf(6))
  expect_gt(fit$style$subtopic_badge_width, 0.26)   # "10.6" ya no se parte
  corto <- .indice_fit_layout(list(), "K", c("A", "B"), .subdf(2))
  expect_equal(corto$style$subtopic_badge_width, 0.26)
})

test_that("los overrides explicitos del analista se respetan sin desborde", {
  style <- list(table_top = 3.0, row_height = 0.5, subtopic_badge_width = 0.4)
  fit <- .indice_fit_layout(style, "X", c("A", "B", "C"), .subdf(0))
  expect_equal(fit$table_top, 3.0)
  expect_equal(fit$row_height, 0.5)
  expect_equal(fit$style$subtopic_badge_width, 0.4)
})
