# aulas_libro_asignacion.R — la hoja «Asignación de aplicadores» del libro
# operativo (B68, dictado de Gonzalo 2026-09-03: «una hoja adicional que sea
# asignación de aplicadores, y ahí se debería mostrar toda esta información de
# forma bastante estética, que se vea cómo la distribución se está haciendo a
# todos por igual, en base a la disponibilidad… que vaya no solo en la
# aplicación, sino también en el Excel operativo que generamos»).
#
# La DOBLE ESCRITURA prometida — y su tercera pata (mismo día, «¿el Sheets ya
# está listo para actualizarse con la nueva hoja?»): la app enseña el reparto
# en la pestaña de Asignación, el `.xlsx` generado lleva esta hoja, y el libro
# VIVO de Sheets la recibe como CUARTA hoja de la APP del publicador. Un solo
# constructor de filas (`aulas_libro_filas_asignacion`) alimenta las dos
# salidas — el xlsx le pone estilos por tipo de fila y Sheets recibe los
# values planos — para que no existan dos verdades que puedan divergir. El
# reparto es el del MISMO motor con la MISMA configuración vigente (fijadas,
# duración, rango, semilla del resorteo).
#
# La hoja es APP-OWNED y se regenera entera en cada escritura; el importador
# no la lee, igual que Base de control. Las hojas del EQUIPO ni se rozan: esa
# regla vive en el publicador (dueño por hoja, `respetada`).
#
# Sin disponibilidad cargada no hay reparto que escribir y la hoja NO se crea
# (ni en el xlsx ni en Sheets): una hoja vacía se leería como «nadie
# asignado», que es mentira — la ausencia del bloque ya la declara la app.

# El día de semana SIN locale (mismo patrón que .mav_DIAS) y en la palabra
# completa del libro.
.ala_DIAS <- c("Domingo", "Lunes", "Martes", "Miércoles", "Jueves",
               "Viernes", "Sábado")

.ala_txt <- function(v) {
  out <- trimws(as.character(v %||% "")[1])
  if (is.na(out)) "" else out
}

# «2026-09-07» → «Lunes 07/09», la etiqueta de la casa.
.ala_etiqueta <- function(fecha) {
  d <- suppressWarnings(as.Date(fecha))
  if (is.na(d)) return(fecha)
  paste(.ala_DIAS[[as.POSIXlt(d)$wday + 1L]], format(d, "%d/%m"))
}

# El croquis del día en palabras del lector (B79: «3 aplicaciones en A», nunca
# «A×3»): primera entrada completa, las siguientes cortas.
.ala_croquis <- function(lugares_del_dia, primera_completa = TRUE) {
  letras <- character(0)
  for (lg in lugares_del_dia) {
    if (grepl("^[A-ZÁÉÍÓÚ]{1,2}[0-9]{2,4}$", lg, ignore.case = TRUE)) {
      letras <- c(letras, toupper(substr(trimws(lg), 1L, 1L)))
    }
  }
  if (!length(letras)) return("")
  conteo <- sort(table(letras), decreasing = TRUE)
  partes <- vapply(seq_along(conteo), function(k) {
    n <- as.integer(conteo[[k]]); letra <- names(conteo)[[k]]
    if (k == 1L && primera_completa) {
      sprintf("%d %s en %s", n, if (n == 1L) "aplicación" else "aplicaciones", letra)
    } else sprintf("%d en %s", n, letra)
  }, character(1))
  paste(partes, collapse = " · ")
}

.ala_AVISO <- c(
  sin_disponibilidad = "fuera de su disponibilidad declarada",
  se_solapa = "se solapa con otra cita suya"
)

# «FACULTAD» entra por el dictado del 2026-09-04 («el cuadro no muestra la
# facultad»), pegada al codigo: sin ella «CH 7» no dice a que corte pertenece
# y habia que ir a buscarlo a otra hoja.
.ala_CABECERA <- c("CURSO-HORARIO", "FACULTAD", "LUGAR", "RECOJO", "SALE AL AULA",
                   "APLICACIÓN", "APLICADOR", "FIJADA", "AVISO")

