# =============================================================================
# monitoreo_territorial_casos_ump.R — casos de una UMP con GPS y hora
# =============================================================================
#
# Avance › UMP · exploración de una UMP (docs/qa/revamp-monitoreo/territorial.md
# §3.16b). El mapa de la exploración dibuja un punto por formulario en su GPS
# de Kobo, numerado por orden, INCLUIDOS los que una anulación de producción
# sacó del avance: la historia de la UMP 107 empieza justamente con 28
# formularios anulados. Ningún payload existente los trae con GPS:
# `response_audit` excluye los anulados y `production_annulments$rows` los
# trae sin coordenadas ni hora.
#
# Contrato (solo lectura):
#   GET /api/monitoreo/territorial/casos-ump?ump=<UMP>
#     { ok, ump, phase, casos: [ { id, orden, fecha_iso, hora, momento,
#       duracion_segundos, lat, lon, gps_estado, distancia_m, id_manzana,
#       manzana, tipo_manzana, aplicador, codigo_pulso, sexo, edad,
#       consentimiento, motivos, anulado, estado } ], resumen }
#   `estado` ∈ cuenta · observacion · no_cuenta · anulado_efectiva ·
#   anulado_sin_consentimiento.
#
# Cómo se obtiene sin tocar el motor (congelado a crecimiento): se pide la
# auditoría de Validación con una COPIA de la config sin anulaciones —así
# vienen todas las filas con su GPS— y se marcan como anuladas con la misma
# máscara que usa el motor (`.monitoreo_territorial_production_annulment_mask`)
# sobre la config real. La cuenta es cara, así que se guarda por sesión con la
# invalidación en la clave (huella de la base + config territorial).
#
# Los aplicadores se rotulan como hoy en la app (código y nombre); no viaja DNI.
# =============================================================================

.monitoreo_territorial_casos_ump_cache <- new.env(parent = emptyenv())

.casos_ump_chr <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n || !col %in% names(df)) return(rep("", n))
  value <- as.character(df[[col]])
  value[is.na(value)] <- ""
  trimws(value)
}

.casos_ump_num <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n || !col %in% names(df)) return(rep(NA_real_, n))
  suppressWarnings(as.numeric(df[[col]]))
}

.casos_ump_lgl <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n || !col %in% names(df)) return(rep(FALSE, n))
  value <- df[[col]]
  if (is.logical(value)) return(value %in% TRUE)
  tolower(trimws(as.character(value))) %in% c("true", "1", "si", "sí", "yes")
}

# «UMP 107», «107» o «0107» → «107».
.casos_ump_normalizar <- function(value) {
  value <- as.character(value %||% "")
  value[is.na(value)] <- ""
  value <- trimws(sub("^ump\\s*", "", trimws(value), ignore.case = TRUE))
  stripped <- sub("^0+(?=\\d)", "", value, perl = TRUE)
  ifelse(grepl("^\\d+$", value), stripped, value)
}

# Una lista de registros (como sale `response_audit`) vuelta data.frame.
.casos_ump_registros_df <- function(registros) {
  if (is.data.frame(registros)) return(registros)
  if (!is.list(registros) || !length(registros)) return(data.frame())
  columnas <- unique(unlist(lapply(registros, names), use.names = FALSE))
  out <- lapply(columnas, function(col) {
    valores <- lapply(registros, function(fila) {
      v <- fila[[col]]
      if (is.null(v) || !length(v)) NA else v[[1]]
    })
    unlist(valores, use.names = FALSE)
  })
  names(out) <- columnas
  as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
}

