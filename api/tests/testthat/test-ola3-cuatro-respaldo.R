# Ola 3, O1 (antes G3/G4/G6): la lámina de cuatro gráficos con una apilada con cruce que va de respaldo.
#   (a) la nota de diferencias va al pie de la lámina, sobre «Base:», y no dentro del panel;
#   (b) la fila de arriba (la escala con su leyenda) se lleva más alto que la de abajo (las categóricas) y el bloque usa el
#       alto libre bajo un título corto;
#   (c) el respaldo se dibuja con su cajón real.
# Fixture sintético (helper-ola2-laminas.R).

test_that("la nota de diferencias va al pie, una sola vez y sin repetir lo que dice la base", {
  skip_if_not_installed("officer")
  pth <- .ola2_lamina_i()
  cj <- .ola2_cajas(pth, 1)
  nota <- cj[grepl("se muestran como referencia", cj$texto, fixed = TRUE), , drop = FALSE]
  expect_equal(nrow(nota), 1L)
  expect_identical(nota$texto, "Los grupos con menos de 30 casos se muestran como referencia y no se comparan.")
  base <- cj[startsWith(cj$texto, "Base:"), , drop = FALSE]
  expect_equal(nrow(base), 1L)
  expect_lte(nota$y1, base$y0 + 1e-3)                                     # sobre «Base:»
  expect_false(grepl("Diferencias entre los grupos mostrados", nota$texto, fixed = TRUE))
  expect_false(any(grepl("trama", cj$texto, ignore.case = TRUE)))
  # Ningún otro texto de la lámina invade la caja de la nota.
  otros <- cj[!seq_len(nrow(cj)) %in% which(cj$texto == nota$texto) & !startsWith(cj$texto, "Base:"), , drop = FALSE]
  expect_true(all(otros$y1 <= nota$y0 - 0.02 | otros$y0 >= nota$y1 + 0.02 | otros$x1 <= nota$x0 | otros$x0 >= nota$x1))
})

test_that("la fila de la escala con su leyenda se lleva más alto que la de las categóricas y el bloque sube bajo el título", {
  skip_if_not_installed("officer")
  pth <- .ola2_lamina_i()
  f <- .ola2_formas(pth, 1)
  # Los filetes: el horizontal entre las dos filas queda por debajo de la mitad del bloque.
  sep <- f[!nzchar(f$texto) & abs((f$y1 - f$y0) - 0.008) < 0.002 & (f$x1 - f$x0) > 6, , drop = FALSE]
  expect_gte(nrow(sep), 1L)
  pq <- f[f$texto %in% c("El reglamento es pertinente", "El reglamento es claro", "Sexo", "¿Conoce el reglamento?"), , drop = FALSE]
  arriba <- min(pq$y0)
  expect_lt(arriba, .std_geom("zona_datos_y0") - 0.1)                    # usa el alto libre bajo el título de una línea
  medio <- (arriba + .std_geom("contenido_y1")) / 2
  expect_gt(sep$y0[1], medio)
})

test_that("el respaldo se vuelve a dibujar con el cajón que le da la lámina y sin su nota", {
  geo <- .lam_mixta_geo("paneles_4")
  cj <- .lam_respaldo_cajon_alto(geo$paneles[[1]], "El reglamento es pertinente", "64 respuestas", .lam_perfil_estilo())
  fin <- .lam_panel_titulo(.lam_lienzo(), geo$paneles[[1]]$x, geo$paneles[[1]]$y, geo$paneles[[1]]$w, "El reglamento es pertinente",
                           "64 respuestas", size = .std_comp("perfil", "titulo_pt"))
  expect_equal(cj$y, fin + 0.1, tolerance = 1e-9)
  expect_equal(cj$y + cj$h, geo$paneles[[1]]$y + geo$paneles[[1]]$h, tolerance = 1e-9)
  # El redibujador pide el alto y reserva la nota para la lámina.
  visto <- NULL
  el <- structure(list(.element_type = "barras_apiladas", overrides = list()), class = "ppt_element")
  red <- .lam_mixta_redibujador(list(el), function(e, ancho_slot, alto_slot) {
    visto <<- list(alto = e$overrides$alto, nota = e$overrides$nota_pie, en_lamina = getOption("prosecnur.sig_nota_en_lamina"),
                   ancho = ancho_slot, alto_slot = alto_slot)
    NULL
  })
  red(1L, 6, 2.2)
  expect_identical(visto$alto, 2.2); expect_identical(visto$alto_slot, 2.2); expect_identical(visto$ancho, 6)
  expect_identical(visto$nota, ""); expect_true(isTRUE(visto$en_lamina))
  expect_null(getOption("prosecnur.sig_nota_en_lamina"))                 # la opción no se filtra fuera del render
})

test_that("la nota sin lo que la base ya dice", {
  expect_identical(.lam_nota_sin_lo_de_la_base("Los grupos con menos de 30 casos se muestran como referencia y no se comparan. Diferencias entre los grupos mostrados.",
                                               "Base: 77. Excluye el grupo Derecho. Diferencias entre los grupos mostrados"),
                   "Los grupos con menos de 30 casos se muestran como referencia y no se comparan.")
  expect_identical(.lam_nota_sin_lo_de_la_base("Una nota.", NULL), "Una nota.")
})
