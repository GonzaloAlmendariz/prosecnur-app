# Los bordes se miden sobre el XML de la lamina y no sobre la estructura del
# flextable: ahi la primera fila del cuerpo conserva un `black` interno que
# `fix_border_issues` resuelve al serializar y que nunca llega al mazo —el
# barrido del entregable no encontro ni un borde negro—. Medir la estructura
# haria fallar al test por un valor que el PPT no tiene.
.rejilla_del_xml <- function(estilo) {
  ft <- .tabla_nativa_flextable(
    data.frame(Tema = c("a", "b"), Docentes = c("1", "2")),
    estilo = estilo
  )
  doc <- officer::read_pptx()
  doc <- officer::add_slide(doc, "Title and Content", "Office Theme")
  doc <- officer::ph_with(doc, ft, location = officer::ph_location_type("body"))
  destino <- tempfile(fileext = ".pptx")
  print(doc, target = destino)

  xml <- paste(readLines(
    unzip(destino, "ppt/slides/slide1.xml", exdir = tempfile()),
    warn = FALSE
  ), collapse = "")
  bloques <- regmatches(
    xml,
    gregexpr("<a:ln[LRTB]\\b.*?</a:ln[LRTB]>", xml)
  )[[1]]
  colores <- regmatches(bloques, regexpr('val="[0-9A-Fa-f]{6}"', bloques))
  toupper(unique(sub('^val="([0-9A-Fa-f]{6})"$', "\\1", colores)))
}


test_that("la rejilla de una tabla nativa sale en el gris del aprobado", {
  # Medido sobre `Informe Contabilidad 14-08.pptx`: sus tres tablas —ficha
  # tecnica 6x2 y los dos perfiles de egreso 7x4 y 6x4— declaran los cuatro
  # lados de cada celda en `757070` a 0.75 pt, 48 bordes. El motor los pintaba
  # en `BFBFBF`, cuatro tonos mas claro, que sobre el relleno `F2F2F2` del
  # cuerpo apenas se distingue. El grosor ya coincidia.
  expect_equal(.rejilla_del_xml(list()), "757070")
})


test_that("un estilo con `grid_col` propio sigue mandando", {
  # El indice usa este mismo constructor con separadores `F2F2F2` gruesos: el
  # default no puede pisarselos.
  expect_equal(.rejilla_del_xml(list(grid_col = "#F2F2F2")), "F2F2F2")
})


test_that("la ficha tecnica usa la misma rejilla que el resto", {
  # Hay DOS constructores de tabla nativa: `.tabla_nativa_flextable()` para las
  # del plan y el bloque `technical_table` de `reporte_plan_ppt.R` para ficha
  # tecnica y escala. Cambiar solo uno dejaba 48 bordes en el gris claro sobre
  # la lamina 4 mientras las otras 200 ya iban en `757070`.
  f <- readLines(
    testthat::test_path("..", "..", "R", "reporte_plan_ppt.R"),
    warn = FALSE
  )
  linea <- grep('"border_color"', f, fixed = TRUE, value = TRUE)
  expect_length(linea, 1L)
  expect_true(grepl("#757070", linea, fixed = TRUE))
})
