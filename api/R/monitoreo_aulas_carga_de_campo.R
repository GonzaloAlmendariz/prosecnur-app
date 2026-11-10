# =============================================================================
# Monitoreo › aulas › Carga de campo en Excel (.xlsx real)
# =============================================================================
# Cuántos aplicadores hacen falta a la vez, y cuándo: la malla de la vista
# (frontend/src/features/monitoreo/profiles/aulas/cargaDeCampo.ts) escrita como
# libro de dos hojas —«Carga de campo» con la malla coloreada y «Detalle por
# sesión»—. Antes el front armaba una tabla HTML con extensión .xls y Excel
# avisaba que el formato no coincidía.
#
# Las reglas son las del front, una por una, porque la vista y el libro tienen
# que decir el mismo pico:
# - Cada curso-horario titular cuenta en su PRIMERA sesión de la semana.
# - Firme: hay hora agendada (de la ventana del motor si llega, si no
#   `scheduled_time` en HH:MM exacto). Ocupa [inicio − preparación, inicio +
#   duración); con momento acordado, el inicio sale de la sesión.
# - Plausible: sin agendar, ocupa la clase entera.
# - Eje `semana`: seis filas, lunes a sábado. Eje `calendario`: una fila por
#   fecha agendada más un carril «por agendar» por día de la semana; el pico se
#   mide sólo sobre las fechas.

.MCC_DIAS <- c("lunes", "martes", "miércoles", "jueves", "viernes", "sábado")
.MCC_ABREV <- c(LUN = 0L, MAR = 1L, MIE = 2L, "MIÉ" = 2L, JUE = 3L, VIE = 4L, SAB = 5L, "SÁB" = 5L)
.MCC_MOMENTOS <- c(inicio = "inicio", intermedio = "intermedio", medio = "intermedio", final = "final", cierre = "final")

.mcc_txt <- function(x) {
  x <- if (is.null(x) || !length(x)) "" else as.character(x[[1]])
  if (is.na(x)) "" else trimws(x)
}

.mcc_hhmm <- function(m) sprintf("%02d:%02d", as.integer(m %/% 60), as.integer(m %% 60))

