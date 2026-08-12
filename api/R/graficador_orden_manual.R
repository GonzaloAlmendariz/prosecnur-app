# =============================================================================
# graficador_orden_manual.R — cuándo manda el orden declarado a mano
# =============================================================================
#
# Dos controles pedían lo mismo y sólo uno lo decía. El inspector mostraba a la
# vez «Orden de las categorías» —con «Ascendente» marcado— y «Orden manual», y
# el manual ganaba en silencio: el analista veía un orden que no era el que su
# selector afirmaba.
#
# La regla es que **el modo manda**, y «Manual» es uno de sus modos. Vive aquí
# y no dentro de cada graficador porque el pie y las barras agrupadas resuelven
# el orden con estructuras distintas —índices unos, niveles de factor otros—
# pero la decisión de *si* el orden declarado aplica es la misma. Con una copia
# por graficador, arreglar uno dejaba al otro con el conflicto: fue exactamente
# lo que pasó.

#' ¿Manda el orden declarado a mano?
#'
#' @param orden_manual Etiquetas declaradas por el analista, o `NULL`.
#' @param modo Modo elegido en el selector de orden del graficador.
#' @param modos_automaticos Valores de ese selector que ordenan por dato. El
#'   nombre del arg cambia entre graficadores (`ordenar_categorias` en el pie,
#'   `orden_barras` en agrupadas) y también sus valores, así que los pone el
#'   llamador.
#' @return `TRUE` si el orden declarado debe aplicarse tal cual.
#' @keywords internal
.orden_manual_manda <- function(orden_manual, modo, modos_automaticos) {
  om <- as.character(orden_manual %||% character(0))
  om <- om[!is.na(om) & nzchar(om)]
  if (!length(om)) return(FALSE)

  # Compatibilidad: un proyecto guardado antes de que «Manual» fuera un modo
  # trae la declaración sin él. Ahí se respeta, porque borrarle el orden al
  # reabrir sería peor que la incoherencia que esto viene a evitar. Sólo pierde
  # frente a un modo automático elegido a conciencia.
  identical(modo, "manual") || !as.character(modo %||% "") %in% modos_automaticos
}

#' Limpia una declaración de orden manual.
#'
#' @param orden_manual Valor crudo tal como llega del plan.
#' @return Vector de caracteres sin vacíos ni `NA`.
#' @keywords internal
.orden_manual_etiquetas <- function(orden_manual) {
  om <- as.character(orden_manual %||% character(0))
  om[!is.na(om) & nzchar(om)]
}
