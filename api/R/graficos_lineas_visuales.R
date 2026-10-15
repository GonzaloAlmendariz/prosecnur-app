# =============================================================================
# graficos_lineas_visuales.R — líneas visuales propias, guardadas en la app (ID3 del rediseño, decisión D7)
# =============================================================================
#
# Decisión D7 de Gonzalo (2026-10-14): las líneas visuales que arma el usuario «se guardan en la app, para todos los
# estudios; al aplicarla, el estudio copia sus valores (el .pulso sigue portable)». Por eso viven fuera del `.pulso`, en
# el directorio de datos de la app (`~/.prosecnurapp/`, la misma raíz de los secretos y la caché de cartografía), en un
# JSON `lineas_visuales.json`. No guardan secretos ni datos de encuestados: sólo presets, paletas, ajustes guardados y
# reglas, la misma forma que un perfil del recetario (`.ppt_style_profiles_payload`, graficos_metadata.R) más `id`,
# `incluye`, `origen = "propia"` y fechas. El estudio nunca referencia una línea propia por id para dibujar: aplicar
# copia sus valores al plan (store del front, `applyPptStyleProfile`).
#
# Contrato (congelado para ID3, 2026-10-15):
#   GET    /api/graficos/lineas-visuales           -> list(ok, lineas = [linea])
#   PUT    /api/graficos/lineas-visuales/<id>      -> list(ok, linea)        crea o reemplaza
#   DELETE /api/graficos/lineas-visuales/<id>      -> list(ok, id)
#   linea = list(id, titulo_humano, descripcion, preview_colors, presets, paletas, overrides_reusables, scope_rules,
#                incluye = list(colores, portada, letra, logos), origen = "propia", creada, modificada)

.LV_ARCHIVO <- "lineas_visuales.json"
.LV_ID <- "^lv-[a-z0-9][a-z0-9-]{2,59}$"
.LV_MAX_LINEAS <- 200L
.LV_MAX_BYTES <- 512L * 1024L
.LV_INCLUYE <- c("colores", "portada", "letra", "logos")

# Directorio de datos de la app. Los tests lo redirigen con `options(prosecnurapp.dir_datos_app = <tmp>)` para no
# escribir nunca en el HOME de quien corre la suite.
.lv_dir <- function() {
  d <- getOption("prosecnurapp.dir_datos_app", file.path(Sys.getenv("HOME", unset = "~"), ".prosecnurapp"))
  if (!dir.exists(d)) dir.create(d, recursive = TRUE, showWarnings = FALSE, mode = "0700")
  d
}

.lv_ruta <- function() file.path(.lv_dir(), .LV_ARCHIVO)

#' Líneas propias guardadas en la app. Un archivo ilegible no tumba la pestaña: se avisa por stderr y se lee vacío.
.lv_leer <- function() {
  ruta <- .lv_ruta()
  if (!file.exists(ruta)) return(list())
  datos <- tryCatch(jsonlite::fromJSON(ruta, simplifyVector = FALSE), error = function(e) {
    message("[lineas_visuales] no se pudo leer ", ruta, ": ", conditionMessage(e))
    NULL
  })
  lineas <- (datos %||% list())$lineas %||% list()
  Filter(function(l) is.list(l) && is.character(l$id) && grepl(.LV_ID, l$id), lineas)
}

# Escritura atómica: un archivo temporal en el mismo directorio y `file.rename`, para que un corte a mitad no deje el
# JSON a medias.
.lv_escribir <- function(lineas) {
  ruta <- .lv_ruta()
  tmp <- tempfile(pattern = "lineas_visuales_", tmpdir = dirname(ruta), fileext = ".json")
  jsonlite::write_json(list(version = 1L, lineas = unname(lineas)), tmp, auto_unbox = TRUE, pretty = TRUE, null = "null")
  if (!file.rename(tmp, ruta)) {
    unlink(tmp)
    stop_api(500, "E_LINEA_VISUAL_NO_GUARDADA", "No se pudo guardar la línea visual en la app.")
  }
  invisible(TRUE)
}

.lv_registro <- function(x) is.list(x) && (length(x) == 0L || !is.null(names(x)))

.lv_texto <- function(x, max, campo, obligatorio = FALSE) {
  v <- if (is.null(x)) "" else trimws(as.character(x)[1])
  if (is.na(v)) v <- ""
  if (obligatorio && !nzchar(v)) stop_api(400, "E_LINEA_VISUAL_INVALIDA", sprintf("La línea visual necesita %s.", campo))
  if (nchar(v) > max) stop_api(400, "E_LINEA_VISUAL_INVALIDA", sprintf("%s pasa de %d caracteres.", campo, max))
  v
}

