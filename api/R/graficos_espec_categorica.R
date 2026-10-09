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
#' @param n Frecuencia de cada categoría.
#' @return Lista con `version`, `tipo`, `rotulos`, `valores`, `cifras`, `n`, `realce`.
#' @keywords internal
preparar_categorica <- function(rotulos, valores, cifras, n = NULL, residuales_al_final = TRUE, sin_ceros = TRUE) {
  rotulos <- trimws(gsub("\\s*\n\\s*", " ", as.character(rotulos)))
  valores <- suppressWarnings(as.numeric(valores)); valores[!is.finite(valores)] <- 0
  cifras <- as.character(cifras)
  n <- if (is.null(n)) rep(NA_real_, length(rotulos)) else suppressWarnings(as.numeric(n))
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
  list(version = .ESPEC_CATEGORICA_VERSION, tipo = "categorica",
       rotulos = rotulos[idx], valores = v, largos = largo, cifras = cifras[idx], n = n[idx],
       # El máximo se decide sobre lo que se lee: dos categorías que rotulan 12 % empatan aunque una valga 0.1204.
       realce = length(largo) > 2L && sum(abs(largo - max(largo)) < 1e-9) == 1L)
}
