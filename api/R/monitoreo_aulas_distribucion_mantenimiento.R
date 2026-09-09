# monitoreo_aulas_distribucion_mantenimiento.R — los dos pasos que faltaban.
#
# Dictado de Gonzalo (2026-09-08), después de ver que publicar podía borrar de
# un request los 33 cambios de aplicador que el coordinador llevaba escritos:
# «Dejemos todo el proceso robusto para tapar el agujero».
#
# El ciclo que él describió tiene cuatro movimientos —**la app PROPONE, el
# coordinador DISPONE, la app ADOPTA lo que él cambió y AÑADE sólo lo que
# falta**— y hasta hoy la app sabía hacer dos: publicar (`publicar-distribucion`,
# ahora con guarda) y adoptar (`adoptar-distribucion`). Los otros dos se hacían
# con scripts fuera de la app, o sea que el operativo dependía de que hubiera
# alguien con una consola abierta:
#
# - **añadir las agendadas a las que no va nadie** — el 08/09 eran seis (CH 35,
#   40, 69, 82, 83 y 133), agendadas de la semana sin una sola fila en la hoja
#   de los aplicadores. Nadie las habría echado en falta hasta el día mismo;
# - **refrescar el ESTADO** con lo que la plataforma demuestra, sin pisar lo que
#   el equipo tecleó.
#
# La regla que mantiene el ciclo estable, y que gobierna este archivo entero:
# **una fila que ya existe no se vuelve a proponer.** La app añade lo que falta
# y actualiza lo que puede demostrar; todo lo demás es del coordinador.

#' Los estados que significan «el aula ya se aplicó».
#'
#' Dos y no uno porque «APLICADA POR REAGENDACIÓN» es un estado propio (dictado
#' 2026-09-08): cuenta igual para la cuota, pero costó una llamada más y un
#' hueco en la agenda de alguien, y el operativo necesita poder contarlas
#' aparte para saber cuánto está costando reagendar.
#' @keywords internal
.madm_APLICADOS <- c("APLICADA", "APLICADA POR REAGENDACIÓN")

#' Los estados de la agenda que justifican mandar a alguien.
#'
#' `agendada` y `reagendada`, no todo lo que tiene hora. El plan trae
#' `scheduled_time` aunque nadie haya cerrado el acuerdo —cuando no hay hora
#' pactada cae al horario del curso del catálogo—, así que añadir una fila por
#' tener hora sería mandar a un aplicador a una clase que el docente no ha
#' confirmado. Es el filtro que en el 08/09 dejó fuera catorce candidatas y
#' entrar sólo a seis.
#' @keywords internal
.madm_AGENDADOS <- c("agendada", "reagendada")

#' Los minutos de una hora escrita, o `NA` si no se deja leer.
#'
#' Existe para que NINGUNA comparación de horas de este archivo se haga como
#' texto: el equipo escribe «8:30» y el motor escribe «08:30», y en texto la
#' primera es mayor que «09:20». `monitoreo_aulas_hora_parse()` las lee las dos
#' igual y devuelve minutos, que es lo único ordenable.
#' @keywords internal
.madm_minutos <- function(x) {
  v <- .alpa_txt(x)
  if (!nzchar(v)) return(NA_real_)
  m <- suppressWarnings(monitoreo_aulas_hora_parse(v))
  if (!length(m)) NA_real_ else as.numeric(m[[1L]])
}

#' La cabecera de la hoja remota, con la longitud de la del motor.
#' @keywords internal
.madm_cabecera <- function(filas_remotas) {
  if (!length(filas_remotas)) return(character(0))
  .madc_valores(filas_remotas[[1L]], length(.alpa_CABECERA))
}

#' El índice de una columna por su RÓTULO, o `NA` si no está.
#' @keywords internal
.madm_col <- function(cab, titulo) {
  i <- which(cab == titulo)
  if (length(i) == 1L) i else NA_integer_
}

#' Una celda de una fila remota, tolerando filas cortas.
#' @keywords internal
.madm_celda <- function(v, i) {
  if (is.na(i) || i > length(v)) "" else v[[i]]
}

#' Exige que la hoja remota se pueda leer por rótulo.
#'
#' Sin CURSO-HORARIO y FECHA no hay forma de saber de qué aula habla cada fila,
#' y comparar por POSICIÓN sobre un documento que alguien pudo reordenar
#' produciría diferencias inventadas: se declara y se para.
#' @keywords internal
.madm_exigir_legible <- function(cab) {
  faltan <- setdiff(c("CURSO-HORARIO", "FECHA"), cab)
  if (length(faltan)) {
    stop_api(
      422, "E_AULAS_DISTRIBUCION_ILEGIBLE",
      paste0(
        "La hoja de la distribución no trae la columna ",
        paste(faltan, collapse = " ni "),
        ": sin ellas no se puede saber de qué aula habla cada fila."
      ),
      details = list(faltan = as.list(faltan), cabecera = as.list(cab))
    )
  }
  invisible(TRUE)
}

#' Las unidades del plan como lista, venga data.frame o lista.
#' @keywords internal
.madm_unidades <- function(plan) {
  if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
}

