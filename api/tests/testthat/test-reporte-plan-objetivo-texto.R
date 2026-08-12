source("setup-load-all.R")

# El párrafo del Objetivo salía GIRADO en PowerPoint. La causa no era la
# rotación del rótulo sino la herencia: `officer::ph_location()` por
# coordenadas emite `<p:ph/>` vacío, PowerPoint no lo resuelve y toma las
# propiedades de texto del ancestro que le toque — el título, que es vertical.
#
# LibreOffice resolvía ese mismo `<p:ph/>` a horizontal, así que la cadena de
# PDF que uso para el QA nunca lo enseñó: los PNG salían bien mientras el mazo
# entregado salía mal. Se vio exportando con PowerPoint de verdad.

test_that("el slot de texto del Objetivo declara su placeholder real", {
  spec <- .PPT_CONTRACT$objetivo_icono$slots$text
  expect_false(is.null(spec$ph_xml))
  expect_match(spec$ph_xml, '^<p:ph type="body" idx="[0-9]+"/>$')
})

test_that("los slots de imagen no lo declaran, y eso es deliberado", {
  # El control: si `ph_xml` estuviera en todos, el aserto de arriba no diría
  # nada sobre el texto. Una imagen no hereda propiedades de párrafo.
  expect_null(.PPT_CONTRACT$objetivo_icono$slots$icon$ph_xml)
  expect_null(.PPT_CONTRACT$poblacion_4$slots$up_left$ph_xml)
})

test_that("el renderer escribe el placeholder cuando el contrato lo declara", {
  src <- readLines(file.path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE)
  i <- grep("if (!is.null(spec$ph_xml)) loc$ph <- spec$ph_xml", src, fixed = TRUE)
  expect_length(i, 1L)
  # Y que está en la rama que de verdad escribe: la primera versión lo puso en
  # la otra y quedó como código muerto —el `.pptx` seguía saliendo con `<p:ph/>`
  # y sólo lo delató volver a inspeccionar el XML emitido.
  cola <- paste(src[i:(i + 2L)], collapse = "\n")
  expect_match(cola, "target_loc <- loc")
})

test_that("la disposición del Objetivo ya no gira el rótulo al revés", {
  tpl <- file.path("..", "..", "inst", "plantillas", "plantilla_16_9.pptx")
  skip_if(!file.exists(tpl), "plantilla no disponible")
  xml <- rawToChar(utils::unzip(tpl, "ppt/slideLayouts/slideLayout16.xml", exdir = tempdir()) |>
                     readBin(what = "raw", n = 1e6))
  expect_false(grepl("vert270", xml, fixed = TRUE))
  expect_true(grepl('vert="vert"', xml, fixed = TRUE))
})
