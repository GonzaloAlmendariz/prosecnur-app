# La hoja «Disponibilidad de aplicadores» del libro y del Google Sheets.
#
# Dictado de Gonzalo (2026-09-04): «el Sheets debería tener una forma muy
# elegante de poder mostrar la disponibilidad de cada encuestador en una hoja,
# para que el equipo de campo también pueda saber cuándo o a quién reclutar y no
# dependa enteramente de mí».
#
# Ese «no dependa enteramente de mí» es el requisito, no el adorno: la malla de
# oferta existía sólo dentro de la app, así que quien está en campo tenía que
# preguntarle a él «¿quién puede el jueves temprano?». La hoja contesta las dos
# preguntas por separado, porque son dos:
#
#   CUÁNDO reclutar  → la malla por día y tramo con su conteo. Un tramo en cero
#                      o en uno es donde el operativo se rompe si alguien falla.
#   A QUIÉN llamar   → los nombres de cada tramo, y debajo el resumen por
#                      persona con los días que cubre y su horario de punta a
#                      punta, que es lo que se mira para reasignar.
#
# Es hoja de la APP —se reescribe en cada publicación— y CONDICIONAL: sin
# disponibilidad cargada no se produce ni entra al juego de hojas, igual que
# «Asignación de aplicadores». Una hoja vacía diría «nadie tiene horario», que
# es distinto de «todavía no se cargó el libro de disponibilidad».
#
# La doble escritura sale del MISMO constructor de filas tipadas que la hoja de
# asignación (`aulas_libro_filas_asignacion`): el `.xlsx` les pone estilos por
# tipo de fila y Sheets recibe los valores planos, para que no existan dos
# verdades que puedan divergir.

.ald_DIAS <- c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")

# La palabra bien escrita, que es la que va a la hoja. La clave del motor viene
# sin tilde («miercoles») porque es un identificador, no un rótulo.
.ald_ETIQUETA_DIA <- c(
  lunes = "Lunes", martes = "Martes", miercoles = "Miércoles", jueves = "Jueves",
  viernes = "Viernes", sabado = "Sábado", domingo = "Domingo"
)

.ald_txt <- function(x, alt = "") {
  v <- tryCatch(as.character(x %||% "")[1], error = function(...) "")
  if (length(v) == 0L || is.na(v)) alt else trimws(v)
}