#' Las filas de la hoja de asignación, tipadas — el ÚNICO constructor.
#'
#' @param plan el plan COMPLETO de la sesión (el mismo insumo que usa la app).
#' @param disponibilidad la clave de sesión `monitoreo_aulas_disponibilidad`;
#'   `NULL` o vacía = `NULL` (no hay hoja que construir).
#' @param cfg el config de aulas vigente (fijadas, duración, rango, semilla).
#' @return `NULL` sin disponibilidad; si hay, lista de filas `{tipo, celdas}`
#'   con `tipo` en `titulo | nota | dia | cabecera | dato | alerta | bloque`.
#' @keywords internal
aulas_libro_filas_asignacion <- function(plan, disponibilidad, cfg = list()) {
  if (is.null(disponibilidad) || !is.list(disponibilidad) || !length(disponibilidad)) {
    return(NULL)
  }
  cfg <- if (is.list(cfg)) cfg else list()
  rep <- monitoreo_aulas_reparto(
    plan, disponibilidad,
    fijadas = cfg[["reparto_fijado"]] %||% list(),
    duracion_min = cfg[["duracion_aplicacion_min"]] %||% 30L,
    rango = cfg[["reparto_rango"]],
    semilla = cfg[["reparto_semilla"]] %||% 0L,
    concentrado = if (is.null(cfg[["reparto_concentrado"]])) TRUE else isTRUE(cfg[["reparto_concentrado"]])
  )

  # Código → lugar confirmado (el catálogo como fallback), igual que la app.
  lugares <- new.env(parent = emptyenv())
  # Y codigo → facultad, del mismo barrido (dictado 2026-09-04).
  facultades <- new.env(parent = emptyenv())
  for (u in (if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else plan)) {
    cod <- .ala_txt(u[["operational_code"]])
    if (!nzchar(cod)) next
    lg <- .ala_txt(u[["scheduled_venue"]])
    if (!nzchar(lg)) lg <- .ala_txt(u[["venue"]])
    if (nzchar(lg) && is.null(lugares[[cod]])) lugares[[cod]] <- lg
    fac <- .ala_txt(u[["faculty"]])
    if (nzchar(fac) && is.null(facultades[[cod]])) facultades[[cod]] <- fac
  }
  lugar_de <- function(cod) .ala_txt(lugares[[cod]] %||% "")
  facultad_de <- function(cod) .ala_txt(facultades[[cod]] %||% "")

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = as.character(celdas))
  }

  poner("titulo", "ASIGNACIÓN DE APLICADORES")
  semilla <- as.integer(rep[["semilla"]] %||% 0L)
  rango <- rep[["rango"]]
  poner("nota", sprintf(
    "Sorteo: %s · Rango: %s · Generada con el reparto vigente de la app",
    if (semilla > 0L) sprintf("n.º %d", semilla + 1L) else "original (alfabético)",
    if (is.list(rango)) sprintf("del %s al %s", rango[["desde"]], rango[["hasta"]]) else "todo el horizonte"
  ))
  poner("nota", "Materiales se recogen 30 min antes; salida al aula 15 min antes de la hora pactada.")
  poner("nota", "")

  for (d in (rep[["dias"]] %||% list())) {
    asigs <- d[["asignaciones"]] %||% list()
    lugares_dia <- vapply(asigs, function(a) lugar_de(.ala_txt(a[["codigo"]])), character(1))
    # Dictado 2026-09-03: «no son citas, son aplicaciones». El conteo del día
    # dice la unidad correcta, y el croquis va todo en corto para no repetir
    # la palabra («7 aplicaciones — 3 en A · 2 en J»).
    croquis <- .ala_croquis(lugares_dia, primera_completa = FALSE)
    # Dictado 2026-09-04: «basta de los em dashes». El separador de la casa es
    # el punto medio, y el detector de estilos de abajo (`.ala_ES_DIA`) cambia
    # EN EL MISMO commit: la fila de día se reconoce por este formato, así que
    # tocar uno sin el otro dejaba el día sin su navy.
    poner("dia", sprintf(
      "%s · %d %s%s",
      .ala_etiqueta(.ala_txt(d[["fecha"]])), length(asigs),
      if (length(asigs) == 1L) "aplicación" else "aplicaciones",
      if (nzchar(croquis)) paste0(" · ", croquis) else ""
    ))
    if (length(asigs)) {
      poner("cabecera", .ala_CABECERA)
      for (a in asigs) {
        cod <- .ala_txt(a[["codigo"]])
        aviso <- .ala_txt(a[["advertencia"]])
        poner("dato", c(
          cod,
          facultad_de(cod),
          lugar_de(cod),
          .ala_txt(a[["recojo"]]),
          .ala_txt(a[["salida"]]),
          paste0(.ala_txt(a[["inicio"]]),
                 if (nzchar(.ala_txt(a[["fin"]]))) paste0(" a ", .ala_txt(a[["fin"]])) else ""),
          # El nombre, escrito como se escribe un nombre (dictado 2026-09-04).
          aulas_nombre_aplicador(a[["aplicador"]]),
          if (isTRUE(a[["fijada"]])) "fijada a mano" else "",
          if (nzchar(aviso)) (.ala_AVISO[[aviso]] %||% aviso) else ""
        ))
      }
    }
    no_cub <- unlist(d[["no_cubiertos"]] %||% list())
    if (length(no_cub)) {
      poner("alerta", sprintf("Sin nadie asignado: %s", paste(no_cub, collapse = ", ")))
    }
    pend <- unlist(d[["por_confirmar"]] %||% list())
    if (length(pend)) {
      poner("nota", sprintf("Por confirmar (fecha sin hora pactada): %s",
                            paste(pend, collapse = ", ")))
    }
    poner("nota", "")
  }

  fuera <- rep[["fuera_de_rango"]] %||% list()
  if (length(fuera)) {
    poner("alerta", "FUERA DEL RANGO ELEGIDO: esperan su tanda; nada se descarta")
    for (f in fuera) {
      cods <- c(unlist(f[["codigos"]] %||% list()), unlist(f[["por_confirmar"]] %||% list()))
      poner("nota", sprintf("%s: %s", .ala_etiqueta(.ala_txt(f[["fecha"]])),
                            paste(cods, collapse = ", ")))
    }
    poner("nota", "")
  }

  # La equidad, dicha (el «que se vea cómo la distribución se hace a todos por
  # igual» del dictado): cargas con ceros y el veredicto, mismo criterio que
  # el rail de la app.
  poner("bloque", "CARGAS POR APLICADOR")
  eq <- rep[["equidad"]] %||% list()
  cargas <- vapply(eq, function(e) as.integer(e[["asignadas"]] %||% 0L), integer(1))
  poner("cabecera", c("APLICADOR", "APLICACIONES ASIGNADAS"))
  for (e in eq) {
    poner("dato", c(aulas_nombre_aplicador(e[["aplicador"]]),
                    as.character(as.integer(e[["asignadas"]] %||% 0L))))
  }
  con_carga <- cargas[cargas > 0L]
  if (length(con_carga)) {
    dif <- max(con_carga) - min(con_carga)
    libres <- sum(cargas == 0L)
    poner("nota", sprintf(
      "%s: cargas entre %d y %d entre quienes salen, diferencia máxima de %d%s",
      if (dif <= 1L) "Reparto parejo" else "Cargas desparejas (la disponibilidad manda)",
      min(con_carga), max(con_carga), dif,
      if (libres > 0L) sprintf(" · %d quedan libres (sin cita en sus horarios)", libres) else ""
    ))
  }
  filas
}

