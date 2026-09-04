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
# Dictado 2026-09-04: «no entiendo a qué se refiere con FIJADA y AVISO; siento
# que debería mostrar el estatus de aplicación». Tenía razón: las dos eran
# contabilidad de la app —quién puso la asignación y si la oferta la respalda—
# y salían vacías en toda la hoja, mientras lo que el equipo necesita saber de
# cada cita es en qué va.
#
# El aviso NO se pierde al quitar su columna: viaja pegado al nombre de quien
# le toca («Ana Prueba (fuera de su disponibilidad)»), que es donde se lee sin
# tener que cruzar dos columnas. Y la marca de puesta a mano se queda en la
# app, que es donde se pone y se deshace.
.ala_CABECERA <- c("APLICADOR", "DÍA", "AULAS", "EN OFICINA", "SALE A APLICAR",
                   "TERMINA", "CURSOS-HORARIO DEL DÍA", "ESTADO DE APLICACIÓN")

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

  # **La hoja gira alrededor del APLICADOR, no del día** (dictado 2026-09-04:
  # «asignación debe estar centrada en torno al aplicador: lo que tiene el
  # aplicador, a cuántas aulas va, en qué días, y qué días tiene que estar en
  # oficina»). El recorrido por día vive en «Plan del día», que es la hoja
  # operativa; duplicarlo aquí era tener dos hojas diciendo lo mismo y ninguna
  # contestando «¿qué le toca a Fulano?».
  #
  # Una fila por APLICADOR y DÍA, porque las tres horas que él pide —oficina,
  # salida y fin— son del día, no de la semana. El detalle cita a cita no entra:
  # va en el Plan del día, con su aula, su docente y su ficha.
  jornadas <- list()   # "aplicador\rfecha" -> lista de sus citas
  etiqueta_de <- list()
  for (d in (rep[["dias"]] %||% list())) {
    fecha <- .ala_txt(d[["fecha"]])
    etiqueta_de[[fecha]] <- .ala_etiqueta(fecha)
    for (a in (d[["asignaciones"]] %||% list())) {
      quien <- .ala_txt(a[["aplicador"]])
      if (!nzchar(quien)) next
      clave <- paste(quien, fecha, sep = "\r")
      jornadas[[clave]] <- c(jornadas[[clave]], list(a))
    }
  }

  if (length(jornadas)) {
    poner("bloque", "QUÉ LE TOCA A CADA APLICADOR")
    poner("cabecera", .ala_CABECERA)
    # Por nombre legible y, dentro, por fecha: se lee «Fulano: el lunes esto, el
    # jueves esto otro», que es la pregunta que la hoja contesta.
    claves <- names(jornadas)
    quien_de <- vapply(strsplit(claves, "\r", fixed = TRUE), `[[`, character(1), 1L)
    fecha_de <- vapply(strsplit(claves, "\r", fixed = TRUE), `[[`, character(1), 2L)
    orden <- order(vapply(quien_de, aulas_nombre_aplicador, character(1)), fecha_de,
                   method = "radix")
    for (k in claves[orden]) {
      citas <- jornadas[[k]]
      quien <- quien_de[[which(claves == k)[1]]]
      fecha <- fecha_de[[which(claves == k)[1]]]
      horas <- function(campo) {
        v <- vapply(citas, function(a) .ala_txt(a[[campo]]), character(1))
        v[nzchar(v)]
      }
      # La jornada de punta a punta: entra a la oficina con el PRIMER recojo y
      # termina con el ÚLTIMO fin. Si alguna cita no trae su hora, la celda
      # calla en vez de dar una punta a medias.
      recojos <- horas("recojo"); salidas <- horas("salida"); fines <- horas("fin")
      aviso <- unique(vapply(citas, function(a) .ala_txt(a[["advertencia"]]), character(1)))
      aviso <- aviso[nzchar(aviso)]
      poner("dato", c(
        paste0(
          aulas_nombre_aplicador(quien),
          if (length(aviso)) sprintf(" (%s)", paste(vapply(aviso, function(x)
            .ala_AVISO[[x]] %||% x, character(1)), collapse = "; ")) else ""
        ),
        etiqueta_de[[fecha]] %||% fecha,
        as.character(length(citas)),
        if (length(recojos)) min(recojos) else "",
        if (length(salidas)) min(salidas) else "",
        if (length(fines)) max(fines) else "",
        # Sus aulas del día, en orden de hora y con su lugar: el «a cuántas
        # aulas va» con la seña que hace falta para ubicarlas.
        paste(vapply(citas, function(a) {
          cod <- .ala_txt(a[["codigo"]])
          lg <- lugar_de(cod)
          if (nzchar(lg)) sprintf("%s (%s)", cod, lg) else cod
        }, character(1)), collapse = " · "),
        "POR APLICAR"
      ))
    }
    poner("nota", "")
  }

  # Lo descubierto se declara igual: es el problema operativo del reparto y su
  # sitio natural sigue siendo esta hoja, que es la que dice si el equipo alcanza.
  descubiertas <- unlist(lapply(rep[["dias"]] %||% list(), function(d) {
    cods <- unlist(d[["no_cubiertos"]] %||% list())
    if (!length(cods)) return(NULL)
    sprintf("%s: %s", .ala_etiqueta(.ala_txt(d[["fecha"]])), paste(cods, collapse = ", "))
  }))
  if (length(descubiertas)) {
    poner("alerta", "SIN NADIE QUE LLEGUE")
    for (linea in descubiertas) poner("nota", linea)
    poner("nota", "")
  }
  pendientes <- unlist(lapply(rep[["dias"]] %||% list(), function(d) {
    cods <- unlist(d[["por_confirmar"]] %||% list())
    if (!length(cods)) return(NULL)
    sprintf("%s: %s", .ala_etiqueta(.ala_txt(d[["fecha"]])), paste(cods, collapse = ", "))
  }))
  if (length(pendientes)) {
    poner("nota", "Por confirmar (fecha sin hora pactada, no piden gente todavía):")
    for (linea in pendientes) poner("nota", linea)
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
#' El aplicador que le toca a cada cita, por código operativo.
#'
#' La misma corrida del reparto que alimenta la hoja «Asignación de
#' aplicadores», expuesta como mapa para que «Plan del día» diga QUIÉN va sin
#' esperar a que alguien rinda su parte de campo. Antes esa columna sólo se
#' llenaba desde el parte —que se rinde DESPUÉS de aplicar— y por eso salía
#' vacía en toda la hoja que el equipo abre la noche anterior.
#'
#' Sin disponibilidad en sesión no hay reparto y devuelve una lista vacía: la
#' columna queda en blanco declarando que nadie está asignado todavía, que es
#' la verdad, en vez de inventar un nombre.
#'
#' El nombre sale NORMALIZADO (`aulas_nombre_aplicador`), como en el resto del
#' libro: el directorio llega tecleado a mano y trae `PANTA GUTIERREZ, PERCY
#' AARÓN` al lado de `Uribe Olaechea , Jesús Ramiro`.
#' @export
aulas_libro_asignados_por_codigo <- function(plan, disponibilidad, cfg = list()) {
  if (is.null(disponibilidad) || !length(disponibilidad)) return(list())
  cfg <- if (is.list(cfg)) cfg else list()
  rep <- monitoreo_aulas_reparto(
    plan, disponibilidad,
    fijadas = cfg[["reparto_fijado"]] %||% list(),
    duracion_min = cfg[["duracion_aplicacion_min"]] %||% 30L,
    rango = cfg[["reparto_rango"]],
    semilla = cfg[["reparto_semilla"]] %||% 0L,
    concentrado = if (is.null(cfg[["reparto_concentrado"]])) TRUE else isTRUE(cfg[["reparto_concentrado"]])
  )
  out <- list()
  for (dia in (rep[["dias"]] %||% list())) {
    for (item in (dia[["asignaciones"]] %||% list())) {
      cod <- .ala_txt(item[["codigo"]])
      nom <- .ala_txt(item[["aplicador"]])
      if (nzchar(cod) && nzchar(nom)) out[[cod]] <- aulas_nombre_aplicador(nom)
    }
  }
  out
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

  openxlsx::setColWidths(wb, hoja, cols = 1:8,
                         widths = c(42, 18, 9, 15, 16, 13, 56, 22))
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

# Los títulos de bloque de la hoja. Desde que gira alrededor del aplicador
# (dictado 2026-09-04) ya no hay filas de día: el recorrido por jornada vive en
# «Plan del día», que es la hoja operativa.
.ala_BLOQUES <- c("QUÉ LE TOCA A CADA APLICADOR", "CARGAS POR APLICADOR")

# Los anchos de columna de la hoja, en píxeles y por RANGOS agrupados (la
# lección de la capa genérica: jamás una request por columna). Son los ~7 px
# por carácter de los anchos del xlsx: identificador y lugar compactos, horas
# parejas, APLICADOR y AVISO anchos porque llevan nombres y frases.
.ala_ANCHOS <- list(
  list(desde = 0L, hasta = 1L, px = 300L),  # APLICADOR (lleva su aviso al lado)
  list(desde = 1L, hasta = 2L, px = 132L),  # DÍA
  list(desde = 2L, hasta = 3L, px = 76L),   # AULAS
  list(desde = 3L, hasta = 6L, px = 116L),  # EN OFICINA · SALE A APLICAR · TERMINA
  list(desde = 6L, hasta = 7L, px = 400L),  # CURSOS-HORARIO DEL DÍA
  list(desde = 7L, hasta = 8L, px = 168L)   # ESTADO DE APLICACIÓN
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
    } else if (primera %in% .ala_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (identical(primera, "APLICADOR") && length(celdas) > 1L) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (startsWith(primera, "SIN NADIE QUE LLEGUE") ||
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
  # Ocho columnas desde que FIJADA y AVISO dejaron sitio al estado.
  if (n_cols >= 8L) {
    for (a in .ala_ANCHOS) poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
    # El conteo y las tres horas de la jornada, centrados: son cifras.
    poner(.maaf_centrar(sheet_id, 2L, 6L, length(rows)))
  }
  requests
}
