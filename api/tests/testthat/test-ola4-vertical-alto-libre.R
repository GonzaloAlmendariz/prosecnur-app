# Ola 4, A7 (lámina «G. 2 vertical divergente con saldo»): la lámina de dos gráficos en vertical que va por los huecos de la
# plantilla (divergente o apilada de imagen) dejaba ~10 % de su alto en blanco abajo: cada gráfico lleva su «Base:» dentro y
# el pie queda vacío, pero los huecos terminaban donde empieza el pie. G1 (ola 2) sólo alcanzaba a la composición nativa.

test_that("A7: sin base en el pie, los dos huecos llegan hasta donde empezaría la base", {
  skip_if_not_installed("officer")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  ct <- .PPT_CONTRACT$graficos_2_vertical
  sin_base <- list(.slide_type = "graficos_2_vertical", slots = list(title = "G"))
  c2 <- .composicion_vertical_alto_libre(doc, ct, sin_base, "graficos_2_vertical")
  pie_y <- as.numeric(ct$slots$base$loc$top %||% ct$slots$base$loc[[2]])                # el contrato fija dónde va la base
  sup <- c2$slots$superior$loc; inf <- c2$slots$inferior$loc
  expect_false(is.null(sup)); expect_false(is.null(inf))
  expect_equal(inf$top + inf$height, pie_y, tolerance = 1e-6)            # llega al arranque de la base
  expect_gte(inf$top - (sup$top + sup$height), 0.2)                                      # la calle entre los dos se conserva
  expect_equal(sup$height, inf$height, tolerance = 1e-6)                                 # el alto ganado, por mitades
  # Con base en el pie, o en otra disposición, nada cambia.
  con_base <- list(.slide_type = "graficos_2_vertical", slots = list(title = "G", base = "Base: 115 docentes"))
  expect_identical(.composicion_vertical_alto_libre(doc, ct, con_base, "graficos_2_vertical"), ct)
  expect_identical(.composicion_vertical_alto_libre(doc, ct, sin_base, "graficos_3_fila"), ct)
})

test_that("A7: por la ruta real, la lámina G termina cerca del pie sin pisar el folio", {
  skip_if_not_installed("officer"); skip_if_not_installed("ggplot2")
  r <- .ola4_lamina_g()
  cj <- .ola2_cajas(r$pptx, 1L)
  base <- cj[grepl("^Base:", cj$texto), , drop = FALSE]
  abajo <- base[which.max(base$y1), ]
  expect_gt(abajo$y1, 6.85)                                                              # antes 6.67
  folio <- cj[grepl("^[0-9]+$", cj$texto) & cj$y0 > 6.9, , drop = FALSE]
  if (nrow(folio)) expect_true(abajo$x1 < min(folio$x0) || abajo$y1 <= min(folio$y0) - 0.02)
})
