prop <- function() officer::fp_text(font.size = 12, color = "#081F5C")


test_that("un texto de una linea produce un solo run", {
  f <- .ppt_fpar_multilinea("Una sola linea", prop())
  expect_length(f$chunks, 1L)
})


test_that("cada linea trae su salto delante, y ninguno sobra", {
  # El caso real: texto y bullet se unen con `\n` en el constructor y salian
  # pegados —«correspondiente.• Los porcentajes»— porque un `\n` dentro de un
  # run no es un salto en OOXML.
  f <- .ppt_fpar_multilinea("Primera\n• Segunda", prop())
  # 2 textos + 1 salto entre ellos
  expect_length(f$chunks, 3L)
  clases <- vapply(f$chunks, function(x) class(x)[1], "")
  expect_equal(clases[[2]], "run_linebreak")
})


test_that("tres lineas llevan dos saltos, no tres", {
  # Un salto al final abriria una linea vacia en PowerPoint.
  f <- .ppt_fpar_multilinea("a\nb\nc", prop())
  clases <- vapply(f$chunks, function(x) class(x)[1], "")
  expect_equal(sum(clases == "run_linebreak"), 2L)
  expect_equal(clases[[length(clases)]], "ftext")
})


test_that("un texto vacio o nulo no revienta", {
  expect_length(.ppt_fpar_multilinea("", prop())$chunks, 1L)
  expect_length(.ppt_fpar_multilinea(NULL, prop())$chunks, 1L)
  expect_length(.ppt_fpar_multilinea(NA, prop())$chunks, 1L)
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
