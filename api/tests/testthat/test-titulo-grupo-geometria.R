# P46, tercer intento. Los dos anteriores estimaban el alto del enunciado como
# `n_cat × alto_fila` y los dos solaparon: el texto se dibuja centrado en
# `mean(y_min, y_max)`, que son los CENTROS de la primera y la última categoría,
# no sus bordes. Aquí el alto sale de los centros reales.
#
# El invariante que lo hace seguro: **los altos reparten el área útil sin
# solaparse** — cada bloque toma la mitad de la distancia a cada vecino, así que
# dos contiguos se encuentran justo en el punto medio y la suma de todos es
# exactamente el área.

test_that("los altos reparten el área útil, ni más ni menos", {
  # EL INVARIANTE. Si la suma pasara del área, dos bloques se estarían pisando.
  alto <- 5
  for (cs in list(c(0.3, 0.5, 0.7), c(0.25, 0.8), c(0.5),
                  c(0.22, 0.35, 0.60, 0.88), c(0.3, 0.31, 0.9))) {
    r <- .barras_alto_disponible_real(cs, alto, borde_inf = 0.2, borde_sup = 0.9)
    expect_equal(sum(r), (0.9 - 0.2) * alto)
  }
})


test_that("cada bloque llega justo hasta el punto medio con su vecino", {
  cs <- c(0.3, 0.8)
  r <- .barras_alto_disponible_real(cs, 5, borde_inf = 0.2, borde_sup = 0.9)
  # El primero: de 0.2 al medio (0.55) = 0.35 npc = 1.75 in. El segundo, del
  # medio a 0.9 = 0.35 → 1.75. Se tocan y no se pisan.
  expect_equal(r, c(1.75, 1.75))
})


test_that("el orden de entrada se respeta aunque los centros vengan revueltos", {
  # `group_df` viene ordenado por `.group_id`, no por posición.
  cs <- c(0.7, 0.3, 0.5)
  r <- .barras_alto_disponible_real(cs, 5, borde_inf = 0.2, borde_sup = 0.9)
  orden <- .barras_alto_disponible_real(sort(cs), 5, borde_inf = 0.2, borde_sup = 0.9)
  expect_equal(r, orden[c(3, 1, 2)])
})


test_that("un bloque solo se queda con toda el área", {
  expect_equal(.barras_alto_disponible_real(0.5, 5, 0.2, 0.9), 3.5)
})


test_that("sin geometría no inventa un alto", {
  expect_true(all(is.na(.barras_alto_disponible_real(c(0.3, NA), 5))))
  expect_true(all(is.na(.barras_alto_disponible_real(0.5, 0))))
  expect_true(all(is.na(.barras_alto_disponible_real(numeric(0), 5))))
})


test_that("lo autorizado cabe, al cuerpo devuelto", {
  wf <- function(x, pt) max(1, floor(30 * 14 / pt))
  texto <- paste(rep("palabra", 24), collapse = " ")
  for (alto in seq(0.4, 2.4, by = 0.2)) {
    r <- .titulo_grupo_ajuste(texto, alto, wf, 14, minimo_pt = 9)
    ocupa <- r$cupos[1] * (r$size_pt / 72) * .BARRAS_INTERLINEA_TITULO
    # El margen no es cero: `.BARRAS_TOL_LINEA = 0.05` redondea hacia arriba
    # cuando falta menos del 5 % de una línea, y existe por una razón medida.
    margen <- .BARRAS_TOL_LINEA * (r$size_pt / 72) * .BARRAS_INTERLINEA_TITULO
    expect_true(ocupa <= alto + margen + 1e-9)
  }
})


test_that("manda el bloque que peor lo tiene y el cuerpo es uno por lámina", {
  wf <- function(x, pt) max(1, floor(30 * 14 / pt))
  textos <- c("corto", paste(rep("palabra", 24), collapse = " "), "otro")
  r <- .titulo_grupo_ajuste(textos, c(2.0, 0.70, 2.0), wf, 14, minimo_pt = 9)
  expect_length(r$size_pt, 1L)
  expect_length(r$cupos, 3L)
  expect_lt(r$size_pt, 14)
})


test_that("sin medición devuelve el declarado y ningún cupo", {
  expect_equal(.titulo_grupo_ajuste("x", 1, function(x, pt) NA_real_, 14)$size_pt, 14)
  expect_null(.titulo_grupo_ajuste("x", 1, function(x, pt) NA_real_, 14)$cupos)
})


test_that("el graficador usa la geometría real y las dos salidas", {
  # Un helper correcto sobre una entrada estimada fue exactamente el fallo de
  # los dos intentos anteriores: hay que ver que el alto venga de los centros.
  ruta <- testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  expect_true(grepl(".centros_blq <- (group_df$y_min + group_df$y_max) / 2",
                    src, fixed = TRUE))
  expect_true(grepl(".alto_disp <- .barras_alto_disponible_real(", src, fixed = TRUE))
  expect_true(grepl("size_titulos_grupo <- .ajuste_tit$size_pt", src, fixed = TRUE))
  expect_true(grepl("cupo_forzado = .ajuste_tit$cupos[i]", src, fixed = TRUE))
})
