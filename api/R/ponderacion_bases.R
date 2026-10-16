# =============================================================================
# Ponderación declarada por base — lectura de TODAS las bases del estudio.
#
# Responde, para cada base de `estudio$bases`, qué ponderación tiene declarada
# sin cambiar la base activa ni escribir en la sesión. Usa la misma resolución
# que el comparativo armonizado (`.armz_ponderar`), es decir
# `.analitica_ponderacion_cfg_base`, y la misma regla de declaración:
#   - sin `ponderacion.enabled`        -> declarada = FALSE (enabled/modo NA);
#   - `enabled = false`                -> declarada, sin ponderar (modo NA);
#   - `enabled = true`                 -> declarada, con modo columna|calibracion.
#
# NA (y no NULL) para los ausentes: el serializador de la API (`na = "null"`)
# los manda como `null`; un NULL dentro de una lista saldría como `{}`.
# =============================================================================

# Config de la corrida tal como la ve `.analitica_config_get`, pero de solo
# lectura: replica su migración conservadora de `independent_siblings` (que allí
# hace session_set) devolviendo el valor sin persistirlo.
.pond_bases_cfg_corrida <- function(sid, s) {
  active <- .analitica_scoped_base(sid)
  if (!nzchar(active)) return(s$analitica_config %||% .analitica_default_config())
  configs <- s$analitica_config_por_base
  if (is.list(configs) && !is.null(configs[[active]])) return(configs[[active]])
  hereda_global <- estudio_is_independent_siblings(sid)
  if (hereda_global && !length(configs) && !is.null(s$analitica_config)) {
    return(s$analitica_config)
  }
  .analitica_default_config()
}

# Resumen de UNA config de ponderación ya resuelta para su base.
.pond_bases_resumen <- function(pond) {
  declarada <- is.list(pond) && !is.null(pond$enabled)
  if (!declarada) {
    return(list(declarada = FALSE, enabled = NA, modo = NA_character_,
                peso_columna = NA_character_))
  }
  enabled <- isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))
  if (!enabled) {
    return(list(declarada = TRUE, enabled = FALSE, modo = NA_character_,
                peso_columna = NA_character_))
  }
  modo <- .analitica_ponderacion_modo(pond)
  col <- NA_character_
  if (identical(modo, "columna")) {
    col <- trimws(as.character(.analitica_ponderacion_scalar(pond$peso_columna, "")))
    if (!length(col) || is.na(col) || !nzchar(col)) col <- NA_character_
  }
  list(declarada = TRUE, enabled = TRUE, modo = modo, peso_columna = col)
}

#' Ponderación declarada de cada base del estudio (solo lectura).
#' @return list(ok, bases = named list base -> {declarada, enabled, modo, peso_columna}).
#' @keywords internal
ponderacion_bases_estado <- function(sid) {
  s <- session_get(sid)
  nombres <- names((s$estudio %||% list())$bases %||% list())
  nombres <- nombres[!is.na(nombres) & nzchar(nombres)]
  cfg <- .pond_bases_cfg_corrida(sid, s)
  bases <- stats::setNames(lapply(nombres, function(b) {
    cfg_p <- .analitica_ponderacion_cfg_base(sid, b, cfg)
    .pond_bases_resumen((cfg_p %||% list())$ponderacion)
  }), nombres)
  # Sin bases: objeto JSON vacío `{}`, no arreglo `[]`.
  if (!length(bases)) bases <- stats::setNames(list(), character(0))
  list(ok = TRUE, bases = bases)
}