# --- A2 · qué aulas agendadas no tienen fila ---------------------------------

#' Las aulas agendadas que no tienen cita en la hoja de los aplicadores.
#'
#' Ésta es la pregunta que importaba y que nadie contestaba: **¿hay aulas
#' agendadas a las que no va nadie?** El 08/09 había seis y se descubrieron
#' cruzando a mano la agenda con la distribución.
#'
#' Una aula entra si —y sólo si— se cumplen las cuatro:
#'
#' 1. su curso-horario **no está ya en la hoja** (una fila que existe no se
#'    vuelve a proponer, aunque el reparto de la app la haya movido de persona);
#' 2. la agenda la declara `agendada` o `reagendada` (ver `.madm_AGENDADOS`);
#' 3. su fecha cae en la ventana pedida, cuando se pide una;
#' 4. su hora se puede leer, porque sin hora no hay recojo ni salida que
#'    escribir y la fila saldría a medias.
#'
#' **Lo que no entra se devuelve dicho, no se calla.** Un descarte silencioso es
#' indistinguible de un cero real, y es justo el caso en que alguien se queda
#' sin ir a un aula creyendo que la app ya lo miró.
#'
#' El aplicador va **en blanco**: quién va lo decide una persona en el
#' desplegable, que es exactamente lo que Gonzalo pidió («claro con el aplicador
#' en blanco con el desplegable para que alguien manualmente pueda determinar
#' quién aplica»).
#'
#' @param plan filas del plan.
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param desde,hasta ventana de fechas ISO; `""` no acota.
#' @return lista `{faltantes, descartadas, en_hoja, ventana}`.
#' @export
monitoreo_aulas_agendadas_sin_cita <- function(plan, filas_remotas,
                                               desde = "", hasta = "") {
  cab <- .madm_cabecera(filas_remotas)
  .madm_exigir_legible(cab)
  c_cod <- .madm_col(cab, "CURSO-HORARIO")

  en_hoja <- character(0)
  if (length(filas_remotas) > 1L) {
    en_hoja <- vapply(filas_remotas[-1L], function(f) {
      .madm_celda(.madc_valores(f, length(.alpa_CABECERA)), c_cod)
    }, character(1))
    en_hoja <- unique(en_hoja[nzchar(en_hoja)])
  }

  d0 <- .mav_fecha(desde); d1 <- .mav_fecha(hasta)

  faltantes <- list(); descartadas <- list()
  descartar <- function(cod, motivo, detalle = "") {
    descartadas[[length(descartadas) + 1L]] <<- list(
      curso_horario = cod, motivo = motivo, detalle = detalle
    )
  }

  vistos <- character(0)
  for (u in .madm_unidades(plan)) {
    cod <- .alpa_txt(u[["operational_code"]])
    if (!nzchar(cod) || cod %in% vistos) next
    vistos <- c(vistos, cod)
    if (cod %in% en_hoja) next

    fecha <- .mav_fecha(u[["scheduled_date"]])
    if (!nzchar(fecha)) next        # sin fecha no está agendada: no es un descarte
    if (nzchar(d0) && fecha < d0) next
    if (nzchar(d1) && fecha > d1) next

    estado <- monitoreo_aulas_estado_muestra(u[["sample_status"]])
    if (!(estado %in% .madm_AGENDADOS)) {
      descartar(cod, "sin_agendar", estado)
      next
    }
    ini <- suppressWarnings(monitoreo_aulas_hora_parse(.alpa_txt(u[["scheduled_time"]]))[[1L]])
    if (!is.finite(ini)) {
      descartar(cod, "sin_hora", .alpa_txt(u[["scheduled_time"]]))
      next
    }

    cuando <- .alpa_dia_y_fecha(fecha)
    recojo <- .mav_hhmm(max(0, ini - .mav_PREPARACION_MIN))
    faltantes[[length(faltantes) + 1L]] <- list(
      curso_horario = cod,
      fecha_iso = fecha,
      fecha = cuando$fecha,
      dia = cuando$dia,
      recojo = recojo,
      facultad = .alpa_txt(u[["faculty"]]),
      fila = list(
        "",                                   # APLICADOR: lo pone una persona
        cuando$dia, cuando$fecha, recojo,
        .mav_hhmm(max(0, ini - .mav_SALIDA_MIN)),
        paste0(.mav_hhmm(ini), " a ", .mav_hhmm(ini + .mav_DURACION_MIN)),
        cod,
        .alpa_txt(u[["scheduled_venue"]], .alpa_txt(u[["venue"]])),
        .alpa_txt(u[["faculty"]]),
        .alpa_txt(u[["course_name"]]),
        .alpa_txt(u[["teacher"]]),
        "POR APLICAR"
      )
    )
  }

  # Por día y por hora de recojo: es el orden en que se leen y el que decide
  # dónde se insertan.
  if (length(faltantes)) {
    orden <- order(
      vapply(faltantes, function(f) f$fecha_iso, character(1)),
      vapply(faltantes, function(f) .madm_minutos(f$recojo), numeric(1))
    )
    faltantes <- faltantes[orden]
  }
  list(
    faltantes = faltantes,
    descartadas = descartadas,
    en_hoja = length(en_hoja),
    ventana = list(desde = d0, hasta = d1)
  )
}

