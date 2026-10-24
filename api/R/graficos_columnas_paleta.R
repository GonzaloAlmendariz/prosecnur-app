# Columnas de una sola serie en la paleta de la marca (frente C, CCSS Perfil 2026).
#
# `graficar_barras_categoricas()` en columnas pintaba cada categoría de un color (azul, verde, amarillo, naranja): el preset
# de fábrica trae diez colores con claves genéricas (`Categoria_1`…) que no nombran ninguna categoría, `.graficos_mk_palette`
# no las encontraba y caía a su paleta base, una por categoría. Las barras horizontales ya resolvían esto con el realce
# (`.graficar_categoricas_horizontal`); aquí las columnas hacen lo mismo: azul de la marca y la mayor resaltada, salvo que
# el proyecto haya fijado sus colores.

#' ¿El proyecto fijó los colores de estas columnas?
#'
#' Sí con una paleta (`paleta_colores`), con colores por categoría que nombran categorías reales o con colores sin
#' nombre (se aplican por posición, a propósito). No con las claves genéricas del preset de fábrica.
#' @keywords internal
.graficos_columnas_colores_propios <- function(colores_categorias, paleta_colores, categorias) {
  pal <- unlist(paleta_colores, use.names = FALSE)
  if (length(pal) && any(!is.na(pal) & nzchar(pal))) return(TRUE)
  cc <- unlist(colores_categorias)
  if (!length(cc)) return(FALSE)
  nm <- names(cc)
  if (is.null(nm) || !any(nzchar(nm))) return(TRUE)
  any(nm %in% categorias)
}

#' Relleno de las columnas: los colores del proyecto si los fijó; si no, el azul de la marca con la mayor resaltada
#'
#' La regla del realce es la de las barras horizontales: más de dos categorías y una sola mayor; si no, todas en azul.
#' @param valores Valor de cada columna, en el orden de `fill`.
#' @param fill Colores resueltos (`.barras_categoricas_resolve_colors`), que se conservan si son propios.
#' @keywords internal
.graficos_columnas_fill <- function(valores, fill, propios) {
  if (isTRUE(propios) || !length(valores)) return(fill)
  v <- suppressWarnings(as.numeric(valores)); cats <- .std_paleta("categorias")
  mx <- suppressWarnings(max(v, na.rm = TRUE))
  realce <- length(v) > 2L && is.finite(mx) && sum(v == mx, na.rm = TRUE) == 1L
  ifelse(realce & !(v %in% mx), cats$resto, cats$mayor)
}
