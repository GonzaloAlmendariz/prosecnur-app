# =============================================================================
# monitoreo_territorial_rechazos.R — rechazo auditado de un paquete sugerido
# =============================================================================
#
# Control › Subsanaciones (docs/qa/revamp-monitoreo/territorial.md §3.11). La
# decisión de Gonzalo: el motor sugiere el paquete y el coordinador lo APLICA o
# lo RECHAZA, y las dos acciones quedan en el historial con autor, fecha y nota.
# Aplicar ya existía (`operational-adjustments/apply`); rechazar no tenía dónde
# guardarse.
#
# Por qué una clave de sesión propia y no la config territorial:
# - `monitoreo_territorial_normalize_config` (motor, congelado a crecimiento)
#   arma la config territorial como lista EXPLÍCITA: una clave nueva se pierde
#   en la siguiente normalización.
# - Las entradas de `operational_adjustments` normalizan todo estado distinto
#   de active/reverted a "active": un «rechazado» guardado ahí se APLICARÍA.
# `monitoreo_territorial_rechazos` es persistible (censada en session_schema.R)
# y viaja en el .pulso como el resto del estado de sesión.
#
# Contrato:
#   GET  /api/monitoreo/territorial/subsanaciones/rechazos?phase=field
#     { ok, phase, rechazos: [ { id, phase, clave_paquete, ... , nota,
#       autor, fecha, estado } ] }
#   POST /api/monitoreo/territorial/subsanaciones/rechazar
#     { phase?, sugerencia: { id, source_block_id, target_block_id, sex,
#       age_group, source_ump, target_ump, count, ... }, nota?, autor? }
#     → { ok, rechazo, rechazos }
#
# `clave_paquete` identifica el paquete por lo que mueve (bloque origen,
# bloque destino, sexo y edad). Si el motor vuelve a sugerir un paquete con la
# misma clave, la UI lo marca como «ya rechazado» con la nota original. El
# motor de sugerencias no lo filtra: eso exigiría tocar monitoreo_engine.R.
# =============================================================================

.MONITOREO_TERRITORIAL_RECHAZOS_CLAVE <- "monitoreo_territorial_rechazos"

.rechazo_chr <- function(x, default = "") {
  value <- if (is.null(x) || !length(x)) default else as.character(x[[1]])
  if (is.na(value)) default else trimws(value)
}

# Bloque origen, bloque destino, sexo y edad: lo que el paquete mueve. Con
# varios movimientos (paquete de cierre) se usan todos, ordenados.
monitoreo_territorial_rechazo_clave_paquete <- function(sugerencia) {
  movimientos <- sugerencia$adjustments %||% list()
  if (!length(movimientos)) movimientos <- list(sugerencia)
  partes <- vapply(movimientos, function(mov) {
    paste(
      .rechazo_chr(mov$source_block_id %||% sugerencia$source_block_id),
      .rechazo_chr(mov$target_block_id %||% sugerencia$target_block_id),
      tolower(.rechazo_chr(mov$sex)),
      tolower(.rechazo_chr(mov$age_group)),
      sep = "|"
    )
  }, character(1))
  paste(sort(partes), collapse = ";")
}

.rechazos_vacios <- function() list(pilot = list(), field = list())

# Lo guardado, por fase; tolera la forma de un .pulso viejo (sin la clave).
monitoreo_territorial_rechazos_normalizar <- function(valor) {
  out <- .rechazos_vacios()
  if (!is.list(valor)) return(out)
  for (fase in names(out)) {
    entradas <- valor[[fase]] %||% list()
    if (!is.list(entradas)) next
    out[[fase]] <- Filter(function(e) is.list(e) && nzchar(.rechazo_chr(e$id)) && nzchar(.rechazo_chr(e$clave_paquete)), entradas)
  }
  out
}