# --- A3 · dónde va cada fila nueva -------------------------------------------

#' En qué fila de la hoja entra cada aula que falta.
#'
#' **Al final de su día y en su hora**, no al final del documento: la hoja se
#' lee por jornadas y una cita del miércoles pegada debajo del sábado se pierde
#' de vista. Si su día no existe todavía, va al final, que es donde el día nuevo
#' empieza.
#'
#' **La hora se compara en MINUTOS, nunca como texto.** Gonzalo lo vio en
#' pantalla el 2026-09-08: una fila de las 09:20 había entrado por encima de la
#' de las 8:30. La causa es que el equipo teclea las horas a mano y las escribe
#' sin el cero de la izquierda —«8:30», «9:00»—, y como texto «8:30» es MAYOR
#' que «09:20» porque compara «8» contra «0». La fila caía en el primer sitio
#' donde el orden textual mentía, que en un día que empieza antes de las diez es
#' casi el principio. Una hora que no se puede leer manda su fila al final del
#' día, que es visible, en vez de a un sitio arbitrario.
#'
#' Devuelve las posiciones en número de fila de la hoja (1 es la cabecera) y de
#' ABAJO ARRIBA, que es el único orden en que insertar varias no descoloca a las
#' siguientes.
#'
#' @param filas_remotas los valores de la hoja.
#' @param faltantes la salida de `monitoreo_aulas_agendadas_sin_cita()$faltantes`.
#' @return lista de `{posicion, curso_horario, fila}`, de mayor a menor posición.
#' @export
monitoreo_aulas_posiciones_de_las_nuevas <- function(filas_remotas, faltantes) {
  faltantes <- faltantes %||% list()
  if (!length(faltantes)) return(list())
  cab <- .madm_cabecera(filas_remotas)
  .madm_exigir_legible(cab)
  c_fecha <- .madm_col(cab, "FECHA")
  c_recojo <- .madm_col(cab, "EN OFICINA")

  n <- length(filas_remotas)
  celdas <- lapply(filas_remotas, function(f) .madc_valores(f, length(.alpa_CABECERA)))
  fechas <- vapply(seq_len(n), function(i) .madm_celda(celdas[[i]], c_fecha), character(1))
  recojos <- vapply(seq_len(n), function(i) {
    .madm_minutos(.madm_celda(celdas[[i]], c_recojo))
  }, numeric(1))

  salida <- list()
  for (f in faltantes) {
    # La fila 1 es la cabecera y nunca cuenta como día.
    mismas <- setdiff(which(fechas == f$fecha), 1L)
    minuto <- .madm_minutos(f$recojo)
    pos <- if (!length(mismas)) {
      n + 1L
    } else if (!is.finite(minuto)) {
      max(mismas) + 1L
    } else {
      despues <- mismas[is.finite(recojos[mismas]) & recojos[mismas] > minuto]
      if (length(despues)) min(despues) else max(mismas) + 1L
    }
    salida[[length(salida) + 1L]] <- list(
      posicion = as.integer(pos), curso_horario = f$curso_horario, fila = f$fila
    )
  }
  # De abajo arriba: insertar de arriba abajo movería las posiciones de las que
  # aún no se han insertado.
  salida[order(-vapply(salida, function(x) x$posicion, numeric(1)))]
}

# --- A4 · el ESTADO que la plataforma demuestra ------------------------------