#' Bloques «MAR 14:00-16:00 · MIE 10:00-12:00» → data.frame(dia, desde, hasta)
#' @keywords internal
.mcc_sesiones <- function(texto) {
  texto <- .mcc_txt(texto)
  vacio <- data.frame(dia = integer(), desde = integer(), hasta = integer())
  if (!nzchar(texto)) return(vacio)
  trozos <- trimws(strsplit(texto, "[·|]|<br\\s*/?>", perl = TRUE)[[1]])
  filas <- lapply(trozos, function(t) {
    m <- regmatches(t, regexec("^([A-Za-zÁÉÍÓÚáéíóú]{3})\\s+(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})", t, perl = TRUE))[[1]]
    if (length(m) != 6L) return(NULL)
    dia <- .MCC_ABREV[toupper(m[2])]
    if (is.na(dia)) return(NULL)
    desde <- as.integer(m[3]) * 60L + as.integer(m[4])
    hasta <- as.integer(m[5]) * 60L + as.integer(m[6])
    if (hasta <= desde) return(NULL)
    data.frame(dia = unname(dia), desde = desde, hasta = hasta)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) vacio else do.call(rbind, filas)
}

# Hora de 24 horas exacta («08:30») → minutos; NA si no lo es (el AM/PM lo parsea el motor).
.mcc_hora <- function(x) {
  m <- regmatches(.mcc_txt(x), regexec("^(\\d{1,2}):(\\d{2})$", .mcc_txt(x)))[[1]]
  if (length(m) != 3L) return(NA_integer_)
  min <- as.integer(m[2]) * 60L + as.integer(m[3])
  if (min < 0L || min >= 24L * 60L) NA_integer_ else min
}

.mcc_fecha <- function(x) {
  t <- .mcc_txt(x)
  if (!grepl("^\\d{4}-\\d{2}-\\d{2}$", t)) return("")
  if (is.na(suppressWarnings(as.Date(t, format = "%Y-%m-%d")))) "" else t
}

# Índice de .MCC_DIAS (0 = lunes) de una fecha ISO; -1 si es domingo o no es fecha.
.mcc_dia_de_fecha <- function(iso) {
  d <- suppressWarnings(as.Date(iso, format = "%Y-%m-%d"))
  if (is.na(d)) return(-1L)
  dow <- as.integer(format(d, "%u"))   # 1 = lunes … 7 = domingo
  if (dow == 7L) -1L else dow - 1L
}

.mcc_etiqueta_fecha <- function(iso) {
  d <- suppressWarnings(as.Date(iso, format = "%Y-%m-%d"))
  if (is.na(d)) return(iso)
  nombres <- c("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
  sprintf("%s %s", nombres[as.integer(format(d, "%u"))], format(d, "%d/%m"))
}

.mcc_titular <- function(fila) {
  rol <- .mcc_txt(fila$sample_role)
  !nzchar(rol) || identical(rol, "titular")
}

#' Sesiones visitables del plan (sólo titulares), una fila por bloque
#' @keywords internal
.mcc_sesiones_del_plan <- function(plan) {
  filas <- list()
  for (f in plan) {
    if (!is.list(f) || !.mcc_titular(f)) next
    b <- .mcc_sesiones(f$sesiones_dia_hora)
    if (!nrow(b)) next
    aula <- .mcc_txt(f$classroom_id)
    filas[[length(filas) + 1L]] <- data.frame(
      b, salon = .mcc_txt(f$venue), aula = aula, curso = .mcc_txt(f$course_name),
      facultad = .mcc_txt(f$faculty),
      elegibles = suppressWarnings(as.numeric(.mcc_txt(f$eligible_n))),
      codigo = if (nzchar(.mcc_txt(f$operational_code))) .mcc_txt(f$operational_code) else aula,
      stringsAsFactors = FALSE
    )
  }
  if (!length(filas)) {
    return(data.frame(dia = integer(), desde = integer(), hasta = integer(), salon = character(), aula = character(),
                      curso = character(), facultad = character(), elegibles = numeric(), codigo = character()))
  }
  do.call(rbind, filas)
}

# Ventanas confirmadas del motor por código: lista con nombre (codigo → {fecha, inicio_min})
# o arreglo de {codigo, fecha, inicio_min | inicioMin | inicio "HH:MM"}.
.mcc_ventanas <- function(ventanas) {
  if (is.null(ventanas) || !length(ventanas)) return(list())
  if (is.data.frame(ventanas)) ventanas <- lapply(seq_len(nrow(ventanas)), function(i) as.list(ventanas[i, , drop = FALSE]))
  nombres <- names(ventanas)
  out <- list()
  for (i in seq_along(ventanas)) {
    v <- ventanas[[i]]
    if (!is.list(v)) next
    codigo <- .mcc_txt(v$codigo %||% if (!is.null(nombres)) nombres[[i]] else "")
    inicio <- suppressWarnings(as.integer(.mcc_txt(v$inicio_min %||% v$inicioMin)))
    if (is.na(inicio)) inicio <- .mcc_hora(v$inicio)
    if (!nzchar(codigo) || is.na(inicio) || !is.null(out[[codigo]])) next
    out[[codigo]] <- list(fecha = .mcc_fecha(v$fecha), inicio = inicio)
  }
  out
}

.mcc_unidades <- function(plan, ventanas) {
  unidades <- list()
  for (f in plan) {
    if (!is.list(f) || !.mcc_titular(f)) next
    bloques <- .mcc_sesiones(f$sesiones_dia_hora)
    if (!nrow(bloques)) next
    aula <- .mcc_txt(f$classroom_id)
    orden <- order(bloques$dia, bloques$desde)
    primera <- bloques[orden[1], , drop = FALSE]
    previa <- unidades[[aula]]
    if (!is.null(previa) && (previa$primera$dia < primera$dia ||
                             (previa$primera$dia == primera$dia && previa$primera$desde <= primera$desde))) next
    momento <- unname(.MCC_MOMENTOS[tolower(.mcc_txt(f$scheduled_moment))])
    codigo <- if (nzchar(.mcc_txt(f$operational_code))) .mcc_txt(f$operational_code) else aula
    u <- list(aula = aula, codigo = codigo, bloques = bloques, primera = primera,
              hora = .mcc_hora(f$scheduled_time), momento = if (is.na(momento %||% NA)) NULL else momento,
              fecha = .mcc_fecha(f$scheduled_date))
    v <- ventanas[[codigo]]
    if (!is.null(v)) {
      u$hora <- v$inicio
      if (nzchar(v$fecha)) u$fecha <- v$fecha
    }
    unidades[[aula]] <- u
  }
  unname(unidades)
}

.mcc_inicio_ventana <- function(desde, hasta, dur, momento) {
  if (identical(momento, "final")) return(max(desde, hasta - dur))
  if (identical(momento, "intermedio")) return(max(desde, round((desde + hasta - dur) / 2)))
  desde
}

#' La malla de carga de campo (espejo de `calcularCarga` del front)
#'
#' @return list(eje, franjas, filas (data.frame clave, etiqueta, dia, por_agendar),
#'   aulas, firmes, plausibles (matrices fila × franja), pico, agendadas,
#'   por_agendar, agendadas_sin_fecha, fechas, sin_horario).
#' @keywords internal
monitoreo_aulas_carga_de_campo_malla <- function(plan, duracion_min = 30L, eje = "semana", ventanas = NULL,
                                                 preparacion_min = 30L, salida_min = 15L, paso_min = 30L) {
  titulares <- Filter(function(f) is.list(f) && .mcc_titular(f), plan %||% list())
  unidades <- .mcc_unidades(titulares, .mcc_ventanas(ventanas))
  franjas <- seq(7L * 60L, 22L * 60L - 1L, by = paso_min)
  con_hora <- vapply(unidades, function(u) !is.na(u$hora), logical(1))
  fechas_u <- vapply(unidades, function(u) u$fecha, character(1))

  if (identical(eje, "calendario")) {
    fechas <- sort(unique(fechas_u[con_hora & nzchar(fechas_u)]))
    dias_pend <- sort(unique(vapply(unidades[!con_hora], function(u) u$primera$dia, integer(1))))
    filas <- data.frame(
      clave = c(fechas, if (length(dias_pend)) paste0("por-agendar:", dias_pend) else character()),
      etiqueta = c(vapply(fechas, .mcc_etiqueta_fecha, character(1)), .MCC_DIAS[dias_pend + 1L]),
      dia = c(vapply(fechas, .mcc_dia_de_fecha, integer(1)), dias_pend),
      por_agendar = c(rep(FALSE, length(fechas)), rep(TRUE, length(dias_pend))),
      stringsAsFactors = FALSE
    )
  } else {
    filas <- data.frame(clave = .MCC_DIAS, etiqueta = .MCC_DIAS, dia = 0:5, por_agendar = FALSE,
                        stringsAsFactors = FALSE)
  }
  vacia <- function() matrix(0L, nrow = nrow(filas), ncol = length(franjas))
  aulas <- vacia(); firmes <- vacia(); plausibles <- vacia()
  marcar <- function(m, i, desde, hasta) {
    j <- which(franjas >= desde & franjas < hasta)
    m[i, j] <- m[i, j] + 1L
    m
  }
  marcar_firme <- function(i, b, u) {
    desde <- if (!is.null(u$momento)) .mcc_inicio_ventana(b$desde, b$hasta, duracion_min, u$momento) else u$hora
    firmes <<- marcar(firmes, i, max(0L, desde - preparacion_min), desde + duracion_min)
  }
  agendadas <- 0L
  sin_fecha <- 0L
  for (u in unidades) {
    if (!is.na(u$hora)) agendadas <- agendadas + 1L
    if (identical(eje, "calendario")) {
      if (!is.na(u$hora)) {
        if (!nzchar(u$fecha)) { sin_fecha <- sin_fecha + 1L; next }
        i <- match(u$fecha, filas$clave)
        if (is.na(i)) next
        d <- .mcc_dia_de_fecha(u$fecha)
        b <- if (any(u$bloques$dia == d)) u$bloques[which(u$bloques$dia == d)[1], , drop = FALSE] else u$primera
        aulas <- marcar(aulas, i, b$desde, b$hasta)
        marcar_firme(i, b, u)
      } else {
        i <- match(paste0("por-agendar:", u$primera$dia), filas$clave)
        if (is.na(i)) next
        aulas <- marcar(aulas, i, u$primera$desde, u$primera$hasta)
        plausibles <- marcar(plausibles, i, u$primera$desde, u$primera$hasta)
      }
    } else {
      i <- u$primera$dia + 1L
      if (i < 1L || i > nrow(filas)) next
      aulas <- marcar(aulas, i, u$primera$desde, u$primera$hasta)
      if (!is.na(u$hora)) marcar_firme(i, u$primera, u)
      else plausibles <- marcar(plausibles, i, u$primera$desde, u$primera$hasta)
    }
  }
  if (!identical(eje, "calendario")) sin_fecha <- sum(con_hora & !nzchar(fechas_u))

  total <- firmes + plausibles
  candidatas <- if (identical(eje, "calendario")) which(!filas$por_agendar) else seq_len(nrow(filas))
  pico <- NULL
  mejor <- 0L
  for (d in candidatas) for (j in seq_along(franjas)) {
    if (total[d, j] > mejor) {
      mejor <- total[d, j]
      pico <- list(firmes = firmes[d, j], plausibles = plausibles[d, j], fila = filas$etiqueta[d],
                   franja = franjas[j], aulas = aulas[d, j])
    }
  }
  list(eje = eje, franjas = franjas, filas = filas, aulas = aulas, firmes = firmes, plausibles = plausibles,
       pico = pico, agendadas = agendadas, por_agendar = length(unidades) - agendadas,
       agendadas_sin_fecha = sin_fecha, fechas = length(unique(fechas_u[con_hora & nzchar(fechas_u)])),
       sin_horario = length(titulares) - length(unidades), duracion_min = duracion_min)
}

# El mismo degradado de la pantalla, resuelto a hex.
.mcc_fondo <- function(n, tope) {
  if (n <= 0) return("#F2F0EC")
  t <- min(1, n / max(1, tope))
  desde <- c(226, 233, 243); hasta <- c(31, 56, 100)
  c3 <- round(desde + (hasta - desde) * t)
  sprintf("#%02X%02X%02X", c3[1], c3[2], c3[3])
}

.mcc_fmt <- function(n) format(n, big.mark = ",", scientific = FALSE, trim = TRUE)

#' Escribe el libro de carga de campo (.xlsx, dos hojas) y devuelve la malla
#' @keywords internal
monitoreo_aulas_carga_de_campo_xlsx <- function(plan, path, duracion_min = 30L, eje = "semana", ventanas = NULL,
                                                preparacion_min = 30L, salida_min = 15L) {
  malla <- monitoreo_aulas_carga_de_campo_malla(plan, duracion_min, eje, ventanas, preparacion_min, salida_min)
  calendario <- identical(malla$eje, "calendario")
  total <- malla$firmes + malla$plausibles
  vivas <- which(colSums(malla$aulas) > 0)
  tope <- max(1L, total)

  wb <- openxlsx::createWorkbook()
  hoja <- "Carga de campo"
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)
  st_titulo <- openxlsx::createStyle(fontSize = 15, textDecoration = "bold", fontColour = "#191C20")
  st_nota <- openxlsx::createStyle(fontSize = 9.5, fontColour = "#4B515A", wrapText = FALSE)
  st_head <- openxlsx::createStyle(fontColour = "#FFFFFF", fgFill = "#1F3864", textDecoration = "bold",
                                   halign = "center", border = "TopBottomLeftRight", borderColour = "#C4BCB0")
  st_fila <- openxlsx::createStyle(fontColour = "#FFFFFF", fgFill = "#1F3864", textDecoration = "bold",
                                   halign = "left", border = "TopBottomLeftRight", borderColour = "#C4BCB0")
  st_carril <- openxlsx::createStyle(fontColour = "#4B515A", fgFill = "#E8E4DC", textDecoration = "bold",
                                     halign = "left", border = "TopBottomLeftRight", borderColour = "#C4BCB0")

  pico <- if (is.null(malla$pico)) "sin datos" else sprintf(
    "%s confirmados y hasta %s, %s %s, %s cursos-horario en curso",
    .mcc_fmt(malla$pico$firmes), .mcc_fmt(malla$pico$firmes + malla$pico$plausibles),
    malla$pico$fila, .mcc_hhmm(malla$pico$franja), .mcc_fmt(malla$pico$aulas))
  lectura <- if (calendario) sprintf("Calendario: una fila por fecha agendada, sobre %s días de campo.", .mcc_fmt(malla$fechas))
    else "Patrón semanal: cada curso-horario en el día de su horario recurrente."
  sin_fecha <- if (calendario && malla$agendadas_sin_fecha > 0) sprintf(
    " %s cursos-horario tienen hora pero no fecha y no caben en el calendario.", .mcc_fmt(malla$agendadas_sin_fecha)) else ""
  notas <- c(
    "Carga de campo",
    "Cuántos aplicadores hacen falta a la vez, sobre el rango horario de cada curso.",
    sprintf("%s Aplicación de %s minutos, pico: %s.", lectura, .mcc_fmt(malla$duracion_min), pico),
    paste0("En negrita sobre color, los cursos-horario con hora ya agendada. En cursiva sobre fondo claro, el rango ",
           "posible de los que faltan agendar. ", .mcc_fmt(malla$agendadas), " de ",
           .mcc_fmt(malla$agendadas + malla$por_agendar), " cursos-horario ya tienen hora.", sin_fecha)
  )
  openxlsx::writeData(wb, hoja, notas, startRow = 1, startCol = 1)
  openxlsx::addStyle(wb, hoja, st_titulo, rows = 1, cols = 1)
  openxlsx::addStyle(wb, hoja, st_nota, rows = 2:4, cols = 1, gridExpand = TRUE)

  fila0 <- 6L
  cab <- c(if (calendario) "Fecha" else "Día", .mcc_hhmm(malla$franjas[vivas]))
  openxlsx::writeData(wb, hoja, t(cab), startRow = fila0, colNames = FALSE)
  openxlsx::addStyle(wb, hoja, st_head, rows = fila0, cols = seq_along(cab), gridExpand = TRUE)
  r <- fila0
  primera_pend <- match(TRUE, malla$filas$por_agendar)
  for (d in seq_len(nrow(malla$filas))) {
    r <- r + 1L
    if (calendario && !is.na(primera_pend) && d == primera_pend) {
      openxlsx::writeData(wb, hoja, "Por agendar, todavía sin fecha, sobre el horario del curso", startRow = r, startCol = 1)
      openxlsx::mergeCells(wb, hoja, cols = seq_along(cab), rows = r)
      openxlsx::addStyle(wb, hoja, st_carril, rows = r, cols = seq_along(cab), gridExpand = TRUE)
      r <- r + 1L
    }
    openxlsx::writeData(wb, hoja, malla$filas$etiqueta[d], startRow = r, startCol = 1)
    openxlsx::addStyle(wb, hoja, st_fila, rows = r, cols = 1)
    for (k in seq_along(vivas)) {
      j <- vivas[k]
      n <- total[d, j]
      firme <- malla$firmes[d, j]
      if (n > 0) openxlsx::writeData(wb, hoja, n, startRow = r, startCol = k + 1L)
      italica <- firme == 0 && n > 0
      st <- openxlsx::createStyle(
        fgFill = if (firme > 0) .mcc_fondo(n, tope) else "#F2F0EC",
        fontColour = if (italica) "#4B515A" else if (n / tope > 0.45 && firme > 0) "#FFFFFF" else "#191C20",
        textDecoration = if (italica) "italic" else if (firme > 0) "bold" else NULL,
        halign = "center", border = "TopBottomLeftRight", borderColour = "#DDD8D0")
      openxlsx::addStyle(wb, hoja, st, rows = r, cols = k + 1L)
    }
  }
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 18)
  if (length(vivas)) openxlsx::setColWidths(wb, hoja, cols = seq_along(vivas) + 1L, widths = 7)
  openxlsx::freezePane(wb, hoja, firstActiveRow = fila0 + 1L, firstActiveCol = 2L)

  det <- "Detalle por sesión"
  openxlsx::addWorksheet(wb, det)
  ses <- .mcc_sesiones_del_plan(plan)
  ses <- ses[order(ses$dia, ses$desde, ses$salon), , drop = FALSE]
  tabla <- data.frame(
    "Día" = .MCC_DIAS[ses$dia + 1L], Inicio = .mcc_hhmm(ses$desde), Fin = .mcc_hhmm(ses$hasta),
    "Salón" = ses$salon, "Curso-horario" = toupper(ses$aula), Curso = ses$curso, Facultad = ses$facultad,
    Elegibles = ses$elegibles, check.names = FALSE, stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, det, tabla, headerStyle = st_head)
  openxlsx::freezePane(wb, det, firstRow = TRUE)
  openxlsx::setColWidths(wb, det, cols = seq_len(ncol(tabla)), widths = c(12, 8, 8, 14, 16, 40, 30, 10))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(malla)
}

