# CCSS-24 y CCSS-2 (mazo CCSS Perfil 2026, grilla de seis `p_slide_6_graficos_poblacion`, celdas de 3.91 x 2.2 y 1.75 in).
#
# CCSS-24: una categórica de cuatro opciones no cabía como barras del recetario (fila de 0.26 in contra el piso de 0.30,
# o «Hasta secundaria completa» en dos líneas de 11 pt) y el panel caía a su ggplot de columnas, que en 1.17 in de alto
# útil dejaba columnas de 3 px. Ahora la celda chica prueba barras horizontales nativas compactas antes de caer.
#
# CCSS-2: el histograma de un panel no nombraba su público («397 respuestas») como los demás: su espec trae `conteos` y
# `.espec_n_base` no los leía.

.w5_cat <- function(rot, v, n) preparar_categorica(rot, v, sprintf("%d%%", round(100 * v)), n = n, residuales_al_final = FALSE)

test_that("CCSS-24: una categórica de cuatro opciones cabe como barras nativas en las celdas de la grilla de seis", {
  madre <- .w5_cat(c("Hasta secundaria completa", "Superior técnica", "Universitaria", "Posgrado"),
                   c(.24, .21, .39, .17), c(90, 80, 147, 61))
  nivel <- .w5_cat(c("VI", "VII", "VIII", "IX"), c(.30, .30, .24, .16), c(119, 119, 95, 64))
  secu <- .w5_cat(c("En Lima Metropolitana", "En otra región del Perú", "En Callao", "En otra provincia de Lima"),
                  c(.66, .27, .05, .02), c(262, 107, 20, 8))
  P <- .lam_poblacion_geo("p_slide_6_graficos_poblacion")$paneles
  for (caso in list(list(madre, P[[1]], "Madre", "378 respuestas"), list(nivel, P[[4]], "Nivel", "397 respuestas"),
                    list(secu, P[[6]], "Secundaria", "397 respuestas"))) {
    p <- caso[[2]]
    g <- .lam_panel_geo(caso[[1]], p$x, p$y, p$w, p$h, pregunta = caso[[3]], publico = caso[[4]])
    expect_identical(g$tipo, "barras", info = caso[[3]])
    expect_true(isTRUE(g$cabe), info = caso[[3]])
    # Alto real: la barra mide al menos 0.15 in (12 px a 80 dpi; antes, 3 px) y las filas caben en el panel.
    expect_gte(g$g, 0.15)
    expect_lte(g$y0 + g$fila * 4, p$y + p$h + 1e-6)
    # Los rótulos caben en su fila con el cuerpo elegido.
    altos <- .lam_alto_tinta(caso[[1]]$rotulos, g$wlab, g$size, .std_negrita_forzada("categorias"))
    expect_true(all(altos - 0.1 <= g$fila - 0.02), info = caso[[3]])
  }
})

test_that("CCSS-24: un panel grande (fuera de la grilla chica) no cambia de geometría", {
  e <- .w5_cat(c("A", "B", "C"), c(.5, .3, .2), c(50, 30, 20))
  g <- .lam_panel_geo(e, 0.5, 1.65, 6.01, 4.2, pregunta = "P", publico = "100 respuestas")
  expect_identical(g$tipo, "barras"); expect_true(g$cabe)
  expect_null(g$compacta)
})

test_that("CCSS-2: el histograma de un panel nombra a su público como los demás paneles", {
  e <- list(version = "histograma/1", tipo = "histograma", rotulos = as.character(18:22), valores = c(10, 30, 40, 15, 5),
            cifras = c("10%", "30%", "40%", "15%", "5%"), conteos = c(40, 119, 159, 60, 19), mediana = 20)
  expect_equal(.espec_n_base(e), 397)
  enc <- .lam_mixta_encabezados(list(e), list(list(var = "edad", overrides = list(titulo = "Edad"))))
  expect_identical(enc$publicos[[1]], "397 respuestas")
})

test_that("CCSS-24: acotado a la grilla de seis; la de cinco (Arte, lámina 2) conserva su respaldo", {
  cat5 <- .w5_cat(c("Contratado", "Jefe de Práctica", "Auxiliar", "Asociado", "Principal"), c(.42, .29, .17, .11, .02),
                  c(48, 33, 20, 13, 2))
  P5 <- .lam_poblacion_geo("p_slide_5_graficos_poblacion")$paneles
  for (p in P5) {
    g <- .lam_panel_geo(cat5, p$x, p$y, p$w, p$h, pregunta = "¿Cuál es su categoría académica?")
    expect_null(g$compacta)
  }
})
