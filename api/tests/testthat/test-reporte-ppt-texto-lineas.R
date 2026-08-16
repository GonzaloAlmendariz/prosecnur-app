prop <- function() officer::fp_text(font.size = 12, color = "#081F5C")


test_that("un texto de una linea sigue siendo un fpar", {
  f <- .ppt_fpar_multilinea("Una sola linea", prop())
  expect_s3_class(f, "fpar")
  expect_length(f$chunks, 1L)
})


test_that("cada linea es su propio parrafo", {
  # El caso real: texto y bullet se unen con `\n` en el constructor y salian
  # pegados —«correspondiente.• Los porcentajes»— porque un `\n` dentro de un
  # run no es un salto en OOXML. `run_linebreak()` tampoco vale: officer no le
  # da metodo para PowerPoint y aborta el placeholder.
  f <- .ppt_fpar_multilinea("Primera\n• Segunda", prop())
  expect_s3_class(f, "block_list")
  expect_length(f, 2L)
})


test_that("tres lineas dan tres parrafos, sin uno vacio al final", {
  f <- .ppt_fpar_multilinea("a\nb\nc", prop())
  # `block_list` es una lista PLANA de `fpar`, sin `$blocks`.
  expect_length(f, 3L)
  expect_equal(f[[3]]$chunks[[1]]$value, "c")
})


test_that("un texto vacio o nulo no revienta y sigue siendo un fpar", {
  for (x in list("", NULL, NA)) {
    f <- .ppt_fpar_multilinea(x, prop())
    expect_s3_class(f, "fpar")
  }
})


test_that("el contador de lineas ve lo que el parrafo va a dibujar", {
  expect_equal(.ppt_contar_lineas("a\nb\nc"), 3L)
  expect_equal(.ppt_contar_lineas("solo una"), 1L)
  expect_equal(.ppt_contar_lineas(""), 0L)
  expect_equal(.ppt_contar_lineas(NULL), 0L)
})


test_that("la alineacion es la que se pide", {
  f <- .ppt_fpar_multilinea("x", prop(), align = "left")
  expect_equal(f$fp_p$text.align, "left")
})
