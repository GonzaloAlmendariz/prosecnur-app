# graficos_casos_junto.R — «Casos junto al porcentaje», ajuste del informe (aprobado por Gonzalo, 2026-10-11).
#
# Antes cada tipo de gráfico decidía por su cuenta: las escalas escribían «x de y» sólo en la columna Top Two Box y sólo
# con base chica (umbral fijo de 30, `.LAM_BASE_CHICA_N`), las dicotómicas ponían «(n)» siempre y el resto nunca. Ahora
# un solo ajuste del informe, en `presets$base$args$casos_junto = list(cuando, umbral)`:
#   - cuando = "menos"  : sólo si algún grupo del gráfico tiene menos de `umbral` casos (defecto, umbral 30);
#   - cuando = "siempre": siempre;  - cuando = "nunca": nunca.
# Un gráfico puede pedir otra cosa con su propio `casos_junto` (args u overrides). Los casos se cuentan SIN ponderar.
# El motor lo lee de la opción `prosecnur.casos_junto`, que fijan las entradas del PPT y del Word durante el render.

.CASOS_JUNTO_DEFECTO <- list(cuando = "menos", umbral = 30)

#' Ajuste normalizado: `list(cuando, umbral)`; lo que no se entiende vuelve al defecto
#' @keywords internal
.casos_junto_normalizar <- function(x) {
  x <- if (is.list(x)) x else list()
  cuando <- tolower(as.character(x$cuando %||% .CASOS_JUNTO_DEFECTO$cuando)[1])
  if (!cuando %in% c("menos", "siempre", "nunca")) cuando <- .CASOS_JUNTO_DEFECTO$cuando
  umbral <- suppressWarnings(as.numeric(x$umbral %||% .CASOS_JUNTO_DEFECTO$umbral)[1])
  if (!is.finite(umbral) || umbral < 1) umbral <- .CASOS_JUNTO_DEFECTO$umbral
  list(cuando = cuando, umbral = umbral)
}

#' El ajuste del informe tal como lo trae `presets` (o el defecto)
#' @keywords internal
.casos_junto_de_presets <- function(presets) .casos_junto_normalizar(presets$base$args$casos_junto %||% presets$base$casos_junto)

#' El ajuste vigente en este render (opción `prosecnur.casos_junto`), con el de un gráfico encima si lo trae
#' @keywords internal
.casos_junto_vigente <- function(propio = NULL) {
  inf <- .casos_junto_normalizar(getOption("prosecnur.casos_junto", .CASOS_JUNTO_DEFECTO))
  if (is.list(propio) && length(propio)) {
    p <- .casos_junto_normalizar(utils::modifyList(inf, propio))
    return(p)
  }
  if (is.character(propio) && length(propio) && propio[1] %in% c("siempre", "nunca", "menos")) inf$cuando <- propio[1]
  inf
}

#' ¿Se escriben los casos para estos grupos? `n` = casos sin ponderar de cada grupo del gráfico
#' @keywords internal
.casos_junto_muestra <- function(n, propio = NULL) {
  r <- .casos_junto_vigente(propio)
  if (identical(r$cuando, "nunca")) return(FALSE)
  if (identical(r$cuando, "siempre")) return(TRUE)
  n <- suppressWarnings(as.numeric(n))
  any(is.finite(n) & n > 0 & n < r$umbral)
}
