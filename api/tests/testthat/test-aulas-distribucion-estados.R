# Un estado se reconoce escrito como el equipo lo escribe.
#
# El 2026-09-10 el documento de los aplicadores traía «APLICADA SIN AGENDACION»
# —sin tilde, tecleada esa manana— y la app declara «APLICADA SIN AGENDACIÓN».
# La comparación era `TEXT_EQ` contra el canónico, así que esa celda se quedaba
# sin color y sin reconocer, y nada fallaba.

test_that("el estado se reconoce con tilde y sin ella", {
  expect_identical(aulas_distribucion_estado_canonico("APLICADA SIN AGENDACION"),
                   "APLICADA SIN AGENDACIÓN")
  expect_identical(aulas_distribucion_estado_canonico("APLICADA SIN AGENDACIÓN"),
                   "APLICADA SIN AGENDACIÓN")
  # Minúsculas y espacios de más: es una celda tecleada, no un identificador.
  expect_identical(aulas_distribucion_estado_canonico("  aplicada por reagendacion "),
                   "APLICADA POR REAGENDACIÓN")
})

test_that("lo que no es un estado declarado NO se aproxima al más parecido", {
  # Devolver «APLICADA» para «APLICADO EN PARTE» metería en el operativo un
  # estado que nadie escribió. Vacío es la respuesta honesta.
  expect_identical(aulas_distribucion_estado_canonico("APLICADO EN PARTE"), "")
  expect_identical(aulas_distribucion_estado_canonico(""), "")
  expect_identical(aulas_distribucion_estado_canonico(NULL), "")
})

