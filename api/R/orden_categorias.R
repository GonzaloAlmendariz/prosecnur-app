# Orden de categorías definido por el analista
# =============================================
#
# El orden en que se muestran las categorías de una pregunta (en tablas de
# frecuencia y en los PPT) sale, por defecto, del orden de filas del sheet
# `choices` del XLSForm y viaja dentro de `inst$orders_list[[var]]` (ver
# reporte_instrumento.R y .bases_clean_report_instrument en helpers_bases.R).
#
# Este módulo permite que el analista defina, desde Analítica, un orden
# explícito POR LISTA DE OPCIONES (`list_name`) que se persiste en el config
# de la sesión (`analitica_config_por_base[[base]]$orden_categorias`) y se
# re-aplica sobre `orders_list` en cada construcción del instrumento — tanto
# en el path de Analítica/Frecuencias (.analitica_apply_data_review) como en
# el de Gráficos/PPT (.graficos_processing_sources). Como ambos paths leen el
# mismo `orders_list`, el orden queda idéntico en tablas y en el PPT.
#
# El override se aplica SIEMPRE después de que el instrumento se normaliza
# contra el `choices` (que re-fija los `names` al orden del instrumento); si se
# aplicase antes, la normalización lo pisaría.

#' Normaliza el sub-config `orden_categorias` a una named list list_name ->
#' character(codes). Tolera la forma cruda de jsonlite (list de list/scalars).
#' @noRd
.orden_categorias_from_cfg <- function(cfg) {
  raw <- (cfg %||% list())$orden_categorias
  if (is.null(raw) || !is.list(raw) || !length(raw)) return(list())
  out <- list()
  for (ln in names(raw)) {
    if (!nzchar(ln)) next
    codes <- as.character(unlist(raw[[ln]], use.names = FALSE))
    codes <- codes[!is.na(codes) & nzchar(codes)]
    if (length(codes)) out[[ln]] <- codes
  }
  out
}

#' Devuelve la permutación de índices de `cur` que aplica el orden `desired`:
#' primero los códigos de `desired` que existen en `cur` (en el orden de
#' `desired`), luego los restantes de `cur` no mencionados (en su orden
#' original). Robusto ante códigos nuevos del instrumento o ausentes del
#' override (p. ej. valores especiales que el analista dejó fuera de la lista).
#' @noRd
.orden_categorias_perm <- function(cur, desired) {
  cur <- as.character(cur)
  desired <- as.character(desired)
  head_idx <- unlist(lapply(desired, function(code) which(cur == code)), use.names = FALSE)
  head_idx <- unique(head_idx)
  tail_idx <- setdiff(seq_along(cur), head_idx)
  c(head_idx, tail_idx)
}

#' Reordena `inst$orders_list` según el override por `list_name`.
#'
#' @param inst  Instrumento (`prosecnur_instrumento`) con `$orders_list` y
#'   `$survey` (se usa `.analitica_list_name_for_var` para mapear var->lista).
#' @param orden_cfg  named list `list_name -> character(codes)`.
#' @return `inst` con `orders_list` reordenado. Idempotente; sin override
#'   aplicable devuelve `inst` intacto.
#' @noRd
.apply_orden_categorias <- function(inst, orden_cfg) {
  if (is.null(inst) || is.null(inst$orders_list) || !length(inst$orders_list)) return(inst)
  if (is.null(orden_cfg) || !is.list(orden_cfg) || !length(orden_cfg)) return(inst)
  if (!exists(".analitica_list_name_for_var", mode = "function")) return(inst)

  for (var in names(inst$orders_list)) {
    entry <- inst$orders_list[[var]]
    if (is.null(entry$names) || !length(entry$names)) next

    ln <- tryCatch(.analitica_list_name_for_var(inst, var), error = function(e) "")
    if (!nzchar(ln) || is.null(orden_cfg[[ln]])) next

    perm <- .orden_categorias_perm(entry$names, orden_cfg[[ln]])
    # No-op real: si la permutación ya es la identidad, no tocar.
    if (identical(perm, seq_along(entry$names))) next

    inst$orders_list[[var]]$names <- as.character(entry$names)[perm]
    if (!is.null(entry$labels) && length(entry$labels) == length(entry$names)) {
      inst$orders_list[[var]]$labels <- entry$labels[perm]
    }
  }
  inst
}
