# ADR 0092 (F2.5b) — la fila «Total» del bloque por actores (filas_pulso del
# recetario): primera, ponderada por la base válida de cada actor (tot_pond) y
# separada por un filete.

test_that("el Total pondera cada actor por su base", {
  d <- data.frame(actor = c("Docentes", "Estudiantes"), N = c(52, 172),
                  td = c(0, .06), d = c(.02, .18), a = c(.29, .34), ta = c(.54, .19), si = c(.15, .23))
  out <- .apiladas_fila_total(d, "actor", NULL, "N", c("td", "d", "a", "ta", "si"))
  expect_identical(out$actor, c("Total", "Docentes", "Estudiantes"))
  expect_equal(out$N[1], 224)
  expect_equal(out$a[1], (.29 * 52 + .34 * 172) / 224)
  expect_equal(sum(unlist(out[1, c("td", "d", "a", "ta", "si")])), 1)
})

test_that("con una sola fila o sin base no se inventa un Total", {
  d1 <- data.frame(actor = "A", N = 10, x = .5, y = .5)
  expect_identical(.apiladas_fila_total(d1, "actor", NULL, "N", c("x", "y")), d1)
  d0 <- data.frame(actor = c("A", "B"), N = c(NA, 0), x = c(.5, .4), y = c(.5, .6))
  expect_identical(.apiladas_fila_total(d0, "actor", NULL, "N", c("x", "y")), d0)
})

test_that("en el gráfico el Total va primero y sus columnas usan el ponderado", {
  skip_if_not_installed("cowplot")
  m <- rbind(c(0, 2, 29, 54, 15), c(6, 18, 34, 19, 23)) / 100
  d <- data.frame(categoria = c("Docentes", "Estudiantes"), N = c(52L, 172L),
                  t1 = m[, 1], t2 = m[, 2], t3 = m[, 3], t4 = m[, 4], t5 = m[, 5])
  p <- suppressMessages(suppressWarnings(graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", 1:5),
    etiquetas_grupos = c(t1 = "TD", t2 = "D", t3 = "A", t4 = "TA", t5 = "SI"), exportar = "rplot",
    usar_canvas = TRUE, ancho = 12.5, alto = 4.6, mostrar_barra_extra = TRUE, barra_extra_preset = "top2box",
    top2box_labels = c("A", "TA"), columna_bottom2box = TRUE, bottom2box_labels = c("TD", "D"), fila_total = TRUE)))
  lay <- attr(p, "pulso_barras_apiladas_layout")
  expect_equal(lay$n_categorias, 3L)
  expect_equal(unname(lay$bottom2box), c("19%", "2%", "24%"))
})
