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
      for (entry in body$data %||% list()) {
        titulo <- .sheets_api_sin_comillas(entry$range)
        if (nzchar(titulo) && !is.null(env$sheets[[titulo]])) {
          env$sheets[[titulo]]$values <- entry$values
        }
      }
      return(list(totalUpdatedSheets = length(body$data %||% list())))
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
