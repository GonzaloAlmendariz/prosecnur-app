source("setup-load-all.R")

# El aviso «Pregunta de opcion multiple» salia en redonda y encima del titulo.
# Dos causas independientes, las dos silenciosas:
#
#   1. `graficar_barras_apiladas()` NO tenia el formal `face_subtitulo`, asi que
#      el `face` que le mandaba el motor se descartaba sin decir nada.
#   2. El aviso forzaba `encabezado_separacion_in = 0`, y esa es la distancia
#      ENTRE los dos textos: cero los dibuja en la misma coordenada.

test_that("el subtitulo de la apilada nace en italica, como en agrupadas", {
  # Es una acotacion sobre la pregunta, no un segundo titulo compitiendo con el
  # primero. Barras agrupadas ya lo tenia asi; apiladas no lo implementaba.
  expect_true("face_subtitulo" %in% names(formals(graficar_barras_apiladas)))
  expect_equal(eval(formals(graficar_barras_apiladas)$face_subtitulo), "italic")
  expect_equal(eval(formals(graficar_barras_agrupadas)$face_subtitulo), "italic")
})

test_that("el aviso de opcion multiple pide italica y alto para dos textos", {
  ov <- .ppt_multiple_choice_notice_overrides()
  expect_equal(ov$subtitulo, "Pregunta de opción múltiple")
  expect_equal(ov$face_subtitulo, "italic")
  # Ya no fuerza separacion cero: ese era el lever equivocado y superponia los
  # textos. El alto del encabezado tiene que alojar los dos.
  expect_null(ov$encabezado_separacion_in)
  expect_gt(ov$canvas_h_header_in, 0.34)
})

test_that("el aviso respeta lo que la lamina ya declaro", {
  # Un tamano declarado por el analista se conserva, acotado.
  ov <- .ppt_multiple_choice_notice_overrides(list(size_subtitulo = 8))
  expect_equal(ov$size_subtitulo, 8)
  # Y uno desmedido se acota, para que el aviso no compita con el titulo.
  expect_lte(.ppt_multiple_choice_notice_overrides(list(size_subtitulo = 40))$size_subtitulo, 10.5)
})
