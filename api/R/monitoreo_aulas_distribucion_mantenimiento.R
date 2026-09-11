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
# «APLICADA SIN AGENDACIÓN» entra aquí desde el 2026-09-10: es un aula RENDIDA
# y saltarla es justo el punto de esta lista. Sin ella, la fila que aplicaron sin
# cita se reportaba como desalineada —«sin_plan» o «ya_no_agendada»— y el recibo
# pedía atención sobre algo que ya estaba hecho. «POR APLICAR SIN AGENDACIÓN» NO
# entra: ésa todavía no ha rendido.
.madm_APLICADOS <- c("APLICADA", "APLICADA POR REAGENDACIÓN", "APLICADA SIN AGENDACIÓN")

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

#' ¿Hay que guardar el enlace de la distribución, o ya está guardado?
#'
#' Se guarda la PRIMERA vez que la hoja se deja leer —ensayo incluido— y no se
#' vuelve a pisar: un destino ya recordado es una decisión del usuario, y
#' reescribirlo en cada sincronización lo cambiaría en silencio si alguien pasa
#' otro enlace de paso para mirar una semana distinta.
#'
#' @param aulas_cfg la config de aulas.
#' @return `TRUE` cuando todavía no hay destino recordado.
#' @keywords internal
.madm_falta_recordar_destino <- function(aulas_cfg) {
  id <- .monitoreo_scalar(
    ((aulas_cfg %||% list())[["distribucion_sheets"]] %||% list())[["spreadsheet_id"]], "")
  !nzchar(trimws(id))
}

# --- A2b · qué citas escritas ya no tienen agenda ----------------------------

