# Ola 4, A4 (B3 en la «G. 2 vertical divergente con saldo» y en la lámina 2 del mazo de familias): desde la ola 3 la
# divergente de imagen pinta con la escala del estándar y `verificar_mazo()` mide sus barras, que salían más gruesas que las
# de la apilada vecina (1.06 cm contra 0.61). La divergente se redibuja con el grosor de la apilada de su lámina.

test_that("A4: en la lámina de dos gráficos en vertical, la divergente mide la barra de la apilada", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_g()
  v <- verificar_mazo(r$pptx)
  expect_false("B3 grosores desiguales" %in% v$hallazgos$regla)
  formas <- .verif_formas(.verif_laminas_xml(r$pptx)[[1]])
  g <- vapply(.verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA)), function(x) x$grosor, 0)
  expect_length(g, 2L)
  expect_lt(diff(range(g)) * 2.54, 0.05)
})

test_that("A4: la opción de grosor objetivo no sale de la composición", {
  expect_null(getOption(.COMPOSICION_GROSOR_OPCION))
  rendered <- list(structure(list(), pulso_barras_apiladas_layout = list(grosor_in = 0.3)), structure(list(), class = "ggplot"))
  els <- list(list(.element_type = "barras_apiladas"), list(.element_type = "barras_divergentes"))
  visto <- NULL
  out <- .composicion_grosor_comun(rendered, els, c(6, 6), list(2, 2), function(el, a, h) {
    visto <<- getOption(.COMPOSICION_GROSOR_OPCION); structure(list(k = "redibujado"), class = "ggplot") })
  expect_identical(visto, 0.3)
  expect_identical(out[[2]]$k, "redibujado")
  expect_null(getOption(.COMPOSICION_GROSOR_OPCION))
  # Sin apilada con grosor, o sin divergente, nada se redibuja.
  expect_identical(.composicion_grosor_comun(rendered[2:1], els[c(1, 1)], c(6, 6), list(2, 2), function(...) stop("no")), rendered[2:1])
})
