# =============================================================================
# reporte_plan_base_casos.R — la base de lámina es casos, el % va ponderado
# =============================================================================
#
# Contrato: docs/qa/contrato-base-sin-ponderar-graficos-f6-2026-10-11.md (S1–S4,
# I1–I7). Con ponderación, la «Base: 55» de una lámina era la SUMA DE PESOS: un
# número que ningún lector puede contar y que no coincide con los casos que
# respondieron. La regla vigente es:
#
#   - Base (I1): entero de casos con respuesta válida, sin ponderar, filas con
#     peso > 0. Sale de `freq_table_spss(..., casos = TRUE)$n_casos`.
#   - Ponderado (I2): %, medias, Top Two Box, fila Total. Sigue saliendo de `n`.
#
# `n` y `n_casos` nacen del mismo vector de pesos y en la misma llamada; este
# archivo sólo los transporta del tabulado a la lámina sin que se separen. Es
# también lo que libera líneas en reporte_plan_ppt.R (congelado a crecimiento):
# las siete copias del bloque «N desde el Total, o suma si hubo exclusión» se
# reemplazan por `.plan_base_de_tab()`.
#
# Sin `peso` (o con pesos 1) `n_casos == n` en cada fila y nada visible cambia.

#' Base de un tabulado de lámina: ponderada y en casos, a la vez.
#'
#' Reemplaza el bloque histórico de reporte_plan_ppt.R: la base es el Total de
#' `tab_crudo`; si la exclusión de opciones quitó alguna en una pregunta de
#' respuesta única, la base es la suma de lo que quedó en `tab_filtrado`. Con
#' select_multiple el Total manda aunque se oculten opciones (cada persona aporta
#' a varias). La exclusión recalcula AMBAS cifras, nunca una sola.
#'
#' @param tab_crudo Salida de `freq_table_spss()` (con fila `Total`).
#' @param tab_filtrado La misma tras `.reporte_plan_prepare_freq_options()` y
#'   `.reporte_plan_filter_freq_options()` (trae el atributo `excluded_any`).
#' @param es_sm ¿Es select_multiple? Se evalúa sólo si hubo exclusión (promesa
#'   perezosa: el llamador puede pasar la llamada cara sin pagarla siempre).
#' @return `list(n, n_casos)`. Sin columna `n_casos`, `n_casos` es `n`.
#' @keywords internal
.plan_base_de_tab <- function(tab_crudo, tab_filtrado, es_sm = FALSE) {
  n <- NA_real_
  n_casos <- NA_real_
  if (is.data.frame(tab_crudo) && all(c("Opciones", "n") %in% names(tab_crudo))) {
    idx <- which(tab_crudo$Opciones == "Total")
    if (length(idx)) {
      n <- suppressWarnings(as.numeric(tab_crudo$n[idx[1]]))
      n_casos <- suppressWarnings(as.numeric(.plan_col_o_n(tab_crudo)[idx[1]]))
    }
  }
  excluido <- isTRUE(attr(tab_filtrado, "excluded_any", exact = TRUE))
  if ((excluido && !isTRUE(es_sm)) || !is.finite(n)) {
    n <- sum(suppressWarnings(as.numeric(tab_filtrado$n)), na.rm = TRUE)
    n_casos <- sum(suppressWarnings(as.numeric(.plan_col_o_n(tab_filtrado))), na.rm = TRUE)
  }
  if (!is.finite(n_casos)) n_casos <- n
  list(n = n, n_casos = n_casos)
}

#' `n_casos` del tabulado, o `n` si el tabulado no la trae (B: `n_casos := n`).
#' @keywords internal
.plan_col_o_n <- function(tab) {
  if (is.data.frame(tab) && "n_casos" %in% names(tab)) tab$n_casos else tab$n
}

#' Casos por opción, en el orden pedido (0 para la opción que no aparece).
#' @keywords internal
.plan_casos_por_opcion <- function(tab, opts) {
  nc <- suppressWarnings(as.numeric(.plan_col_o_n(tab)))
  out <- nc[match(as.character(opts), as.character(tab$Opciones))]
  out[!is.finite(out) | is.na(out)] <- 0
  out
}

#' Nombre de la columna de casos que acompaña a una columna ponderada.
#'
#' `N` -> `N_casos`, `n` -> `n_casos`, `n_<k>` -> `nc_<k>`; el resto, `<x>_casos`.
#' @keywords internal
.plan_col_casos <- function(cols) {
  cols <- as.character(cols)
  out <- paste0(cols, "_casos")
  out[cols == "N"] <- "N_casos"
  out[cols == "n"] <- "n_casos"
  es_k <- grepl("^n_[0-9]+$", cols)
  out[es_k] <- sub("^n_", "nc_", cols[es_k])
  out
}

#' Añade a una fila ancha (`N`, `n_1..n_k`) sus gemelas en casos.
#'
#' @param row Fila de la tabla ancha (tibble de una fila).
#' @param tab Tabulado preparado de esa fila (con `n_casos` o sin ella).
#' @param opts Opciones en el orden de las columnas `n_1..n_k`.
#' @param n_casos Base en casos de la fila (`.plan_base_de_tab()$n_casos`).
#' @return La fila con `N_casos` y `nc_1..nc_k`.
#' @keywords internal
.plan_fila_casos <- function(row, tab, opts, n_casos) {
  row$N_casos <- as.numeric(n_casos)
  nc <- .plan_casos_por_opcion(tab, opts)
  for (i in seq_along(opts)) row[[paste0("nc_", i)]] <- nc[[i]]
  row
}

#' Declara al graficador dónde están los casos: `var_n_casos` / `cols_n_casos`.
#'
#' Sólo se añaden si la tabla trae las columnas gemelas (`.plan_col_casos()`); un
#' graficador que aún no los conoce los descarta en `.keep_formals()` y sigue con
#' `var_n` (contrato §2.5: sin el arg, `n_casos := n`).
#' @keywords internal
.plan_args_casos <- function(base_args) {
  d <- base_args$data
  if (!is.data.frame(d)) return(base_args)
  vn <- base_args$var_n
  if (is.character(vn) && length(vn) == 1L && .plan_col_casos(vn) %in% names(d)) {
    base_args$var_n_casos <- .plan_col_casos(vn)
  }
  cn <- base_args$cols_n
  if (length(cn)) {
    cc <- .plan_col_casos(unname(cn))
    if (all(cc %in% names(d))) base_args$cols_n_casos <- stats::setNames(cc, names(cn))
  }
  base_args
}

#' Casos de una base de dimensiones / FODA / criterios: filas con peso > 0.
#' @param w Vector de pesos ya saneado (`.dim_safe_weights()`).
#' @keywords internal
.plan_casos_de_pesos <- function(w) {
  as.numeric(sum(suppressWarnings(as.numeric(w)) > 0, na.rm = TRUE))
}
