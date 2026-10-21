# analitica_armonizada_universo.R — una base con selección y sin universo
# =========================================================================
#
# Medido en la matriz de HSyVbG (2026-10-21, checklist A7): la base 2026 trae
# la columna `seleccionado` (2.500 de 3.318 casos) y nadie declaró el universo
# («Qué casos cuentan», en Analítica). El comparativo contó los 3.318 y nada lo advirtió.
#
# Decisión de Gonzalo: el aviso es INTERNO. Va entre los avisos del comparativo
# (lo que ve la persona en la app); el Excel no cambia, porque los formatos de
# tablas de los entregables están aprobados.
#
# Regla conservadora para no acusar cualquier 0/1: una columna cuyo NOMBRE dice
# selección (seleccionado, en_muestra, incluido…), con valores sólo 0 y 1, ambos
# presentes, en una base que no declaró qué caso cuenta. Se lee la data original
# de la base (la columna puede no estar incorporada al instrumento).

.ARMZ_COLUMNA_SELECCION_RE <- "^(seleccionad[oa]s?|seleccion|selected|en_?muestra|incluid[oa]s?|elegid[oa]s?|muestra_?final)$"

.armz_columna_seleccion <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return(NULL)
  nombres <- names(df)
  norm <- .carm_texto_norm(nombres)
  for (i in which(grepl(.ARMZ_COLUMNA_SELECCION_RE, norm))) {
    v <- .codif_agrupar_codigo_chr(haven::zap_labels(df[[i]]))
    obs <- v[!is.na(v) & nzchar(v)]
    if (length(obs) && all(obs %in% c("0", "1")) && all(c("0", "1") %in% obs)) {
      return(list(columna = nombres[[i]], n_total = nrow(df), n_marcados = sum(obs == "1")))
    }
  }
  NULL
}

.armz_universo_declarado <- function(sid, base) {
  meta <- ((session_get(sid, required = FALSE) %||% list())$estudio %||% list())$bases[[base]]
  cfg <- tryCatch(normalize_validation_operational_config((meta$validacion %||% list())$operational_config),
                  error = function(e) NULL)
  cv <- (cfg %||% list())$caso_valido %||% list()
  isTRUE(cv$enabled) && length(cv$condiciones %||% list()) > 0L
}

#' Bases de la serie con una columna de selección y sin universo declarado.
#' @return list nombrada base -> list(columna, n_total, n_marcados).
#' @noRd
.armz_universo_sin_declarar <- function(sid, periodos) {
  out <- list()
  for (b in periodos) {
    if (.armz_universo_declarado(sid, b)) next
    # Sólo la data (el instrumento no hace falta) y nada de esto puede cortar el
    # comparativo: un aviso que no se pudo calcular no se emite.
    sel <- tryCatch({
      files <- .resolve_base_files(sid, b)
      .armz_columna_seleccion(as.data.frame(.read_data_for_validation(files$data$path, files$data_ext),
                                            check.names = FALSE))
    }, error = function(e) NULL)
    if (!is.null(sel)) out[[b]] <- sel
  }
  out
}

.armz_avisos_universo <- function(ap, rotulos) {
  lapply(names(ap$universo_sin_declarar %||% list()), function(b) {
    u <- ap$universo_sin_declarar[[b]]
    list(tipo = "universo_sin_declarar", base = b, columna = u$columna, mensaje = sprintf(
      "La base %s trae la columna «%s» (%s de %s casos con 1) y no tiene universo declarado: el comparativo cuenta los %s. Si sólo deben contar los seleccionados, decláralo en Analítica > Qué casos cuentan.",
      rotulos[[b]] %||% b, u$columna, .armz_fmt_n(u$n_marcados), .armz_fmt_n(u$n_total),
      .armz_fmt_n(u$n_total)))
  })
}