#' Las citas de la hoja cuya aula ya no está agendada para ese día.
#'
#' Es la pregunta INVERSA de `monitoreo_aulas_agendadas_sin_cita()`, y es la
#' cara cara de las dos: aquélla deja un aula sin nadie, ésta manda a alguien al
#' campus por un aula que se movió. El 2026-09-09, con las dos hojas leídas en
#' vivo, había dos: CH 12 seguía citado el 07/09 con la agenda ya en el 14/09, y
#' CH 74 igual con la suya en el 09/09. Ninguna de las dos la veía nadie:
#' `monitoreo_aulas_filas_dudosas()` mira la hoja SOLA y esas fechas caen dentro
#' de su semana, así que para ella no tienen nada de raro; sólo se ven cruzando
#' con la agenda.
#'
#' Tres motivos, y el detalle dice siempre a qué atenerse:
#'
#' - `aula_movida` — la agenda la tiene agendada, pero en OTRA fecha. El detalle
#'   trae la fecha nueva. Es la reagendación que dejó su fila vieja detrás.
#' - `ya_no_agendada` — el aula sigue en el plan y su status ya no es
#'   `agendada` ni `reagendada` (una rechazada, por ejemplo). El detalle trae el
#'   status de hoy.
#' - `sin_plan` — el curso-horario no aparece en el plan. Puede ser una fila
#'   tecleada a mano con el código mal escrito.
#'
#' **Lo aplicado NO entra**, y se reconoce por DOS sitios porque el estado de
#' aplicación no vive en el plan: la columna ESTADO de la propia fila (que es lo
#' que `monitoreo_aulas_estados_distribucion()` mantiene) y los códigos que
#' llegan en `aplicadas`. El `sample_status` del plan NUNCA dice «aplicada»
#' —su vocabulario es `sin_contactar`, `en_contacto`, `agendada`, `reagendada`,
#' `rechazo`, `en_reserva`, `reemplazada`—, así que buscarlo ahí es mirar donde
#' no está. Una cita cuya aula ya se aplicó cumplió su función y su fila es el
#' registro de que alguien fue; llamarla huérfana diría que sobra justo la fila
#' que prueba el trabajo hecho.
#'
#' **Y esto no borra ni propone borrar nada.** Son filas del coordinador: la
#' hoja las dice y él decide. Quitar una fila por nuestra cuenta es decidir por
#' él sobre su fila, que es la misma razón por la que `dudosas` tampoco toca.
#'
#' @param plan filas del plan.
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param aplicadas códigos operativos que constan aplicados.
#' @param desde,hasta ventana de fechas ISO; `""` no acota.
#' @return lista de `{fila, curso_horario, fecha, motivo, detalle}`.
#' @export
monitoreo_aulas_citas_sin_agenda <- function(plan, filas_remotas,
                                             aplicadas = character(0),
                                             desde = "", hasta = "") {
  cab <- .madm_cabecera(filas_remotas)
  .madm_exigir_legible(cab)
  c_cod <- .madm_col(cab, "CURSO-HORARIO")
  c_fecha <- .madm_col(cab, "FECHA")
  c_estado <- .madm_col(cab, "ESTADO")
  # `.alpa_txt()` es ESCALAR (toma `[1]`): usarlo aquí colapsaba la lista a su
  # primer código y las demás aulas aplicadas salían declaradas huérfanas.
  aplicadas <- unique(trimws(as.character(aplicadas %||% character(0))))
  d0 <- .mav_fecha(desde); d1 <- .mav_fecha(hasta)

  # La agenda de hoy, por curso-horario. Un código repetido en el plan (titular
  # y su reserva comparten nada, pero el plan puede traer la misma fila dos
  # veces) se queda con la PRIMERA: leer dos veces el mismo código y quedarse
  # con la última haría depender la respuesta del orden del plan.
  agenda <- list()
  for (u in .madm_unidades(plan)) {
    cod <- .alpa_txt(u[["operational_code"]])
    if (!nzchar(cod) || !is.null(agenda[[cod]])) next
    agenda[[cod]] <- list(
      fecha = .mav_fecha(u[["scheduled_date"]]),
      estado = monitoreo_aulas_estado_muestra(u[["sample_status"]])
    )
  }

  filas <- if (length(filas_remotas) > 1L) filas_remotas[-1L] else list()
  salida <- list()
  for (i in seq_along(filas)) {
    v <- .madc_valores(filas[[i]], length(.alpa_CABECERA))
    cod <- .madm_celda(v, c_cod)
    if (!nzchar(cod)) next                      # eso lo dice `filas_dudosas`
    fecha <- .madm_fecha_de_la_hoja(.madm_celda(v, c_fecha), desde)
    if (!nzchar(fecha)) next                    # ídem: fecha ilegible es suya
    if (nzchar(d0) && fecha < d0) next
    if (nzchar(d1) && fecha > d1) next
    if (cod %in% aplicadas) next
    # Por el canónico: el desplegable de la hoja tenía «APLICADA SIN AGENDACION»
    # sin tilde, y comparar en crudo la habría dejado fuera de la lista.
    if (aulas_distribucion_estado_canonico(.madm_celda(v, c_estado)) %in% .madm_APLICADOS) next

    a <- agenda[[cod]]
    if (is.null(a)) {
      salida[[length(salida) + 1L]] <- list(
        fila = i + 1L, curso_horario = cod, fecha = fecha,
        motivo = "sin_plan", detalle = "")
      next
    }
    if (!(a$estado %in% .madm_AGENDADOS)) {
      salida[[length(salida) + 1L]] <- list(
        fila = i + 1L, curso_horario = cod, fecha = fecha,
        motivo = "ya_no_agendada", detalle = a$estado)
      next
    }
    if (nzchar(a$fecha) && !identical(a$fecha, fecha)) {
      salida[[length(salida) + 1L]] <- list(
        fila = i + 1L, curso_horario = cod, fecha = fecha,
        motivo = "aula_movida", detalle = a$fecha)
    }
  }
  salida
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
  cambios <- list(); observaciones <- list()
  aplicadas <- as.character(aplicadas %||% character(0))

  for (i in seq_len(n)) {
    v <- .madc_valores(filas[[i]], length(.alpa_CABECERA))
    cod <- .madm_celda(v, c_cod)
    previo <- toupper(trimws(.madm_celda(v, c_estado)))
    previos[[i]] <- previo

    # **La celda escrita se conserva SIEMPRE. La app sólo siembra la vacía.**
    #
    # Es la regla de Gonzalo, textual (2026-09-09): «el status de aplicada es
    # manual y lo hace el aplicador, no la app; la app solo pone por defecto POR
    # APLICAR al construir, punto».
    #
    # Antes la app PROPONÍA el estado y lo escribía cuando le parecía un
    # ascenso: si un código constaba aplicado —por plataforma o por parte de
    # campo— ponía APLICADA, y si la fecha se había movido ponía REAGENDADA. Eso
    # convirtió una columna de la persona en una columna de la app, y el daño se
    # vio el mismo día: CH 111 y CH 82, agendadas para el VIERNES 11 y con cero
    # respuestas, quedaron marcadas APLICADA porque un parte de campo estaba
    # tecleado en la fila de al lado. La hoja que el equipo lee para saber a
    # dónde ir decía que dos aulas del futuro ya estaban hechas, y alguien podía
    # dejar de ir.
    #
    # Lo que la app sabe NO se pierde: sigue saliendo en el recibo como
    # observación, que es donde una discrepancia se lee sin que nadie la
    # escriba encima.
    # **Se repara la GRAFÍA, nunca el significado** (Gonzalo, 2026-09-10: «dale
    # con la 2»). El desplegable declara «APLICADA SIN AGENDACIÓN» con tilde y
    # la celda de CH164 la tenía sin ella: Sheets la marcaba «Entrada no válida»
    # aunque el estado fuera el correcto y el color le saliera bien. Escribir la
    # forma canónica del MISMO estado que el equipo eligió no es decidir por
    # nadie: es dejar de marcar en rojo algo que está bien.
    #
    # Un valor que no case con ninguno de los siete se queda EXACTAMENTE como
    # está: ahí la app no sabe qué quiso decir, y adivinar sería lo contrario de
    # reparar.
    canonico <- aulas_distribucion_estado_canonico(previo)
    final <- if (!nzchar(previo)) "POR APLICAR" else if (nzchar(canonico)) canonico else previo
    estados[[i]] <- final
    if (!identical(final, previo)) {
      cambios[[length(cambios) + 1L]] <- list(
        curso_horario = cod, fila = i + 1L, antes = previo, ahora = final
      )
    }

    # Lo que la app ve y la fila no dice. Se OBSERVA, no se escribe.
    dicha <- .madm_celda(v, c_fecha)
    iso_agenda <- if (nzchar(cod) && cod %in% names(fecha_agenda)) {
      .mav_fecha(fecha_agenda[[cod]])
    } else {
      ""
    }
    corta_agenda <- if (nzchar(iso_agenda)) .alpa_dia_y_fecha(iso_agenda)$fecha else ""
    if (nzchar(dicha) && nzchar(corta_agenda) && !identical(dicha, corta_agenda)) {
      observaciones[[length(observaciones) + 1L]] <- list(
        curso_horario = cod, fila = i + 1L, motivo = "fecha_movida",
        detalle = sprintf("la agenda la tiene el %s", corta_agenda)
      )
    }
    if (nzchar(cod) && cod %in% aplicadas && !(previo %in% .madm_APLICADOS)) {
      observaciones[[length(observaciones) + 1L]] <- list(
        curso_horario = cod, fila = i + 1L, motivo = "consta_aplicada",
        detalle = if (nzchar(previo)) sprintf("la fila dice %s", previo) else "la fila está vacía"
      )
    }
  }
  # `conflictos` se conserva en el retorno por compatibilidad de los llamadores;
  # con la regla nueva no puede haber conflicto de ESCRITURA, porque la app ya
  # no escribe sobre lo tecleado. Lo que había ahí ahora vive en `observaciones`.
  list(estados = estados, previos = previos, cambios = cambios,
       conflictos = list(), observaciones = observaciones)
}

