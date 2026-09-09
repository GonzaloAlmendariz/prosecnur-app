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

# --- la ventana por defecto, que no puede ser «todo» -------------------------
#
# Medido sobre el operativo el 2026-09-08: el reparto rige del 07 al 12 de
# septiembre y aplaza a propósito lo agendado más allá. Preguntar sin acotar
# devolvía 28 aulas de las semanas 2 a 4 como si fueran huecos; con el rango del
# propio reparto la respuesta es 0, que es la verdad de ese día. Sin esta
# defensa, una llamada sin fechas proponía añadirle esas 28 filas a la hoja del
# coordinador.

test_that("la ventana de un reparto sale de su propio rango, y sin rango no inventa una", {
  ventana <- prosecnurapp:::.madm_ventana_del_reparto
  expect_identical(ventana(list(rango = list(desde = "2026-09-07", hasta = "2026-09-12"))),
                   list(desde = "2026-09-07", hasta = "2026-09-12"))
  expect_identical(ventana(list()), list(desde = "", hasta = ""))
  expect_identical(ventana(NULL), list(desde = "", hasta = ""))
})

test_that("acotar por la ventana deja fuera lo que el reparto aplaza a propósito", {
  hoja <- .madm_hoja()
  plan <- list(
    .madm_aula("CH 1", "2026-09-09", "10:00 am"),   # dentro de la semana
    .madm_aula("CH 2", "2026-09-21", "10:00 am")    # semana 3: aplazada, no es hueco
  )
  sin <- monitoreo_aulas_agendadas_sin_cita(plan, hoja)
  con <- monitoreo_aulas_agendadas_sin_cita(plan, hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(sin$faltantes, 2L)
  expect_length(con$faltantes, 1L)
  expect_identical(con$faltantes[[1]]$curso_horario, "CH 1")
  # Y la ventana que rigió viaja en el recibo: quien lea el resultado tiene que
  # poder saber sobre qué se contestó.
  expect_identical(con$ventana$desde, "2026-09-07")
  expect_identical(con$ventana$hasta, "2026-09-12")
})

test_that("el tablero publica cuántas agendadas no tienen cita, acotado al rango", {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "a1", sample_role = "titular",
         sample_status = "agendada", faculty = "Ciencias", course_name = "Cálculo",
         teacher = "Docente Uno", scheduled_venue = "A101",
         scheduled_date = "2026-09-07", scheduled_time = "10:00 am",
         eligible_n = 40, expected_valid = 20),
    # Agendada dentro de la semana a una hora que nadie cubre: es un hueco de
    # verdad y tiene que salir contado.
    list(operational_code = "CH 9", classroom_id = "a9", sample_role = "titular",
         sample_status = "agendada", faculty = "Ciencias", course_name = "Física",
         teacher = "Docente Dos", scheduled_venue = "A109",
         scheduled_date = "2026-09-07", scheduled_time = "11:00 pm",
         eligible_n = 40, expected_valid = 20)
  )
  disp <- list(list(nombre = "Ana Prueba",
                    dias = list(lunes = list(list(inicio = "08:00", fin = "13:00")))))
  d <- prosecnurapp:::.mac_publicar_disponibilidad(
    list(), plan, disp, rango = list(desde = "2026-09-07", hasta = "2026-09-12"))
  dist <- d$reparto$distribucion
  expect_true(is.numeric(dist$agendadas_sin_cita))
  expect_identical(dist$agendadas_sin_cita, 1L)
  # Y las nombra: un «falta 1» sin el código obliga a volver a cruzarlo a mano.
  expect_length(dist$sin_cita, 1L)
  expect_identical(dist$sin_cita[[1]]$curso_horario, "CH 9")
  expect_identical(dist$sin_cita[[1]]$fecha, "07/09")
  # La huella y las citas de siempre siguen ahí: el bloque gana un campo, no
  # cambia de forma.
  expect_true(nzchar(dist$huella))
  expect_gte(dist$citas, 1L)
})

