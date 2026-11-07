# P4: la lista de encuestadores respeta los códigos PXXX que trae el Excel.
# El caso real: un Excel con P101–P104 se guardaba como P320, P270, P229, P220.

.tlc_excel <- function(filas) {
  skip_if_not_installed("openxlsx")
  path <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(filas, path)
  path
}

.tlc_filas <- function(codigos) data.frame(
  `AP PATERNO` = c("Ruiz", "Paz", "Soto", "Vega"),
  `AP MATERNO` = c("Lima", "Rojas", "Cano", "Mora"),
  NOMBRES = c("Ana", "Luis", "Rosa", "Hugo"),
  DNI = c("40000001", "40000002", "40000003", "40000004"),
  `CODIGO PULSO` = codigos,
  check.names = FALSE, stringsAsFactors = FALSE
)

.tlc_codigos <- function(r) vapply(r$assignments, `[[`, "", "codigo_pulso")

test_that("los códigos PXXX del Excel se respetan tal cual", {
  path <- .tlc_excel(.tlc_filas(c("P101", "P102", "P103", "P104")))
  r <- monitoreo_territorial_enumerator_roster_desde_excel(path)
  expect_identical(.tlc_codigos(r), c("P101", "P102", "P103", "P104"))
  expect_identical(r$recibo_codigos$del_excel, 4L)
  expect_length(r$recibo_codigos$no_respetados, 0L)
})

test_that("el código del Excel gana al que la persona tenía antes, y el resto no choca", {
  previo <- monitoreo_territorial_enumerator_roster_desde_excel(.tlc_excel(.tlc_filas(c("", "", "", ""))))
  # Ana tenía un código sorteado; el Excel nuevo le pone P102. Luis no trae código.
  path <- .tlc_excel(.tlc_filas(c("P102", "", "P103", "103")))
  r <- monitoreo_territorial_enumerator_roster_desde_excel(path, previous = previo)
  cod <- .tlc_codigos(r)
  expect_identical(cod[[1]], "P102")
  # «103» es P103 una vez limpio: el código se repite en el Excel y no se sabe de
  # quién es, así que ninguna de las dos filas lo recibe.
  expect_false(cod[[3]] == "P103")
  expect_false(cod[[4]] %in% c("P102", "P103"))
  expect_false(anyDuplicated(cod) > 0)
  # Luis conserva el código que ya tenía (no venía en el Excel y no choca).
  luis_antes <- .tlc_codigos(previo)[[2]]
  if (!luis_antes %in% c("P102", "P103")) expect_identical(cod[[2]], luis_antes)
  motivos <- vapply(r$recibo_codigos$no_respetados, `[[`, "", "motivo")
  expect_identical(sum(motivos == "se repite en el Excel"), 2L)
})

test_that("un código inválido se dice y la persona recibe uno válido", {
  path <- .tlc_excel(.tlc_filas(c("P101", "ABC", "P103", "P104")))
  r <- monitoreo_territorial_enumerator_roster_desde_excel(path)
  expect_true(grepl("^P[0-9]{3}$", .tlc_codigos(r)[[2]]))
  expect_identical(r$recibo_codigos$no_respetados[[1]]$motivo, "no es un código PXXX válido")
})
