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
# `columnas_peso`: columnas numéricas de la data de la base cuyo nombre parece
# un peso, con el mismo patrón que el selector del frontend
# (`pareceraPeso` en PesoPorColumna.tsx). Es superconjunto de la regla que corta
# el comparativo (`.armz_ponderar`: columna exacta `peso` sin declarar), así que
# toda base que el comparativo bloquearía la trae no vacía. Por eso una columna
# llamada exactamente `peso` entra SIEMPRE —numérica o no, aunque esté vacía—:
# `.armz_ponderar` bloquea por su sola existencia y la UI tiene que poder
# ofrecer «sin ponderar» o «por columna» para esa base. Vacía = la base no
# tiene peso que declarar: «sin declarar» equivale a «sin ponderar».
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

.PONDERACION_PATRON_COLUMNA_PESO <- "pond|peso|weight|factor|wgt"

# ¿La columna es numérica? Número (con o sin etiquetas de valor) o texto cuyos
# valores no vacíos son todos números finitos (data tecleada o CSV de Kobo).
.pond_bases_es_numerica <- function(x) {
  x <- haven::zap_labels(x)
  if (is.numeric(x)) return(TRUE)
  if (!is.character(x) && !is.factor(x)) return(FALSE)
  v <- trimws(as.character(x))
  v <- v[!is.na(v) & nzchar(v)]
  length(v) > 0L && all(is.finite(suppressWarnings(as.numeric(v))))
}

# Columnas de peso candidatas de UNA base, en la lectura memoizada de Analítica
# (la misma que codigos_observados). Sin par instrumento+data: ninguna.
.pond_bases_columnas_peso <- function(s, nombre) {
  meta <- s$estudio$bases[[nombre]]
  pair <- .analitica_pair_for_base(s, meta, "adaptados", nombre)
  if (is.null(pair)) return(character(0))
  df <- .analitica_read_pair(pair, meta)$data
  if (!is.data.frame(df) || !ncol(df)) return(character(0))
  cand <- names(df)[grepl(.PONDERACION_PATRON_COLUMNA_PESO, names(df), ignore.case = TRUE)]
  # `peso` exacta entra sin filtro: es la que corta el comparativo.
  cand[cand == "peso" | vapply(cand, function(n) .pond_bases_es_numerica(df[[n]]), logical(1))]
}

#' Ponderación declarada de cada base del estudio (solo lectura).
#' @return list(ok, bases = named list base -> {declarada, enabled, modo, peso_columna,
#'   columnas_peso}). `columnas_peso` es una lista (arreglo JSON, también con uno o cero).
#' @keywords internal
ponderacion_bases_estado <- function(sid) {
  s <- session_get(sid)
  nombres <- names((s$estudio %||% list())$bases %||% list())
  nombres <- nombres[!is.na(nombres) & nzchar(nombres)]
  cfg <- .pond_bases_cfg_corrida(sid, s)
  bases <- stats::setNames(lapply(nombres, function(b) {
    cfg_p <- .analitica_ponderacion_cfg_base(sid, b, cfg)
    res <- .pond_bases_resumen((cfg_p %||% list())$ponderacion)
    res$columnas_peso <- as.list(.pond_bases_columnas_peso(s, b))
    res
  }), nombres)
  # Sin bases: objeto JSON vacío `{}`, no arreglo `[]`.
  if (!length(bases)) bases <- stats::setNames(list(), character(0))
  list(ok = TRUE, bases = bases)
}
