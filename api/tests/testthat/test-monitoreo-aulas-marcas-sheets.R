# =============================================================================
# La EXCEPCIÓN acotada: llevar «REFUERZO POR CONTACTAR» a la hoja del equipo
# =============================================================================
#
# Gonzalo, 2026-09-11: «¿pero no se puede hacer una excepción para esos casos?»,
# al saber que «Aulas Agendadas» es del equipo y la app la declara `respetada`.
#
# Se puede porque la regla de dueño protege LA HOJA —lo peligroso es reescribir
# el rectángulo encima de quien teclea—, y esto escribe UNA columna, SÓLO las
# filas que la app marcó, y SÓLO si la celda está libre. Estos tests son las
# cuatro garantías, una por una: si alguna se rompe, la excepción deja de serlo.

.mms_fila <- function(codigo, estado = "refuerzo_por_contactar") {
  list(operational_code = codigo, sample_status = estado)
}

.mms_hoja <- function(codigos, estados) {
  data.frame(`CURSO-HORARIO` = codigos, `STATUS MUESTRA` = estados,
             check.names = FALSE, stringsAsFactors = FALSE)
}

test_that("marca sólo la celda libre y respeta la que el equipo ya escribió", {
  plan <- list(.mms_fila("R 1.1"), .mms_fila("R 2.1"), .mms_fila("R 3.1"))
  hoja <- .mms_hoja(c("R 1.1", "R 2.1", "R 3.1"),
                    c("", "AGENDADA", "EN RESERVA"))
  out <- monitoreo_aulas_marcas_por_publicar(plan, hoja)
  expect_identical(vapply(out$escribibles, function(x) x$codigo, character(1)),
                   c("R 1.1", "R 3.1"))
  # La que el equipo ya resolvió no se pisa, y se dice QUÉ había: quien publica
  # necesita ver si esa aula ya se agendó por su cuenta.
  expect_identical(length(out$respetadas), 1L)
  expect_identical(out$respetadas[[1]]$codigo, "R 2.1")
  expect_identical(out$respetadas[[1]]$habia, "AGENDADA")
})

test_that("un estado remoto que no conocemos también se respeta", {
  # La lista de libres es corta a propósito: lo desconocido es trabajo de
  # alguien, no un hueco. Al revés —escribir salvo lo que reconozcamos— la app
  # ganaría carreras que no debe ganar.
  plan <- list(.mms_fila("R 1.1"))
  out <- monitoreo_aulas_marcas_por_publicar(plan, .mms_hoja("R 1.1", "POR CONFIRMAR CON COORDINACIÓN"))
  expect_identical(length(out$escribibles), 0L)
  expect_identical(out$respetadas[[1]]$habia, "POR CONFIRMAR CON COORDINACIÓN")
})

test_that("sólo entran las que la app marcó, nunca el resto del plan", {
  plan <- list(.mms_fila("R 1.1"), .mms_fila("CH 1", "agendada"),
               .mms_fila("R 9.9", "en_reserva"))
  out <- monitoreo_aulas_marcas_por_publicar(plan, .mms_hoja(c("R 1.1", "CH 1", "R 9.9"), c("", "", "")))
  expect_identical(length(out$escribibles), 1L)
  expect_identical(out$escribibles[[1]]$codigo, "R 1.1")
})

test_that("sin marcas no se escribe nada: una marca retirada no borra", {
  # Garantía 4: la app nunca vacía una celda. Si alguien retira la marca, lo que
  # el equipo haya puesto después se queda donde está.
  out <- monitoreo_aulas_marcas_por_publicar(list(.mms_fila("CH 1", "agendada")),
                                             .mms_hoja("CH 1", "REFUERZO POR CONTACTAR"))
  expect_identical(length(out$escribibles), 0L)
  expect_identical(length(out$respetadas), 0L)
})

test_that("sin hoja legible no se escribe: adivinar la fila es pisar la de otro", {
  plan <- list(.mms_fila("R 1.1"))
  expect_identical(length(monitoreo_aulas_marcas_por_publicar(plan, NULL)$escribibles), 0L)
  expect_identical(monitoreo_aulas_marcas_por_publicar(plan, NULL)$sin_fila, "R 1.1")
  # Y con una hoja a la que le falta la columna, igual.
  sin_col <- data.frame(`CURSO-HORARIO` = "R 1.1", check.names = FALSE)
  expect_identical(length(monitoreo_aulas_marcas_por_publicar(plan, sin_col)$escribibles), 0L)
})

test_that("una marcada que no está en la hoja se declara, no se inventa fila", {
  out <- monitoreo_aulas_marcas_por_publicar(list(.mms_fila("R 7.1")), .mms_hoja("CH 1", ""))
  expect_identical(out$sin_fila, "R 7.1")
  expect_identical(length(out$escribibles), 0L)
})

test_that("el resumen dice las tres cifras, y sólo las que existen", {
  plan <- list(.mms_fila("R 1.1"), .mms_fila("R 2.1"), .mms_fila("R 7.1"))
  out <- monitoreo_aulas_marcas_por_publicar(plan, .mms_hoja(c("R 1.1", "R 2.1"), c("", "RECHAZO")))
  txt <- monitoreo_aulas_marcas_texto(out)
  expect_true(grepl("1 celda por marcar", txt, fixed = TRUE))
  expect_true(grepl("1 que el equipo ya escribio", txt, fixed = TRUE))
  expect_true(grepl("1 sin fila en la hoja", txt, fixed = TRUE))
})
