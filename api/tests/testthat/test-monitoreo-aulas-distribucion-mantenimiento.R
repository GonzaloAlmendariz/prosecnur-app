# **Los dos pasos del ciclo que se hacían fuera de la app.**
#
# Dictado de Gonzalo (2026-09-08): «Dejemos todo el proceso robusto para tapar
# el agujero». El agujero no era sólo que publicar pudiera borrar la hoja del
# coordinador —eso ya tiene su guarda—: era que añadir las aulas agendadas sin
# cita y refrescar el ESTADO se hacían con scripts, y el operativo dependía de
# que hubiera alguien con una consola abierta.
#
# Lo que se sujeta aquí es la regla que mantiene el ciclo estable: **una fila
# que ya existe no se vuelve a proponer; la app añade lo que falta y actualiza
# lo que puede demostrar.**

.madm_cab <- function() as.list(prosecnurapp:::.alpa_CABECERA)

.madm_fila <- function(quien, dia, fecha, oficina, sale, aplica, cod,
                       aula = "A101", fac = "Ciencias", curso = "Cálculo",
                       doc = "Docente Uno", estado = "POR APLICAR") {
  as.list(c(quien, dia, fecha, oficina, sale, aplica, cod, aula, fac, curso, doc, estado))
}

.madm_hoja <- function(...) c(list(.madm_cab()), list(...))

.madm_aula <- function(cod, fecha, hora, estado = "agendada", fac = "Ciencias") {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = "titular", sample_status = estado, faculty = fac,
       course_name = "Cálculo", teacher = "Docente Uno", scheduled_venue = "A101",
       scheduled_date = fecha, scheduled_time = hora,
       eligible_n = 40, expected_valid = 20)
}

# --- A2 · qué agendadas no tienen cita ---------------------------------------

test_that("una agendada sin fila se propone, y una que ya está no se vuelve a proponer", {
  hoja <- .madm_hoja(.madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45",
                                "10:00 a 10:30", "CH 1"))
  plan <- list(.madm_aula("CH 1", "2026-09-07", "10:00 am"),
               .madm_aula("CH 2", "2026-09-07", "12:00 pm"))
  out <- monitoreo_aulas_agendadas_sin_cita(plan, hoja)
  expect_length(out$faltantes, 1L)
  expect_identical(out$faltantes[[1]]$curso_horario, "CH 2")
  # El aplicador va EN BLANCO: quién va lo decide una persona en el desplegable.
  expect_identical(out$faltantes[[1]]$fila[[1]], "")
  # Y con las horas que el reparto usaría: recojo T−30, salida T−15.
  expect_identical(out$faltantes[[1]]$fila[[4]], "11:30")
  expect_identical(out$faltantes[[1]]$fila[[5]], "11:45")
  expect_identical(out$faltantes[[1]]$fila[[6]], "12:00 a 12:30")
  expect_identical(out$faltantes[[1]]$fila[[12]], "POR APLICAR")
})

test_that("lo que no entra se DICE: sin agendar y sin hora se declaran, no se callan", {
  hoja <- .madm_hoja()
  plan <- list(
    .madm_aula("CH 3", "2026-09-09", "10:00 am", estado = "sin_contactar"),
    .madm_aula("CH 4", "2026-09-09", "no es una hora"),
    .madm_aula("CH 5", "2026-09-09", "10:00 am", estado = "reagendada")
  )
  out <- monitoreo_aulas_agendadas_sin_cita(plan, hoja)
  # Una reagendada SÍ necesita que alguien vaya.
  expect_identical(vapply(out$faltantes, function(f) f$curso_horario, character(1)), "CH 5")
  motivos <- vapply(out$descartadas, function(d) d$motivo, character(1))
  codigos <- vapply(out$descartadas, function(d) d$curso_horario, character(1))
  expect_setequal(codigos, c("CH 3", "CH 4"))
  expect_identical(motivos[codigos == "CH 3"], "sin_agendar")
  expect_identical(motivos[codigos == "CH 4"], "sin_hora")
})

