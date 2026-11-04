source("setup-load-all.R")

# `residuales_gris` es una decisión explícita: gana sobre la paleta de la lista en la lámina nativa (CCSS 2026-11-04:
# con paleta por lista, «Otros» salía del color de su opción aunque el mando pidiera gris).

espec_con <- function(residuales_gris) list(
  rotulos = c("Voluntariado", "Otros", "Ninguna"),
  colores = c(Voluntariado = "#1F4E8C", Otros = "#5B8FD1", Ninguna = "#2E6BB0"),
  residuales_gris = residuales_gris)

test_that("con residuales_gris las residuales van en gris aunque haya paleta", {
  cols <- .espec_colores_de(espec_con(TRUE))
  gris <- .graficos_no_sustantivo_color()
  expect_identical(cols[2:3], c(gris, gris))
  expect_identical(cols[1], "#1F4E8C")
})

test_that("sin residuales_gris la paleta manda en todas las opciones", {
  expect_identical(.espec_colores_de(espec_con(FALSE)), c("#1F4E8C", "#5B8FD1", "#2E6BB0"))
})

test_that("sin paleta no inventa colores (la lámina decide el azul por defecto)", {
  e <- espec_con(TRUE); e$colores <- NULL
  expect_null(.espec_colores_de(e))
  expect_null(.espec_residuales_en_gris(e, e$rotulos, NULL))
})

test_that("las barras y la piruleta nativas miran residuales_gris antes que la paleta", {
  src_b <- paste(readLines(test_path("..", "..", "R", "lamina_categorica.R"), warn = FALSE), collapse = "\n")
  src_l <- paste(readLines(test_path("..", "..", "R", "lamina_lollipop.R"), warn = FALSE), collapse = "\n")
  expect_match(src_b, 'residuales_gris"]]) && grepl(.CATEGORIAS_RESIDUALES, et[k]', fixed = TRUE)
  pos_res <- regexpr('residuales_gris"]]) && grepl(.CATEGORIAS_RESIDUALES, lab[i]', src_l, fixed = TRUE)
  pos_pal <- regexpr("if (!is.null(cols_u)) cols_u[i] else azul", src_l, fixed = TRUE)
  expect_true(pos_res > 0 && pos_pal > 0 && pos_res < pos_pal)
})
