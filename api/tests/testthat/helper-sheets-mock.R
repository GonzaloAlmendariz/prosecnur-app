# Mock compartido de la API de Google Sheets.
#
# Cuatro archivos de test llevan cada uno su COPIA de este fixture:
# test-monitoreo-sync-incremental.R (`.msi_sheets_mock`, el original),
# test-monitoreo-aulas-publicar-libro.R (`.mapl_sheets_mock`, la variante más
# rica), test-monitoreo-aulas-conversar.R y test-carga-aulas-libro-plan-dia.R.
# La nota de plan-dia pedía promoverlo a helper «cuando alguien lo necesite
# por tercera vez»: test-monitoreo-aulas-sheets-formato.R es el quinto
# consumidor y el que lo promueve. Se promueve la variante de publicar-libro:
# contesta metadata y lecturas de values, y APLICA los values:batchUpdate al
# estado, para que una siembra deje huella que la publicación siguiente relee.
#
# Las cuatro copias existentes se quedan como están A PROPÓSITO: migrarlas es
# trabajo del dueño de cada archivo, no de la oleada que promovió el helper.
#
# Sin red: todo pasa por `.monitoreo_google_api` mockeado con
# `testthat::local_mocked_bindings`.

# El título de pestaña que un rango A1 nombra («'Plan del día'!A1:C9» →
# «Plan del día»), sin las comillas escapadas del quoting de Sheets.
# La parte A1 de un rango («'Semana 1'!L1:L9» → «L1:L9»), o NULL si el rango
# nombra la pestaña entera.
.sheets_api_a1 <- function(rango) {
  x <- as.character(rango %||% "")[1]
  if (!grepl("!", x, fixed = TRUE)) return(NULL)
  sub("^.*!", "", x)
}

# Aplica un bloque de valores sobre la matriz de la pestaña en el rango A1 dado.
# Sólo lo que el motor usa: un ancla («A5») o un rango de una columna
# («L1:L93»), en ROWS o en COLUMNS.
.sheets_api_aplicar <- function(valores, a1, bloque, major) {
  col_num <- function(letras) {
    n <- 0L
    for (ch in strsplit(toupper(letras), "")[[1]]) n <- n * 26L + (utils::tail(which(LETTERS == ch), 1L))
    n
  }
  piezas <- strsplit(a1, ":", fixed = TRUE)[[1]]
  m <- regmatches(piezas[[1]], regexec("^([A-Za-z]+)([0-9]+)$", piezas[[1]]))[[1]]
  if (length(m) != 3L) return(valores)
  c0 <- col_num(m[[2]]); r0 <- as.integer(m[[3]])
  filas <- if (identical(major, "COLUMNS")) {
    # Una columna: cada valor del primer vector es una fila.
    lapply(unlist(bloque[[1]] %||% list(), use.names = FALSE), function(v) list(v))
  } else {
    bloque
  }
  for (k in seq_along(filas)) {
    fila <- r0 + k - 1L
    while (length(valores) < fila) valores[[length(valores) + 1L]] <- list()
    actual <- as.list(unlist(valores[[fila]] %||% list(), use.names = FALSE))
    nuevos <- as.list(unlist(filas[[k]] %||% list(), use.names = FALSE))
    for (j in seq_along(nuevos)) {
      pos <- c0 + j - 1L
      while (length(actual) < pos) actual[[length(actual) + 1L]] <- ""
      actual[[pos]] <- nuevos[[j]]
    }
    valores[[fila]] <- actual
  }
  valores
}

.sheets_api_sin_comillas <- function(rango) {
  rango <- sub("!.*$", "", as.character(rango %||% "")[1])
  gsub("''", "'", sub("^'(.*)'$", "\\1", rango))
}

