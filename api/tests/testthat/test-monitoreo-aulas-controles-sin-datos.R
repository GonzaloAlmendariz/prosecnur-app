# Un control verde tiene que haber comprobado algo.
#
# «Verde por conformidad, no por ausencia» es la regla del Contrato de
# Superficie, y la lista de validacion la incumplia en tres de sus doce
# controles a la vez. La forma es siempre la misma: **la comprobabilidad se
# decide por «hay filas» y no por «hay algo que enfrentar»**, y como los
# comparadores devuelven «no discrepan» cuando falta un lado, cero hallazgos se
# publica como coincidencia.
#
# Los tres, medidos el 2026-08-30 sobre el estudio de 152 partes y 1.424 filas
# de plan:
#
#  - `field_report_reconciliation` decia «Los numeros de cada parte de campo
#    cuadran» con 0 de 152 partes comprobados (el motor leia `observed_students`
#    y el libro escribe `asistentes`).
#  - `book_sheets_cross_check` decia «Las 152 aulas que estan en las dos hojas
#    dicen lo mismo» con los tres campos cruzados ausentes en las dos hojas.
#  - `unknown_sample_status` daba «ok» sin plan que mirar.

# `validation` es una LISTA de listas con `check`/`status`/`detail`, no un
# data.frame: leerla como columnas devuelve vacio y todo aserto falla igual.
.mcs_uno <- function(d, check) {
  for (v in d$validation) if (identical(v$check, check)) return(v)
  NULL
}
.mcs_estado <- function(d, check) as.character(.mcs_uno(d, check)$status %||% "")
.mcs_detalle <- function(d, check) as.character(.mcs_uno(d, check)$detail %||% "")
.mcs_plan <- function(n = 2) lapply(seq_len(n), function(i) list(
  operational_code = sprintf("CH %d", i), classroom_id = sprintf("a%d", i),
  faculty = "DERECHO", sample_role = "titular", expected_valid = 10,
  eligible_n = 30, sample_status = "agendada", operational_status = "aplicada"
))

test_that("partes sin identidad que comprobar no se declaran cuadrados", {
  # Los partes existen y no traen ni asistentes ni efectivas: no hay resta que
  # hacer, y decir que cuadran afirma una comprobacion que no ocurrio.
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list(
    partes_campo = list(
      list(operational_code = "CH 1", aplicador = "APL-1"),
      list(operational_code = "CH 2", aplicador = "APL-2")
    )
  ))
  expect_identical(.mcs_estado(d, "field_report_reconciliation"), "sin_datos")
  expect_match(.mcs_detalle(d, "field_report_reconciliation"), "no hay identidad que comprobar")
  expect_false(grepl("cuadran", .mcs_detalle(d, "field_report_reconciliation"), fixed = TRUE))
})

test_that("con partes comprobables y sin descuadres si se declara el cuadre", {
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list(
    partes_campo = list(
      list(operational_code = "CH 1", asistentes = 10, validas = 10),
      list(operational_code = "CH 2", observed_students = 8, effective_surveys = 8)
    )
  ))
  expect_identical(.mcs_estado(d, "field_report_reconciliation"), "ok")
  # Y dice sobre cuantos lo afirma, que es lo que faltaba para poder creerselo.
  expect_match(.mcs_detalle(d, "field_report_reconciliation"), "2 partes de campo comprobables")
})

test_that("codigos en las dos hojas sin campos comunes no son un cruce", {
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list(
    partes_campo = list(list(operational_code = "CH 1", asistentes = 10, validas = 10)),
    # La Base de control de sexo: comparte el codigo y ningun campo cruzado.
    control = list(list(operational_code = "CH 1", sexo = "F", n = 12))
  ))
  expect_identical(.mcs_estado(d, "book_sheets_cross_check"), "sin_datos")
  expect_match(.mcs_detalle(d, "book_sheets_cross_check"), "no hay valores que enfrentar")
})

test_that("sin plan no se emite lista de controles, asi que no hay verde que dar", {
  # **Medido antes de escribir el aserto, y cambio lo que este test afirma.**
  # `unknown_sample_status` daba «ok» con `estados_raros$total == 0L` sin mirar
  # si habia plan, que es la misma forma de los otros dos. Pero con plan vacio
  # el dashboard no emite NINGUN control, asi que ese verde no llegaba nunca a
  # pantalla: la guarda que ahora exige plan es defensa, no la reparacion de un
  # defecto observado. Se deja escrito para que nadie la cuente como hallazgo.
  d <- monitoreo_aulas_dashboard(list(), data.frame(), list())
  expect_length(d$validation, 0L)
})

test_that("con plan y estados reconocidos el control si es ok", {
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list())
  expect_identical(.mcs_estado(d, "unknown_sample_status"), "ok")
})

# --- Los avisos concuerdan con su cifra ---------------------------------------
#
# El barrido de plurales, como el de tildes y el de vocabulario, se habia hecho
# solo sobre el frontend. En el motor quedaban 19 candidatos; estos tres son los
# que valen 1 con mas frecuencia, y los tres son avisos que se leen enteros
# cuando saltan.

test_that("una sola columna sin nombre no dice «1 columnas»", {
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list(control_sin_nombre = 1L))
  expect_match(.mcs_detalle(d, "unnamed_control_columns"), "^1 columna de la Base")
})

test_that("con varias mantiene el plural", {
  d <- monitoreo_aulas_dashboard(.mcs_plan(), data.frame(), list(control_sin_nombre = 7L))
  expect_match(.mcs_detalle(d, "unnamed_control_columns"), "^7 columnas de la Base")
})