#' Los values de la hoja para el publicador de Sheets: filas planas.
#'
#' @return `NULL` sin disponibilidad; si hay, lista de filas (vector character
#'   por fila) lista para `monitoreo_sheets_publish_tabs()`.
#' @keywords internal
aulas_libro_valores_asignacion <- function(plan, disponibilidad, cfg = list()) {
  filas <- aulas_libro_filas_asignacion(plan, disponibilidad, cfg = cfg)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

#' Escribe la hoja «Asignación de aplicadores» sobre el workbook del libro.
#'
#' @param wb workbook de openxlsx ya en construcción.
#' @param plan el plan COMPLETO de la sesión, no el filtrado del libro.
#' @param disponibilidad la clave de sesión; `NULL` = no se escribe hoja.
#' @param cfg el config de aulas vigente.
#' @return TRUE si la hoja se escribió; FALSE si no había reparto.
#' @keywords internal
aulas_libro_hoja_asignacion <- function(wb, plan, disponibilidad, cfg = list()) {
  filas <- aulas_libro_filas_asignacion(plan, disponibilidad, cfg = cfg)
  if (is.null(filas)) return(invisible(FALSE))

  hoja <- "Asignación de aplicadores"
  openxlsx::addWorksheet(wb, hoja)

  # Estilos sobrios de la casa por TIPO de fila: el rojo primordial para los
  # días, alerta en su tono, cabeceras con banda.
  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    dia = openxlsx::createStyle(textDecoration = "bold", fontColour = "#FFFFFF",
                                fgFill = "#A0464E", fontSize = 11),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    alerta = openxlsx::createStyle(fontColour = "#8F3A42", textDecoration = "bold"),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )

  for (i in seq_along(filas)) {
    f <- filas[[i]]
    openxlsx::writeData(wb, hoja, t(as.matrix(f$celdas)), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i,
                         cols = seq_along(f$celdas), gridExpand = TRUE)
    }
  }

  openxlsx::setColWidths(wb, hoja, cols = 1:9,
                         widths = c(16, 24, 14, 10, 13, 14, 34, 13, 30))
  invisible(TRUE)
}

