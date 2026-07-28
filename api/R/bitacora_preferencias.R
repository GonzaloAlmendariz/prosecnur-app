# =============================================================================
# Preferencias de vista del módulo Bitácora (ADR 0047)
# =============================================================================
#
# Filtros y preferencias de las cuatro secciones. Viven en el .pulso y NO en
# localStorage: en esta aplicación la sesión es el proyecto abierto, así que un
# filtro por etiqueta del estudio A no significa nada en el estudio B. La
# contrapartida es que ocupan lugar en state.rds; por eso el objeto es chico y
# de forma fija, no un saco de claves libres.
#
# Contraejemplo deliberado: el preset de layout (`pulso.layoutPreset`) sí vive
# en localStorage, porque describe la MÁQUINA (tamaño de pantalla), no el
# estudio. La regla es esa: lo que describe el proyecto viaja con el proyecto.

BITACORA_VISTAS_CRONOGRAMA <- c("fases", "gantt", "lista")
BITACORA_MAX_FILTROS <- 12L

.bit_prefs_default <- function() {
  list(
    schema = "bitacora_prefs_v1",
    cronograma = list(
      vista = "fases",
      estados = list(),
      prioridades = list(),
      fases = list(),
      etiquetas = list(),
      desde = "",
      hasta = "",
      texto = "",
      mostrar_archivadas = FALSE
    ),
    bitacora = list(
      tonos = list(),
      modulos = list(),
      etiquetas = list(),
      texto = "",
      mostrar_archivadas = FALSE
    ),
    canvas = list(
      snap = TRUE,
      grid = 16L,
      guias = TRUE
    )
  )
}

# Lista de tokens libres acotada: se usa para filtros por estado, prioridad,
# fase, tono o módulo, cuyos vocabularios los valida el engine que consume el
# filtro. Acá solo se garantiza forma y cardinalidad.
.bit_prefs_lista <- function(value, max_items = BITACORA_MAX_FILTROS) {
  if (is.null(value)) return(list())
  if (is.list(value)) value <- unlist(value, recursive = TRUE, use.names = FALSE)
  if (!length(value)) return(list())
  out <- vapply(as.character(value), .bit_texto, character(1), max_chars = 60L, USE.NAMES = FALSE)
  out <- unique(out[nzchar(out)])
  as.list(utils::head(out, max_items))
}

.bit_prefs_normalizar <- function(x) {
  base <- .bit_prefs_default()
  if (is.null(x) || !is.list(x)) return(base)
  cron <- x$cronograma %||% list()
  bita <- x$bitacora %||% list()
  canv <- x$canvas %||% list()
  list(
    schema = "bitacora_prefs_v1",
    cronograma = list(
      vista = calc_enum(cron$vista, BITACORA_VISTAS_CRONOGRAMA, base$cronograma$vista),
      estados = .bit_prefs_lista(cron$estados),
      prioridades = .bit_prefs_lista(cron$prioridades),
      fases = .bit_prefs_lista(cron$fases),
      etiquetas = .bit_etiquetas(cron$etiquetas, max_items = BITACORA_MAX_FILTROS),
      desde = .bit_fecha(cron$desde),
      hasta = .bit_fecha(cron$hasta),
      texto = .bit_texto(cron$texto, 120L),
      mostrar_archivadas = calc_bool(cron$mostrar_archivadas, FALSE)
    ),
    bitacora = list(
      tonos = .bit_prefs_lista(bita$tonos),
      modulos = .bit_prefs_lista(bita$modulos),
      etiquetas = .bit_etiquetas(bita$etiquetas, max_items = BITACORA_MAX_FILTROS),
      texto = .bit_texto(bita$texto, 120L),
      mostrar_archivadas = calc_bool(bita$mostrar_archivadas, FALSE)
    ),
    canvas = list(
      snap = calc_bool(canv$snap, TRUE),
      grid = calc_int(canv$grid, 16L, min = 4L, max = 128L),
      guias = calc_bool(canv$guias, TRUE)
    )
  )
}

.bit_prefs_leer <- function(s) {
  .bit_prefs_normalizar(s$bitacora_preferencias %||% NULL)
}

# Escritura con literal explícito: el censo de session_schema.R exige que el
# escáner AST vea la clave como string literal en un `session_set`.
.bit_prefs_guardar <- function(sid, prefs) {
  normalizadas <- .bit_prefs_normalizar(prefs)
  session_set(sid, "bitacora_preferencias", normalizadas)
  normalizadas
}

# Fusión superficial por sección: la UI manda solo la sección que tocó, y el
# resto se conserva. Sin esto, guardar un filtro del cronograma borraría los
# filtros de la bitácora.
.bit_prefs_aplicar_parche <- function(s, parche) {
  actuales <- .bit_prefs_leer(s)
  if (is.null(parche) || !is.list(parche)) return(actuales)
  for (seccion in c("cronograma", "bitacora", "canvas")) {
    entrante <- parche[[seccion]]
    if (is.null(entrante) || !is.list(entrante)) next
    actuales[[seccion]] <- utils::modifyList(actuales[[seccion]], entrante)
  }
  .bit_prefs_normalizar(actuales)
}