# --- las filas que YA están y no cuadran --------------------------------------
#
# El motor revisaba lo que falta y lo que se puede demostrar, y no miraba lo que
# ya está escrito. Dos defectos vivían en la hoja del operativo desde el 08/09
# sin que nadie los viera: CH 74 con la fecha tecleada «9:09» en vez de «09/09»,
# y CH 12 conservando su fila del lunes después de reagendarse al 14/09.

test_that("una fecha que no parsea se DICE, y no se toca", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Miércoles", "9:09", "08:30", "08:45", "09:00 a 09:30", "CH 74"),
    .madm_fila("Dos", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1")
  )
  d <- monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(d, 1L)
  expect_identical(d[[1]]$curso_horario, "CH 74")
  expect_identical(d[[1]]$motivo, "fecha_ilegible")
  # Dice el valor tal como está escrito: sin él hay que ir a buscarlo a la hoja.
  expect_identical(d[[1]]$valor, "9:09")
  # Y la fila, para poder ir a ella.
  expect_identical(d[[1]]$fila, 2L)
})

test_that("una fila que se fue de semana y dejó la vieja también se dice", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1"),
    .madm_fila("Dos", "Lunes", "14/09", "09:30", "09:45", "10:00 a 10:30", "CH 12")
  )
  d <- monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(d, 1L)
  expect_identical(d[[1]]$curso_horario, "CH 12")
  expect_identical(d[[1]]$motivo, "fuera_de_la_semana")
})

test_that("sin ventana no se inventa un rango: sólo se revisa lo que no depende de él", {
  hoja <- .madm_hoja(
    .madm_fila("Uno", "Lunes", "14/09", "09:30", "09:45", "10:00 a 10:30", "CH 12"),
    .madm_fila("Dos", "Miércoles", "9:09", "08:30", "08:45", "09:00 a 09:30", "CH 74")
  )
  d <- monitoreo_aulas_filas_dudosas(hoja)
  motivos <- vapply(d, function(x) x$motivo, character(1))
  # La del 14/09 no se puede juzgar sin saber qué semana rige: callar es lo
  # correcto, porque acusarla sería inventarse el rango.
  expect_false("fuera_de_la_semana" %in% motivos)
  expect_true("fecha_ilegible" %in% motivos)
})

test_that("una fila con contenido y sin curso-horario es invisible para todo lo demás", {
  hoja <- .madm_hoja(
    .madm_fila("Alguien", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "")
  )
  d <- monitoreo_aulas_filas_dudosas(hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(d, 1L)
  expect_identical(d[[1]]$motivo, "sin_curso_horario")
  # Y una fila del todo vacía NO es dudosa: es una fila vacía.
  limpia <- monitoreo_aulas_filas_dudosas(
    c(.madm_hoja(), list(as.list(rep("", length(prosecnurapp:::.alpa_CABECERA))))),
    desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(limpia, 0L)
})

test_that("el recibo las nombra aunque no se toquen", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = TRUE, anadidas = list(),
    estado = list(cambios = list(), conflictos = list()),
    dudosas = list(list(curso_horario = "CH 74", motivo = "fecha_ilegible"),
                   list(curso_horario = "CH 12", motivo = "fuera_de_la_semana")),
    sin_aplicador = list()
  ))
  expect_match(texto, "CH 74: fecha_ilegible", fixed = TRUE)
  expect_match(texto, "CH 12: fuera_de_la_semana", fixed = TRUE)
  expect_match(texto, "se dejaron como están", fixed = TRUE)
})

# --- A2b · qué citas escritas ya no tienen agenda -----------------------------
#
# La pregunta inversa, y la cara cara: `agendadas_sin_cita` deja un aula sin
# nadie; ésta manda a alguien al campus por un aula que se movió. Salió de
# cruzar las DOS hojas en vivo el 2026-09-09: CH 12 seguía citado el 07/09 con
# la agenda ya en el 14/09, y CH 74 igual con la suya en el 09/09. No las veía
# nadie porque `filas_dudosas` mira la hoja SOLA y esas fechas caen dentro de su
# semana.