test_that("la ventana de fechas acota, y una hoja sin CURSO-HORARIO se declara ilegible", {
  hoja <- .madm_hoja()
  plan <- list(.madm_aula("CH 6", "2026-09-07", "10:00 am"),
               .madm_aula("CH 7", "2026-09-20", "10:00 am"))
  out <- monitoreo_aulas_agendadas_sin_cita(plan, hoja, desde = "2026-09-07", hasta = "2026-09-13")
  expect_identical(vapply(out$faltantes, function(f) f$curso_horario, character(1)), "CH 6")

  rota <- list(as.list(c("APLICADOR", "DÍA", "FECHA")))
  err <- tryCatch(monitoreo_aulas_agendadas_sin_cita(plan, rota), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_DISTRIBUCION_ILEGIBLE")
})

# --- A3 · dónde entra cada una -----------------------------------------------

test_that("la hora se compara en MINUTOS: una fila de 09:20 va DESPUÉS de una escrita «8:30»", {
  # La regresión de Gonzalo, 2026-09-08, con el Sheets delante: «la fila no se
  # puso en orden y hay que estar en oficina a las 9:20, ¿no debería ir después
  # de CH 161?». El equipo teclea las horas sin el cero de la izquierda y, como
  # TEXTO, «8:30» es MAYOR que «09:20» —compara «8» contra «0»—, así que la fila
  # nueva se colaba en el primer sitio donde el orden textual mentía.
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Miércoles", "09/09", "08:20", "08:35", "08:50 a 09:20", "CH 117"),
    .madm_fila("Dos", "Miércoles", "09/09", "8:30", "8:45", "9:00 a 9:30", "CH 74"),
    .madm_fila("Tres", "Miércoles", "09/09", "09:15", "09:30", "09:45 a 10:15", "CH 161"),
    .madm_fila("Cuatro", "Miércoles", "09/09", "10:00", "10:15", "10:30 a 11:00", "CH 121")
  )
  plan <- list(.madm_aula("CH 35", "2026-09-09", "09:50 am"))
  faltan <- monitoreo_aulas_agendadas_sin_cita(plan, hoja)
  pos <- monitoreo_aulas_posiciones_de_las_nuevas(hoja, faltan$faltantes)
  expect_length(pos, 1L)
  # Fila 5 de la hoja: justo después de CH 161 (fila 4) y antes de CH 121.
  expect_identical(pos[[1]]$posicion, 5L)
})

test_that("varias filas nuevas salen de abajo arriba, y un día que no existe va al final", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1"),
    .madm_fila("Dos", "Lunes", "07/09", "13:30", "13:45", "14:00 a 14:30", "CH 2")
  )
  plan <- list(.madm_aula("CH 3", "2026-09-07", "12:00 pm"),
               .madm_aula("CH 4", "2026-09-10", "09:00 am"))
  faltan <- monitoreo_aulas_agendadas_sin_cita(plan, hoja)
  pos <- monitoreo_aulas_posiciones_de_las_nuevas(hoja, faltan$faltantes)
  posiciones <- vapply(pos, function(x) x$posicion, integer(1))
  expect_true(all(diff(posiciones) < 0))
  # CH 3 entra entre las dos del lunes; CH 4 abre un día nuevo al final.
  esperado <- stats::setNames(posiciones, vapply(pos, function(x) x$curso_horario, character(1)))
  expect_identical(unname(esperado[["CH 3"]]), 3L)
  expect_identical(unname(esperado[["CH 4"]]), 4L)
})

# --- A4 · el ESTADO ----------------------------------------------------------

test_that("lo que la plataforma demuestra asciende una fila vacía, y una movida es APLICADA POR REAGENDACIÓN", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1", estado = ""),
    .madm_fila("Dos", "Miércoles", "09/09", "09:30", "09:45", "10:00 a 10:30", "CH 2", estado = "")
  )
  # CH 2 está en la hoja el 09/09 y la agenda dice 07/09: se movió.
  est <- monitoreo_aulas_estados_distribucion(
    hoja, aplicadas = c("CH 1", "CH 2"),
    fecha_agenda = c(`CH 1` = "2026-09-07", `CH 2` = "2026-09-07")
  )
  expect_identical(est$estados, c("APLICADA", "APLICADA POR REAGENDACIÓN"))
  expect_length(est$cambios, 2L)
})

