# Formato y desplegables del libro de aulas publicado a Google Sheets — B8/W2.
#
# Dictado textual de Gonzalo tras ver la siembra real: «no hay nada del formato
# que el Excel tenía, los colores, se ve genuinamente fatal»; «el status de
# muestra está como sin contactar pero no hay ningún desplegable»; «la forma de
# contacto solo debería ser o por teléfono o por correo».
#
# La paleta NO se inventa aquí: es la del `.xlsx` (carga_aulas_libro_formato.R)
# — cabecera #002457 con texto blanco en negrita, bandas de eslabón de
# `aulas_libro_colores_eslabon()` y el semáforo de estados (#E3F3E8/#155E2E el
# verde de lo cerrado). Los vocabularios de los desplegables son los MISMOS de
# la hoja «Listas» del xlsx (`aulas_libro_status_muestra`,
# `AULAS_LIBRO_MEDIO_CONTACTO`, `AULAS_LIBRO_DIA`,
# `AULAS_LIBRO_STATUS_APLICACION`): una lista, no dos.
#
# Dos decisiones de forma que el motor genérico no toma
# (`.monitoreo_sheets_professional_format_requests`, monitoreo_engine.R:5685,
# que NO se usa aquí — congela 1 fila para todas las hojas y emite una request
# de ancho POR COLUMNA, 253 en la agenda real):
#
#   1. La cabecera entera —color de cada celda, banda de eslabón incluida— va
#      en UN `updateCells` con `fields = "userEnteredFormat(...)"`: no toca
#      values ni dataValidation y cuesta lo mismo con 3 bloques que con 12.
#   2. Los anchos van por RANGOS agrupados (≤4 por hoja), jamás uno por
#      columna: el presupuesto del libro completo queda muy por debajo de las
#      30 requests que pinea el contrato.
#
# Estas requests viajan en el batch-2 del motor de publicación (DESPUÉS de los
# values): el reset de una pestaña con dimensiones cambiadas
# (`.monitoreo_sheets_reset_tab_requests`) borra el rectángulo entero con
# `updateCells` — userEnteredFormat Y dataValidation incluidos — así que emitir
# validaciones antes de escribir sería regalarlas al borrado.

# --- geometría de las hojas de bloques ---------------------------------------

# Ancho de un bloque de la hoja de campo: ID MATCH + los 21 títulos de agenda
# que repite + los títulos propios del parte. Derivado de las specs, no un 35 a
# mano: si el bloque gana un campo, esto sigue midiendo bien.
.mafs_ancho_campo <- function() {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE + length(.calg_titulos_campo())
}

# Cuántos bloques (eslabones o intentos) caben en el ancho publicado.
.mafs_bloques <- function(hoja, n_cols) {
  n_cols <- max(1L, .monitoreo_int(n_cols, 1L))
  if (identical(hoja, "Aulas Agendadas")) {
    return(max(1L, (n_cols - 1L) %/% AULAS_AGENDADAS_ANCHO_BLOQUE))
  }
  if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    return(max(1L, n_cols %/% .mafs_ancho_campo()))
  }
  1L
}

# Columna (1-based) de un campo del bloque de agenda en el bloque `b`. Por
# nombre de campo contra la spec, igual que las validaciones del xlsx.
.mafs_col_agenda <- function(campo, b) {
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) identical(s$campo, campo), logical(1)))
  1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + idx[[1]]
}

# Columna (1-based) de un título del parte de campo en el intento `b`.
.mafs_col_campo <- function(titulo, b) {
  (b - 1L) * .mafs_ancho_campo() + 1L + AULAS_AGENDADAS_ANCHO_BLOQUE +
    which(.calg_titulos_campo() == titulo)[[1]]
}

# --- colores de la fila de banda ---------------------------------------------