test_that("una cita cuya aula se movió de día se dice, con la fecha nueva", {
  hoja <- .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 12"),
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1")
  )
  plan <- list(
    .madm_aula("CH 12", "2026-09-14", "10:00", estado = "reagendada"),
    .madm_aula("CH 1", "2026-09-07", "10:00")
  )
  out <- monitoreo_aulas_citas_sin_agenda(plan, hoja, desde = "2026-09-07",
                                          hasta = "2026-09-12")
  expect_length(out, 1L)
  expect_equal(out[[1]]$curso_horario, "CH 12")
  expect_equal(out[[1]]$motivo, "aula_movida")
  # El detalle trae A DÓNDE se movió: sin eso hay que ir a buscarlo al libro.
  expect_equal(out[[1]]$detalle, "2026-09-14")
  # Y la fila, para poder mirarla en la hoja. La 1 es la cabecera.
  expect_equal(out[[1]]$fila, 2L)
})

test_that("una cita cuya aula dejó de estar agendada se dice con su status", {
  hoja <- .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 3")
  )
  # El vocabulario del plan dice «rechazo», no «rechazada»: escribir el segundo
  # degrada a `sin_contactar` sin avisar (`monitoreo_aulas_estado_muestra()`).
  plan <- list(.madm_aula("CH 3", "2026-09-07", "10:00", estado = "rechazo"))
  out <- monitoreo_aulas_citas_sin_agenda(plan, hoja, desde = "2026-09-07",
                                          hasta = "2026-09-12")
  expect_length(out, 1L)
  expect_equal(out[[1]]$motivo, "ya_no_agendada")
  expect_equal(out[[1]]$detalle, "rechazo")
})

test_that("un curso-horario que el plan no conoce se dice, no se calla", {
  hoja <- .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 999")
  )
  out <- monitoreo_aulas_citas_sin_agenda(list(.madm_aula("CH 1", "2026-09-07", "10:00")),
                                          hoja, desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(out, 1L)
  expect_equal(out[[1]]$motivo, "sin_plan")
})

test_that("lo APLICADO no es huérfano: su fila prueba que alguien fue", {
  # Es el mutante que importa, y hay que reconocerlo por DOS sitios porque el
  # plan no guarda si se aplicó: su `sample_status` sólo llega hasta
  # `reagendada`. Las dos aulas de abajo se movieron de día en la agenda —el
  # caso que dispara «aula_movida»— y aun así alguien fue.
  hoja <- .madm_hoja(
    # 1) la columna ESTADO de la propia fila, que es lo que la app mantiene.
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30",
               "CH 1", estado = "APLICADA"),
    # 2) el código que llega en `aplicadas`, cuando la hoja aún no se refrescó.
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30",
               "CH 2", estado = "POR APLICAR")
  )
  plan <- list(
    .madm_aula("CH 1", "2026-09-14", "10:00", estado = "reagendada"),
    .madm_aula("CH 2", "2026-09-14", "10:00", estado = "reagendada")
  )
  expect_length(monitoreo_aulas_citas_sin_agenda(plan, hoja, aplicadas = c("CH 1", "CH 2"),
                                                 desde = "2026-09-07", hasta = "2026-09-12"), 0L)
  # Y sin ninguna de las dos señales, las MISMAS filas sí salen: es lo que
  # prueba que el silencio de arriba lo produce la aplicación y no el filtro
  # de la ventana.
  expect_length(monitoreo_aulas_citas_sin_agenda(plan, .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30",
               "CH 1", estado = "POR APLICAR"),
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30",
               "CH 2", estado = "POR APLICAR")
  ), desde = "2026-09-07", hasta = "2026-09-12"), 2L)
})

