# =============================================================================
# monitoreo_sheets_bloques.R — Hojas de barrido con bloques lado a lado
# =============================================================================
#
# Una hoja de barrido puede traer, en la MISMA fila, dos o más listas con el
# mismo juego de columnas: el ACNUR RMS 2026 pasó de una tabla con `Origen`
# (Muestra/Backup) a dos bloques —A–O la muestra, P vacía, Q–AD el backup—,
# cada uno con su `Código proGres`. Leída como tabla única, la segunda llave
# se vuelve `Código proGres_1`, el backup no es caso de nadie y `Origen`
# desaparece, así que las dimensiones declaradas sobre él quedan huérfanas.
#
# Qué hace: si el encabezado repite el juego de columnas, APILA los bloques.
#   - Cada fila de cada bloque con llave es un caso; sin llave se descarta.
#   - `Origen` lleva el rótulo del bloque: el encabezado que lo distingue de
#     los demás en la misma posición («Muestra», «Backup»), o «Bloque k».
#     Si esa columna sólo repite su propio rótulo, se pliega en `Origen`.
#   - `Par de` guarda la llave del caso del otro bloque en la misma fila. Sólo
#     eso: que compartan fila no dice que uno reemplace al otro.
#   - Las columnas propias de un bloque (p. ej. «¿Se reemplaza con el
#     Backup?») quedan vacías en las filas de los demás.
# Si no hay bloques, se lee igual que siempre (`.monitoreo_values_to_dataframe`)
# y, si la columna de origen tiene otro nombre, se le añade `Origen`
# (monitoreo_sheets_origen.R).
#
# Quién lo llama: `monitoreo_sheets_read_source()` (monitoreo_engine.R,
# congelado: sólo reemplaza su llamada). Gate: test-monitoreo-sheets-bloques.R.
# =============================================================================

.MONITOREO_BLOQUES_COL_ORIGEN <- "Origen"
.MONITOREO_BLOQUES_COL_PAR <- "Par de"
# Un bloque es «el mismo juego» si comparte al menos esto con los demás.
.MONITOREO_BLOQUES_MIN_COMUNES <- 3L
.MONITOREO_BLOQUES_MIN_FRACCION_COMUN <- 0.5
# La llave identifica: la mayoría de sus valores no vacíos son distintos.
.MONITOREO_BLOQUES_MIN_UNICIDAD_LLAVE <- 0.9

.monitoreo_bloques_filas <- function(values) {
  lapply(values, function(row) {
    x <- as.character(row %||% character(0))
    x[is.na(x)] <- ""
    x
  })
}

.monitoreo_bloques_celda <- function(fila, j) {
  if (j > length(fila)) "" else fila[[j]]
}

.monitoreo_bloques_columna <- function(filas, j) {
  vapply(filas, .monitoreo_bloques_celda, character(1), j = j)
}

# Rangos [inicio, fin] de cada bloque a partir de las posiciones de la llave,
# sin las columnas vacías que los separan.
.monitoreo_bloques_rangos <- function(header, pos) {
  offset <- pos[[1]] - 1L
  inicios <- integer(length(pos))
  inicios[[1]] <- 1L
  for (k in seq_along(pos)[-1]) {
    s <- pos[[k]] - offset
    inicios[[k]] <- if (s > pos[[k - 1L]]) s else pos[[k]]
  }
  fines <- c(inicios[-1] - 1L, length(header))
  lapply(seq_along(inicios), function(k) {
    idx <- seq.int(inicios[[k]], fines[[k]])
    llenas <- idx[nzchar(header[idx])]
    seq.int(min(llenas), max(llenas))
  })
}