# --- formato en Google Sheets (misma estética que las otras hojas de la app) --
#
# Dictado 2026-09-03: «darle buen formato… debe estar igual a nivel estético
# de las otras hojas», y el mismo día «mejora la estética de las hojas
# asignación, plan del día». Misma doctrina y misma paleta que «Avance de
# campo» (B19): todo derivado FILA A FILA del contenido publicado —jamás
# números mágicos—, navy #002457 para título y bloques (el día es un título
# de bloque), #E7EEF9/#1B4B8F para cabeceras de tabla, y el rojo suave de la
# casa para las alertas (descubiertos y fuera-de-rango). Los strings que se
# detectan son LOS MISMOS que emite `aulas_libro_filas_asignacion` — un solo
# constructor, cero derivas. Encima de las bandas, la hoja lleva la jerarquía
# que el xlsx ya tenía: título grande con aire, días y bloques a 11 pt, notas
# en gris pequeño e itálica (el aparte del que lee, no un dato), anchos de
# columna calcados de los del xlsx (`aulas_libro_hoja_asignacion`) y las
# columnas de hora centradas.

.ala_ES_DIA <- function(celda) {
  # El separador pasó de em dash a punto medio el 2026-09-04 («basta de los em
  # dashes»); se acepta el viejo para que una hoja publicada ANTES del cambio
  # siga reconociéndose al reasertar su formato.
  grepl("^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo) [0-9]{2}/[0-9]{2} [·—] ", celda)
}

# Los anchos de columna de la hoja, en píxeles y por RANGOS agrupados (la
# lección de la capa genérica: jamás una request por columna). Son los ~7 px
# por carácter de los anchos del xlsx: identificador y lugar compactos, horas
# parejas, APLICADOR y AVISO anchos porque llevan nombres y frases.
.ala_ANCHOS <- list(
  list(desde = 0L, hasta = 1L, px = 132L),  # CURSO-HORARIO
  list(desde = 1L, hasta = 2L, px = 168L),  # FACULTAD
  list(desde = 2L, hasta = 3L, px = 112L),  # LUGAR
  list(desde = 3L, hasta = 6L, px = 108L),  # RECOJO · SALE AL AULA · APLICACIÓN
  list(desde = 6L, hasta = 7L, px = 232L),  # APLICADOR
  list(desde = 7L, hasta = 8L, px = 104L),  # FIJADA
  list(desde = 8L, hasta = 9L, px = 264L)   # AVISO
)

#' Requests de formato de la hoja de asignación para el batch-2 del motor.
#'
#' @param sheet_id id numérico de la pestaña.
#' @param rows los values realmente publicados.
#' @return lista de requests de batchUpdate (vacía sin filas).
#' @keywords internal
aulas_libro_asignacion_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, "ASIGNACIÓN DE APLICADORES")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (identical(primera, "CARGAS POR APLICADOR") || .ala_ES_DIA(primera)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (primera %in% c("CURSO-HORARIO", "APLICADOR")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (startsWith(primera, "Sin nadie asignado:") ||
               startsWith(primera, "FUERA DEL RANGO ELEGIDO")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#FBE9EA", "#8F3A42"))
    } else if (length(celdas) == 1L && nzchar(primera)) {
      # Nota (protocolo, sorteo, por-confirmar, fechas fuera de rango): el
      # gris pequeño e itálico del xlsx — se lee como aparte, no como dato.
      # Solo filas de UNA celda: las filas-dato traen sus 8 (o 2) columnas.
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    }
  }
  # Anchos del xlsx y horas centradas — solo cuando la hoja publicó su tabla
  # completa (con días sin asignaciones el rectángulo es más angosto y la
  # geometría de 8 columnas no existe).
  # Nueve columnas desde que FACULTAD entró (dictado 2026-09-04). Los índices
  # de centrado se movieron CON ella: dejarlos en los de ocho centraba LUGAR y
  # APLICADOR, que es justo lo que no se centra.
  if (n_cols >= 9L) {
    for (a in .ala_ANCHOS) poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
    poner(.maaf_centrar(sheet_id, 3L, 6L, length(rows)))  # RECOJO · SALE · APLICACIÓN
    poner(.maaf_centrar(sheet_id, 7L, 8L, length(rows)))  # FIJADA
  }
  requests
}