#' Las filas de la hoja de disponibilidad, tipadas.
#'
#' Mismo contrato que `aulas_libro_filas_asignacion`: una lista de
#' `list(tipo, celdas)` donde el tipo gobierna el estilo del `.xlsx` y el
#' formato del Sheets.
#'
#' **Dos tablas y no una lista.** La primera versión bajaba tramo por tramo, día
#' tras día: sobre el operativo salían más de doscientas filas de media hora y
#' Gonzalo lo llamó por su nombre (2026-09-04): «tenemos que asegurarnos de que
#' el Excel no sea críptico… hay que ver que visualmente sea entendible, porque
#' son varias aristas: rangos horarios, días disponibles y personas como tal».
#'
#' Tres ejes no caben en una columna. Caben en dos tablas cruzadas, y cada una
#' contesta UNA de sus dos preguntas con la forma que él mismo propuso:
#'
#'   CUÁNTOS HAY, HORA POR HORA   hora × día, la celda es el conteo. Treinta
#'     filas en vez de doscientas, y el hueco se ve de un golpe: es el «por día,
#'     el lunes estos son los disponibles» leído en vertical.
#'   QUIÉN PUEDE CADA DÍA          persona × día, la celda es su rango. Una fila
#'     por persona: es el «el aplicador tal, y ésta es su disponibilidad el
#'     lunes, el martes, el miércoles».
#'
#' @param disponibilidad el bloque de oferta del motor
#'   (`monitoreo_aulas_disponibilidad_bloque`), o la oferta cruda de la sesión.
#' @return lista de filas tipadas, o `NULL` si no hay oferta que enseñar.
#' @keywords internal
aulas_libro_filas_disponibilidad <- function(disponibilidad = list()) {
  bloque <- disponibilidad
  cruda <- disponibilidad
  # Acepta las dos formas: el bloque ya armado o la oferta cruda de sesión. Sin
  # esto, el llamador tenía que saber cuál de las dos tenía en la mano. La
  # tabla de personas necesita la CRUDA (los bloques de cada quien); con el
  # bloque ya armado esa tabla se deriva de sus franjas.
  if (!is.list(bloque) || is.null(bloque[["dias"]])) {
    bloque <- monitoreo_aulas_disponibilidad_bloque(disponibilidad %||% list())
  } else {
    cruda <- NULL
  }
  dias <- bloque[["dias"]] %||% list()
  if (!length(dias)) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = as.character(celdas))
  }

  # Los días CON cobertura, en orden de semana: una columna por cada uno. Un día
  # sin nadie no gana columna vacía; que no esté ya dice que nadie puede.
  claves <- vapply(dias, function(d) .ald_txt(d[["dia"]]), character(1))
  claves <- .ald_DIAS[.ald_DIAS %in% claves]
  cabecera_dias <- vapply(claves, function(k) .ald_ETIQUETA_DIA[[k]] %||% k, character(1))
  por_dia <- stats::setNames(dias[match(claves, vapply(dias, function(d) .ald_txt(d[["dia"]]), character(1)))], claves)

  poner("titulo", "DISPONIBILIDAD DE APLICADORES")
  poner("nota", paste(
    "Quién puede estar en campo. Sale del libro de disponibilidad que el equipo",
    "llenó; la app no la inventa."
  ))
  poner("nota", "")

  # --- tabla 1: cuántos hay, hora por hora -----------------------------------
  poner("bloque", "CUÁNTOS HAY, HORA POR HORA")
  poner("nota", "Un tramo en 0 o en 1 es donde el día se cae si alguien falla: ahí hace falta reclutar.")
  poner("cabecera", c("TRAMO", cabecera_dias))

  # El eje horario es la UNIÓN de lo que cubre cada día, no un 07:00–22:00 fijo:
  # una hoja con quince filas vacías arriba y abajo es la que se vuelve críptica.
  conteo <- list()
  for (k in claves) {
    for (f in (por_dia[[k]][["franjas"]] %||% list())) {
      tramo <- sprintf("%s a %s", .ald_txt(f[["inicio"]]), .ald_txt(f[["fin"]]))
      if (is.null(conteo[[tramo]])) conteo[[tramo]] <- stats::setNames(integer(length(claves)), claves)
      conteo[[tramo]][[k]] <- as.integer(f[["disponibles"]] %||% length(f[["nombres"]] %||% list()))
    }
  }
  tramos <- names(conteo)
  # Por hora de inicio, que es como se lee un horario.
  tramos <- tramos[order(vapply(tramos, function(t) substr(t, 1L, 5L), character(1)), method = "radix")]
  for (t in tramos) {
    poner("dato", c(t, as.character(as.integer(conteo[[t]]))))
  }
  poner("nota", "")

  # --- tabla 2: quién puede cada día ------------------------------------------
  #
  # La celda es el RANGO de la persona ese día, no un aspa: «08:00 a 11:00» dice
  # cuándo llamarla y un aspa obliga a bajar a la tabla de arriba a buscarlo.
  rangos <- .ald_rangos_por_persona(cruda, por_dia, claves)
  if (length(rangos)) {
    poner("bloque", "QUIÉN PUEDE CADA DÍA")
    poner("cabecera", c("APLICADOR", cabecera_dias))
    for (nombre in names(rangos)) {
      poner("dato", c(nombre, unname(rangos[[nombre]][claves])))
    }
  }

  filas
}