# Núcleo puro: arma la entrada de un rechazo.
monitoreo_territorial_rechazo_nuevo <- function(sugerencia, nota = "", autor = "", phase = "field", fecha = NULL) {
  if (!is.list(sugerencia)) {
    stop_api(400, "E_MONITOREO_TERRITORIAL_RECHAZO_INVALIDO", "Falta el paquete sugerido que se rechaza.")
  }
  origen <- .rechazo_chr(sugerencia$source_block_id)
  destino <- .rechazo_chr(sugerencia$target_block_id)
  if (!nzchar(origen) || !nzchar(destino)) {
    stop_api(400, "E_MONITOREO_TERRITORIAL_RECHAZO_INVALIDO", "El paquete sugerido no dice de qué manzana a qué manzana mueve casos.")
  }
  fecha <- fecha %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  clave <- monitoreo_territorial_rechazo_clave_paquete(sugerencia)
  list(
    id = paste0("rechazo_", substr(digest::digest(paste(clave, fecha), algo = "xxhash64"), 1, 12)),
    phase = .monitoreo_territorial_phase(phase, "field"),
    clave_paquete = clave,
    sugerencia_id = .rechazo_chr(sugerencia$id),
    source_block_id = origen,
    target_block_id = destino,
    source_ump = .rechazo_chr(sugerencia$source_ump),
    target_ump = .rechazo_chr(sugerencia$target_ump),
    sex = .rechazo_chr(sugerencia$sex),
    age_group = .rechazo_chr(sugerencia$age_group),
    count = suppressWarnings(as.integer(.rechazo_chr(sugerencia$count, "1"))),
    nota = .rechazo_chr(nota),
    autor = if (nzchar(.rechazo_chr(autor))) .rechazo_chr(autor) else "local",
    fecha = fecha,
    estado = "activo"
  )
}

# Agrega el rechazo a su fase; rechazar de nuevo el mismo paquete actualiza la
# nota y la fecha en lugar de duplicar la entrada.
monitoreo_territorial_rechazos_agregar <- function(rechazos, rechazo) {
  rechazos <- monitoreo_territorial_rechazos_normalizar(rechazos)
  fase <- rechazo$phase
  claves <- vapply(rechazos[[fase]], function(e) .rechazo_chr(e$clave_paquete), character(1))
  previo <- which(claves == rechazo$clave_paquete)
  if (length(previo)) {
    rechazo$id <- rechazos[[fase]][[previo[[1]]]]$id
    rechazos[[fase]][[previo[[1]]]] <- rechazo
  } else {
    rechazos[[fase]][[length(rechazos[[fase]]) + 1L]] <- rechazo
  }
  rechazos
}

.monitoreo_territorial_rechazos_fase <- function(s, phase = NULL) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  list(cfg = cfg, phase = .monitoreo_territorial_phase(phase %||% cfg$territorial$active_route_phase, "field"))
}

# Fronteras testeables.
.monitoreo_territorial_rechazos_listar_from_session <- function(sid, phase = NULL) {
  s <- session_get(sid)
  fase <- .monitoreo_territorial_rechazos_fase(s, phase)$phase
  rechazos <- monitoreo_territorial_rechazos_normalizar(s[[.MONITOREO_TERRITORIAL_RECHAZOS_CLAVE]])
  list(ok = TRUE, phase = fase, rechazos = rechazos[[fase]])
}

.monitoreo_territorial_rechazar_from_session <- function(sid, body) {
  body <- if (is.list(body)) body else list()
  s <- session_get(sid)
  contexto <- .monitoreo_territorial_rechazos_fase(s, body$phase)
  if (!identical(contexto$cfg$monitoreo_profile$family %||% "acreditacion", "territorial")) {
    stop_api(409, "E_MONITOREO_TERRITORIAL_REQUIRED", "Rechazar una subsanación requiere un monitoreo territorial activo.")
  }
  rechazo <- monitoreo_territorial_rechazo_nuevo(body$sugerencia, body$nota %||% "", body$autor %||% "", contexto$phase)
  rechazos <- monitoreo_territorial_rechazos_agregar(s[[.MONITOREO_TERRITORIAL_RECHAZOS_CLAVE]], rechazo)
  session_set(sid, "monitoreo_territorial_rechazos", rechazos)
  list(ok = TRUE, rechazo = rechazo, rechazos = rechazos[[contexto$phase]])
}

mount_monitoreo_territorial_rechazos <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/territorial/subsanaciones/rechazos", wrap_endpoint(function(req, res, phase = "", ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_rechazos_listar_from_session(sid, if (nzchar(phase)) phase else NULL)
    })) |>
    plumber::pr_post("/api/monitoreo/territorial/subsanaciones/rechazar", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_rechazar_from_session(sid, .monitoreo_parse_body(req))
    }))
}