#' Parámetros del cuerpo de la carga de campo, validados
#' @keywords internal
.mcc_parametros <- function(body) {
  entero <- function(x, defecto, min, max, campo) {
    if (is.null(x) || !length(x)) return(defecto)
    v <- suppressWarnings(as.integer(x[[1]]))
    if (is.na(v) || v < min || v > max) {
      stop_api(422, "E_MONITOREO_CARGA_CAMPO_PARAMETROS",
               sprintf("%s debe ser un número entero de minutos entre %d y %d.",
                       switch(campo, duracion_min = "La duración de la sesión", preparacion_min = "La preparación",
                              salida_min = "La salida", "El valor"), min, max), details = list(campo = campo))
    }
    v
  }
  eje <- .mcc_txt(body$eje %||% "semana")
  if (!nzchar(eje)) eje <- "semana"
  if (!eje %in% c("semana", "calendario")) {
    stop_api(422, "E_MONITOREO_CARGA_CAMPO_PARAMETROS", "El eje es \"semana\" o \"calendario\".",
             details = list(campo = "eje"))
  }
  list(duracion_min = entero(body$duracion_min, 30L, 5L, 240L, "duracion_min"),
       eje = eje,
       ventanas = body$ventanas,
       preparacion_min = entero(body$preparacion_min, 30L, 0L, 240L, "preparacion_min"),
       salida_min = entero(body$salida_min, 15L, 0L, 240L, "salida_min"))
}

