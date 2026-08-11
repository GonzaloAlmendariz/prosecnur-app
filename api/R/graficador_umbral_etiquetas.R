# =============================================================================
# graficador_umbral_etiquetas.R — ocultar cifras pequeñas es una decisión
# =============================================================================
#
# El motor ocultaba por su cuenta toda etiqueta de valor <= 15 % en dos casos
# —baterías ordinales de tres o más variables, y gráficos de menos de 7,25 in—
# inyectando `umbral_ocultar_etiqueta = 0.15` desde `reporte_plan_helpers.R`.
# Nadie lo pedía y nada lo decía: en la lámina de seis enunciados del mazo de
# acreditación desaparecían los porcentajes del 1 % al 15 %, que es justo donde
# vive el dato interesante de una escala de acuerdo.
#
# Medido con `trace()` sobre «Conta 11-08»: de 51 llamadas al graficador, las
# que caían en esas reglas recibían `ocultar = 0.15` y el resto `ocultar = 0`.
#
# Ahora el criterio es al revés y explícito: **por defecto se muestran todos los
# porcentajes**, y ocultar los pequeños es un interruptor que el analista
# enciende. El umbral conserva su valor y su significado; lo que cambia es que
# ya no se aplica a menos que se pida.

#' Umbral por debajo del cual NO se dibuja la etiqueta.
#'
#' @param ocultar_pequenas Interruptor del analista. Apagado por defecto.
#' @param umbral Umbral declarado, en proporción (0.15 = 15 %). Sólo se usa
#'   cuando el interruptor está encendido.
#' @return `0` con el interruptor apagado —se dibuja todo valor positivo— o el
#'   umbral declarado cuando está encendido.
#' @keywords internal
.barras_umbral_ocultar_efectivo <- function(ocultar_pequenas, umbral) {
  if (!isTRUE(ocultar_pequenas)) return(0)
  u <- suppressWarnings(as.numeric(umbral)[1])
  if (!is.finite(u) || is.na(u) || u < 0) return(0)
  u
}
