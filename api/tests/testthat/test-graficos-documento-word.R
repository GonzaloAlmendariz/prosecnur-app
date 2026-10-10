source("setup-load-all.R")

# F6.0b.4: el Word del recetario recibe las opciones del documento que manda el editor (dirección F6 §8.4).

.dw <- function(x) jsonlite::fromJSON(x, simplifyVector = FALSE)

test_that("las opciones válidas pasan en la forma que espera .word_documento y lo vacío no viaja", {
  o <- .graficos_opciones_documento(.dw('{"portada":"C","apertura":"A","como_leer":false,"redondeo":"resto_mayor",
    "titulo_corto":" Servicio educativo ","fuente":"Encuesta 2026","contacto":{"correo":"pulso@pucp.edu.pe","web":""},
    "meta_portada":{"para":"Facultad de Ciencias Contables","version":"Informe final"}}'))
  expect_identical(o$portada, "C"); expect_identical(o$apertura, "A"); expect_false(o$como_leer)
  expect_identical(o$redondeo, "resto_mayor"); expect_identical(o$titulo_corto, "Servicio educativo")
  expect_identical(o$contacto, list(correo = "pulso@pucp.edu.pe"))
  expect_identical(o$meta_portada, list(para = "Facultad de Ciencias Contables", version = "Informe final"))
  expect_identical(o$fuente, "Encuesta 2026")
  expect_null(.graficos_opciones_documento(.dw('{"como_leer":"auto"}'))$como_leer)    # auto = lo decide el informe
  expect_identical(.graficos_opciones_documento(NULL), list())
})

test_that("un valor fuera de lo admitido es un error 400 con código, no un default silencioso", {
  e <- tryCatch(.graficos_opciones_documento(list(portada = "D")), error = function(e) e)
  expect_identical(e$code %||% attr(e, "code") %||% e$body$code, "E_BAD_DOCUMENTO_WORD")
  expect_error(.graficos_opciones_documento(list(como_leer = "siempre")))
})

test_that("la config guarda documento_word como campo propio, no en _unknown", {
  cfg <- .graficos_normalize_config(list(documento_word = list(portada = "B")))
  expect_identical(cfg$documento_word$portada, "B")
  expect_false("documento_word" %in% names(cfg$`_unknown` %||% list()))
})

test_that("el worker de Word acepta las opciones y un worker sin ellas sigue funcionando (argumento opcional)", {
  f <- formals(graficos_job_worker_word)
  expect_true("opciones_documento" %in% names(f))
  expect_identical(eval(f$opciones_documento), list())
})
