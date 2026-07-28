# Censo del transporte HTTP de todo api/R/.
#
# Por qué existe: el mismo defecto —un handle de curl sin `timeout` ni
# `connecttimeout`— apareció de forma independiente en cinco subsistemas
# (SurveyMonkey, Kobo, Google, Hugging Face y Hojas de ruta). Plumber atiende
# en un solo hilo, así que cada aparición no colgaba su ruta: colgaba el
# backend entero. Los tests por módulo cierran los sitios conocidos; este
# archivo existe para que un sitio NUEVO no pueda nacer con el mismo agujero.
#
# Mismo patrón de censo que test-errors-registry.R y test-session-schema.R:
# la lista vive acá y agrandarla es un acto deliberado, no un descuido.

# Archivos autorizados a construir handles de curl. Cada uno debe aplicar
# timeout y connecttimeout en su constructor, y su test de módulo lo verifica.
.transporte_archivos_con_handle <- function() {
  c(
    "dashboard_publish.R",     # Hugging Face      -> test-dashboard-publish-http.R
    "hojas_ruta_http.R",       # ArcGIS (manzanas) -> test-hojas-ruta-http.R
    "kobo_api.R",              # KoboToolbox       -> test-monitoreo-sync-incremental.R
    "monitoreo_google_http.R", # Google/Sheets     -> test-monitoreo-google-http.R
    "surveymonkey_api.R"       # SurveyMonkey      -> test-engine-surveymonkey-api.R
  )
}

.transporte_archivos_r <- function() {
  dir_r <- testthat::test_path("..", "..", "R")
  sort(list.files(dir_r, pattern = "\\.R$", full.names = TRUE))
}

# Recorre el AST en vez de grepear: inmune al formato (llamadas partidas en
# varias líneas, espacios, comentarios).
.transporte_llamadas <- function(ruta, nombre_fn) {
  hallazgos <- list()
  visitar <- function(nodo) {
    # Argumento vacío (`x[, 1]`): el hijo es el símbolo vacío y sólo revienta
    # al forzarse, ya dentro de la llamada. `missing()` es quien lo detecta.
    if (missing(nodo) || is.null(nodo)) return(invisible(NULL))
    if (is.call(nodo)) {
      fn <- nodo[[1]]
      nombre <- if (is.name(fn)) {
        as.character(fn)
      } else if (is.call(fn) && identical(as.character(fn[[1]]), "::")) {
        as.character(fn[[3]])
      } else {
        ""
      }
      if (identical(nombre, nombre_fn)) {
        # `c(..., list(x))` y no `[[n+1]] <<- x`: una llamada sin argumentos
        # nombrados da NULL, y asignar NULL borra el elemento en vez de
        # agregarlo — el censo se quedaría corto justo con `new_handle()`.
        hallazgos <<- c(hallazgos, list(names(as.list(nodo))[-1]))
      }
    }
    if (is.call(nodo) || is.expression(nodo) || is.pairlist(nodo)) {
      for (i in seq_along(nodo)) {
        visitar(tryCatch(nodo[[i]], error = function(e) NULL))
      }
    }
  }
  for (expr in parse(ruta, encoding = "UTF-8")) visitar(expr)
  hallazgos
}

test_that("ninguna salida a red de api/R sale sin handle", {
  sin_handle <- character(0)
  for (ruta in .transporte_archivos_r()) {
    llamadas <- .transporte_llamadas(ruta, "curl_fetch_memory")
    for (args in llamadas) {
      if (!"handle" %in% args) sin_handle <- c(sin_handle, basename(ruta))
    }
  }
  expect_equal(
    sin_handle, character(0),
    info = paste0(
      "curl_fetch_memory() sin `handle=` usa los defaults de libcurl, que no ",
      "tienen timeout. Con Plumber de un solo hilo eso cuelga el backend ",
      "entero. Archivos:\n",
      paste(sprintf("  - api/R/%s", unique(sin_handle)), collapse = "\n")
    )
  )
})

test_that("solo los archivos de transporte censados construyen handles de curl", {
  con_handle <- character(0)
  for (ruta in .transporte_archivos_r()) {
    if (length(.transporte_llamadas(ruta, "new_handle"))) {
      con_handle <- c(con_handle, basename(ruta))
    }
  }
  nuevos <- setdiff(con_handle, .transporte_archivos_con_handle())
  expect_equal(
    nuevos, character(0),
    info = paste0(
      "Archivo nuevo construyendo handles de curl sin pasar por un ",
      "constructor con timeout/connecttimeout. Si es transporte legítimo, ",
      "dale su constructor acotado, su test de módulo, y recién ahí súmalo a ",
      ".transporte_archivos_con_handle(). Archivos:\n",
      paste(sprintf("  - api/R/%s", nuevos), collapse = "\n")
    )
  )

  # El censo tampoco puede quedar obsoleto al revés: un archivo listado que ya
  # no construye handles es una entrada muerta que afloja el gate.
  expect_equal(setdiff(.transporte_archivos_con_handle(), con_handle), character(0))
})
