# =============================================================================
# graficos_espec_categorica.R — lo que afirma un gráfico de categorías (ADR 0093, N3)
# =============================================================================
#
# La capa pura de las categóricas y las agrupadas de una serie, con las reglas del
# recetario (`barras_h()` de recetario.R:182-209 y las columnas de recetario_m3a.R:6-18):
#
# - las categorías residuales («Otros», «No sabe», «Ninguna», «Prefiero no») van al
#   final aunque el instrumento las ponga antes;
# - una categoría que se rotula 0 % no se dibuja (`sin_ceros`);
# - con más de dos categorías y un máximo único (en la cifra rotulada), la mayor se realza;
# - la cifra es la del motor (su redondeo, `.barras_categoricas_etiquetas_pct`), y la barra o columna mide
#   esa cifra rotulada, como en el recetario (el largo cuenta lo mismo que se lee).
#
# Los renderers (columnas, barras horizontales, dicotomía) leen esto y no recalculan.

.ESPEC_CATEGORICA_VERSION <- "categorica/1"
.CATEGORIAS_RESIDUALES <- "^(Otro|Otros|No sabe|Ninguna|Ninguno|Prefiero no)"

#' Especificación de una categórica
#'
#' @param rotulos Etiqueta visible de cada categoría, en el orden del graficador.
#' @param valores Proporción de cada categoría (0 a 1).
#' @param cifras Cifra rotulada por el motor para cada categoría.
#' @param n Frecuencia de cada categoría (ponderada cuando la corrida tiene peso).
#' @param n_casos Casos sin ponderar de cada categoría (contrato base-sin-ponderar F6, I1); sin él, `n_casos := n`.
#' @param n_base_casos Base de la pregunta en casos (los que respondieron; en selección múltiple, personas y no
#'   marcas). Sin ella `.espec_n_base()` la reconstruye.
#' @return Lista con `version`, `tipo`, `rotulos`, `valores`, `cifras`, `n`, `n_casos`, `n_base_casos`, `realce`. El
#'   motor le agrega `colores` (rótulo = hex) sólo si el usuario definió una paleta que resuelve para la lista
#'   (`.paleta_en_espec()`, ADR 0097); sin ella la lámina es monocroma, como el recetario.
#' @keywords internal
preparar_categorica <- function(rotulos, valores, cifras, n = NULL, residuales_al_final = TRUE, sin_ceros = TRUE,
                                n_casos = NULL, n_base_casos = NULL, casos = NA) {
  rotulos <- trimws(gsub("\\s*\n\\s*", " ", as.character(rotulos)))
  valores <- suppressWarnings(as.numeric(valores)); valores[!is.finite(valores)] <- 0
  cifras <- as.character(cifras)
  n <- if (is.null(n)) rep(NA_real_, length(rotulos)) else suppressWarnings(as.numeric(n))
  n_casos <- if (is.null(n_casos) || length(n_casos) != length(n)) n else suppressWarnings(as.numeric(n_casos))
  keep <- if (isTRUE(sin_ceros)) !(valores <= 0 | grepl("^0([.,]0+)?\\s*%$", trimws(cifras))) else rep(TRUE, length(rotulos))
  idx <- which(keep)
  if (isTRUE(residuales_al_final)) {
    resid <- grepl(.CATEGORIAS_RESIDUALES, rotulos[idx], ignore.case = TRUE)
    if (any(resid) && !all(resid)) idx <- c(idx[!resid], idx[resid])
  }
  v <- valores[idx]
  # Largo de cada barra: la cifra rotulada (si se puede leer como porcentaje); si no, la proporción exacta.
  rotulada <- ifelse(grepl("%", cifras[idx], fixed = TRUE),
                     suppressWarnings(as.numeric(sub("\\s*%.*$", "", trimws(cifras[idx])))) / 100, NA_real_)
  largo <- ifelse(is.finite(rotulada), rotulada, v)
  cifras <- .casos_junto_cifras(cifras, n_casos, n_base_casos, idx, propio = casos)   # «43% (12)» según el ajuste (graficos_casos_junto.R)
  list(version = .ESPEC_CATEGORICA_VERSION, tipo = "categorica",
       rotulos = rotulos[idx], valores = v, largos = largo, cifras = cifras, n = n[idx], n_casos = n_casos[idx],
       n_base_casos = suppressWarnings(as.numeric(n_base_casos %||% NA_real_)[1]),
       casos_mostrar = as.logical(casos %||% NA)[1],   # decisión propia del gráfico sobre los casos (NA: el ajuste del informe)
       # El máximo se decide sobre lo que se lee: dos categorías que rotulan 12 % empatan aunque una valga 0.1204.
       realce = length(largo) > 2L && sum(abs(largo - max(largo)) < 1e-9) == 1L)
}

# ---- casos sin ponderar (contrato base-sin-ponderar F6, I1) ------------------
#
# Con ponderación, `n` es la suma de pesos: sirve para el porcentaje y no para decir cuántos respondieron. Toda cifra
# de casos que se escribe («12 de 20», «N respuestas», «Masculino (33)», «N = 12», el público de un panel) se lee con
# `.espec_casos()`; sin la columna de casos (corrida sin peso, especificación anterior) es `n`, así que sin ponderación
# nada visible cambia.

#' Casos sin ponderar de una especificación, sus filas o una tabla: `n_casos`, o `n` si no la trae
#'
#' `[[` y no `$`: `$` completa nombres parciales en una lista y `x$n` devolvería `n_casos` o `n_base_casos`.
#' @keywords internal
.espec_casos <- function(x) x[["n_casos"]] %||% x[["n"]]

#' Casos del total de una torta o dona (`total_n_casos`), o `total_n` si la especificación no los trae
#' @keywords internal
.espec_total_casos <- function(espec) espec[["total_n_casos"]] %||% espec[["total_n"]]

#' La columna de casos que acompaña a `col`, si el llamador la declaró y la tabla la trae; si no, `col`
#' @keywords internal
.graficos_col_casos <- function(data, col, col_casos = NULL) {
  cc <- as.character(col_casos %||% "")[1]
  if (!is.na(cc) && nzchar(cc) && is.data.frame(data) && cc %in% names(data)) cc else col
}

#' Las columnas de casos por segmento (`cols_n_casos`, nombradas por la columna de porcentaje), si cubren todas las de
#' `cols_n` y la tabla las trae; si no, `cols_n` tal cual (una mezcla de casos y pesos sería peor que ninguna)
#' @keywords internal
.graficos_cols_casos <- function(data, cols_n, cols_n_casos = NULL) {
  if (is.null(cols_n) || !length(cols_n) || is.null(cols_n_casos) || !length(cols_n_casos)) return(cols_n)
  cc <- unlist(cols_n_casos, use.names = TRUE)
  nm <- names(unlist(cols_n, use.names = TRUE))
  if (is.null(nm) || is.null(names(cc)) || !all(nm %in% names(cc)) || !all(cc[nm] %in% names(data))) return(cols_n)
  stats::setNames(as.character(cc[nm]), nm)
}