# El color hex de CADA columna de la fila de banda (la primera). Es la misma
# escala del xlsx: titular navy, reemplazos aclarándose por eslabón
# (`aulas_libro_colores_eslabon`), y en la «Base de control» los cuatro tramos
# temáticos con su propia escala. Lo que no cae en ningún bloque queda navy.
.mafs_colores_banda <- function(hoja, n_cols) {
  navy <- "#002457"
  colores <- rep(navy, n_cols)
  if (identical(hoja, "Aulas Agendadas")) {
    bloques <- .mafs_bloques(hoja, n_cols)
    tonos <- aulas_libro_colores_eslabon(bloques)
    for (b in seq_len(bloques)) {
      desde <- 1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + 1L
      hasta <- min(n_cols, 1L + b * AULAS_AGENDADAS_ANCHO_BLOQUE)
      if (desde <= hasta) colores[desde:hasta] <- tonos[[min(b, length(tonos))]]
    }
  } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    bloques <- .mafs_bloques(hoja, n_cols)
    tonos <- aulas_libro_colores_eslabon(bloques)
    ancho <- .mafs_ancho_campo()
    for (b in seq_len(bloques)) {
      desde <- (b - 1L) * ancho + 1L
      hasta <- min(n_cols, b * ancho)
      if (desde <= hasta) colores[desde:hasta] <- tonos[[min(b, length(tonos))]]
    }
  } else if (identical(hoja, "Base de control")) {
    grupos <- aulas_libro_grupos_control()
    escala <- aulas_libro_colores_eslabon(max(1L, length(grupos)))
    for (k in seq_along(grupos)) {
      desde <- max(1L, .monitoreo_int(grupos[[k]]$desde, 1L))
      hasta <- min(n_cols, .monitoreo_int(grupos[[k]]$hasta, 0L))
      if (desde <= hasta) colores[desde:hasta] <- escala[[min(k, length(escala))]]
    }
  }
  colores
}

# --- constructores de requests ------------------------------------------------

.mafs_celda_cabecera <- function(hex) {
  list(userEnteredFormat = list(
    backgroundColor = .monitoreo_sheets_rgb(hex),
    textFormat = list(bold = TRUE, foregroundColor = .monitoreo_sheets_rgb("#FFFFFF")),
    wrapStrategy = "WRAP",
    verticalAlignment = "MIDDLE"
  ))
}

.mafs_dim_request <- function(sheet_id, desde, hasta, pixeles) {
  list(updateDimensionProperties = list(
    range = list(
      sheetId = sheet_id, dimension = "COLUMNS",
      startIndex = as.integer(desde), endIndex = as.integer(hasta)
    ),
    properties = list(pixelSize = as.integer(pixeles)),
    fields = "pixelSize"
  ))
}

# Una regla condicional «contiene texto» sobre varias columnas NO contiguas:
# UNA request con un rango por columna (los eslabones están a 21 columnas de
# distancia y no pueden pedirse como rectángulo). `indice` es el orden de
# precedencia: el reset del motor ya borró las reglas previas de la pestaña,
# así que la numeración local es exacta.
.mafs_regla_contiene <- function(sheet_id, cols, desde, hasta, texto, fondo, tinta, indice) {
  list(addConditionalFormatRule = list(
    rule = list(
      ranges = lapply(cols, function(col) list(
        sheetId = sheet_id,
        startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
        startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
      )),
      booleanRule = list(
        condition = list(
          type = "TEXT_CONTAINS",
          values = list(list(userEnteredValue = texto))
        ),
        format = list(
          backgroundColor = .monitoreo_sheets_rgb(fondo),
          textFormat = list(foregroundColor = .monitoreo_sheets_rgb(tinta), bold = TRUE)
        )
      )
    ),
    index = as.integer(indice)
  ))
}

# --- A. formato por hoja ------------------------------------------------------