#' Detecta bloques repetidos en el encabezado de una hoja de barrido.
#'
#' @param header encabezado crudo (una fila de la hoja).
#' @param filas filas de datos ya alineadas como vectores de texto.
#' @return NULL si la hoja es de un solo bloque; si no, lista con `llave`,
#'   `bloques` (índices de columna por bloque), `rotulos` y `col_rotulo`
#'   (índice absoluto de la columna que da el rótulo, o NA).
#' @noRd
.monitoreo_sheets_bloques_detectar <- function(header, filas = list()) {
  h <- trimws(as.character(header %||% character(0)))
  h[is.na(h)] <- ""
  llenos <- h[nzchar(h)]
  repetidos <- unique(llenos[duplicated(llenos)])
  if (!length(repetidos)) return(NULL)
  for (llave in llenos[llenos %in% repetidos & !duplicated(llenos)]) {
    pos <- which(h == llave)
    bloques <- .monitoreo_bloques_rangos(h, pos)
    nombres <- lapply(bloques, function(idx) h[idx][nzchar(h[idx])])
    if (any(vapply(seq_along(bloques), function(k) !(pos[[k]] %in% bloques[[k]]), logical(1)))) next
    comunes <- Reduce(intersect, nombres)
    tamanos <- lengths(nombres)
    if (length(comunes) < .MONITOREO_BLOQUES_MIN_COMUNES) next
    if (length(comunes) < .MONITOREO_BLOQUES_MIN_FRACCION_COMUN * min(tamanos)) next
    if (min(tamanos) < .MONITOREO_BLOQUES_MIN_FRACCION_COMUN * max(tamanos)) next
    # Una columna repetida que no identifica (Fecha, Status de cada intento)
    # no es llave: bloques de intentos no se apilan.
    valores <- trimws(.monitoreo_bloques_columna(filas, pos[[1]]))
    valores <- valores[nzchar(valores)]
    if (length(valores) && length(unique(valores)) / length(valores) < .MONITOREO_BLOQUES_MIN_UNICIDAD_LLAVE) next
    rotulo <- .monitoreo_bloques_rotulo(h, bloques, nombres)
    return(list(llave = llave, pos_llave = pos, bloques = bloques,
                rotulos = rotulo$rotulos, col_rotulo = rotulo$col))
  }
  NULL
}

# El rótulo de cada bloque: la primera posición relativa donde los encabezados
# son todos distintos, no vacíos y propios (no aparecen en otro bloque).
.monitoreo_bloques_rotulo <- function(h, bloques, nombres) {
  n_min <- min(lengths(bloques))
  for (i in seq_len(n_min)) {
    cols <- vapply(bloques, function(idx) idx[[i]], integer(1))
    nm <- h[cols]
    if (!all(nzchar(nm)) || anyDuplicated(nm)) next
    propios <- vapply(seq_along(nm), function(k) {
      !nm[[k]] %in% unlist(nombres[-k], use.names = FALSE)
    }, logical(1))
    if (all(propios)) return(list(rotulos = nm, col = cols))
  }
  list(rotulos = sprintf("Bloque %d", seq_along(bloques)), col = rep(NA_integer_, length(bloques)))
}

# Nombre libre para una columna derivada si la hoja ya trae una igual.
.monitoreo_bloques_nombre_libre <- function(base, usados) {
  if (!.monitoreo_text_key(base) %in% .monitoreo_text_key(usados)) return(base)
  paste(base, "(bloque)")
}

#' Lee los values de una pestaña; apila los bloques si los hay.
#'
#' Reemplaza a `.monitoreo_values_to_dataframe()` en el lector de fuentes
#' Sheets: sin bloques, delega en él y el resultado es idéntico.
#'
#' @param values `values` de la API de Sheets (lista de filas).
#' @param header_row fila del encabezado (1 = primera).
#' @return data.frame de texto. Con bloques, trae el atributo
#'   `monitoreo_bloques` (llave, rótulos y casos por bloque).
#' @noRd
monitoreo_sheets_bloques_dataframe <- function(values, header_row = 1L) {
  legado <- function() .monitoreo_values_to_dataframe(values, header_row)
  if (is.null(values) || !length(values)) return(legado())
  header_row <- max(1L, .monitoreo_int(header_row, 1L))
  filas <- .monitoreo_bloques_filas(values)
  if (length(filas) <= header_row) return(legado())
  header <- trimws(filas[[header_row]])
  datos <- filas[(header_row + 1L):length(filas)]
  det <- .monitoreo_sheets_bloques_detectar(header, datos)
  # Un bloque: el origen puede venir en una columna con otro nombre
  # («Muestra»: Muestra/Backup); monitoreo_sheets_origen.R lo reconoce.
  if (is.null(det)) return(.monitoreo_sheets_origen_un_bloque(legado()))
  .monitoreo_bloques_apilar(header, datos, det)
}