#' Genera y registra el libro de carga de campo de la sesión (ADR 0133)
#'
#' @return la respuesta pública: ok, file_id, filename, size, eje, pico y los
#'   cuatro campos del registro.
#' @keywords internal
monitoreo_aulas_carga_de_campo_excel <- function(sid, body = list()) {
  p <- .mcc_parametros(body %||% list())
  plan <- session_get(sid)$monitoreo_aulas_plan %||% list()
  if (!length(plan)) {
    stop_api(409, "E_MONITOREO_CARGA_CAMPO_SIN_PLAN",
             "No hay plan de aulas: importa la selección de Cálculo de muestra primero.")
  }
  if (!nrow(.mcc_sesiones_del_plan(plan))) {
    stop_api(409, "E_MONITOREO_CARGA_CAMPO_SIN_HORARIO",
             "Ningún curso-horario titular trae su horario de sesiones: no hay carga que calcular.")
  }
  path <- file.path(.session_downloads_dir(sid), paste0(uuid::UUIDgenerate(), ".xlsx"))
  malla <- monitoreo_aulas_carga_de_campo_xlsx(plan, path, p$duracion_min, p$eje, p$ventanas,
                                               p$preparacion_min, p$salida_min)
  meta <- .register_output_file(sid, "monitoreo_aulas_carga_de_campo", path,
                                detalle = if (identical(p$eje, "calendario")) "calendario" else NULL)
  resp <- list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size,
               eje = p$eje, duracion_min = p$duracion_min,
               agendadas = malla$agendadas, por_agendar = malla$por_agendar)
  # Sin pico la clave no viaja: un NULL se serializaría como `{}`, que en JS es truthy.
  if (!is.null(malla$pico)) {
    resp$pico <- list(firmes = malla$pico$firmes, plausibles = malla$pico$plausibles, fila = malla$pico$fila,
                      franja = .mcc_hhmm(malla$pico$franja), aulas = malla$pico$aulas)
  }
  entregable_respuesta(resp, meta)
}
