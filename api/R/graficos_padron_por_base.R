# =============================================================================
# graficos_padron_por_base.R — el padrón y la meta de cada base, como propuesta (ADR 0135, punto 6)
# =============================================================================
#
# La lámina de cobertura necesita el padrón y la meta de cada público, y el render no tiene sesión. Aquí se PROPONEN
# desde lo que el estudio ya declaró, con su origen a la vista; el analista los confirma en la tarjeta y quedan
# escritos en el payload (`universos`, `metas`). Nada se infiere:
#   1. Cálculo de muestra: el componente cuyo actor nombra a la base. Padrón = `marco$marco_validado`; meta =
#      `meta$valor` (en porcentaje si la meta es de cobertura; si no, en casos).
#   2. Si no, Monitoreo (reporte de avance de acreditación): la fila del actor. Padrón = `Universo`; meta = `Meta`
#      (casos).
# Una base sin actor que la nombre, o con dos componentes que la nombran con cifras distintas, queda en NA con su
# motivo.

#' Texto comparable de un nombre de base o de actor: sin tildes, mayúsculas ni separadores
#' @keywords internal
.padron_clave <- function(x) trimws(gsub("[^a-z0-9]+", " ", .contraste_clave(x)))

#' Número entero positivo o NA
#' @keywords internal
.padron_num <- function(x) {
  v <- suppressWarnings(as.numeric(unlist(x %||% NA))[1])
  if (is.finite(v) && v > 0) v else NA_real_
}

#' Candidatos de Cálculo de muestra: una fila por componente con actor, padrón y meta
#' @keywords internal
.padron_de_calc_muestra <- function(s) {
  comps <- (s$calc_muestra_estudio %||% list())$componentes %||% list()
  lapply(comps, function(cp) {
    meta <- cp$meta %||% list()
    v <- .padron_num(meta$valor)
    list(claves = unique(.padron_clave(c(cp$actor %||% "", cp$actor_id %||% "", cp$actor_categoria %||% ""))),
         actor = as.character(cp$actor %||% cp$actor_id %||% "")[1],
         padron = .padron_num((cp$marco %||% list())$marco_validado),
         meta = v, meta_unidad = if (is.finite(v)) (if (identical(meta$tipo, "cobertura")) "porcentaje" else "casos") else NA_character_)
  })
}

#' Candidatos de Monitoreo: las filas de actores del reporte de avance de acreditación
#' @keywords internal
.padron_de_monitoreo <- function(s) {
  act <- tryCatch(s$monitoreo_snapshot$dashboard$acreditacion_reports$client_report$actors, error = function(e) NULL)
  if (!is.data.frame(act) || !nrow(act) || !"Actor" %in% names(act)) return(list())
  meta_col <- if ("Meta" %in% names(act)) act$Meta else rep(NA, nrow(act))
  uni_col <- if ("Universo" %in% names(act)) act$Universo else rep(NA, nrow(act))
  lapply(seq_len(nrow(act)), function(i) {
    v <- .padron_num(meta_col[i])
    list(claves = .padron_clave(act$Actor[i]), actor = as.character(act$Actor[i]), padron = .padron_num(uni_col[i]),
         meta = v, meta_unidad = if (is.finite(v)) "casos" else NA_character_)
  })
}

#' El candidato de una fuente para una base: el único actor que la nombra (o varios con las mismas cifras)
#' @return `list(fila, motivo)`: `fila` NULL si no hay uno solo.
#' @keywords internal
.padron_elegir <- function(cands, base, fuente) {
  k <- .padron_clave(base)
  hits <- Filter(function(cd) k %in% cd$claves, cands)
  if (!length(hits)) return(list(fila = NULL, motivo = sprintf("%s no tiene un actor que se llame como la base.", fuente)))
  firmas <- unique(vapply(hits, function(h) paste(h$padron, h$meta, h$meta_unidad), ""))
  if (length(firmas) > 1L) {
    return(list(fila = NULL, motivo = sprintf("%s tiene %d actores para la base con cifras distintas.", fuente, length(hits))))
  }
  list(fila = hits[[1]], motivo = "")
}

#' Propuesta de padrón y meta por base
#'
#' @param s Estado de la sesión (`session_get`).
#' @param bases Nombres de las bases, en su orden.
#' @return Lista con una entrada por base: `{base, padron, padron_origen, meta, meta_unidad, meta_origen, motivo}`.
#'   `padron`/`meta` en NA (con `motivo`) cuando ninguna fuente los declara para esa base.
#' @keywords internal
.graficos_padron_por_base <- function(s, bases) {
  fuentes <- list(list(nombre = "Cálculo de muestra", cands = .padron_de_calc_muestra(s),
                       origen_padron = "Cálculo de muestra: marco validado", origen_meta = "Cálculo de muestra: meta"),
                  list(nombre = "Monitoreo", cands = .padron_de_monitoreo(s),
                       origen_padron = "Monitoreo: universo", origen_meta = "Monitoreo: meta"))
  lapply(as.character(bases), function(b) {
    out <- list(base = b, padron = NA_real_, padron_origen = "", meta = NA_real_, meta_unidad = NA_character_, meta_origen = "", motivo = "")
    motivos <- character(0)
    for (f in fuentes) {
      e <- .padron_elegir(f$cands, b, f$nombre)
      if (is.null(e$fila)) { motivos <- c(motivos, e$motivo); next }
      fila <- e$fila
      if (!is.finite(out$padron) && is.finite(fila$padron)) { out$padron <- fila$padron; out$padron_origen <- sprintf("%s (%s)", f$origen_padron, fila$actor) }
      if (!is.finite(out$meta) && is.finite(fila$meta)) {
        out$meta <- fila$meta; out$meta_unidad <- fila$meta_unidad; out$meta_origen <- sprintf("%s (%s)", f$origen_meta, fila$actor)
      }
      if (is.finite(out$padron) && is.finite(out$meta)) break
    }
    if (!is.finite(out$padron)) out$motivo <- paste(c("Sin padrón declarado.", motivos), collapse = " ")
    else if (!is.finite(out$meta)) out$motivo <- "Sin meta declarada."
    out
  })
}