# Núcleo puro: de la auditoría completa a los casos de una UMP.
#
# `auditoria` trae TODAS las filas de la fase (también las anuladas) con las
# columnas de `response_audit`. `tcfg` es la config territorial real: de ella
# sale qué está anulado.
monitoreo_territorial_casos_ump_desde_auditoria <- function(auditoria, tcfg, phase = "field", ump = "") {
  ump <- .casos_ump_normalizar(ump)[[1]]
  vacio <- list(ok = TRUE, ump = ump, phase = phase, casos = list(),
                resumen = list(total = 0L, anulados = 0L, con_gps = 0L))
  auditoria <- .casos_ump_registros_df(auditoria)
  if (!nrow(auditoria) || !nzchar(ump)) return(vacio)

  anulado <- .monitoreo_territorial_production_annulment_mask(auditoria, tcfg, phase)
  propia <- .casos_ump_normalizar(.casos_ump_chr(auditoria, "advance_block_ump")) == ump
  declarada <- .casos_ump_normalizar(.casos_ump_chr(auditoria, "declared_ump_normalized")) == ump
  sin_cruce <- !nzchar(.casos_ump_chr(auditoria, "advance_block_ump"))
  keep <- propia | (sin_cruce & declarada)
  if (!any(keep)) return(vacio)
  df <- auditoria[keep, , drop = FALSE]
  anulado <- anulado[keep]

  lat <- .casos_ump_num(df, "gps_effective_lat")
  lon <- .casos_ump_num(df, "gps_effective_lon")
  sin_efectivo <- !is.finite(lat) | !is.finite(lon)
  lat[sin_efectivo] <- .casos_ump_num(df, "lat")[sin_efectivo]
  lon[sin_efectivo] <- .casos_ump_num(df, "lon")[sin_efectivo]
  distancia <- .casos_ump_num(df, "gps_effective_distance_m")
  distancia[!is.finite(distancia)] <- .casos_ump_num(df, "distance_m")[!is.finite(distancia)]
  gps_estado <- .casos_ump_chr(df, "gps_effective_estado")
  gps_estado[!nzchar(gps_estado)] <- .casos_ump_chr(df, "geo_estado")[!nzchar(gps_estado)]

  consentimiento <- .casos_ump_lgl(df, "source_effective")
  validacion <- .casos_ump_chr(df, "validation_status")
  observacion <- .casos_ump_chr(df, "observation_status")
  valido <- .casos_ump_lgl(df, "advance_valid")
  estado <- ifelse(
    anulado,
    ifelse(consentimiento, "anulado_efectiva", "anulado_sin_consentimiento"),
    ifelse(!valido | validacion == "no_defendible", "no_cuenta",
           ifelse(observacion == "en_observacion", "observacion", "cuenta"))
  )

  fecha <- .casos_ump_chr(df, "submission_date_iso")
  hora <- .casos_ump_chr(df, "submission_hour")
  momento <- .casos_ump_chr(df, "submission_time")
  orden_clave <- paste(fecha, momento, .casos_ump_chr(df, "response_id"))
  orden <- order(orden_clave)
  edad <- .casos_ump_num(df, "age")

  casos <- lapply(seq_along(orden), function(posicion) {
    i <- orden[[posicion]]
    list(
      id = .casos_ump_chr(df, "response_id")[[i]],
      orden = posicion,
      fecha_iso = fecha[[i]],
      hora = hora[[i]],
      momento = momento[[i]],
      duracion_segundos = if (is.finite(.casos_ump_num(df, "duration_seconds")[[i]])) .casos_ump_num(df, "duration_seconds")[[i]] else NULL,
      lat = if (is.finite(lat[[i]])) lat[[i]] else NULL,
      lon = if (is.finite(lon[[i]])) lon[[i]] else NULL,
      gps_estado = gps_estado[[i]],
      distancia_m = if (is.finite(distancia[[i]])) round(distancia[[i]], 1) else NULL,
      id_manzana = .casos_ump_chr(df, "advance_block_id")[[i]],
      manzana = .casos_ump_chr(df, "advance_block_manzana")[[i]],
      tipo_manzana = .casos_ump_chr(df, "advance_block_type")[[i]],
      aplicador = .casos_ump_chr(df, "responsible_display")[[i]],
      codigo_pulso = .casos_ump_chr(df, "pulso_code")[[i]],
      sexo = .casos_ump_chr(df, "sex")[[i]],
      edad = if (is.finite(edad[[i]])) edad[[i]] else NULL,
      consentimiento = consentimiento[[i]],
      motivos = .casos_ump_chr(df, "observation_reasons")[[i]],
      anulado = anulado[[i]],
      estado = estado[[i]]
    )
  })

  list(
    ok = TRUE,
    ump = ump,
    phase = phase,
    casos = casos,
    resumen = list(
      total = length(casos),
      anulados = as.integer(sum(anulado)),
      con_gps = as.integer(sum(is.finite(lat) & is.finite(lon)))
    )
  )
}

