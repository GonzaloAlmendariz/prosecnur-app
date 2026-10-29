# Bitácora de decisiones de Hojas de ruta (U17, plan D1; ADR 0115 §4 y ADR 0116).
#
# Cada decisión que cambia el diseño o la muestra deja una entrada fechada en la
# sesión (`s$hojas_ruta_bitacora`), que viaja en el `.pulso` con el resto del
# estado (state.rds guarda la sesión menos sus caches). Va fuera de
# `hojas_ruta_runs` a propósito: esa lista es una por fase y varios módulos la
# recorren así. Cada entrada dice la fase en la que se tomó.
#
# El vocabulario de acciones es cerrado: una acción desconocida se rechaza en
# vez de guardarse con un nombre que nadie va a reconocer después.

HOJAS_RUTA_BITACORA_ACCIONES <- c(
  "territorio_confirmado",
  "poblacion_calculada",
  "tamano_calculado",
  "icc_aplicado",
  "marco_elegible_adoptado",
  "marco_elegible_cambiado",
  "sorteo",
  "ruteo_restaurado",
  "decision_cobertura",
  "plan_supuestos",
  "reemplazos_puntuales",
  "campo_desde_piloto",
  "nota"
)
HOJAS_RUTA_BITACORA_MAX <- 500L

.hojas_ruta_bitacora_texto <- function(x, max = 500L) {
  v <- if (is.null(x) || !length(x)) "" else as.character(x[[1]])
  if (is.na(v)) v <- ""
  substr(trimws(v), 1L, max)
}

#' Una entrada nueva (pura): valida la acción y recorta los textos.
hojas_ruta_bitacora_entrada <- function(accion, resumen, detalle = list(), fase = "field", ahora = Sys.time(), id = 1L) {
  accion <- .hojas_ruta_bitacora_texto(accion, 64L)
  if (!accion %in% HOJAS_RUTA_BITACORA_ACCIONES) {
    stop_api(400, "E_BAD_REQUEST", sprintf("La bitácora no conoce la acción «%s».", accion))
  }
  resumen <- .hojas_ruta_bitacora_texto(resumen)
  if (!nzchar(resumen)) stop_api(400, "E_BAD_REQUEST", "Una entrada de la bitácora necesita un resumen.")
  list(
    id = as.integer(id),
    fecha = format(ahora, "%Y-%m-%dT%H:%M:%S%z"),
    fase = .hojas_ruta_bitacora_texto(fase %||% "field", 16L),
    accion = accion,
    resumen = resumen,
    detalle = if (is.list(detalle)) detalle else list()
  )
}

#' Lee la bitácora de la sesión, opcionalmente de una fase; la más reciente primero.
hojas_ruta_bitacora_leer <- function(sid, fase = NULL) {
  b <- session_get(sid)$hojas_ruta_bitacora %||% list()
  b <- Filter(is.list, b)
  if (!is.null(fase) && nzchar(fase)) b <- Filter(function(e) identical(as.character(e$fase %||% ""), fase), b)
  rev(b)
}

#' Agrega una entrada a la bitácora de la sesión y marca el proyecto como modificado.
hojas_ruta_bitacora_registrar <- function(sid, accion, resumen, detalle = list(), fase = NULL) {
  s <- session_get(sid)
  previas <- Filter(is.list, s$hojas_ruta_bitacora %||% list())
  fase <- fase %||% as.character(s$hojas_ruta_active_phase %||% "field")
  # Idempotente con la última de la MISMA acción y fase: la página clásica recalcula
  # seguido, y alternar población → tamaño → población con la misma config no es
  # una decisión nueva.
  misma <- Filter(function(e) identical(e$accion, accion) && identical(as.character(e$fase %||% ""), as.character(fase)), previas)
  ultima <- if (length(misma)) misma[[length(misma)]] else NULL
  if (!is.null(ultima) && identical(ultima$resumen, .hojas_ruta_bitacora_texto(resumen))) {
    return(invisible(ultima))
  }
  siguiente <- 1L + max(c(0L, vapply(previas, function(e) as.integer(e$id %||% 0L), integer(1))))
  entrada <- hojas_ruta_bitacora_entrada(accion, resumen, detalle, fase, id = siguiente)
  todas <- c(previas, list(entrada))
  if (length(todas) > HOJAS_RUTA_BITACORA_MAX) todas <- todas[seq.int(length(todas) - HOJAS_RUTA_BITACORA_MAX + 1L, length(todas))]
  s$hojas_ruta_bitacora <- todas
  s <- .mark_project_dirty(s, "hojas_ruta_bitacora")
  .session_env[[sid]] <- s
  invisible(entrada)
}