.monitoreo_bloques_apilar <- function(header, datos, det) {
  n_bloques <- length(det$bloques)
  llaves <- lapply(det$pos_llave, function(j) trimws(.monitoreo_bloques_columna(datos, j)))
  todos <- unique(header[nzchar(header)])
  col_origen <- .monitoreo_bloques_nombre_libre(.MONITOREO_BLOQUES_COL_ORIGEN, todos)
  col_par <- .monitoreo_bloques_nombre_libre(.MONITOREO_BLOQUES_COL_PAR, todos)

  partes <- vector("list", n_bloques)
  casos <- integer(n_bloques)
  descartadas <- integer(n_bloques)
  orden <- character(0)
  for (k in seq_len(n_bloques)) {
    idx <- det$bloques[[k]]
    con_llave <- nzchar(llaves[[k]])
    casos[[k]] <- sum(con_llave)
    descartadas[[k]] <- sum(!con_llave & vapply(datos, function(f) {
      any(nzchar(trimws(vapply(idx, .monitoreo_bloques_celda, character(1), fila = f))))
    }, logical(1)))
    rotulo_col <- det$col_rotulo[[k]]
    cols <- list()
    nombres_k <- character(0)
    for (j in idx) {
      nm <- header[[j]]
      valores <- .monitoreo_bloques_columna(datos, j)[con_llave]
      if (!nzchar(nm)) {
        if (!any(nzchar(trimws(valores)))) next
        nm <- paste0("col_", j)
      }
      if (!is.na(rotulo_col) && identical(j, rotulo_col)) {
        # El rótulo se pliega en `Origen` si la columna sólo lo repite.
        llenos <- trimws(valores[nzchar(trimws(valores))])
        if (all(.monitoreo_text_key(llenos) == .monitoreo_text_key(nm))) {
          nombres_k <- c(nombres_k, col_origen)
          cols[[col_origen]] <- rep(det$rotulos[[k]], sum(con_llave))
          next
        }
      }
      nm <- make.unique(c(nombres_k, nm), sep = "_")[[length(nombres_k) + 1L]]
      nombres_k <- c(nombres_k, nm)
      cols[[nm]] <- valores
    }
    if (!col_origen %in% nombres_k) {
      nombres_k <- c(nombres_k, col_origen)
      cols[[col_origen]] <- rep(det$rotulos[[k]], sum(con_llave))
    }
    otras <- llaves[-k]
    cols[[col_par]] <- vapply(which(con_llave), function(r) {
      pares <- vapply(otras, function(v) v[[r]], character(1))
      paste(pares[nzchar(pares)], collapse = " | ")
    }, character(1))
    nombres_k <- c(nombres_k, col_par)
    orden <- c(orden, setdiff(nombres_k, orden))
    partes[[k]] <- cols
  }
  # `Par de` al final; `Origen` donde estaba el rótulo (o tras la llave).
  orden <- c(setdiff(orden, col_par), col_par)
  if (all(is.na(det$col_rotulo))) {
    orden <- setdiff(orden, col_origen)
    en <- match(det$llave, orden)
    orden <- append(orden, col_origen, after = en)
  }
  tablas <- lapply(partes, function(cols) {
    n <- length(cols[[col_par]])
    completas <- lapply(orden, function(nm) if (is.null(cols[[nm]])) rep("", n) else cols[[nm]])
    as.data.frame(stats::setNames(completas, orden), stringsAsFactors = FALSE, optional = TRUE)
  })
  out <- do.call(rbind, tablas)
  rownames(out) <- NULL
  names(out) <- orden
  attr(out, "monitoreo_bloques") <- list(
    llave = det$llave,
    rotulos = det$rotulos,
    casos = stats::setNames(as.list(casos), det$rotulos),
    descartadas = stats::setNames(as.list(descartadas), det$rotulos)
  )
  out
}