#' Valida y normaliza una línea propia que llega del front. `id` manda el de la ruta; fechas las pone el servidor.
.lv_normalizar <- function(id, cuerpo, ahora = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"), previa = NULL) {
  if (!is.character(id) || length(id) != 1L || !grepl(.LV_ID, id)) {
    stop_api(400, "E_LINEA_VISUAL_INVALIDA", "El id de la línea visual no es válido.", details = list(id = id))
  }
  if (!is.list(cuerpo)) stop_api(400, "E_LINEA_VISUAL_INVALIDA", "La línea visual debe ser un objeto.")
  for (campo in c("presets", "paletas", "scope_rules")) {
    if (!is.null(cuerpo[[campo]]) && !.lv_registro(cuerpo[[campo]])) {
      stop_api(400, "E_LINEA_VISUAL_INVALIDA", sprintf("`%s` debe ser un objeto.", campo))
    }
  }
  if (!is.null(cuerpo$overrides_reusables) && !is.list(cuerpo$overrides_reusables)) {
    stop_api(400, "E_LINEA_VISUAL_INVALIDA", "`overrides_reusables` debe ser una lista.")
  }
  colores <- unlist(cuerpo$preview_colors %||% list(), use.names = FALSE)
  colores <- as.character(colores[grepl("^#[0-9A-Fa-f]{3,8}$", as.character(colores))])
  incluye <- stats::setNames(lapply(.LV_INCLUYE, function(k) isTRUE((cuerpo$incluye %||% list())[[k]] %||% TRUE)), .LV_INCLUYE)
  reglas <- cuerpo$scope_rules %||% list()
  global <- if (.lv_registro(reglas$global)) reglas$global else list()
  global$profile_id <- id   # la línea se reconoce aplicada por este id (lineaVisualAplicada en el front)
  reglas$global <- global
  linea <- list(
    id = id,
    titulo_humano = .lv_texto(cuerpo$titulo_humano, 80L, "un nombre", obligatorio = TRUE),
    descripcion = .lv_texto(cuerpo$descripcion, 300L, "La descripción"),
    preview_colors = as.list(utils::head(colores, 8L)),
    presets = cuerpo$presets %||% stats::setNames(list(), character(0)),
    paletas = cuerpo$paletas %||% stats::setNames(list(), character(0)),
    overrides_reusables = cuerpo$overrides_reusables %||% list(),
    scope_rules = reglas,
    incluye = incluye,
    origen = "propia",
    creada = (previa %||% list())$creada %||% ahora,
    modificada = ahora
  )
  bytes <- nchar(jsonlite::toJSON(linea, auto_unbox = TRUE), type = "bytes")
  if (bytes > .LV_MAX_BYTES) stop_api(413, "E_LINEA_VISUAL_GRANDE", "La línea visual es demasiado grande para guardarla.")
  linea
}

#' Crea o reemplaza una línea propia y devuelve la guardada.
.lv_guardar <- function(id, cuerpo) {
  lineas <- .lv_leer()
  i <- which(vapply(lineas, function(l) identical(l$id, id), logical(1)))
  previa <- if (length(i)) lineas[[i[1]]] else NULL
  if (is.null(previa) && length(lineas) >= .LV_MAX_LINEAS) {
    stop_api(409, "E_LINEA_VISUAL_TOPE", sprintf("La app guarda hasta %d líneas visuales propias.", .LV_MAX_LINEAS))
  }
  linea <- .lv_normalizar(id, cuerpo, previa = previa)
  if (length(i)) lineas[[i[1]]] <- linea else lineas[[length(lineas) + 1L]] <- linea
  .lv_escribir(lineas)
  linea
}

#' Elimina una línea propia. Una que no existe es un 404: el front pidió borrar algo que no tiene.
.lv_eliminar <- function(id) {
  if (!is.character(id) || !grepl(.LV_ID, id)) stop_api(400, "E_LINEA_VISUAL_INVALIDA", "El id de la línea visual no es válido.")
  lineas <- .lv_leer()
  quedan <- Filter(function(l) !identical(l$id, id), lineas)
  if (length(quedan) == length(lineas)) stop_api(404, "E_LINEA_VISUAL_NO_EXISTE", "Esa línea visual no está guardada en la app.")
  .lv_escribir(quedan)
  invisible(id)
}