test_that("lo que el equipo tecleó no se pisa, y una RECHAZADA con respuestas se declara sin tocarla", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1", estado = "RECHAZADA"),
    .madm_fila("Dos", "Lunes", "07/09", "11:30", "11:45", "12:00 a 12:30", "CH 2", estado = "REAGENDADA")
  )
  est <- monitoreo_aulas_estados_distribucion(
    hoja, aplicadas = "CH 1",
    fecha_agenda = c(`CH 1` = "2026-09-07", `CH 2` = "2026-09-07")
  )
  # La rechazada se queda RECHAZADA: un rechazo lo teclea quien habló con el
  # docente, y unas respuestas bajo ese código son más probablemente un parte
  # mal puesto —pasó con CH 111 y CH 113— que un rechazo que se aplicó solo.
  expect_identical(est$estados[[1]], "RECHAZADA")
  expect_length(est$conflictos, 1L)
  expect_identical(est$conflictos[[1]]$curso_horario, "CH 1")
  # Y la reagendada tecleada tampoco se degrada a POR APLICAR.
  expect_identical(est$estados[[2]], "REAGENDADA")
  expect_length(est$cambios, 0L)
})

# --- A5 · la acción única ----------------------------------------------------

.madm_mock_con_hoja <- function() {
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1", estado = "")
  ))
  mock
}

test_that("el ensayo no escribe NADA y describe lo que haría", {
  mock <- .madm_mock_con_hoja()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist",
    plan = list(.madm_aula("CH 1", "2026-09-07", "10:00 am"),
                .madm_aula("CH 2", "2026-09-07", "12:00 pm")),
    aplicadas = "CH 1", roster = "Ana Prueba"
  )
  expect_false(isTRUE(out$aplicado))
  expect_length(out$anadidas, 1L)
  expect_identical(out$hoja, "Semana 1")
  escrituras <- Filter(function(c) !identical(c$method, "GET"), mock$env$calls)
  expect_length(escrituras, 0L)
})

test_that("aplicar añade la fila en su sitio, deja el aplicador en blanco y escribe el ESTADO", {
  mock <- .madm_mock_con_hoja()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist",
    plan = list(.madm_aula("CH 1", "2026-09-07", "10:00 am"),
                .madm_aula("CH 2", "2026-09-07", "12:00 pm")),
    aplicadas = "CH 1", roster = "Ana Prueba", aplicar = TRUE
  )
  expect_true(isTRUE(out$aplicado))
  v <- mock$env$sheets[["Semana 1"]]$values
  expect_length(v, 3L)
  fila <- function(i) as.character(unlist(v[[i]], use.names = FALSE))
  expect_identical(fila(2)[[7]], "CH 1")
  expect_identical(fila(3)[[7]], "CH 2")
  # El aplicador de la nueva, en blanco.
  expect_identical(fila(3)[[1]], "")
  # Y el estado: la que consta aplicada asciende; la nueva nace POR APLICAR.
  expect_identical(fila(2)[[12]], "APLICADA")
  expect_identical(fila(3)[[12]], "POR APLICAR")
})

test_that("una hoja con dueño se lee y se respeta: ninguna fila existente cambia de aplicador", {
  mock <- .sheets_api_mock()
  # El coordinador reasignó CH 1 a otra persona: la app lo ADOPTA, no lo revierte.
  mock$seed("Semana 1", values = .madm_hoja(
    .madm_fila("Otro Aplicador", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1")
  ))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  out <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist", plan = list(.madm_aula("CH 1", "2026-09-07", "10:00 am")),
    roster = c("Ana Prueba", "Otro Aplicador"), aplicar = TRUE
  )
  expect_identical(out$fijaciones[["CH 1"]], aulas_nombre_aplicador("Otro Aplicador"))
  fila <- as.character(unlist(mock$env$sheets[["Semana 1"]]$values[[2]], use.names = FALSE))
  expect_identical(fila[[1]], "Otro Aplicador")
})

test_that("el recibo termina diciendo cuántas citas quedan sin aplicador", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE,
    anadidas = list(list(curso_horario = "CH 35")),
    estado = list(cambios = list(), conflictos = list()),
    sin_aplicador = list(list(curso_horario = "CH 35", fecha = "09/09"))
  ))
  expect_match(texto, "CH 35", fixed = TRUE)
  expect_match(texto, "sin aplicador", fixed = TRUE)
  # Un cero SE DICE: omitirlo deja sin saber si es que no hay o no se miró.
  vacio <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE, anadidas = list(),
    estado = list(cambios = list(), conflictos = list()), sin_aplicador = list()
  ))
  expect_match(vacio, "Todas las citas tienen aplicador", fixed = TRUE)
})