#' Resumen legible de un sorteo para la bitácora.
hojas_ruta_bitacora_resumen_sorteo <- function(resultado, config) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  me <- cfg$marco_elegible %||% list()
  sprintf(
    "Sorteo %s con semilla %d: %d titulares y %d reemplazos (%s).",
    as.character(resultado$method %||% cfg$sampling_method),
    as.integer(resultado$seed %||% cfg$seed),
    as.integer(resultado$n_blocks %||% 0L),
    as.integer(resultado$n_replacement_blocks %||% 0L),
    if (isTRUE(me$declarado)) sprintf("marco elegible: mínimo %d vivienda(s), %d área(s)", as.integer(me$minimo_viviendas), length(me$areas_excluidas %||% list())) else "todo el marco 2017"
  )
}

# El margen para el resumen del tamaño: «sin estimar» en vez de «±NA %».
.hojas_ruta_bitacora_margen <- function(m) {
  m <- suppressWarnings(as.numeric(m %||% NA)[1])
  if (is.na(m)) "sin estimar" else sprintf("±%.1f %%", 100 * m)
}

#' Resumen del marco elegible para el detalle de una entrada: lo que se decidió, sin
#' los polígonos de las áreas (crecerían el state.rds con cada entrada).
hojas_ruta_bitacora_detalle_marco <- function(me) {
  me <- if (is.list(me)) me else list()
  areas <- me$areas_excluidas %||% list()
  list(
    declarado = isTRUE(me$declarado),
    minimo_viviendas = as.integer(me$minimo_viviendas %||% 0L),
    areas_excluidas = length(areas),
    motivos = as.list(unique(vapply(areas, function(a) as.character(a$motivo %||% ""), character(1)))),
    hash = digest::digest(me, algo = "xxhash64")
  )
}

#' ¿Toca anotar? No cuando el cálculo es una restauración (warm start o hidratación
#' que rehacen salidas al abrir: no es una decisión del usuario) ni cuando la fase
#' activa es una piloto bloqueada (save_run descarta su config: nada se aplicó).
.hojas_ruta_bitacora_anota <- function(sid, origen = NULL) {
  if (identical(as.character(origen %||% "")[1], "restauracion")) return(FALSE)
  s <- session_get(sid)
  fase <- as.character(s$hojas_ruta_active_phase %||% "field")
  !(identical(fase, "pilot") && isTRUE(s$hojas_ruta_runs$pilot$locked))
}

#' Registra sin tumbar al llamador: la bitácora acompaña a un endpoint que ya hizo
#' su trabajo (sortear, calcular), y un fallo al anotarla no debe deshacerlo. El
#' error va a stderr para no perderlo.
.hojas_ruta_bitacora_intentar <- function(sid, accion, resumen, detalle = list(), origen = NULL) {
  if (!.hojas_ruta_bitacora_anota(sid, origen)) return(invisible(NULL))
  tryCatch(
    hojas_ruta_bitacora_registrar(sid, accion, resumen, detalle),
    error = function(e) {
      message("[hojas-ruta/bitacora] no se pudo registrar «", accion, "»: ", conditionMessage(e))
      NULL
    }
  )
}

# Acciones cuyo resumen es texto libre del equipo (y no una frase armada por el motor).
HOJAS_RUTA_BITACORA_TEXTO_LIBRE <- c("nota", "decision_cobertura")

#' Los textos de la bitácora como data.frame, para que el gate de PII los escanee.
hojas_ruta_bitacora_textos <- function(estado) {
  b <- Filter(is.list, estado$hojas_ruta_bitacora %||% list())
  if (!length(b)) return(data.frame(resumen = character(0), stringsAsFactors = FALSE))
  data.frame(resumen = vapply(b, function(e) as.character(e$resumen %||% ""), character(1)), stringsAsFactors = FALSE)
}

#' Retira el texto libre de la bitácora antes de que un .pulso salga del equipo
#' (anonimizador, ADR 0043): el resumen de notas y decisiones de cobertura se
#' reemplaza y su detalle conserva sólo la decisión y el marco resumido.
hojas_ruta_bitacora_anonimizar <- function(estado) {
  b <- estado$hojas_ruta_bitacora
  if (!is.list(b) || !length(b)) return(estado)
  estado$hojas_ruta_bitacora <- lapply(b, function(e) {
    if (!is.list(e) || !as.character(e$accion %||% "") %in% HOJAS_RUTA_BITACORA_TEXTO_LIBRE) return(e)
    e$resumen <- if (identical(e$accion, "nota")) "Nota retirada al anonimizar." else "Decisión de cobertura (justificación retirada al anonimizar)."
    d <- if (is.list(e$detalle)) e$detalle else list()
    e$detalle <- d[intersect(names(d), c("decision", "marco_elegible"))]
    e
  })
  estado
}