.sheets_api_mock <- function() {
  env <- new.env(parent = emptyenv())
  env$sheets <- list()
  env$calls <- list()
  env$next_id <- 100L
  sembrar <- function(titulo, values = list()) {
    env$sheets[[titulo]] <- list(
      sheetId = env$next_id, title = titulo,
      developerMetadata = list(), values = values
    )
    env$next_id <- env$next_id + 1L
  }
  handler <- function(url, method = "GET", body = NULL) {
    env$calls[[length(env$calls) + 1L]] <- list(url = url, method = method, body = body)
    if (grepl("/values:batchUpdate$", url)) {
      celdas <- 0L
      for (entry in body$data %||% list()) {
        titulo <- .sheets_api_sin_comillas(entry$range)
        if (!nzchar(titulo) || is.null(env$sheets[[titulo]])) next
        a1 <- .sheets_api_a1(entry$range)
        if (is.null(a1)) {
          # Rango sin `!A1`: la pestaña ENTERA, que es como publica el motor.
          env$sheets[[titulo]]$values <- entry$values
          celdas <- celdas + length(entry$values %||% list())
          next
        }
        env$sheets[[titulo]]$values <- .sheets_api_aplicar(
          env$sheets[[titulo]]$values %||% list(), a1,
          entry$values %||% list(), entry$majorDimension %||% "ROWS"
        )
        celdas <- celdas + sum(vapply(entry$values %||% list(),
                                      function(v) length(unlist(v, use.names = FALSE)), 0L))
      }
      return(list(totalUpdatedSheets = length(body$data %||% list()),
                  totalUpdatedCells = celdas))
    }
    if (grepl("/values:batchGet", url)) {
      crudos <- regmatches(url, gregexpr("ranges=[^&]+", url))[[1]]
      vr <- lapply(crudos, function(r) {
        titulo <- .sheets_api_sin_comillas(utils::URLdecode(sub("^ranges=", "", r)))
        list(range = titulo, values = env$sheets[[titulo]]$values %||% list())
      })
      return(list(valueRanges = vr))
    }
    if (grepl("/values/", url)) {
      pedazo <- sub("[?].*$", "", sub(".*/values/", "", url))
      titulo <- .sheets_api_sin_comillas(utils::URLdecode(pedazo))
      return(list(values = env$sheets[[titulo]]$values %||% list()))
    }
    if (grepl("[?]fields=", url)) {
      return(list(
        spreadsheetId = "sheet_libro",
        sheets = unname(lapply(env$sheets, function(s) list(
          properties = list(
            sheetId = s$sheetId,
            title = s$title,
            gridProperties = list(rowCount = 1000L, columnCount = 26L)
          ),
          developerMetadata = s$developerMetadata
        )))
      ))
    }
    if (grepl(":batchUpdate$", url)) {
      apply_metadata <- function(sheet_id, key, value, update = FALSE) {
        for (nm in names(env$sheets)) {
          if (!identical(env$sheets[[nm]]$sheetId, sheet_id)) next
          md <- env$sheets[[nm]]$developerMetadata
          if (isTRUE(update)) {
            for (j in seq_along(md)) {
              if (identical(md[[j]]$metadataKey, key)) md[[j]]$metadataValue <- value
            }
          } else {
            md[[length(md) + 1L]] <- list(metadataKey = key, metadataValue = value)
          }
          env$sheets[[nm]]$developerMetadata <- md
        }
      }
      for (request in body$requests %||% list()) {
        title <- request$addSheet$properties$title %||% ""
        if (nzchar(title)) sembrar(title)
        # `insertDimension` de FILAS: mete una fila vacía en su sitio, que es lo
        # que el mantenimiento de la distribución hace antes de escribirla.
        ins <- request$insertDimension
        if (!is.null(ins) && identical(ins$range$dimension, "ROWS")) {
          for (nm in names(env$sheets)) {
            if (!identical(env$sheets[[nm]]$sheetId, ins$range$sheetId)) next
            v <- env$sheets[[nm]]$values %||% list()
            i <- as.integer(ins$range$startIndex) + 1L
            antes <- if (i > 1L) v[seq_len(min(i - 1L, length(v)))] else list()
            despues <- if (i <= length(v)) v[seq.int(i, length(v))] else list()
            env$sheets[[nm]]$values <- c(antes, list(list()), despues)
          }
        }
        cdm <- request$createDeveloperMetadata$developerMetadata
        if (!is.null(cdm)) apply_metadata(cdm$location$sheetId, cdm$metadataKey, cdm$metadataValue)
        udm <- request$updateDeveloperMetadata
        if (!is.null(udm)) {
          apply_metadata(
            udm$developerMetadata$location$sheetId,
            udm$developerMetadata$metadataKey,
            udm$developerMetadata$metadataValue,
            update = TRUE
          )
        }
      }
      return(list(replies = list()))
    }
    list()
  }
  list(env = env, handler = handler, seed = sembrar)
}
