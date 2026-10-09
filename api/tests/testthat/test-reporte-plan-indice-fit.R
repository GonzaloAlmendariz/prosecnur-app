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

# H73 (docs/qa/checklist-motor-ppt-diagnostico-2026-10-06.md): con los 13 estandares de acreditacion la letra seguia en
# 16 pt sobre una tabla de 5.22 in; cuatro titulos largos se partian en dos lineas, esas filas crecian al alto del
# texto y la ultima entrada quedaba en el borde inferior de la lamina (7.49 de 7.5 in en el render).
.estandares13 <- c("Perfil del encuestado", "Caracteristicas institucionales", "Desarrollo de politicas institucionales",
  "Estructura organizacional, administrativa y financiera", "Cuerpo academico", "Estudiantes y graduados",
  "Infraestructura, instalaciones y recursos de apoyo", "Caracteristicas del perfil de egreso", "Estructura curricular",
  "Vinculacion con el medio y desarrollo sostenible", "Internacionalizacion integral", "Investigacion, desarrollo e innovacion (I+D+i)",
  "Integridad y transparencia")
.ancho_texto <- function(fit, txt) nchar(txt) * 0.52 * fit$style$section_size / 72   # ancho estimado en Arial negrita

test_that("con 13 estandares cada titulo cabe en una linea de la tabla (H73)", {
  fit <- .indice_fit_layout(list(), "INDICE", .estandares13, .subdf(0))
  disponible <- fit$table_width - fit$style$number_width - 0.22   # menos el relleno de la celda
  expect_lte(max(.ancho_texto(fit, .estandares13)), disponible)
  expect_gte(fit$style$section_size, 11)                          # nunca bajo el piso legible
  expect_lte(fit$style$number_size, fit$style$section_size)
  expect_lte(fit$table_top + length(.estandares13) * fit$row_height, 7.05 + 1e-6)
})

test_that("con 5 secciones cortas la letra no cambia (H73)", {
  fit <- .indice_fit_layout(list(), "INDICE", .estandares13[c(1, 2, 5, 6, 9)], .subdf(0))
  expect_equal(fit$style$section_size, 16)
  expect_equal(fit$style$number_size, 16)
})

test_that("con 8 secciones la letra no baja: partir un titulo en dos lineas cabe (H73)", {
  fit <- .indice_fit_layout(list(), "INDICE", .estandares13[1:8], .subdf(0))
  expect_equal(fit$style$section_size, 16)
})