#' Requests de formato de UNA hoja del libro de aulas en Sheets.
#'
#' Freeze de la(s) fila(s) de cabecera (el reparto de `.malp_cabeceras`: 1 en
#' «Aulas Agendadas» y «Plan del día», 2 en las demás), cabecera con la paleta
#' del xlsx (navy #002457 + blanco en negrita, bandas de eslabón), semáforo de
#' estados con los colores del xlsx y anchos de columna por rangos agrupados.
#'
#' @param hoja nombre de la hoja del libro.
#' @param sheet_id sheetId remoto de la pestaña.
#' @param n_filas filas publicadas (cabeceras incluidas).
#' @param n_cols columnas publicadas.
#' @return lista de requests de batchUpdate, todas sobre `sheet_id`.
#' @keywords internal
monitoreo_aulas_sheets_formato_requests <- function(hoja, sheet_id, n_filas, n_cols) {
  hoja <- .monitoreo_scalar(hoja, "")
  n_filas <- max(0L, .monitoreo_int(n_filas, 0L))
  n_cols <- max(1L, .monitoreo_int(n_cols, 1L))
  cabeceras <- min(.malp_cabeceras(hoja), max(1L, n_filas))
  requests <- list()

  # Freeze: las filas de cabecera y la primera columna (en una hoja de 253
  # columnas, perder de vista el ID es perder la fila — mismo panel que el
  # xlsx). Congelarlo TODO lo rechaza Google («no se pueden inmovilizar todas
  # las filas visibles»), de ahí las guardas.
  requests[[length(requests) + 1L]] <- list(updateSheetProperties = list(
    properties = list(
      sheetId = sheet_id,
      gridProperties = list(
        frozenRowCount = if (n_filas > cabeceras) as.integer(cabeceras) else 0L,
        frozenColumnCount = if (n_cols > 1L) 1L else 0L
      )
    ),
    fields = "gridProperties(frozenRowCount,frozenColumnCount)"
  ))

  # La cabecera entera en UN updateCells de solo-formato: fila de banda con el
  # color de su eslabón/tramo y fila de títulos navy. `fields` acotado a
  # userEnteredFormat — no toca values ni dataValidation.
  if (n_filas >= 1L) {
    banda <- .mafs_colores_banda(hoja, n_cols)
    filas_formato <- lapply(seq_len(cabeceras), function(fila) {
      colores <- if (fila == 1L) banda else rep("#002457", n_cols)
      list(values = lapply(colores, .mafs_celda_cabecera))
    })
    requests[[length(requests) + 1L]] <- list(updateCells = list(
      range = list(
        sheetId = sheet_id,
        startRowIndex = 0L, endRowIndex = as.integer(cabeceras),
        startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
      ),
      rows = filas_formato,
      fields = "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)"
    ))
  }

  # Semáforo de estados, con los MISMOS tonos del xlsx
  # (carga_aulas_libro_formato.R:384-389): verde lo cerrado, azul lo que
  # espera en cadena, gris lo que ya no se toca, ámbar lo que espera acción.
  # `contains` igual que allá: «REAGENDADA» cae en el verde de «AGENDADA» y un
  # estado nuevo simplemente no se tiñe.
  if (n_filas > cabeceras) {
    bloques <- .mafs_bloques(hoja, n_cols)
    if (identical(hoja, "Aulas Agendadas")) {
      cols_status <- vapply(seq_len(bloques), function(b) .mafs_col_agenda("sample_status", b), integer(1))
      cols_status <- cols_status[cols_status <= n_cols]
      if (length(cols_status)) {
        reglas <- list(
          list(texto = "AGENDADA", fondo = "#E3F3E8", tinta = "#155E2E"),
          list(texto = "EN RESERVA", fondo = "#E7EEF9", tinta = "#1B4B8F"),
          list(texto = "REEMPLAZADA", fondo = "#EEF0F3", tinta = "#5B6472")
        )
        for (i in seq_along(reglas)) {
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_status, cabeceras, n_filas,
            reglas[[i]]$texto, reglas[[i]]$fondo, reglas[[i]]$tinta, i - 1L
          )
        }
      }
    } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
      cols_status <- vapply(seq_len(bloques), function(b) .mafs_col_campo("STATUS DE APLICACIÓN", b), integer(1))
      cols_status <- cols_status[cols_status <= n_cols]
      if (length(cols_status)) {
        # «NO APLICADA» PRIMERO (índice menor = mayor precedencia): contiene
        # «APLICADA», y al revés toda la columna saldría verde.
        reglas <- list(
          list(texto = "NO APLICADA", fondo = "#FBEDE3", tinta = "#8A4B1B"),
          list(texto = "APLICADA", fondo = "#E3F3E8", tinta = "#155E2E")
        )
        for (i in seq_along(reglas)) {
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_status, cabeceras, n_filas,
            reglas[[i]]$texto, reglas[[i]]$fondo, reglas[[i]]$tinta, i - 1L
          )
        }
      }
    }
  }

  # Anchos por RANGOS agrupados, jamás uno por columna. La columna sin ancho
  # queda en el defecto de 100px, así que entre todos cubren el rectángulo
  # entero. El detalle por contenido del xlsx no se replica: a 253 columnas la
  # cuota de batchUpdate manda, y tres anchos —identificador, titular, resto—
  # ya distinguen lo que se trabaja de lo que se consulta.
  if (identical(hoja, "Aulas Agendadas")) {
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, 1L, 64L)
    corte_titular <- min(n_cols, 1L + AULAS_AGENDADAS_ANCHO_BLOQUE)
    if (corte_titular > 1L) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 1L, corte_titular, 160L)
    }
    if (n_cols > corte_titular) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, corte_titular, n_cols, 132L)
    }
  } else if (identical(hoja, "Base de control")) {
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, 1L, 72L)
    if (n_cols > 1L) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 1L, n_cols, 132L)
    }
  } else {
    px <- if (identical(hoja, "Aulas Aplicadas (Campo)")) 140L else 150L
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, n_cols, px)
  }

  requests
}