test_that("«POR APLICAR SIN AGENDACIÓN» es un estado, y es la hermana pendiente", {
  # Gonzalo, 2026-09-10, con su desplegable delante: «deberían ser estas». Sin
  # ella, ir a un aula sin cita se anotaba como un «POR APLICAR» normal y nadie
  # distinguía una cita pactada de una apuesta.
  expect_true("POR APLICAR SIN AGENDACIÓN" %in% MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
  expect_identical(aulas_distribucion_estado_canonico("por aplicar sin agendacion"),
                   "POR APLICAR SIN AGENDACIÓN")
  # Y NO se confunde con su hermana rendida ni con el «POR APLICAR» normal.
  expect_false(identical(aulas_distribucion_estado_canonico("POR APLICAR SIN AGENDACION"),
                         "POR APLICAR"))
  colores <- prosecnurapp:::.alpa_COLOR_ESTADO
  expect_false(identical(colores[["POR APLICAR SIN AGENDACIÓN"]], colores[["POR APLICAR"]]))
  expect_false(identical(colores[["POR APLICAR SIN AGENDACIÓN"]],
                         colores[["APLICADA SIN AGENDACIÓN"]]))
})

test_that("el desplegable sale en SU orden, y sin «NO APLICADA»", {
  # El orden es el de su validación: una lista que se recorre con la vista.
  expect_identical(MONITOREO_AULAS_ESTADOS_DISTRIBUCION, c(
    "POR APLICAR", "APLICADA", "APLICADA POR REAGENDACIÓN",
    "REAGENDADA", "RECHAZADA",
    "APLICADA SIN AGENDACIÓN", "POR APLICAR SIN AGENDACIÓN"
  ))
  # «NO APLICADA» vive en «STATUS DE APLICACIÓN» del libro, otra hoja y otro
  # vocabulario: aquí sería una opción que él no puso.
  expect_false("NO APLICADA" %in% MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
})

test_that("cada estado con tilde emite DOS reglas de color, una por forma", {
  # Una sola regla deja sin pintar justo la celda tecleada a mano.
  expect_setequal(aulas_distribucion_formas_de_estado("APLICADA SIN AGENDACIÓN"),
                  c("APLICADA SIN AGENDACIÓN", "APLICADA SIN AGENDACION"))
  # Sin tildes no se duplica: dos reglas idénticas se pisarían sin motivo.
  expect_identical(aulas_distribucion_formas_de_estado("POR APLICAR"), "POR APLICAR")
})

test_that("el formato de la hoja pinta la forma SIN TILDE que hay en el documento", {
  filas <- list(
    as.list(prosecnurapp:::.alpa_CABECERA),
    as.list(c("Interno Pulso", "Jueves", "10/09", "8:15", "8:30", "8:45 a 9:15",
              "CH 51", "E201", "CIENCIAS E INGENIERÍA", "CÁLCULO", "—",
              "APLICADA SIN AGENDACION"))
  )
  reqs <- aulas_libro_plan_aplicadores_formato_requests(0L, filas)
  valores <- unlist(lapply(reqs, function(r) {
    r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue
  }), use.names = FALSE)
  expect_true("APLICADA SIN AGENDACION" %in% valores)
  expect_true("APLICADA SIN AGENDACIÓN" %in% valores)
  expect_true("POR APLICAR SIN AGENDACIÓN" %in% valores)
})

test_that("una fila con el estado sin tilde se clasifica como el equipo la marcó", {
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- as.list(c("Interno Pulso", "Jueves", "10/09", "8:15", "8:30", "8:45 a 9:15",
                    "CH 51", "", "", "", "", "REAGENDADA"))
  plan <- list(list(operational_code = "CH 51", scheduled_venue = "E201",
                    faculty = "CIENCIAS E INGENIERÍA", course_name = "CÁLCULO",
                    teacher = "—", scheduled_date = "2026-09-10", scheduled_time = "08:45"))
  out <- monitoreo_aulas_completar_distribucion(list(cab, fila), plan = plan)
  expect_identical(out$filas[[1]]$clase, "reagendada")
})

# --- El motor NUNCA degrada un estado que no escribió -------------------------
#
# Gonzalo, 2026-09-10: «el estado aplicada también lo pone el coordinador… o sea
# puede, no es que siempre lo ponga», y «ojo, no es a mano, es un chip
# desplegable». Lo elige ANTES de que llegue el parte, así que la app puede ir
# por detrás — y publicarle «POR APLICAR» encima borraría lo que él sabe.

test_that("«APLICADA» puesta por el coordinador sobrevive a un motor que no se enteró", {
  expect_identical(aulas_distribucion_estado_a_publicar("POR APLICAR", "APLICADA"),
                   "APLICADA")
  # Y las que el motor no deduce nunca, con más razón.
  for (e in c("REAGENDADA", "RECHAZADA", "APLICADA POR REAGENDACIÓN")) {
    expect_identical(aulas_distribucion_estado_a_publicar("POR APLICAR", e), e)
  }
})

test_that("sólo la celda VACÍA se siembra; «POR APLICAR» escrita tampoco se asciende", {
  # La primera versión de esto ascendía «POR APLICAR» a «APLICADA» cuando la app
  # se enteraba. Choca con su regla —«la celda escrita se conserva siempre»— y
  # con lo que hace el ciclo diario, que no toca ninguna celda con contenido. Un
  # ascenso también es escribir encima, y el daño de CH 111 y CH 82 fue
  # exactamente eso.
  expect_identical(aulas_distribucion_estado_a_publicar("APLICADA", ""), "APLICADA")
  expect_identical(aulas_distribucion_estado_a_publicar("POR APLICAR", ""), "POR APLICAR")
  expect_identical(aulas_distribucion_estado_a_publicar("APLICADA", "POR APLICAR"),
                   "POR APLICAR")
  # Lo que la app sabe no se pierde: sale en el recibo como observación, que es
  # donde una discrepancia se lee sin que nadie la escriba encima.
})

test_that("el motor NO asciende una celda escrita, ni siquiera a su desenlace", {
  # Su regla del 2026-09-09, textual: «el status de aplicada es manual y lo hace
  # el aplicador, no la app; la app solo pone por defecto POR APLICAR al
  # construir, punto». Nació de un daño medido: cuando la app proponía ascensos,
  # CH 111 y CH 82 —agendadas para el viernes 11 y con cero respuestas— salieron
  # APLICADA porque un parte estaba tecleado en la fila de al lado, y la hoja
  # decía que dos aulas del futuro ya estaban hechas.
  expect_identical(
    aulas_distribucion_estado_a_publicar("APLICADA", "POR APLICAR SIN AGENDACIÓN"),
    "POR APLICAR SIN AGENDACIÓN")
  expect_identical(
    aulas_distribucion_estado_a_publicar("APLICADA", "REAGENDADA"), "REAGENDADA")
})

test_that("un valor escrito que la app NO reconoce tampoco se pisa", {
  # Borrarlo por no reconocerlo sería el peor desenlace de una lista cerrada: el
  # equipo escribió algo y la app lo hace desaparecer.
  expect_identical(
    aulas_distribucion_estado_a_publicar("POR APLICAR", "PENDIENTE DE CONFIRMAR"),
    "PENDIENTE DE CONFIRMAR")
})

test_that("los estados publicados se indexan por curso-horario Y fecha", {
  # Un mismo curso-horario aparece dos veces cuando se reagenda —CH 74 salió el
  # 07/09 y aterrizó el 09/09— y sólo el par distingue una fila de la otra.
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod, fecha, estado) as.list(c(
    "Castillo Solorsano, Leidy Viviana", "Lunes", fecha, "", "", "",
    cod, "", "", "", "", estado))
  mapa <- aulas_distribucion_estados_publicados(list(
    cab, fila("CH 74", "07/09", "REAGENDADA"),
    fila("CH 74", "09/09", "APLICADA POR REAGENDACIÓN")))
  expect_identical(mapa[["CH 74\r07/09"]], "REAGENDADA")
  expect_identical(mapa[["CH 74\r09/09"]], "APLICADA POR REAGENDACIÓN")
})

test_that("el generador respeta el estado ya publicado de esa cita", {
  plan <- list(list(operational_code = "CH 51", scheduled_venue = "E201",
                    faculty = "CIENCIAS E INGENIERÍA", course_name = "CÁLCULO",
                    teacher = "—", scheduled_date = "2026-09-10", scheduled_time = "08:45"))
  rep <- list(dias = list(list(fecha = "2026-09-10", asignaciones = list(list(
    codigo = "CH 51", aplicador = "Interno Pulso",
    recojo = "8:15", salida = "8:30", inicio = "8:45", fin = "9:15")))))
  disp <- list(list(nombre = "Interno Pulso"))
  corta <- function(...) aulas_libro_filas_plan_aplicadores(plan, disp, rep = rep, ...)
  i_est <- which(prosecnurapp:::.alpa_CABECERA == "ESTADO")
  # Sin nada publicado, el motor pone lo que deduce.
  expect_identical(corta()[[2]][[i_est]], "POR APLICAR")
  # Con «APLICADA» ya puesta en esa misma cita, NO la degrada.
  clave <- paste("CH 51", "10/09", sep = "\r")
  expect_identical(
    corta(estados_previos = stats::setNames("APLICADA", clave))[[2]][[i_est]],
    "APLICADA")
})

# --- El Sheets es la fuente de verdad, y la app tiene que poder LEERLO --------
#
# Gonzalo, 2026-09-10: «se supone que el Sheets es la fuente de verdad que cambia
# lo que la app tiene, a menos que la app identifique aulas agendadas que el
# Sheets todavía no tiene mapeadas». Ese día una fila decía «CH164» y los 1.392
# códigos del plan van con espacio: la app la declaraba `desconocida`, así que
# una aula APLICADA SIN AGENDACIÓN no contaba para ninguna cuota y nadie veía
# por qué. Un espacio de menos no puede perder una encuesta.

test_that("un código sin el espacio casa igual con el del plan", {
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- as.list(c("Interno Pulso", "Jueves", "10/09", "11:30", "11:45",
                    "11:45 a 12:15", "CH164", "R101", "", "", "",
                    "APLICADA SIN AGENDACION"))
  plan <- list(list(operational_code = "CH 164", scheduled_venue = "R101",
                    faculty = "EDUCACIÓN", course_name = "INVESTIGACIÓN",
                    teacher = "—", scheduled_date = "2026-09-10", scheduled_time = "11:45"))
  out <- monitoreo_aulas_completar_distribucion(list(cab, fila), plan = plan)
  expect_length(out$filas, 1L)
  # Antes salía «desconocida» y la fila no se completaba con nada.
  expect_false(identical(out$filas[[1]]$clase, "desconocida"))
  expect_identical(out$resumen$desconocida, 0L)
  # Y al reconocerla, el plan le pone la facultad que le faltaba.
  i_fac <- which(prosecnurapp:::.alpa_CABECERA == "FACULTAD")
  expect_identical(out$filas[[1]]$fila[[i_fac]], "EDUCACIÓN")
})

test_that("la fijación también casa sin el espacio, y fija el código del PLAN", {
  cab <- as.list(prosecnirapp <- prosecnurapp:::.alpa_CABECERA)
  fila <- as.list(c("Interno Pulso", "Jueves", "10/09", "", "", "",
                    "CH164", "", "", "", "", "APLICADA"))
  plan <- list(list(operational_code = "CH 164"))
  out <- monitoreo_aulas_fijaciones_desde_distribucion(
    list(cab, fila), plan = plan, roster = c("Interno Pulso"))
  expect_identical(out$adoptadas, 1L)
  # La clave que se fija es la del plan: con «CH164» el reparto no la
  # encontraría al aplicarla.
  expect_true("CH 164" %in% names(out$fijadas))
  expect_length(out$codigos_desconocidos, 0L)
})

test_that("un código que de verdad no está en el plan SIGUE declarándose", {
  # El normalizador no puede tragarse lo ajeno: si el código no existe, es un
  # tecleo y hay que verlo.
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- as.list(c("Interno Pulso", "Jueves", "10/09", "", "", "",
                    "CH 999", "", "", "", "", "APLICADA"))
  out <- monitoreo_aulas_completar_distribucion(
    list(cab, fila), plan = list(list(operational_code = "CH 164")))
  expect_identical(out$resumen$desconocida, 1L)
})

test_that("una aplicada SIN AGENDACIÓN cuenta como rendida y no se reporta como desalineada", {
  # Sin ella en `.madm_APLICADOS`, la fila que aplicaron sin cita salía como
  # «sin_plan» o «ya_no_agendada» y el recibo pedía atención sobre algo hecho.
  expect_true("APLICADA SIN AGENDACIÓN" %in% prosecnurapp:::.madm_APLICADOS)
  # Y «POR APLICAR SIN AGENDACIÓN» NO: ésa todavía no ha rendido.
  expect_false("POR APLICAR SIN AGENDACIÓN" %in% prosecnurapp:::.madm_APLICADOS)
  # La comparación va por canónico: en la hoja está sin tilde.
  expect_true(aulas_distribucion_estado_canonico("APLICADA SIN AGENDACION")
              %in% prosecnurapp:::.madm_APLICADOS)
})

# --- La raya entre días la dibuja la APP ---------------------------------------
#
# La dibujaba el equipo a mano y se desalineó en cuanto la app insertó una fila:
# el 2026-09-10 la sincronización metió CH 137 —sábado 12/09 a las 08:45, la más
# temprana de su día— al principio del bloque, y la raya se quedó en la fila de
# abajo. La cita nueva aparecía colgando del viernes. Gonzalo: «pero ahora la
# línea negra del sábado quedó allí arriba de esa aula».

test_that("la raya cae donde cambia la fecha, no donde cayó la vez pasada", {
  fila <- function(dia, fecha, cod) as.list(c(
    "Interno Pulso", dia, fecha, "", "", "", cod, "", "", "", "", "POR APLICAR"))
  rows <- list(
    as.list(prosecnurapp:::.alpa_CABECERA),
    fila("Viernes", "11/09", "CH 45"),
    fila("Viernes", "11/09", "CH 142"),
    fila("Sábado", "12/09", "CH 137"),   # la insertada, primera de su día
    fila("Sábado", "12/09", "CH 33"))
  reqs <- prosecnurapp:::.alpa_separadores_de_dia(0L, rows)
  bordes <- Filter(function(r) !is.null(r$updateBorders$top), reqs)
  expect_length(bordes, 1L)
  # Fila 4 del documento (cabecera + 2 del viernes): índice 0-based = 3.
  expect_identical(bordes[[1]]$updateBorders$range$startRowIndex, 3L)
  expect_identical(bordes[[1]]$updateBorders$top$style, "SOLID_THICK")
})

test_that("se limpia la raya anterior antes de dibujar la nueva", {
  # Sin limpiar, la del reparto pasado quedaría ADEMÁS de la nueva y el bloque
  # saldría partido en dos sitios.
  fila <- function(dia, fecha) as.list(c("Interno Pulso", dia, fecha, "", "", "",
                                         "CH 1", "", "", "", "", "POR APLICAR"))
  reqs <- prosecnurapp:::.alpa_separadores_de_dia(0L, list(
    as.list(prosecnurapp:::.alpa_CABECERA), fila("Lunes", "07/09"), fila("Martes", "08/09")))
  expect_identical(reqs[[1]]$updateBorders$innerHorizontal$style, "NONE")
  # Y la limpieza cubre TODAS las filas, no sólo hasta el primer corte.
  expect_identical(reqs[[1]]$updateBorders$range$endRowIndex, 3L)
})

test_that("con un solo día no se dibuja ninguna raya", {
  fila <- as.list(c("Interno Pulso", "Lunes", "07/09", "", "", "",
                    "CH 1", "", "", "", "", "POR APLICAR"))
  reqs <- prosecnurapp:::.alpa_separadores_de_dia(
    0L, list(as.list(prosecnurapp:::.alpa_CABECERA), fila, fila))
  # Ninguna RAYA — pero sí la limpieza, que borra la del reparto anterior.
  expect_length(Filter(function(r) !is.null(r$updateBorders$top), reqs), 0L)
})

test_that("el formato de la hoja incluye las rayas", {
  fila <- function(dia, fecha) as.list(c("Interno Pulso", dia, fecha, "", "", "",
                                         "CH 1", "", "", "", "", "POR APLICAR"))
  reqs <- aulas_libro_plan_aplicadores_formato_requests(0L, list(
    as.list(prosecnurapp:::.alpa_CABECERA), fila("Lunes", "07/09"), fila("Martes", "08/09")))
  expect_true(any(vapply(reqs, function(r) !is.null(r$updateBorders), logical(1))))
})

test_that("la grafía se repara; el significado nunca", {
  # Gonzalo, 2026-09-10: el desplegable declara «APLICADA SIN AGENDACIÓN» con
  # tilde y la celda de CH164 la tenía sin ella, así que Sheets la marcaba
  # «Entrada no válida» aunque el estado fuera el correcto.
  cab <- as.list(prosecnurapp:::.alpa_CABECERA)
  fila <- function(cod, estado) as.list(c("Interno Pulso", "Jueves", "10/09", "", "", "",
                                          cod, "", "", "", "", estado))
  out <- monitoreo_aulas_estados_distribucion(list(
    cab,
    fila("CH 164", "APLICADA SIN AGENDACION"),   # sin tilde: se repara
    fila("CH 20", "REAGENDADA"),                  # ya canónica: no se toca
    fila("CH 21", "PENDIENTE DE CONFIRMAR"),      # ajena: se respeta tal cual
    fila("CH 22", "")))                           # vacía: se siembra
  expect_identical(out$estados[[1]], "APLICADA SIN AGENDACIÓN")
  expect_identical(out$estados[[2]], "REAGENDADA")
  expect_identical(out$estados[[3]], "PENDIENTE DE CONFIRMAR")
  expect_identical(out$estados[[4]], "POR APLICAR")
  # La reparación se DECLARA como cambio, no se hace en silencio.
  cods <- vapply(out$cambios, function(c1) c1$curso_horario, character(1))
  expect_true("CH 164" %in% cods)
  expect_false("CH 20" %in% cods)
  expect_false("CH 21" %in% cods)
})

test_that("una fecha mal tecleada NO parte el bloque de su día", {
  # 2026-09-10: CH164 tiene «10/10» donde debía decir «10/09» y la primera
  # versión —que separaba por FECHA— le puso una raya al entrar y otra al salir,
  # encajonando la fila y partiendo el jueves en tres. Gonzalo lo fotografió.
  # El día es lo que el lector agrupa; la errata se ve en su columna.
  fila <- function(dia, fecha, cod) as.list(c(
    "Interno Pulso", dia, fecha, "", "", "", cod, "", "", "", "", "POR APLICAR"))
  rows <- list(
    as.list(prosecnurapp:::.alpa_CABECERA),
    fila("Miércoles", "09/09", "CH 11"),
    fila("Jueves", "10/09", "CH 62"),
    fila("Jueves", "10/10", "CH164"),   # la errata
    fila("Jueves", "10/09", "CH 129"),
    fila("Viernes", "11/09", "CH 107"))
  bordes <- Filter(function(r) !is.null(r$updateBorders$top),
                   prosecnurapp:::.alpa_separadores_de_dia(0L, rows))
  # DOS rayas: al entrar el jueves y al entrar el viernes. Ni una dentro.
  expect_length(bordes, 2L)
  inicios <- sort(vapply(bordes, function(b) b$updateBorders$range$startRowIndex, integer(1)))
  expect_identical(inicios, c(2L, 5L))
})

test_that("aunque no haya cortes, la raya vieja se borra", {
  # Devolver `list()` cuando todo cae en un día dejaba puesta para siempre la
  # raya del reparto anterior.
  fila <- as.list(c("Interno Pulso", "Lunes", "07/09", "", "", "",
                    "CH 1", "", "", "", "", "POR APLICAR"))
  reqs <- prosecnurapp:::.alpa_separadores_de_dia(
    0L, list(as.list(prosecnurapp:::.alpa_CABECERA), fila, fila))
  expect_length(reqs, 1L)
  expect_identical(reqs[[1]]$updateBorders$innerHorizontal$style, "NONE")
})

# --- El vocabulario del LIBRO, que es otro que el de la distribución ----------

test_that("«APLICADA POR REAGENDACIÓN» está en el STATUS DE APLICACIÓN del libro", {
  # Gonzalo, 2026-09-10: «además a las que se aplicaron por reagendación las has
  # quitado, cuando ésas también deberían estar». No la quitó nadie: nunca
  # estuvo. La distribución sí la tenía, así que la misma aula salía «APLICADA
  # POR REAGENDACIÓN» en la hoja de los aplicadores y sólo «APLICADA» en el
  # libro, y con eso se pierde lo único que esa palabra cuenta.
  expect_true("APLICADA POR REAGENDACIÓN" %in% aulas_libro_status_aplicacion_de(1L))
  # También en la reserva: una reserva se puede aplicar después de moverla.
  expect_true("APLICADA POR REAGENDACIÓN" %in% aulas_libro_status_aplicacion_de(2L))
  # Y sigue siendo un vocabulario DISTINTO del de la distribución: el libro
  # tiene «REEMPLAZADA POR» y la distribución no.
  expect_true("REEMPLAZADA POR" %in% aulas_libro_status_aplicacion_de(1L))
  expect_false("REEMPLAZADA POR" %in% MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
})

test_that("NINGÚN estado del libro se queda sin color", {
  # La guarda contra la avería que Gonzalo vio dos veces el mismo día: el
  # vocabulario crece y el pintor se queda atrás, así que un estado sale sin
  # pintar en el Sheets vivo del operativo y nadie se entera hasta que alguien
  # lo mira. Pasó con «REEMPLAZADA POR» (2026-09-04, visto el 09-10) y con «POR
  # APLICAR», que salía en blanco al lado de las verdes.
  #
  # Se pregunta al pintor DE VERDAD en vez de leer el archivo: renombrar la
  # tabla de reglas no puede apagar este test.
  reqs <- monitoreo_aulas_sheets_formato_requests(
    "Aulas Aplicadas (Campo)", sheet_id = 0L, n_filas = 40L, n_cols = 120L)
  pintados <- unlist(lapply(reqs, function(r) {
    v <- tryCatch(r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue,
                  error = function(e) NULL)
    if (is.null(v)) NULL else as.character(v)
  }), use.names = FALSE)
  vocabulario <- unique(c(aulas_libro_status_aplicacion_de(1L),
                          aulas_libro_status_aplicacion_de(2L)))
  sin_color <- setdiff(vocabulario, pintados)
  expect_equal(sin_color, character(0),
               info = paste("estados sin regla de color:", paste(sin_color, collapse = ", ")))
})

test_that("lo específico se pinta ANTES que lo genérico", {
  # La comparación es «contiene» y gana el índice menor: si «APLICADA» fuera
  # primero, «NO APLICADA» y «APLICADA POR REAGENDACIÓN» saldrían verdes y la
  # columna entera mentiría.
  reqs <- monitoreo_aulas_sheets_formato_requests(
    "Aulas Aplicadas (Campo)", sheet_id = 0L, n_filas = 40L, n_cols = 120L)
  textos <- unlist(lapply(reqs, function(r) {
    tryCatch(r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue,
             error = function(e) NULL)
  }), use.names = FALSE)
  pos <- function(t) which(textos == t)[[1]]
  expect_lt(pos("NO APLICADA"), pos("APLICADA"))
  expect_lt(pos("APLICADA POR REAGENDACIÓN"), pos("APLICADA"))
  expect_lt(pos("APLICADA DE REFUERZO"), pos("APLICADA"))
})

# --- El «mejor postor» se estima con lo que el campo RINDE, no con el diseño ---
#
# El motor publicaba `factor_de_campo` por celda y `monitoreo_aulas_reserva_por_celda()`
# no lo leía: `tasa_aula` caía siempre al rendimiento por tramo. La costura
# existía y estaba sin usar. Si el campo va al 60 % de lo previsto, ordenar
# candidatos por la tasa del diseño es elegir mal.

test_that("el aporte esperado baja cuando el campo rinde por debajo de lo previsto", {
  # El aporte se lee de `sex_top_*`, que es como el plan describe la
  # composición del aula: los dos sexos más frecuentes con su conteo.
  aula <- function(id) list(
    classroom_id = id, operational_code = id, faculty = "DERECHO",
    sample_role = "extra_reserve_pool", eligible_n = 60,
    sex_top_1 = "F", sex_top_1_n = 40, sex_top_2 = "M", sex_top_2_n = 20)
  celda <- function(factor) list(list(
    faculty = "DERECHO", sex = "F", estado = "deficit_proyectado", brecha = 40L,
    factor_de_campo = factor))
  plan <- list(aula("R 200.1"))
  con_diseno <- monitoreo_aulas_reserva_por_celda(celda(NA_real_), plan)
  con_campo  <- monitoreo_aulas_reserva_por_celda(celda(0.6), plan)
  ap <- function(o) o[[1]]$candidatos[[1]]$aporte_esperado
  expect_gt(ap(con_diseno), 0)
  expect_lt(ap(con_campo), ap(con_diseno))
  # Y la tasa que se declara es la corregida, no la del diseño: el número que se
  # enseña tiene que ser el que se usó.
  tasa <- function(o) o[[1]]$candidatos[[1]]$tasa_efectividad
  expect_lt(tasa(con_campo), tasa(con_diseno))
  expect_equal(tasa(con_campo), round(tasa(con_diseno) * 0.6, 3), tolerance = 0.002)
})

test_that("sin factor medible se usa la tasa del diseño, como antes", {
  aula <- list(classroom_id = "R 200.1", operational_code = "R 200.1",
               faculty = "DERECHO", sample_role = "extra_reserve_pool",
               eligible_n = 60,
               sex_top_1 = "F", sex_top_1_n = 40, sex_top_2 = "M", sex_top_2_n = 20)
  celda <- function(f) list(list(faculty = "DERECHO", sex = "F",
                                 estado = "deficit_proyectado", brecha = 40L,
                                 factor_de_campo = f))
  base <- monitoreo_aulas_reserva_por_celda(celda(NA_real_), list(aula))
  # Un factor 0 o negativo no es «rinde cero»: es que no se pudo medir.
  for (malo in list(NA_real_, 0, -1)) {
    expect_identical(
      monitoreo_aulas_reserva_por_celda(celda(malo), list(aula))[[1]]$candidatos[[1]]$aporte_esperado,
      base[[1]]$candidatos[[1]]$aporte_esperado)
  }
})