#' Qué ESTADO le toca a cada fila de la distribución.
#'
#' Tres reglas, en este orden:
#'
#' 1. **Lo que la plataforma demuestra manda sobre el vacío**: un aula con
#'    parte o con respuestas llegando está aplicada, y si su fila se había
#'    movido de día, está «APLICADA POR REAGENDACIÓN».
#' 2. **Una fila cuya fecha no es la de la agenda está REAGENDADA**, aunque
#'    nadie lo haya tecleado: el hecho vale tanto como la intención declarada.
#' 3. **Lo que el equipo tecleó NO se pisa.** La app sólo rellena lo vacío y
#'    asciende a aplicada lo que estaba por aplicar. Cambiarle un estado a quien
#'    lo escribió es borrar su decisión con una suposición.
#'
#' La única excepción declarada a la regla 3 es «RECHAZADA»: **no se asciende
#' nunca**, ni con respuestas llegando. Un rechazo lo teclea quien habló con el
#' docente, y unas respuestas bajo ese código son más probablemente un parte
#' mal puesto —el 08/09 pasó: el parte de CH 113 estaba en la fila de CH 111—
#' que un rechazo que se aplicó solo. Sale en `conflictos` para que alguien lo
#' mire, que es lo que corresponde hacer con una contradicción.
#'
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param aplicadas códigos que constan aplicados (`monitoreo_aulas_aula_aplicada()`).
#' @param fecha_agenda vector nombrado código → fecha ISO de la agenda.
#' @return lista `{estados, previos, cambios, conflictos}` — `estados` tiene una
#'   entrada por fila de datos, en su orden.
#' @export
monitoreo_aulas_estados_distribucion <- function(filas_remotas,
                                                 aplicadas = character(0),
                                                 fecha_agenda = character(0)) {
  cab <- .madm_cabecera(filas_remotas)
  .madm_exigir_legible(cab)
  c_cod <- .madm_col(cab, "CURSO-HORARIO")
  c_fecha <- .madm_col(cab, "FECHA")
  c_estado <- .madm_col(cab, "ESTADO")

  filas <- if (length(filas_remotas) > 1L) filas_remotas[-1L] else list()
  n <- length(filas)
  estados <- character(n); previos <- character(n)
  cambios <- list(); conflictos <- list()
  aplicadas <- as.character(aplicadas %||% character(0))

  for (i in seq_len(n)) {
    v <- .madc_valores(filas[[i]], length(.alpa_CABECERA))
    cod <- .madm_celda(v, c_cod)
    previo <- toupper(trimws(.madm_celda(v, c_estado)))
    previos[[i]] <- previo

    dicha <- .madm_celda(v, c_fecha)
    iso_agenda <- if (nzchar(cod) && cod %in% names(fecha_agenda)) {
      .mav_fecha(fecha_agenda[[cod]])
    } else {
      ""
    }
    corta_agenda <- if (nzchar(iso_agenda)) .alpa_dia_y_fecha(iso_agenda)$fecha else ""
    movida <- nzchar(dicha) && nzchar(corta_agenda) && !identical(dicha, corta_agenda)
    aplicada <- nzchar(cod) && cod %in% aplicadas

    propuesto <- if (aplicada) {
      if (movida || identical(previo, "REAGENDADA")) .madm_APLICADOS[[2L]] else .madm_APLICADOS[[1L]]
    } else if (movida) {
      "REAGENDADA"
    } else {
      "POR APLICAR"
    }

    final <- propuesto
    if (nzchar(previo) && !identical(previo, propuesto)) {
      asciende <- propuesto %in% .madm_APLICADOS && !(previo %in% .madm_APLICADOS)
      if (identical(previo, "RECHAZADA")) {
        final <- previo
        if (propuesto %in% .madm_APLICADOS) {
          conflictos[[length(conflictos) + 1L]] <- list(
            curso_horario = cod, fila = i + 1L, tecleado = previo, plataforma = propuesto
          )
        }
      } else if (!asciende) {
        final <- previo
      }
    }
    estados[[i]] <- final
    if (!identical(final, previo)) {
      cambios[[length(cambios) + 1L]] <- list(
        curso_horario = cod, fila = i + 1L, antes = previo, ahora = final
      )
    }
  }
  list(estados = estados, previos = previos, cambios = cambios, conflictos = conflictos)
}

# --- A5 · los cuatro pasos en una sola acción --------------------------------

#' Columna en letras A1 («12» → «L»).
#' @keywords internal
.madm_letra <- function(n) {
  s <- ""
  n <- as.integer(n)
  while (n > 0L) {
    r <- (n - 1L) %% 26L
    s <- paste0(LETTERS[[r + 1L]], s)
    n <- (n - 1L) %/% 26L
  }
  s
}

#' Un `values` escrito por rango, en el mismo formato para todas las escrituras.
#' @keywords internal
.madm_escribir <- function(id, datos) {
  if (!length(datos)) return(0L)
  r <- .monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"),
    method = "POST",
    # **RAW y nunca USER_ENTERED.** Es la trampa que ya costó reescribir 50 286
    # celdas: las horas («09:30») y las fechas cortas («08/09») que USER_ENTERED
    # interpreta dejan de ser el texto que el equipo lee y se vuelven seriales.
    body = list(valueInputOption = "RAW", data = datos)
  )
  as.integer(.monitoreo_scalar(r$totalUpdatedCells, length(datos)))
}

#' La ventana que un reparto declara, para acotar lo que se propone añadir.
#'
#' **Sin ventana, «agendadas sin cita» miente por exceso.** Medido sobre el
#' operativo el 2026-09-08: el reparto rige del 07 al 12 de septiembre y aplaza
#' a propósito lo agendado más allá (`fuera_de_rango`, 28 aulas de las semanas
#' 2 a 4). Preguntar sin acotar devuelve esas 28 como si fueran huecos, cuando
#' son una decisión; con el rango del propio reparto la respuesta es 0, que es
#' la verdad. Un aviso que grita 28 el día que no falta ninguna deja de leerse
#' a la semana.
#'
#' @param rep un reparto (`monitoreo_aulas_reparto()`).
#' @return lista `{desde, hasta}`; cadenas vacías si el reparto no declara rango.
#' @keywords internal
.madm_ventana_del_reparto <- function(rep) {
  r <- if (is.list(rep)) (rep[["rango"]] %||% list()) else list()
  list(desde = .monitoreo_scalar(r[["desde"]], ""),
       hasta = .monitoreo_scalar(r[["hasta"]], ""))
}