# --- A4b · las filas que YA están y no cuadran -------------------------------
#
# El motor revisa lo que falta y lo que se puede demostrar, y no miraba lo que ya
# está escrito. Dos defectos vivían en la hoja del operativo desde el 08/09 sin
# que nadie los viera hasta que alguien se puso a mirar:
#
#   · CH 74 con la fecha tecleada «9:09» en vez de «09/09». No parsea, así que
#     esa cita no cae en ningún día: ni se ordena, ni entra en la cuenta del día,
#     ni la ve el que reparte.
#   · CH 12 conservando su fila del lunes en la pestaña «Semana 1» después de
#     reagendarse al 14/09, que es de la semana siguiente.
#
# NO SE CORRIGEN AQUÍ. Son datos del coordinador y arreglarlos por nuestra cuenta
# es decidir por él sobre una fila que él escribió; lo que faltaba es que la app
# los DIGA.

#' La fecha corta de la hoja («09/09») como ISO, con el año de la ventana.
#'
#' La columna FECHA no lleva año —así la escribe el motor y así la teclea el
#' equipo— y sin un año no hay nada que comparar. Se toma el de `desde`, que es
#' el rango que rige esa hoja; sin ventana no se puede situar y se declara.
#' @keywords internal
.madm_fecha_de_la_hoja <- function(corta, desde) {
  v <- .alpa_txt(corta)
  if (!nzchar(v)) return("")
  if (grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", v)) return(.mav_fecha(v))
  m <- regmatches(v, regexec("^([0-9]{1,2})/([0-9]{1,2})$", v))[[1]]
  if (length(m) != 3L) return("")
  anio <- substr(.mav_fecha(desde), 1L, 4L)
  if (!nzchar(anio)) return("")
  iso <- sprintf("%s-%02d-%02d", anio, as.integer(m[[3L]]), as.integer(m[[2L]]))
  .mav_fecha(iso)
}

#' ¿La celda tiene FORMA de fecha, aunque no se pueda situar?
#'
#' «11/09» es una fecha a la que le falta el año, no un texto ilegible. La
#' distinción parece de matiz y no lo es: `monitoreo_aulas_filas_dudosas()`
#' pasaba la propia celda como `desde` cuando no había ventana, así que
#' `.madm_fecha_de_la_hoja("11/09", "11/09")` no encontraba año y devolvía "" —
#' y las 93 filas de la hoja salían marcadas `fecha_ilegible` a la vez.
#' Un aviso que señala TODAS las filas no señala ninguna.
#' @keywords internal
.madm_tiene_forma_de_fecha <- function(corta) {
  v <- .alpa_txt(corta)
  nzchar(v) && (grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", v) ||
                  grepl("^[0-9]{1,2}/[0-9]{1,2}$", v))
}

#' Las filas escritas que no cuadran, dichas una por una.
#'
#' Tres cosas, y ninguna se toca:
#'
#' - `fecha_ilegible` — la celda tiene algo y no es una fecha. Una cita así no
#'   cae en ningún día: no se ordena, no cuenta y no la ve quien reparte.
#' - `fuera_de_la_semana` — la fecha es legible y cae fuera del rango que rige
#'   la hoja. Es la reagendación que se movió de semana y dejó su fila vieja.
#' - `sin_curso_horario` — la fila tiene contenido y no dice de qué aula habla,
#'   así que es invisible para todo lo demás.
#'
#' @param filas_remotas los valores de la hoja (cabecera incluida).
#' @param desde,hasta la ventana que rige la hoja; sin ella sólo se revisa lo
#'   que no depende del rango.
#' @return lista de `{fila, curso_horario, motivo, valor}`.
#' @export
monitoreo_aulas_filas_dudosas <- function(filas_remotas, desde = "", hasta = "") {
  cab <- .madm_cabecera(filas_remotas)
  .madm_exigir_legible(cab)
  c_cod <- .madm_col(cab, "CURSO-HORARIO")
  c_fecha <- .madm_col(cab, "FECHA")
  d0 <- .mav_fecha(desde); d1 <- .mav_fecha(hasta)
  filas <- if (length(filas_remotas) > 1L) filas_remotas[-1L] else list()

  salida <- list()
  anotar <- function(i, cod, motivo, valor) {
    salida[[length(salida) + 1L]] <<- list(
      fila = i + 1L, curso_horario = cod, motivo = motivo, valor = valor)
  }
  for (i in seq_along(filas)) {
    v <- .madc_valores(filas[[i]], length(.alpa_CABECERA))
    if (!any(nzchar(v))) next
    cod <- .madm_celda(v, c_cod)
    dicha <- .madm_celda(v, c_fecha)
    if (!nzchar(cod)) { anotar(i, "", "sin_curso_horario", dicha); next }
    if (!nzchar(dicha)) next
    # **Sin ventana no se pasa la propia celda como año.** «11/09» no puede
    # aportar el año que le falta, así que aquello devolvía "" para TODAS las
    # filas y las marcaba ilegibles en bloque. Sin `desde` no hay año que
    # aplicar y una fecha corta bien escrita no es dudosa: es una fecha que
    # esta llamada no puede situar, y eso no es un defecto de la hoja.
    if (!nzchar(d0)) {
      # Sin ventana no hay año que aplicar, así que sólo se puede juzgar la
      # FORMA. Una fecha corta bien escrita no es dudosa: es una fecha que esta
      # llamada no puede situar, y eso no es un defecto de la hoja.
      if (!.madm_tiene_forma_de_fecha(dicha)) anotar(i, cod, "fecha_ilegible", dicha)
      next
    }
    # Con ventana se intenta situar de verdad, y lo que no se sitúa cae —tenga
    # o no forma de fecha: «45/13» encaja en el patrón y no existe.
    iso <- .madm_fecha_de_la_hoja(dicha, d0)
    if (!nzchar(iso)) { anotar(i, cod, "fecha_ilegible", dicha); next }
    if (nzchar(d0) && nzchar(d1) && (iso < d0 || iso > d1)) {
      anotar(i, cod, "fuera_de_la_semana", dicha)
    }
  }
  salida
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
#' y no borra ninguna. Añade filas, actualiza el ESTADO y pone el AULA al día
#' con el libro; el resto es del coordinador. El aula entra en la lista porque
#' no es dato suyo —la pacta quien agenda, en LUGAR DE APLICACIÓN— y una copia
#' vieja manda a alguien al aula equivocada.
#'
#' @param spreadsheet_id id o enlace del documento de la distribución.
#' @param plan filas del plan.
#' @param aplicadas códigos que constan aplicados.
#' @param roster nombres del equipo, para poder adoptar y para el desplegable.
#' @param desde,hasta ventana de fechas ISO de las aulas que se añaden. **Sin
#'   ventana entra TODO lo agendado**, que casi nunca es lo que se quiere: ver
#'   la nota de `.madm_ventana_del_reparto()`.
#' @param aplicar `TRUE` escribe; por defecto es un ensayo.
#' @return lista `{ok, aplicado, hoja, anadidas, estado, aulas, fijaciones,
#'   sin_aplicador, …}`.
#' @export
monitoreo_aulas_sincronizar_distribucion <- function(spreadsheet_id,
                                                     plan = list(),
                                                     aplicadas = character(0),
                                                     roster = character(0),
                                                     desde = "", hasta = "",
                                                     aplicar = FALSE,
                                                     fijadas_guardadas = list()) {
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
  hojas_dist <- .madc_pestanas_de_la_distribucion(id, titulos)
  hoja <- if (length(hojas_dist)) hojas_dist[[1L]] else ""
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

  # **Las fijaciones se adoptan de TODAS las semanas, no sólo de la primera
  # pestaña.** `remoto` es la hoja sobre la que esta función además ESCRIBE —de
  # ahí salen su `sheet_id`, su ancho y sus reglas—, pero lo que el coordinador
  # decidió vive repartido en las pestañas semanales. Adoptar sólo una deja las
  # decisiones de las demás sin fijar, y el reparto se las reordena en la
  # siguiente corrida: es el mismo daño que la adopción existe para evitar.
  remoto_todas <- remoto
  for (h in hojas_dist[-1L]) {
    v <- tryCatch(.cads_valores_de_pestana(id, h), error = function(e) list())
    if (length(v) > 1L) remoto_todas <- c(remoto_todas, v[-1L])
  }

  # 1 · lo que el coordinador decidió, para que el motor deje de reordenarlo.
  fij <- monitoreo_aulas_fijaciones_desde_distribucion(remoto_todas, plan, roster)
  # Y en qué se quedó atrás la adopción vigente. Sale de lo que YA se leyó: ni
  # un request más. Es el aviso que faltaba el 2026-09-09, cuando la app llevaba
  # 86 fijaciones viejas y once citas habían cambiado de nombre en la hoja.
  desfase <- tryCatch(
    monitoreo_aulas_fijaciones_desfasadas(fijadas_guardadas, fij$fijadas),
    error = function(e) NULL
  )
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

  # 4 · el aula que el libro pacta, sobre las filas como van a quedar. Va
  # DESPUÉS de intercalar las nuevas porque se escribe como una columna entera
  # y su rango tiene que ser el mismo que el del ESTADO.
  aulas <- tryCatch(monitoreo_aulas_aulas_distribucion(final_filas, plan),
                    error = function(e) NULL)

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
    # `observaciones` es lo que la app VE y ya no escribe: un código que consta
    # aplicado con la fila diciendo otra cosa, o una cita en un día que no es el
    # de su agenda. Desde que el ESTADO es de la persona, decirlo es todo lo que
    # la app puede hacer, y callarlo dejaría el desajuste sin dueño.
    estado = list(cambios = est$cambios, conflictos = est$conflictos,
                  observaciones = est$observaciones %||% list()),
    fijaciones = fij$fijadas,
    # **En qué se quedó atrás lo adoptado.** Sólo `cambiadas` contradice a la
    # app; nuevas y retiradas se declaran y no encienden nada.
    fijaciones_desfasadas = list(
      hay = isTRUE((desfase %||% list())$hay),
      cambiadas = (desfase %||% list())$cambiadas %||% list(),
      nuevas = (desfase %||% list())$nuevas %||% list(),
      retiradas = (desfase %||% list())$retiradas %||% list()
    ),
    fijaciones_no_reconocidas = list(
      aplicadores = fij$aplicadores_desconocidos,
      codigos = fij$codigos_desconocidos
    ),
    sin_aplicador = sin_aplicador,
    # Lo que YA está escrito y no cuadra. No se toca: son datos del coordinador
    # y arreglarlos por nuestra cuenta es decidir por él sobre su fila.
    dudosas = tryCatch(
      monitoreo_aulas_filas_dudosas(remoto, desde = faltan$ventana$desde,
                                    hasta = faltan$ventana$hasta),
      error = function(e) list()
    ),
    # La inversa de `anadidas`, y la cara cara: una cita escrita cuya aula ya no
    # está agendada ese día manda a alguien al campus por un aula que se movió.
    # Va con la MISMA ventana que todo lo demás del recibo; sin acotar contesta
    # por semanas que esta hoja no rige.
    sin_agenda = tryCatch(
      monitoreo_aulas_citas_sin_agenda(plan, remoto, aplicadas = aplicadas,
                                       desde = faltan$ventana$desde,
                                       hasta = faltan$ventana$hasta),
      error = function(e) list()
    ),
    ventana = faltan$ventana,
    # La columna que el equipo teclea: si la hoja aún no la tiene, esta acción
    # la crea en su sitio con su desplegable y sus colores.
    columna_estado_nueva = is.na(c_estado),
    # **El aula la manda el libro, no esta hoja.** El ESTADO es del coordinador
    # y no se pisa; el aula la pacta quien agenda y aquí sólo vive una copia,
    # que envejece. Cada corrección viaja con su antes y su después.
    aulas = list(
      rellenadas = as.integer((aulas %||% list())[["rellenadas"]] %||% 0L),
      corregidas = as.integer((aulas %||% list())[["corregidas"]] %||% 0L),
      sin_dato = as.integer((aulas %||% list())[["sin_dato"]] %||% 0L),
      cambios = (aulas %||% list())[["cambios"]] %||% list()
    )
  )
  if (!isTRUE(aplicar)) return(recibo)

  # --- el acto ---------------------------------------------------------------
  #
  # Nada de esto borra una celda escrita: se insertan filas nuevas y se
  # reescriben DOS columnas —la del ESTADO, con lo que el equipo tecleó ya
  # respetado dentro, y la del AULA, que sigue al libro y nunca se blanquea.
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

  celdas_aula <- 0L
  columna_aula <- (aulas %||% list())[["columna"]]
  if (length(columna_aula) &&
      ((aulas[["rellenadas"]] + aulas[["corregidas"]]) > 0L)) {
    # Sólo si hay algo que cambiar: una escritura que reescribe la columna
    # idéntica gasta un request y ensucia el historial de revisiones de un
    # documento que veintidós personas tienen abierto.
    c_aula <- .madm_col(cab, "AULA")
    col_aula <- if (is.na(c_aula)) which(.alpa_CABECERA == "AULA")[[1L]] else c_aula
    letra <- .madm_letra(col_aula)
    celdas_aula <- .madm_escribir(id, list(list(
      range = sprintf("%s!%s1:%s%d", .monitoreo_sheets_quote_sheet(hoja),
                      letra, letra, length(columna_aula)),
      majorDimension = "COLUMNS", values = list(as.list(columna_aula)))))
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
  recibo$celdas_aula <- celdas_aula
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
        # Las fijaciones VIGENTES, para poder decir en qué se quedó atrás la
        # adopción sin salir otra vez a la red.
        fijadas_guardadas = aulas_cfg[["reparto_fijado"]] %||% list(),
        desde = desde, hasta = hasta,
        aplicar = aplicar
      )

      # **El destino se RECUERDA en cuanto la hoja se deja leer**, ensayo
      # incluido, y no sólo al aplicar.
      #
      # Sin esto, pegar el enlace aquí lo usaba y lo tiraba: la config seguía sin
      # `distribucion_sheets`, y entonces la lectura previa que publicar hace de
      # esa hoja salía `sin_destino` y no adoptaba nada. Visto en vivo el
      # 2026-09-09: se sincronizó con el enlace, se publicó a continuación y el
      # recibo dijo «adoptadas 0, motivo sin_destino».
      #
      # Y va en el ENSAYO porque de otro modo armar la red obligaba a escribir
      # en la hoja de 22 personas, que es exactamente lo que el ensayo existe
      # para no tener que hacer. Recordar aquí es seguro: sólo se llega si la
      # hoja se leyó de verdad, así que el enlace está probado — es la misma
      # doctrina con la que `publicar-libro` recuerda el suyo ANTES de escribir,
      # para que un fallo de red no pierda lo pegado.
      if (.madm_falta_recordar_destino(aulas_cfg)) {
        cfg <- monitoreo_aulas_distribucion_destino_set(cfg, destino)
        cfg <- .monitoreo_store_config(sid, cfg, rebuild_dashboard = FALSE)
        aulas_cfg <- cfg[["aulas_universitarias"]] %||% aulas_cfg
        .monitoreo_mark_project_dirty_if_open(sid)
      }

      # **Adoptar es parte del acto, no un paso aparte.** El ciclo entero pierde
      # sentido si la app añade filas y sigue reordenando las de él en la
      # publicación siguiente: lo que el coordinador decidió queda fijado en la
      # misma llamada que respeta su hoja. Esto SÍ es del acto: fijar el reparto
      # cambia lo que la app repartirá, y eso no se decide en un ensayo.
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
  n_dud <- length(out$dudosas %||% list())
  aulas <- out$aulas %||% list()
  n_rel <- as.integer(aulas$rellenadas %||% 0L)
  n_cor <- as.integer(aulas$corregidas %||% 0L)
  n_orf <- length(out$sin_agenda %||% list())
  hecho <- isTRUE(out$aplicado)
  # **Sin rango declarado, «lo que falta» es todo el horizonte.** El rango del
  # reparto es lo que acota esta acción, y cuando el config no lo trae la
  # ventana sale vacía y entran las semanas enteras que están aplazadas a
  # propósito. Medido el 2026-09-09 sobre el operativo: sin rango proponía
  # añadir 49 aulas de las semanas 2 a 4. No se inventa un rango —qué semana se
  # reparte lo decide el lead— pero se dice, porque proponerlas en silencio es
  # lo que hace que alguien las aplique sin querer.
  # **La ausencia del bloque `ventana` no es «sin rango».** Los recibos
  # anteriores al 2026-09-09 no lo traían y no por eso hay que disculparse por
  # ellos; el sincronizador SIEMPRE lo pone. Así que se avisa cuando el bloque
  # está y viene vacío, que es lo que de verdad significa «no hay rango».
  ventana <- out$ventana
  sin_rango <- !is.null(ventana) &&
    !nzchar(.alpa_txt(ventana$desde)) && !nzchar(.alpa_txt(ventana$hasta))
  partes <- c(
    # **Y sin rango, «citas sin agenda» no dice cero: no puede contestar.** La
    # columna FECHA de la hoja lleva «11/09» y el año se toma del rango, así que
    # sin él ninguna fila se sitúa y el detector salta todas — devolviendo una
    # lista vacía que se lee como «ninguna cita perdió su aula». Medido el
    # 2026-09-09 sobre la hoja del operativo: sin ventana 0, con la ventana
    # 07→12 encuentra 2. Una búsqueda que no encuentra no puede callar.
    if (sin_rango) paste(
      "sin rango declarado no se puede comprobar si alguna cita escrita ya no",
      "tiene su aula agendada ese día: la fecha de la hoja no lleva año y es el",
      "rango el que se lo pone"),
    if (n_add && sin_rango) sprintf(
      "no hay rango de reparto declarado, así que entra TODO lo agendado: %d aula%s de aquí en adelante",
      n_add, if (n_add == 1L) "" else "s"),
    if (n_add) sprintf("%s %d aula%s agendada%s que no tenía cita",
                       if (hecho) "Se añadieron" else "Se añadirían", n_add,
                       if (n_add == 1L) "" else "s", if (n_add == 1L) "" else "s"),
    if (n_est) sprintf("%s el estado de %d fila%s", if (hecho) "se actualizó" else "se actualizaría",
                       n_est, if (n_est == 1L) "" else "s"),
    if (n_rel) sprintf("%s el aula de %d fila%s que la tenía en blanco",
                       if (hecho) "se puso" else "se pondría", n_rel,
                       if (n_rel == 1L) "" else "s"),
    # **Las corregidas se listan una por una.** Un aula que la hoja daba por
    # buena y el libro desmiente es la que manda a alguien al aula equivocada:
    # un conteo la esconde entre las rellenadas, que son inofensivas.
    if (n_cor) sprintf("%s %d aula%s que no coincidía%s con el libro (%s)",
                       if (hecho) "se corrigieron" else "se corregirían", n_cor,
                       if (n_cor == 1L) "" else "s", if (n_cor == 1L) "" else "n",
                       paste(vapply(Filter(function(c) identical(c$motivo, "corregida"),
                                           aulas$cambios %||% list()),
                                    function(c) sprintf("%s %s → %s",
                                                        .alpa_txt(c$curso_horario, "?"),
                                                        .alpa_txt(c$antes, "?"),
                                                        .alpa_txt(c$despues, "?")),
                                    character(1)), collapse = "; ")),
    if (n_con) sprintf("%d fila%s marcada%s RECHAZADA tiene%s respuestas en plataforma y no se tocó",
                       n_con, if (n_con == 1L) "" else "s", if (n_con == 1L) "" else "s",
                       if (n_con == 1L) "" else "n"),
    # Se DICEN aunque no se toquen: una fila con la fecha ilegible no cae en
    # ningún día y nadie la echa en falta hasta que alguien se pone a mirar.
    if (n_dud) sprintf("%d fila%s escrita%s no cuadra%s y se dejaron como están (%s)",
                       n_dud, if (n_dud == 1L) "" else "s", if (n_dud == 1L) "" else "s",
                       if (n_dud == 1L) "" else "n",
                       paste(unique(vapply(out$dudosas, function(d) {
                         sprintf("%s: %s", d$curso_horario %||% "?", d$motivo %||% "?")
                       }, character(1))), collapse = "; ")),
    # La cara cara de «se añadirían»: una cita cuya aula se movió manda a
    # alguien al campus por un aula que ya no está ahí ese día. Se dice CON la
    # fecha nueva, que es lo que hace falta para decidir; sin ella hay que ir a
    # buscarla al libro. Tampoco se toca: son filas del coordinador.
    if (n_orf) sprintf("%d cita%s escrita%s ya no tiene%s su aula agendada ese día (%s)",
                       n_orf, if (n_orf == 1L) "" else "s", if (n_orf == 1L) "" else "s",
                       if (n_orf == 1L) "" else "n",
                       paste(vapply(out$sin_agenda, function(o) {
                         d <- .alpa_txt(o$detalle)
                         sprintf("%s el %s%s", .alpa_txt(o$curso_horario, "?"),
                                 .alpa_txt(o$fecha, "?"),
                                 switch(.alpa_txt(o$motivo),
                                        aula_movida = paste0(", ahora el ", d),
                                        ya_no_agendada = paste0(", ahora ", d),
                                        sin_plan = ", que el plan no conoce",
                                        ""))
                       }, character(1)), collapse = "; "))
  )
  # El desfase va PRIMERO cuando lo hay: es lo único de la frase que dice que lo
  # que se está mirando en la app no es lo que el equipo tiene delante.
  aviso <- monitoreo_aulas_fijaciones_desfasadas_texto(out$fijaciones_desfasadas)
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
  paste(c(if (nzchar(aviso)) aviso, cabeza, cola), collapse = " ")
}
