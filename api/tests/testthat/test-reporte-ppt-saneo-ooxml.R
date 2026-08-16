test_that("las fuentes se reordenan al orden del esquema", {
  # Lo que emite officer: latin, cs, ea, sym. El esquema exige latin, ea, cs.
  interior <- paste0(
    '<a:solidFill><a:srgbClr val="CA5651"/></a:solidFill>',
    '<a:latin typeface="Arial"/><a:cs typeface="Arial"/>',
    '<a:ea typeface="Arial"/><a:sym typeface="Arial"/>'
  )
  out <- .ooxml_ordenar_fuentes(interior)
  expect_lt(regexpr("<a:ea", out, fixed = TRUE), regexpr("<a:cs", out, fixed = TRUE))
  expect_lt(regexpr("<a:latin", out, fixed = TRUE), regexpr("<a:ea", out, fixed = TRUE))
  expect_lt(regexpr("<a:cs", out, fixed = TRUE), regexpr("<a:sym", out, fixed = TRUE))
  # El relleno no se toca ni se pierde.
  expect_true(grepl('<a:srgbClr val="CA5651"/>', out, fixed = TRUE))
})


test_that("lo que ya esta en orden no se toca", {
  ok <- '<a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/>'
  expect_identical(.ooxml_ordenar_fuentes(ok), ok)
})


test_that("un solo tipo de letra no se altera", {
  uno <- '<a:solidFill/><a:latin typeface="Arial"/>'
  expect_identical(.ooxml_ordenar_fuentes(uno), uno)
  expect_identical(.ooxml_ordenar_fuentes(""), "")
})


test_that("el saneo respeta los atributos de cada elemento", {
  # Reordenar no puede intercambiar los typeface: `cs` y `ea` pueden declarar
  # tipografias distintas y cruzarlas cambiaria el render.
  interior <- '<a:latin typeface="Arial"/><a:cs typeface="Courier"/><a:ea typeface="Meiryo"/>'
  out <- .ooxml_ordenar_fuentes(interior)
  expect_true(grepl('<a:ea typeface="Meiryo"/>', out, fixed = TRUE))
  expect_true(grepl('<a:cs typeface="Courier"/>', out, fixed = TRUE))
  expect_lt(regexpr("Meiryo", out, fixed = TRUE), regexpr("Courier", out, fixed = TRUE))
})


test_that("el saneo alcanza a rPr, defRPr y endParaRPr", {
  for (tag in c("a:rPr", "a:defRPr", "a:endParaRPr")) {
    xml <- sprintf(
      '<a:p><%s lang="es"><a:latin typeface="Arial"/><a:cs typeface="Arial"/><a:ea typeface="Arial"/></%s></a:p>',
      tag, tag
    )
    out <- .ooxml_sanear_texto(xml)
    expect_lt(regexpr("<a:ea", out, fixed = TRUE), regexpr("<a:cs", out, fixed = TRUE),
              label = tag)
    # La apertura con sus atributos sobrevive.
    expect_true(grepl(sprintf('<%s lang="es">', tag), out, fixed = TRUE))
  }
})


test_that("varios bloques en la misma parte se sanean todos", {
  uno <- '<a:rPr><a:latin typeface="A"/><a:cs typeface="A"/><a:ea typeface="A"/></a:rPr>'
  xml <- paste0("<root>", uno, uno, uno, "</root>")
  out <- .ooxml_sanear_texto(xml)
  # Ni un solo bloque queda con cs antes de ea.
  bloques <- regmatches(out, gregexpr("<a:rPr>.*?</a:rPr>", out))[[1]]
  expect_length(bloques, 3L)
  for (b in bloques) {
    expect_lt(regexpr("<a:ea", b, fixed = TRUE), regexpr("<a:cs", b, fixed = TRUE))
  }
})


test_that("el contador ve cero en un pptx sano y no revienta si no existe", {
  expect_true(is.na(ppt_contar_fuentes_desordenadas(tempfile(fileext = ".pptx"))))
  aprobado <- "/Users/gonzaloalmendariz/Documents/Pulso/ACRD CONTA/Informe Contabilidad 14-08.pptx"
  skip_if(!file.exists(aprobado), "el entregable aprobado no esta disponible")
  expect_equal(ppt_contar_fuentes_desordenadas(aprobado), 0L)
})


test_that("sanear un archivo inexistente no rompe", {
  expect_false(ppt_sanear_ooxml(tempfile(fileext = ".pptx")))
  expect_false(ppt_sanear_ooxml(NULL))
})


test_that("sanear conserva el orden de las entradas del paquete", {
  # PowerPoint espera `[Content_Types].xml` al principio. Con las entradas
  # reordenadas alfabeticamente el archivo era XML valido y zip integro, y
  # PowerPoint no lo abria EN ABSOLUTO — peor que el defecto que se reparaba.
  skip_if_not_installed("zip")
  origen <- file.path(tempdir(), "orden_test.pptx")
  d <- file.path(tempdir(), "orden_src"); unlink(d, recursive = TRUE)
  dir.create(file.path(d, "ppt", "slides"), recursive = TRUE)
  writeLines('<Types/>', file.path(d, "[Content_Types].xml"))
  writeLines(
    '<a:p xmlns:a="x"><a:rPr><a:latin typeface="A"/><a:cs typeface="A"/><a:ea typeface="A"/></a:rPr></a:p>',
    file.path(d, "ppt", "slides", "slide1.xml")
  )
  wd <- getwd(); setwd(d)
  zip::zip(origen, c("[Content_Types].xml", "ppt/slides/slide1.xml"),
           include_directories = FALSE)
  setwd(wd)

  antes <- utils::unzip(origen, list = TRUE)$Name
  expect_true(ppt_sanear_ooxml(origen))
  despues <- utils::unzip(origen, list = TRUE)$Name

  expect_identical(despues[[1]], antes[[1]])
  expect_setequal(despues, antes)
  expect_equal(ppt_contar_fuentes_desordenadas(origen), 0L)
})


test_that("se quitan los tipos de contenido de extensiones ausentes", {
  ct <- paste0(
    '<Types>',
    '<Default Extension="png" ContentType="image/png"/>',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Default Extension="jpg" ContentType="application/octet-stream"/>',
    '<Default Extension="pdf" ContentType="application/pdf"/>',
    '</Types>'
  )
  out <- .ooxml_limpiar_content_types(ct, c("png", "rels", "xml"))
  expect_true(grepl('Extension="png"', out, fixed = TRUE))
  # `rels` y `xml` son obligatorias aunque no figuren como extension de parte.
  expect_true(grepl('Extension="rels"', out, fixed = TRUE))
  expect_true(grepl('Extension="xml"', out, fixed = TRUE))
  expect_false(grepl('Extension="jpg"', out, fixed = TRUE))
  expect_false(grepl('Extension="pdf"', out, fixed = TRUE))
})


test_that("un Default que SI se usa nunca se quita", {
  # Un mazo con iconos SVG necesita su Default: quitarlo romperia el paquete
  # de verdad, que es peor que el ruido que se esta limpiando.
  ct <- paste0('<Types><Default Extension="svg" ContentType="image/svg+xml"/>',
               '<Default Extension="png" ContentType="image/png"/></Types>')
  out <- .ooxml_limpiar_content_types(ct, c("png", "svg"))
  expect_identical(out, ct)
})


test_that("sin nada que quitar el texto no se altera", {
  ct <- '<Types><Default Extension="png" ContentType="image/png"/></Types>'
  expect_identical(.ooxml_limpiar_content_types(ct, "png"), ct)
  expect_identical(.ooxml_limpiar_content_types(ct, character(0)), ct)
})
