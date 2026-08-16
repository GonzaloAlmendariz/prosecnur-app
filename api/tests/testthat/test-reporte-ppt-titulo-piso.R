test_that("el titulo que ya cumple el piso no se toca", {
  # NULL significa «via normal del placeholder», no «misma caja»: si esto
  # devolviera geometria, cada lamina conforme pasaria a emitirse por
  # coordenadas sin necesidad.
  expect_null(.ppt_titulo_geom_con_piso(0.5, 0.50, 10.5, 0.73, piso_in = 0.37))
  expect_null(.ppt_titulo_geom_con_piso(0.5, 0.37, 10.5, 0.73, piso_in = 0.37))
})


test_that("el titulo pegado al borde baja al piso y cede el alto que baja", {
  # Geometria real del layout 'Title and Content' de plantilla_16_9.
  g <- .ppt_titulo_geom_con_piso(0.5046632, 0.2254899, 10.527944, 0.7289972,
                                 piso_in = 0.37)
  expect_false(is.null(g))
  expect_equal(g$top, 0.37)
  expect_equal(g$left, 0.5046632)
  expect_equal(g$width, 10.527944)

  # El borde inferior no puede bajar: si baja, invade el cuerpo.
  expect_equal(g$top + g$height, 0.2254899 + 0.7289972, tolerance = 1e-9)
})


test_that("el piso se respeta aunque el recorte deje la caja bajo el minimo", {
  g <- .ppt_titulo_geom_con_piso(0.5, 0.05, 10, 0.22, piso_in = 0.37)
  expect_equal(g$top, 0.37)
  expect_equal(g$height, 0.2)
})


test_that("una geometria no finita no produce una caja invalida", {
  expect_null(.ppt_titulo_geom_con_piso(0.5, NA_real_, 10, 0.7))
  expect_null(.ppt_titulo_geom_con_piso(0.5, 0.2, 10, NULL))
  expect_null(.ppt_titulo_geom_con_piso("a", 0.2, 10, 0.7))
})


test_that("la fila del placeholder se busca por etiqueta y cae al tipo", {
  props <- data.frame(
    ph_label = c("Google Shape;83;p50", "Google Shape;81;p50", "Marcador 2"),
    type = c("body", "title", "body"),
    offx = c(11.03, 0.5046632, 0.5046632),
    offy = c(0.1736942, 0.2254899, 1.4673917),
    cx = c(2.108297, 10.527944, 12.421874),
    cy = c(0.9252373, 0.7289972, 2.7944783),
    stringsAsFactors = FALSE
  )

  f <- .ppt_titulo_fila_layout(props, list(ph_label = "Google Shape;81;p50"))
  expect_equal(f$type, "title")

  # Sin etiqueta util cae al tipo, no a la primera fila del layout —que aqui
  # es un `body` y daria una caja equivocada.
  f2 <- .ppt_titulo_fila_layout(props, list(ph_label = "", type = "title"))
  expect_equal(f2$type, "title")
  expect_equal(f2$offy, 0.2254899)

  expect_null(.ppt_titulo_fila_layout(props, list(ph_label = "", type = "pic")))
  expect_null(.ppt_titulo_fila_layout(NULL, list(type = "title")))
})


test_that("el layout de texto de la plantilla queda sobre la vara R7", {
  # La cifra que motivo L33: 0.2254899 in son 0.573 cm y R7 exige >= 0.78.
  skip_if_not_installed("officer")
  plantilla <- system.file("plantillas", "plantilla_16_9.pptx",
                           package = "prosecnurapp")
  skip_if(!nzchar(plantilla) || !file.exists(plantilla))

  doc <- officer::read_pptx(plantilla)
  spec <- .PPT_CONTRACT$text_slide$slots$title
  loc <- .ppt_titulo_loc_con_piso(doc, .PPT_CONTRACT$text_slide$layout, spec)

  expect_false(is.null(loc))
  expect_gte(unclass(loc)$top * 2.54, 0.78)
})
