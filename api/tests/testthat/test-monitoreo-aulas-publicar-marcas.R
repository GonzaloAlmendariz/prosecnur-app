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
  expect_length(enc$pares, 1L)
  expect_identical(enc$pares[[1]]$codigo, 1L)
  expect_identical(enc$pares[[1]]$estado, 3L)
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
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[1]])
  expect_identical(names(remoto), c("CURSO-HORARIO", "STATUS MUESTRA"))
  expect_identical(remoto[["STATUS MUESTRA"]], c("SIN CONTACTAR", "AGENDADA"))
})

test_that("una fila corta no revienta: la celda ausente es vacia", {
  valores <- list(
    list("CURSO-HORARIO", "DOCENTE", "STATUS MUESTRA"),
    list("R 1.1")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[1]])
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

test_that("empareja los bloques del libro, que es donde viven las reservas", {
  # Medido el 2026-09-11: de quince marcadas se pintaron nueve —los EXTRA, que
  # tienen fila propia— y las seis reservas de cadena salieron «sin fila en el
  # libro» teniendo su fila delante. Su codigo no esta en la primera columna
  # «CURSO-HORARIO» sino en la de su bloque, y su estado en la «STATUS MUESTRA»
  # de ESE bloque.
  valores <- list(
    list("CURSO-HORARIO", "STATUS MUESTRA", "CURSO-HORARIO", "STATUS MUESTRA"),
    list("CH 1", "AGENDADA", "R 1.1", "SIN CONTACTAR")
  )
  enc <- prosecnurapp:::.mapm_encabezado(valores)
  expect_length(enc$pares, 2L)
  expect_identical(enc$pares[[2]]$codigo, 3L)
  expect_identical(enc$pares[[2]]$estado, 4L)
  # La reserva se encuentra en su bloque y su celda esta libre.
  remoto <- prosecnurapp:::.mapm_remoto(valores, enc$fila, enc$pares[[2]])
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 1L)
  expect_identical(out$escribibles[[1]]$codigo, "R 1.1")
})

test_that("un bloque sin su pareja no participa", {
  # Tres «CURSO-HORARIO» y dos «STATUS MUESTRA»: el tercero se queda fuera en
  # vez de emparejarse con el estado de otro bloque.
  valores <- list(list("CURSO-HORARIO", "STATUS MUESTRA", "CURSO-HORARIO",
                       "STATUS MUESTRA", "CURSO-HORARIO"))
  expect_length(prosecnurapp:::.mapm_encabezado(valores)$pares, 2L)
})

test_that("el desplegable y el morado salen para cada columna tocada", {
  reqs <- prosecnurapp:::.mapm_requests_de_columna(123L, c(12L, 50L), 2L, 40L)
  expect_length(reqs, 4L)
  expect_true(!is.null(reqs[[1]]$setDataValidation))
  expect_true(!is.null(reqs[[2]]$addConditionalFormatRule))
  # La validacion trae el estado nuevo, que es lo que quita el triangulo rojo.
  valores <- vapply(reqs[[1]]$setDataValidation$rule$condition$values,
                    function(v) v$userEnteredValue, character(1))
  expect_true("REFUERZO POR CONTACTAR" %in% valores)
  # Y el color es el de la paleta, no uno tecleado aqui.
  cond <- reqs[[2]]$addConditionalFormatRule$rule$booleanRule$condition
  expect_identical(cond$values[[1]]$userEnteredValue, "REFUERZO POR CONTACTAR")
  expect_identical(reqs[[1]]$setDataValidation$range$startColumnIndex, 11L)
})

test_that("sin columnas tocadas no sale un solo request de formato", {
  expect_length(prosecnurapp:::.mapm_requests_de_columna(123L, integer(0), 2L, 40L), 0L)
  expect_length(prosecnurapp:::.mapm_requests_de_columna(NA_integer_, c(3L), 2L, 40L), 0L)
})

test_that("una marca ya puesta por la app cuenta para reemitir su formato", {
  # Sin esto, republicar no arreglaba nunca el color: la celda ya llevaba el
  # texto, salia «respetada», no habia datos que escribir y el desplegable y el
  # morado no se emitian. Visto en pantalla el 2026-09-11.
  remoto <- data.frame(
    `CURSO-HORARIO` = c("R 1.1"), `STATUS MUESTRA` = c("REFUERZO POR CONTACTAR"),
    check.names = FALSE, stringsAsFactors = FALSE)
  out <- monitoreo_aulas_marcas_por_publicar(list(.mapm_fila("R 1.1")), remoto)
  expect_length(out$escribibles, 0L)
  expect_identical(out$respetadas[[1]]$habia, "REFUERZO POR CONTACTAR")
})