#' La fecha de la agenda de cada curso-horario, para saber qué fila se movió.
#' @keywords internal
.madm_fechas_de_la_agenda <- function(plan) {
  unidades <- .madm_unidades(plan)
  cods <- vapply(unidades, function(u) .alpa_txt(u[["operational_code"]]), character(1))
  fechas <- vapply(unidades, function(u) .mav_fecha(u[["scheduled_date"]]), character(1))
  ok <- nzchar(cods) & !duplicated(cods)
  stats::setNames(fechas[ok], cods[ok])
}

#' Sincroniza la distribución con la agenda y con la plataforma.
#'
#' La acción única que pidió Gonzalo el 2026-09-08: **una sola llamada que lea
#' la hoja, diga qué adoptaría, añada las agendadas que no tienen cita, refresque
#' el ESTADO y termine diciendo cuántas quedan sin aplicador.**
#'
#' **Ensayo por defecto.** La primera llamada no escribe nada y describe lo que
#' haría; `aplicar = TRUE` es el acto. Es la misma disciplina que adoptar, y por
#' la misma razón: son veintidós personas leyendo la hoja.
#'
#' Lo que NO hace, a propósito: no reasigna a nadie, no mueve una fila existente
#' y no borra ninguna. Añade y actualiza el ESTADO; el resto es del coordinador.
#'
#' @param spreadsheet_id id o enlace del documento de la distribución.
#' @param plan filas del plan.
#' @param aplicadas códigos que constan aplicados.
#' @param roster nombres del equipo, para poder adoptar y para el desplegable.
#' @param desde,hasta ventana de fechas ISO de las aulas que se añaden. **Sin
#'   ventana entra TODO lo agendado**, que casi nunca es lo que se quiere: ver
#'   la nota de `.madm_ventana_del_reparto()`.
#' @param aplicar `TRUE` escribe; por defecto es un ensayo.
#' @return lista `{ok, aplicado, hoja, anadidas, estado, fijaciones, sin_aplicador, …}`.
#' @export
monitoreo_aulas_sincronizar_distribucion <- function(spreadsheet_id,
                                                     plan = list(),
                                                     aplicadas = character(0),
                                                     roster = character(0),
                                                     desde = "", hasta = "",
                                                     aplicar = FALSE) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(id)) {
    stop_api(400, "E_SHEETS_SPREADSHEET",
             "El enlace no parece de Google Sheets: no trae el identificador del documento.")
  }
  meta <- tryCatch(.monitoreo_sheets_metadata(id), error = function(e) {
    stop_api(502, "E_GOOGLE_SHEETS",
             paste("No se pudo leer el Sheets de la distribución:", conditionMessage(e)))
  })
  hojas <- meta$sheets %||% list()
  titulos <- vapply(hojas, function(h) {
    .monitoreo_scalar((h$properties %||% list())$title, "")
  }, character(1))
  # Por CABECERA y no por nombre: el documento del operativo la tiene llamada
  # «Semana 1» y buscarla por «Plan del día» leía cero citas de una pestaña con
  # ochenta y seis.
  hoja <- .madc_pestana_de_la_distribucion(id, titulos)
  if (!nzchar(hoja)) {
    stop_api(409, "E_AULAS_DISTRIBUCION_SIN_HOJA",
             paste("El Sheets de la distribución no trae ninguna pestaña con forma de",
                   "distribución: hace falta una con las columnas CURSO-HORARIO y FECHA."))
  }
  props <- list()
  for (h in hojas) {
    if (identical(.monitoreo_scalar((h$properties %||% list())$title, ""), hoja)) props <- h
  }
  sheet_id <- suppressWarnings(as.integer((props$properties %||% list())$sheetId))
  ancho <- suppressWarnings(as.integer(
    ((props$properties %||% list())$gridProperties %||% list())$columnCount))
  reglas_vivas <- length(props$conditionalFormats %||% list())

  remoto <- tryCatch(.cads_valores_de_pestana(id, hoja), error = function(e) {
    stop_api(502, "E_GOOGLE_SHEETS",
             paste("No se pudo leer la pestaña de la distribución:", conditionMessage(e)))
  })
  cab <- .madm_cabecera(remoto)
  .madm_exigir_legible(cab)

  # 1 · lo que el coordinador decidió, para que el motor deje de reordenarlo.
  fij <- monitoreo_aulas_fijaciones_desde_distribucion(remoto, plan, roster)
  # 2 · las agendadas que no tienen cita, y dónde entra cada una.
  faltan <- monitoreo_aulas_agendadas_sin_cita(plan, remoto, desde = desde, hasta = hasta)
  inserciones <- monitoreo_aulas_posiciones_de_las_nuevas(remoto, faltan$faltantes)
  # 3 · el ESTADO que la plataforma demuestra, sin pisar lo tecleado.
  est <- monitoreo_aulas_estados_distribucion(
    remoto, aplicadas = aplicadas, fecha_agenda = .madm_fechas_de_la_agenda(plan)
  )

  # La hoja como quedaría: las filas de siempre con las nuevas metidas en su
  # sitio. Se construye aquí y no se relee después porque es lo que decide el
  # rango del ESTADO y el del formato, y releer abriría una ventana en la que
  # alguien podría estar escribiendo.
  por_posicion <- inserciones[order(vapply(inserciones, function(x) x$posicion, numeric(1)))]
  n_orig <- length(remoto)
  final_filas <- list(); final_estados <- character(0); k <- 1L
  emitir_nuevas <- function(r) {
    while (k <= length(por_posicion) && por_posicion[[k]]$posicion == r) {
      final_filas[[length(final_filas) + 1L]] <<- por_posicion[[k]]$fila
      final_estados <<- c(final_estados, "POR APLICAR")
      k <<- k + 1L
    }
  }
  for (r in seq_len(max(1L, n_orig))) {
    emitir_nuevas(r)
    if (r <= n_orig) {
      final_filas[[length(final_filas) + 1L]] <- remoto[[r]]
      final_estados <- c(final_estados, if (r == 1L) "ESTADO" else est$estados[[r - 1L]])
    }
  }
  emitir_nuevas(n_orig + 1L)

  # Quién queda sin nombre: las filas nuevas nacen así a propósito, y de las
  # viejas hay las que el coordinador aún no ha repartido. Es la frase con la
  # que termina la acción.
  c_estado <- .madm_col(cab, "ESTADO")
  col_estado <- if (is.na(c_estado)) which(.alpa_CABECERA == "ESTADO")[[1L]] else c_estado
  c_quien <- .madm_col(cab, "APLICADOR")
  c_cod <- .madm_col(cab, "CURSO-HORARIO")
  c_fecha <- .madm_col(cab, "FECHA")
  sin_aplicador <- list()
  for (f in final_filas[-1L]) {
    v <- .madc_valores(f, length(.alpa_CABECERA))
    if (nzchar(.madm_celda(v, c_quien))) next
    sin_aplicador[[length(sin_aplicador) + 1L]] <- list(
      curso_horario = .madm_celda(v, c_cod), fecha = .madm_celda(v, c_fecha)
    )
  }

  recibo <- list(
    ok = TRUE,
    aplicado = FALSE,
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    hoja = hoja,
    citas_antes = max(0L, n_orig - 1L),
    citas_despues = max(0L, length(final_filas) - 1L),
    anadidas = faltan$faltantes,
    descartadas = faltan$descartadas,
    estado = list(cambios = est$cambios, conflictos = est$conflictos),
    fijaciones = fij$fijadas,
    fijaciones_no_reconocidas = list(
      aplicadores = fij$aplicadores_desconocidos,
      codigos = fij$codigos_desconocidos
    ),
    sin_aplicador = sin_aplicador,
    ventana = faltan$ventana,
    # La columna que el equipo teclea: si la hoja aún no la tiene, esta acción
    # la crea en su sitio con su desplegable y sus colores.
    columna_estado_nueva = is.na(c_estado)
  )
  if (!isTRUE(aplicar)) return(recibo)

  # --- el acto ---------------------------------------------------------------
  #
  # Nada de esto borra una celda escrita: se insertan filas nuevas y se
  # reescribe UNA columna, la del ESTADO, con lo que el equipo tecleó ya
  # respetado dentro.
  if (is.finite(ancho) && ancho < length(.alpa_CABECERA)) {
    # La rejilla tiene exactamente las columnas que se sembraron; escribir en la
    # de más allá rebota con «exceeds grid limits» sin tocar nada.
    .monitoreo_sheets_batch_update(id, list(list(updateSheetProperties = list(
      properties = list(sheetId = sheet_id, gridProperties = list(
        columnCount = as.integer(length(.alpa_CABECERA)))),
      fields = "gridProperties.columnCount"))))
  }

  if (length(por_posicion)) {
    # De arriba abajo con su desplazamiento: la k-ésima entra una fila más
    # abajo por cada una ya insertada encima. `inheritFromBefore` es lo que hace
    # que la fila nueva nazca con el desplegable y el color de la de arriba.
    reqs <- lapply(seq_along(por_posicion), function(k) {
      fila <- as.integer(por_posicion[[k]]$posicion + (k - 1L))
      list(insertDimension = list(
        range = list(sheetId = sheet_id, dimension = "ROWS",
                     startIndex = fila - 1L, endIndex = fila),
        inheritFromBefore = TRUE))
    })
    .monitoreo_sheets_batch_update(id, reqs)
    datos <- lapply(seq_along(por_posicion), function(k) {
      fila <- as.integer(por_posicion[[k]]$posicion + (k - 1L))
      list(range = sprintf("%s!A%d", .monitoreo_sheets_quote_sheet(hoja), fila),
           majorDimension = "ROWS", values = list(por_posicion[[k]]$fila))
    })
    .madm_escribir(id, datos)
  }

  celdas_estado <- 0L
  if (length(final_estados)) {
    # `.madm_col()` devuelve NA cuando la columna no existe todavía —el
    # documento del operativo vivió dos días sin ella—: entonces se escribe en
    # el sitio que ESTADO ocupa en el vocabulario, que es donde la publicación
    # la pondría, y el recibo dice que se creó.
    letra <- .madm_letra(col_estado)
    rango <- sprintf("%s!%s1:%s%d", .monitoreo_sheets_quote_sheet(hoja),
                     letra, letra, length(final_estados))
    celdas_estado <- .madm_escribir(id, list(list(
      range = rango, majorDimension = "COLUMNS", values = list(as.list(final_estados)))))
  }

  # El formato de la app, reaplicado sobre el rango nuevo.
  #
  # **Las reglas condicionales se borran antes de reemitirse.** `addConditionalFormatRule`
  # no es idempotente: correrlo dos veces deja las reglas duplicadas —ya pasó,
  # ocho donde debían ser cuatro— y con el rango viejo, así que las filas
  # añadidas al final del documento se quedaban sin color. Se borran las de ESTA
  # pestaña, que son las que la app puso al publicarla y al ponerle la columna
  # de estado, y se vuelven a emitir sobre el rango completo.
  reqs <- list()
  if (reglas_vivas > 0L) {
    reqs <- lapply(seq_len(reglas_vivas), function(i) list(
      deleteConditionalFormatRule = list(sheetId = sheet_id, index = 0L)))
  }
  reqs <- c(reqs, aulas_libro_plan_aplicadores_formato_requests(
    sheet_id, final_filas, roster = as.list(roster[nzchar(roster)])))
  .monitoreo_sheets_batch_update(id, reqs)

  recibo$aplicado <- TRUE
  recibo$celdas_estado <- celdas_estado
  recibo$reglas_reemitidas <- TRUE
  recibo
}