test_that("una cita al día no sale, y fuera de la ventana tampoco", {
  hoja <- .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 1"),
    # Ésta SÍ está huérfana, pero cae fuera de la semana que rige la hoja: la
    # contesta la hoja de esa semana, no ésta. Sin acotar, el recibo mezclaría
    # semanas y diría que sobran filas que nadie escribió aquí.
    .madm_fila("Ana Prueba", "Lunes", "20/09", "09:30", "09:45", "10:00 a 10:30", "CH 7")
  )
  plan <- list(
    .madm_aula("CH 1", "2026-09-07", "10:00"),
    .madm_aula("CH 7", "2026-09-28", "10:00", estado = "reagendada")
  )
  expect_length(monitoreo_aulas_citas_sin_agenda(plan, hoja, desde = "2026-09-07",
                                                 hasta = "2026-09-12"), 0L)
})

test_that("el recibo de la sincronización trae las citas sin agenda", {
  # La capacidad existe sólo si alguien la consume: el motor puede saberlo y el
  # recibo no decirlo, y entonces nadie se entera nunca.
  mock <- .sheets_api_mock()
  mock$seed("Semana 1", values = .madm_hoja(
    .madm_fila("Ana Prueba", "Lunes", "07/09", "09:30", "09:45", "10:00 a 10:30", "CH 12")
  ))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  recibo <- monitoreo_aulas_sincronizar_distribucion(
    "sheet_dist",
    plan = list(.madm_aula("CH 12", "2026-09-14", "10:00 am", estado = "reagendada")),
    desde = "2026-09-07", hasta = "2026-09-12")
  expect_length(recibo$sin_agenda, 1L)
  expect_equal(recibo$sin_agenda[[1]]$curso_horario, "CH 12")
  expect_equal(recibo$sin_agenda[[1]]$motivo, "aula_movida")
  # Y el ensayo sigue sin escribir: mirar no cambia la hoja.
  expect_length(Filter(function(c) !identical(c$method, "GET"), mock$env$calls), 0L)
})

test_that("la frase del recibo dice las citas huérfanas CON su fecha nueva", {
  # Decir «1 cita ya no tiene su aula agendada» sin la fecha obliga a ir al
  # libro a buscarla, que es justo el trabajo que esto ahorra.
  texto <- monitoreo_aulas_sincronizacion_texto(list(
    aplicado = FALSE,
    sin_agenda = list(list(curso_horario = "CH 12", fecha = "2026-09-07",
                           motivo = "aula_movida", detalle = "2026-09-14")),
    sin_aplicador = list()
  ))
  expect_match(texto, "CH 12 el 2026-09-07", fixed = TRUE)
  expect_match(texto, "ahora el 2026-09-14", fixed = TRUE)
})

test_that("sin huérfanas la frase no las menciona", {
  texto <- monitoreo_aulas_sincronizacion_texto(list(aplicado = FALSE,
                                                     sin_agenda = list(),
                                                     sin_aplicador = list()))
  expect_false(grepl("agendada ese día", texto, fixed = TRUE))
})

test_that("sincronizar con un enlace lo RECUERDA, o la red de publicar queda muerta", {
  # Visto en vivo el 2026-09-09: se sincronizó pasando el enlace, se publicó a
  # continuación y el recibo dijo «adoptadas 0, motivo sin_destino». La lectura
  # previa que publicar hace de esta hoja depende de que el destino esté
  # guardado; usar el enlace y tirarlo dejaba la red desconectada por una línea.
  cfg <- monitoreo_aulas_distribucion_destino_set(
    list(), "https://docs.google.com/spreadsheets/d/ABC123/edit")
  guardado <- cfg$aulas_universitarias$distribucion_sheets
  expect_equal(guardado$spreadsheet_id, "ABC123")
  # Y desde ahí, la adopción de publicar YA encuentra a dónde mirar: su motivo
  # deja de ser `sin_destino`, que es el síntoma exacto que se vio.
  expect_false(identical(
    prosecnurapp:::.malp_adoptar_distribucion(
      cfg$aulas_universitarias, list(), list())$motivo, "sin_destino"))
})