# Persona → (día → rango legible). De la oferta CRUDA cuando la hay, porque ahí
# están los bloques tal como los declaró cada quien; si sólo llega el bloque ya
# armado, se reconstruye pegando sus franjas contiguas.
.ald_rangos_por_persona <- function(cruda, por_dia, claves) {
  vacio <- stats::setNames(rep("", length(claves)), claves)
  out <- list()

  if (!is.null(cruda) && length(cruda)) {
    oferta <- .marep_oferta(cruda)
    for (nombre in sort(names(oferta) %||% character(0), method = "radix")) {
      fila <- vacio
      for (k in claves) {
        bloques <- oferta[[nombre]][[k]] %||% list()
        if (!length(bloques)) next
        fila[[k]] <- paste(vapply(bloques, function(b)
          sprintf("%s a %s", .mav_hhmm(b[[1L]]), .mav_hhmm(b[[2L]])), character(1)),
          collapse = " · ")
      }
      out[[aulas_nombre_aplicador(nombre)]] <- fila
    }
    return(out[order(names(out), method = "radix")])
  }

  # Sin oferta cruda: de las franjas del bloque, pegando las contiguas de cada
  # persona para no escribir seis tramos de media hora donde hay uno de tres.
  presencias <- list()
  for (k in claves) {
    for (f in (por_dia[[k]][["franjas"]] %||% list())) {
      for (n in unlist(f[["nombres"]] %||% list())) {
        presencias[[n]][[k]] <- c(presencias[[n]][[k]] %||% character(0),
                                  sprintf("%s|%s", .ald_txt(f[["inicio"]]), .ald_txt(f[["fin"]])))
      }
    }
  }
  for (n in sort(names(presencias) %||% character(0), method = "radix")) {
    fila <- vacio
    for (k in claves) {
      trozos <- presencias[[n]][[k]] %||% character(0)
      if (!length(trozos)) next
      partes <- do.call(rbind, strsplit(sort(trozos, method = "radix"), "|", fixed = TRUE))
      juntos <- character(0)
      ini <- partes[1L, 1L]; fin <- partes[1L, 2L]
      for (i in seq_len(nrow(partes))[-1L]) {
        if (identical(partes[i, 1L], fin)) { fin <- partes[i, 2L]; next }
        juntos <- c(juntos, sprintf("%s a %s", ini, fin))
        ini <- partes[i, 1L]; fin <- partes[i, 2L]
      }
      fila[[k]] <- paste(c(juntos, sprintf("%s a %s", ini, fin)), collapse = " · ")
    }
    out[[aulas_nombre_aplicador(n)]] <- fila
  }
  out[order(names(out), method = "radix")]
}

#' Los values de la hoja para el publicador de Sheets: filas planas.
#'
#' `NULL` cuando no hay oferta, que es la señal de «esta hoja no juega esta
#' publicación» que el publicador ya entiende para la de asignación.
#'
#' @param disponibilidad la oferta de la sesión.
#' @return lista de filas de celdas, o `NULL`.
#' @keywords internal
aulas_libro_valores_disponibilidad <- function(disponibilidad = list()) {
  filas <- aulas_libro_filas_disponibilidad(disponibilidad)
  if (is.null(filas)) return(NULL)
  ancho <- max(vapply(filas, function(f) length(f$celdas), integer(1)))
  lapply(filas, function(f) {
    celdas <- f$celdas
    if (length(celdas) < ancho) celdas <- c(celdas, rep("", ancho - length(celdas)))
    as.list(celdas)
  })
}

#' Escribe la hoja «Disponibilidad de aplicadores» sobre el workbook del libro.
#'
#' Hermana de `aulas_libro_hoja_asignacion`: mismos estilos por TIPO de fila,
#' para que las dos hojas de la app se lean como la misma familia.
#'
#' @param wb workbook de openxlsx ya en construcción.
#' @param disponibilidad la clave de sesión; `NULL` o vacía = no se escribe.
#' @return TRUE si la hoja se escribió; FALSE si no había oferta.
#' @keywords internal
aulas_libro_hoja_disponibilidad <- function(wb, disponibilidad) {
  filas <- aulas_libro_filas_disponibilidad(disponibilidad)
  if (is.null(filas)) return(invisible(FALSE))

  hoja <- "Disponibilidad de aplicadores"
  openxlsx::addWorksheet(wb, hoja)

  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    dia = openxlsx::createStyle(textDecoration = "bold", fontColour = "#FFFFFF",
                                fgFill = "#A0464E", fontSize = 11),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
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

  # **El hueco se ve sin leerlo.** Una celda en 0 o en 1 es donde el día se cae
  # si alguien falla, y es justo lo que la hoja existe para enseñar. Se tiñe la
  # CELDA y no la fila: la fila es información, el aviso es el número.
  #
  # Sólo en la primera tabla: en la segunda las celdas son rangos horarios, no
  # conteos, y un «08:00 a 11:00» no se compara con uno.
  flaco <- openxlsx::createStyle(fontColour = "#8F3A42", textDecoration = "bold")
  vacio <- openxlsx::createStyle(fontColour = "#B8ADA8")
  en_conteos <- FALSE
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (identical(f$tipo, "bloque")) {
      en_conteos <- identical(f$celdas[[1]], "CUÁNTOS HAY, HORA POR HORA")
      next
    }
    if (!en_conteos || !identical(f$tipo, "dato")) next
    for (j in seq_along(f$celdas)[-1L]) {
      n <- suppressWarnings(as.integer(f$celdas[[j]]))
      if (is.na(n)) next
      openxlsx::addStyle(wb, hoja, if (n == 0L) vacio else if (n == 1L) flaco else NULL,
                         rows = i, cols = j, stack = TRUE)
    }
  }

  n_cols <- max(vapply(filas, function(f) length(f$celdas), integer(1)))
  # La primera columna lleva el tramo o el nombre; las de día, un rango.
  openxlsx::setColWidths(wb, hoja, cols = 1L, widths = 34)
  if (n_cols > 1L) openxlsx::setColWidths(wb, hoja, cols = 2:n_cols, widths = 17)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 4L, firstActiveCol = 2L)
  invisible(TRUE)
}