# --- A6 · montaje HTTP --------------------------------------------------------
#
# Vive aquí y no en `router_monitoreo.R`, que está congelado a crecimiento, ni
# en `monitoreo_aulas_publicar_libro.R`, que ya lleva las tres rutas del ciclo:
# ésta es la cuarta y es de otro oficio —mantiene el documento, no lo publica—.
# Se registra en `plumber_app.R` fuera de modo público: escribe en un servicio
# externo y muta la config.

#' Los códigos que constan aplicados, con la definición única del operativo.
#'
#' Existía tres veces escrita a mano —en la hoja de los aplicadores, en el
#' refresco del estado y en un script— y las tres tenían que coincidir para que
#' el ESTADO del Sheets y la Base de control dijeran lo mismo. Ahora es una.
#'
#' @param plan filas del plan.
#' @param partes partes de campo.
#' @param efectivas efectivas por código (plataforma).
#' @return vector de códigos operativos.
#' @export
monitoreo_aulas_codigos_aplicados <- function(plan, partes = list(), efectivas = NULL) {
  unidades <- .madm_unidades(plan)
  if (!length(unidades)) return(character(0))
  marca <- tryCatch(
    monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas),
    error = function(e) rep(FALSE, length(unidades))
  )
  cods <- vapply(unidades, function(u) .alpa_txt(u[["operational_code"]]), character(1))
  unique(cods[nzchar(cods) & vapply(seq_along(cods), function(i) isTRUE(marca[[i]]), logical(1))])
}