# --- B. validaciones (desplegables) -------------------------------------------

.mafs_validacion_request <- function(sheet_id, col, desde, hasta, valores) {
  list(setDataValidation = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    rule = list(
      condition = list(
        type = "ONE_OF_LIST",
        values = lapply(valores, function(v) list(userEnteredValue = v))
      ),
      # El chip visible es la queja literal del dictado: sin showCustomUi no
      # hay desplegable que ver. `strict = FALSE` es el allowBlank +
      # showErrorMsg = FALSE del xlsx: los libros existentes traen valores
      # viejos («Llamada») y la validación no debe pelearse con ellos.
      showCustomUi = TRUE,
      strict = FALSE
    )
  ))
}

#' Requests setDataValidation de UNA hoja del equipo del libro de aulas.
#'
#' Los vocabularios son los MISMOS de la hoja «Listas» del xlsx: STATUS
#' MUESTRA a la profundidad real de las cadenas, MEDIO DE CONTACTO
#' (`AULAS_LIBRO_MEDIO_CONTACTO`), DÍA (`AULAS_LIBRO_DIA`) y —en la hoja de
#' campo— STATUS DE APLICACIÓN. UNA columna por request: la lección del xlsx,
#' donde un sqref rectangular dejaba el desplegable de STATUS MUESTRA sobre el
#' nombre del docente. Las hojas de la app no llevan desplegables: nadie
#' escribe en ellas.
#'
#' @param hoja nombre de la hoja del libro.
#' @param sheet_id sheetId remoto de la pestaña.
#' @param n_filas filas publicadas (cabeceras incluidas).
#' @param profundidad bloques de la hoja: eslabones de cadena en la agenda,
#'   intentos en la hoja de campo.
#' @return lista de requests setDataValidation (vacía para hojas sin
#'   desplegables o sin filas de datos).
#' @keywords internal
monitoreo_aulas_sheets_validaciones_requests <- function(hoja, sheet_id, n_filas, profundidad) {
  hoja <- .monitoreo_scalar(hoja, "")
  n_filas <- max(0L, .monitoreo_int(n_filas, 0L))
  profundidad <- max(1L, .monitoreo_int(profundidad, 1L))
  cabeceras <- .malp_cabeceras(hoja)
  if (n_filas <= cabeceras) return(list())

  requests <- list()
  if (identical(hoja, "Aulas Agendadas")) {
    specs <- list(
      list(campo = "sample_status", valores = aulas_libro_status_muestra(profundidad)),
      list(campo = "contact_medium", valores = AULAS_LIBRO_MEDIO_CONTACTO),
      list(campo = "scheduled_day", valores = AULAS_LIBRO_DIA)
    )
    for (spec in specs) {
      for (b in seq_len(profundidad)) {
        requests[[length(requests) + 1L]] <- .mafs_validacion_request(
          sheet_id, .mafs_col_agenda(spec$campo, b), cabeceras, n_filas, spec$valores
        )
      }
    }
  } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    for (b in seq_len(profundidad)) {
      requests[[length(requests) + 1L]] <- .mafs_validacion_request(
        sheet_id, .mafs_col_campo("STATUS DE APLICACIÓN", b), cabeceras, n_filas,
        AULAS_LIBRO_STATUS_APLICACION
      )
    }
  }
  requests
}
