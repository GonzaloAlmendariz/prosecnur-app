# El transporte de la excepcion acotada. No toca la red: se le da el encabezado
# y los valores crudos, y se comprueba QUE rangos saldrian.

.mapm_plan <- function(...) list(...)
.mapm_fila <- function(codigo, estado = "refuerzo_por_contactar") {
  list(operational_code = codigo, sample_status = estado)
}

test_that("encuentra el encabezado aunque no este en la fila 1", {
  valores <- list(
    list("AGENDA DEL OPERATIVO", "", ""),
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1", "X", "SIN CONTACTAR")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  expect_identical(enc$fila, 2L)
  expect_identical(enc$col_codigo, 1L)
  expect_identical(enc$col_estado, 3L)
})

test_that("sin las dos columnas la hoja no participa", {
  expect_null(prosecnurapp:::.mapm_encabezado(list(list("A", "B"), list("1", "2"))))
  expect_null(prosecnurapp:::.mapm_encabezado(list()))
})

test_that("la letra de columna sale de donde esta el encabezado, no de una fija", {
  expect_identical(prosecnurapp:::.mapm_letra(1L), "A")
  expect_identical(prosecnurapp:::.mapm_letra(26L), "Z")
  expect_identical(prosecnurapp:::.mapm_letra(27L), "AA")
  expect_identical(prosecnurapp:::.mapm_letra(38L), "AL")
})

test_that("el remoto sale con los dos rotulos que espera el motor", {
  valores <- list(
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1", "X", "SIN CONTACTAR"),
    list("R 1.2", "Y", "AGENDADA")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc)
  expect_identical(names(remoto), c("CURSO-HORARIO", "STATUS MUESTRA"))
  expect_identical(remoto[["STATUS MUESTRA"]], c("SIN CONTACTAR", "AGENDADA"))
})

test_that("una fila corta no revienta: la celda ausente es vacia", {
  valores <- list(
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc)
  expect_identical(remoto[["STATUS MUESTRA"]], "")
  # Y una celda vacia es LIBRE: se puede marcar.
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 1L)
})

test_that("sin nada marcado no sale un solo request", {
  expect_error(
    monitoreo_aulas_publicar_marcas("abc", list(.mapm_fila("R 1.1", "sin_contactar"))),
    "ningun curso-horario marcado"
  )
})

test_that("sin id no se intenta escribir", {
  expect_error(monitoreo_aulas_publicar_marcas("", list(.mapm_fila("R 1.1"))),
               "identificador")
})

test_that("el texto dice las tres cifras y distingue ensayo de escritura", {
  hecho <- list(escritas = list(1, 2), respetadas = list(1),
                sin_fila = c("R 9.9"), aplicado = TRUE)
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "^Se pintaron 2 celdas")
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "1 se respeto")
  expect_match(monitoreo_aulas_publicar_marcas_texto(hecho), "1 sin fila")
  ensayo <- utils::modifyList(hecho, list(aplicado = FALSE))
  expect_match(monitoreo_aulas_publicar_marcas_texto(ensayo), "^Se pintarian")
})