# --- formato en Google Sheets (misma familia que asignación y avance) ---------
#
# Mismo patrón fila a fila que `aulas_libro_asignacion_formato_requests`: todo
# derivado del CONTENIDO publicado y jamás de números mágicos, para que la hoja
# no se descuadre cuando cambie de alto. Y los rótulos que se detectan son LOS
# MISMOS que emite `aulas_libro_filas_disponibilidad`: un solo dueño.

# UNA celda, no la fila entera: el aviso de esta hoja es el número, y teñir su
# fila diría que el día completo está flaco cuando sólo lo está ese tramo.
# `.maaf_banda` pinta de la columna 0 a la n; aquí se acota a una.
.ald_celda <- function(sheet_id, fila, col, fondo, tinta) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(
      backgroundColor = .monitoreo_sheets_rgb(fondo),
      textFormat = list(bold = TRUE, foregroundColor = .monitoreo_sheets_rgb(tinta))
    )),
    fields = "userEnteredFormat(backgroundColor,textFormat)"
  ))
}

#' Requests de formato de la hoja de disponibilidad para el batch-2 del motor.
#'
#' Mismo patrón fila a fila que `aulas_libro_asignacion_formato_requests`: todo
#' derivado del CONTENIDO publicado y jamás de números mágicos, para que la hoja
#' no se descuadre cuando cambie de alto. Los rótulos que se detectan son LOS
#' MISMOS que emite `aulas_libro_filas_disponibilidad`: un solo dueño.
#'
#' @param sheet_id id numérico de la pestaña.
#' @param rows los values realmente publicados.
#' @return lista de requests de la API de Sheets.
#' @keywords internal
aulas_libro_disponibilidad_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  en_conteos <- FALSE
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    llenas <- celdas[nzchar(celdas)]
    if (identical(primera, "DISPONIBILIDAD DE APLICADORES")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% c("CUÁNTOS HAY, HORA POR HORA", "QUIÉN PUEDE CADA DÍA")) {
      en_conteos <- identical(primera, "CUÁNTOS HAY, HORA POR HORA")
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (primera %in% c("TRAMO", "APLICADOR")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (length(llenas) == 1L && nzchar(primera)) {
      # Las notas: gris pequeño e itálico, como en sus hermanas.
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    } else if (en_conteos && length(llenas) > 1L) {
      # El hueco, celda a celda y SOLO donde importa: un request por cada 0 o 1.
      # Pintar la tabla entera serían ciento ochenta requests para decir lo que
      # dicen doce.
      for (j in seq_along(celdas)[-1L]) {
        n <- suppressWarnings(as.integer(celdas[[j]]))
        if (is.na(n) || n > 1L) next
        poner(.ald_celda(sheet_id, i, j,
                          if (n == 0L) "#F5F5F4" else "#FBE9EA",
                          if (n == 0L) "#B8ADA8" else "#8F3A42"))
      }
    }
  }
  if (n_cols >= 2L) {
    poner(.mafs_dim_request(sheet_id, 0L, 1L, 248L))
    poner(.mafs_dim_request(sheet_id, 1L, n_cols, 124L))
    # Los conteos y los rangos, centrados: se leen en columna.
    poner(.maaf_centrar(sheet_id, 1L, n_cols, length(rows)))
  }
  requests
}