#' Monta la ruta de mantenimiento de la distribución.
#' @param pr router de plumber.
#' @return el router.
#' @export
mount_monitoreo_aulas_distribucion <- function(pr) {
  pr |>
    # **La acción única del ciclo diario.**
    #
    # Encadena los cuatro pasos que hasta hoy se hacían a mano y termina
    # diciendo lo que importa: cuántas agendadas no tienen a nadie asignado.
    # Sin `aplicar` es un ensayo y no escribe nada.
    plumber::pr_post("/api/monitoreo/aulas/sincronizar-distribucion", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data.frame())
      aulas_cfg <- cfg$aulas_universitarias %||% monitoreo_aulas_default_config()

      destino <- .monitoreo_scalar(
        parsed[["url"]] %||% parsed[["spreadsheet_id"]] %||% parsed[["enlace"]], "")
      if (!nzchar(destino)) {
        destino <- .monitoreo_scalar(
          (aulas_cfg[["distribucion_sheets"]] %||% list())[["spreadsheet_id"]], "")
      }
      if (!nzchar(destino)) {
        stop_api(409, "E_AULAS_DISTRIBUCION_SIN_DESTINO",
                 paste("No hay Sheets de la distribución que sincronizar: créalo desde la",
                       "app o pega su enlace una vez."))
      }

      plan <- s[["monitoreo_aulas_plan"]] %||% aulas_cfg[["plan"]] %||% list()
      partes <- aulas_cfg[["partes_campo"]] %||% s[["monitoreo_aulas_partes_campo"]] %||% list()
      # Las efectivas de PLATAFORMA, que son las que demuestran que un aula se
      # aplicó. El parte es la otra cuenta y llega por `partes`.
      efectivas <- tryCatch(
        monitoreo_aulas_efectivas_por_aula(plan, (s$monitoreo_snapshot %||% list())$data, aulas_cfg),
        error = function(e) NULL
      )
      roster <- vapply(s[["monitoreo_aulas_disponibilidad"]] %||% list(), function(x) {
        aulas_nombre_aplicador(x[["nombre"]] %||% x[["aplicador"]] %||% x)
      }, character(1))

      aplicar <- isTRUE(.monitoreo_bool(parsed[["aplicar"]] %||% parsed[["apply"]], FALSE))

      # **La ventana por defecto es la del REPARTO, no «todo».** Sin esto, una
      # llamada sin fechas proponía añadir a la hoja del coordinador las 28
      # aulas de las semanas 2 a 4 que el reparto aplaza a propósito. Medido
      # sobre el operativo el 2026-09-08: sin acotar salían 28 y con el rango
      # del reparto salen 0, que es la verdad de ese día.
      desde <- .monitoreo_scalar(parsed[["desde"]] %||% parsed[["from"]], "")
      hasta <- .monitoreo_scalar(parsed[["hasta"]] %||% parsed[["to"]], "")
      if (!nzchar(desde) && !nzchar(hasta)) {
        rep <- tryCatch(
          monitoreo_aulas_reparto(
            plan, s[["monitoreo_aulas_disponibilidad"]],
            fijadas = aulas_cfg[["reparto_fijado"]] %||% list(),
            duracion_min = aulas_cfg[["duracion_aplicacion_min"]] %||% 30L,
            rango = aulas_cfg[["reparto_rango"]],
            semilla = aulas_cfg[["reparto_semilla"]] %||% 0L
          ),
          error = function(e) NULL
        )
        ventana <- .madm_ventana_del_reparto(rep)
        desde <- ventana$desde
        hasta <- ventana$hasta
      }

      out <- monitoreo_aulas_sincronizar_distribucion(
        destino, plan = plan,
        aplicadas = monitoreo_aulas_codigos_aplicados(plan, partes, efectivas),
        roster = roster,
        desde = desde, hasta = hasta,
        aplicar = aplicar
      )

      # **Adoptar es parte del acto, no un paso aparte.** El ciclo entero pierde
      # sentido si la app añade filas y sigue reordenando las de él en la
      # publicación siguiente: lo que el coordinador decidió queda fijado en la
      # misma llamada que respeta su hoja.
      if (aplicar && length(out$fijaciones)) {
        aulas_cfg[["reparto_fijado"]] <- out$fijaciones
        cfg[["aulas_universitarias"]] <- monitoreo_aulas_normalize_config(aulas_cfg)
        cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = TRUE)
        .monitoreo_mark_project_dirty_if_open(sid)
      }
      c(out, list(
        # La frase con la que termina la jornada, ya redactada: quien llama no
        # tiene que contar listas para saber si puede irse a casa.
        resumen = monitoreo_aulas_sincronizacion_texto(out),
        state = if (aplicar) .monitoreo_state_payload(sid) else NULL
      ))
    }))
}