# La config con las anulaciones vaciadas: la auditoría resultante trae todas
# las filas, que es lo que el mapa necesita para dibujar también las anuladas.
.casos_ump_config_sin_anulaciones <- function(cfg) {
  cfg$territorial$production_annulments <- list(pilot = list(), field = list())
  cfg
}

# Orquestador: arma la auditoría completa de la fase y extrae la UMP.
monitoreo_territorial_casos_ump <- function(data, cfg, context = NULL, kobo_schema = NULL, ump = "") {
  tcfg <- cfg$territorial %||% list()
  phase <- .monitoreo_territorial_phase(.monitoreo_scalar(context$phase, tcfg$active_route_phase), "field")
  reporte <- monitoreo_territorial_reportes(
    data,
    .casos_ump_config_sin_anulaciones(cfg),
    context,
    kobo_schema,
    report_scope = "validation_summary"
  )
  monitoreo_territorial_casos_ump_desde_auditoria(reporte$response_audit %||% list(), tcfg, phase, ump)
}

.casos_ump_cache_key <- function(data, synced_at, cfg, phase) {
  territorial <- cfg$territorial %||% list()
  paste(
    monitoreo_data_fingerprint(data, synced_at),
    phase,
    digest::digest(territorial, algo = "xxhash64"),
    sep = "|"
  )
}

# Frontera testeable: resuelve sesión, fase y contexto, y guarda la auditoría
# completa por sesión para que pedir otra UMP no la recalcule.
.monitoreo_territorial_casos_ump_from_session <- function(sid, ump) {
  ump <- .casos_ump_normalizar(ump)[[1]]
  if (!nzchar(ump)) {
    stop_api(400, "E_MONITOREO_TERRITORIAL_UMP_REQUERIDA", "Indica la UMP cuyos casos quieres ver (parámetro ump).")
  }
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  if (!identical(cfg$monitoreo_profile$family %||% "acreditacion", "territorial")) {
    stop_api(409, "E_MONITOREO_TERRITORIAL_REQUIRED", "Los casos por UMP requieren un monitoreo territorial activo.")
  }
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  key <- .casos_ump_cache_key(data, .monitoreo_scalar(snapshot$synced_at, ""), cfg, phase)
  hit <- .monitoreo_territorial_casos_ump_cache[[sid]]
  auditoria <- if (is.list(hit) && identical(hit$key, key)) {
    hit$auditoria
  } else {
    context <- .monitoreo_territorial_context_with_map_cache(
      sid, cfg, data,
      phase = phase,
      report_scope = "validation_summary",
      allow_stale = TRUE,
      prepare_missing = TRUE
    )
    reporte <- monitoreo_territorial_reportes(
      data,
      .casos_ump_config_sin_anulaciones(cfg),
      context,
      .monitoreo_kobo_schema_for_phase(sid, cfg, phase = phase),
      report_scope = "validation_summary"
    )
    valor <- .casos_ump_registros_df(reporte$response_audit %||% list())
    assign(sid, list(key = key, auditoria = valor), envir = .monitoreo_territorial_casos_ump_cache)
    valor
  }
  monitoreo_territorial_casos_ump_desde_auditoria(auditoria, cfg$territorial %||% list(), phase, ump)
}

mount_monitoreo_territorial_casos_ump <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/territorial/casos-ump", wrap_endpoint(function(req, res, ump = "", ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_casos_ump_from_session(sid, ump)
    }))
}
