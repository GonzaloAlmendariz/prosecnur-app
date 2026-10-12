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

#' Cifras de una especificación categórica con sus casos («43% (12)») cuando el ajuste lo pide para la base del gráfico
#'
#' `idx` son las categorías que quedaron; la base es `n_base_casos` o, sin ella, la suma de los casos de todas. Una cifra
#' que ya trae su paréntesis (`mostrar_n_en_etiquetas`) no se toca.
#' @keywords internal
.casos_junto_cifras <- function(cifras, n_casos, n_base_casos = NULL, idx = seq_along(cifras), propio = NA) {
  base <- suppressWarnings(as.numeric(n_base_casos %||% NA_real_)[1])
  if (!is.finite(base)) base <- sum(suppressWarnings(as.numeric(n_casos)), na.rm = TRUE)
  out <- as.character(cifras[idx])
  if (!.casos_junto_decidir(propio, base)) return(out)
  n <- suppressWarnings(as.numeric(n_casos[idx]))
  pon <- is.finite(n) & !grepl("\\(", out)
  out[pon] <- sprintf("%s (%d)", out[pon], as.integer(round(n[pon])))
  out
}

#' Fija la opción del render con el ajuste que declaran los presets; sin declaración no toca nada (manda la opción vigente
#' o el defecto). Devuelve las opciones anteriores para `on.exit(options(...))`.
#' @keywords internal
.casos_junto_fijar <- function(presets) {
  declarado <- presets$base$args$casos_junto %||% presets$base$casos_junto
  if (is.null(declarado)) return(list())
  options(prosecnur.casos_junto = .casos_junto_normalizar(declarado))
}

#' Decisión de un gráfico con argumento propio: TRUE/FALSE manda; NULL o NA deja que decida el ajuste del informe
#' @keywords internal
.casos_junto_decidir <- function(propio, n_base) {
  if (length(propio) && !is.na(propio[1])) return(isTRUE(propio[1]))
  .casos_junto_muestra(n_base)
}