#' El recibo de la sincronización, en una frase.
#'
#' Termina siempre por lo que decide si la jornada está cerrada: cuántas citas
#' no tienen a nadie. Un cero se dice, no se omite — omitirlo deja al que lee
#' sin saber si es que no hay o si es que no se miró.
#'
#' @param out salida de `monitoreo_aulas_sincronizar_distribucion()`.
#' @return una cadena.
#' @export
monitoreo_aulas_sincronizacion_texto <- function(out) {
  out <- out %||% list()
  n_add <- length(out$anadidas %||% list())
  n_est <- length((out$estado %||% list())$cambios %||% list())
  n_sin <- length(out$sin_aplicador %||% list())
  n_con <- length((out$estado %||% list())$conflictos %||% list())
  hecho <- isTRUE(out$aplicado)
  partes <- c(
    if (n_add) sprintf("%s %d aula%s agendada%s que no tenía cita",
                       if (hecho) "Se añadieron" else "Se añadirían", n_add,
                       if (n_add == 1L) "" else "s", if (n_add == 1L) "" else "s"),
    if (n_est) sprintf("%s el estado de %d fila%s", if (hecho) "se actualizó" else "se actualizaría",
                       n_est, if (n_est == 1L) "" else "s"),
    if (n_con) sprintf("%d fila%s marcada%s RECHAZADA tiene%s respuestas en plataforma y no se tocó",
                       n_con, if (n_con == 1L) "" else "s", if (n_con == 1L) "" else "s",
                       if (n_con == 1L) "" else "n")
  )
  cabeza <- if (!length(partes)) {
    if (hecho) "No hizo falta cambiar nada." else "No haría falta cambiar nada."
  } else {
    paste0(paste(partes, collapse = "; "), ".")
  }
  cola <- if (n_sin == 0L) {
    "Todas las citas tienen aplicador."
  } else {
    sprintf("Quedan %d cita%s sin aplicador: %s.", n_sin, if (n_sin == 1L) "" else "s",
            paste(vapply(out$sin_aplicador, function(x) {
              sprintf("%s (%s)", x$curso_horario, x$fecha)
            }, character(1)), collapse = ", "))
  }
  paste(cabeza, cola)
}
