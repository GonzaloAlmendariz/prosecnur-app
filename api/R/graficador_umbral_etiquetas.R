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
#' **El umbral es el interruptor.** La primera versión de esto exigía además un
#' bool `ocultar_etiquetas_pequenas`, y entonces declarar `0.15` no hacía nada
#' hasta encender un segundo control — dos mandos para una decisión, con el
#' silencioso ganando. Un test que pasaba el umbral explícito lo delató: salían
#' las seis etiquetas. Como el valor por defecto ya es `0`, no hace falta nada
#' más para que «se muestran todos» sea el comportamiento de fábrica.
#'
#' @param ocultar_pequenas Interruptor heredado. Se conserva por los proyectos
#'   que lo tengan guardado, pero apagarlo ya no anula un umbral declarado: si
#'   alguien escribió 15 %, quiso 15 %.
#' @param umbral Umbral declarado, en proporción (0.15 = 15 %).
#' @return El umbral cuando es un número positivo; `0` en cualquier otro caso,
#'   que dibuja todo valor por encima de cero.
#' @keywords internal
.barras_umbral_ocultar_efectivo <- function(ocultar_pequenas = FALSE, umbral = 0) {
  u <- suppressWarnings(as.numeric(umbral)[1])
  if (!is.finite(u) || is.na(u) || u <= 0) return(0)
  u
}


# =============================================================================
# P53 — el residuo de coma flotante resucitaba el segmento aplanado
# =============================================================================
#
# `graficador_barras_apiladas.R` aplana a 0 todo segmento cuya CIFRA es 0 %
# —«un segmento que se rotularia 0 % NO se dibuja», decision de Gonzalo del
# 2026-08-14— y luego, mas abajo, recomprime la barra y la CIERRA EXACTAMENTE
# A 1 sumando `delta = 1 - suma` al ultimo nivel del stack. Ese cierre nacio
# para tapar residuo numerico, y cuando el ultimo nivel es justo uno de los
# aplanados le devuelve el residuo: `.valor_plot` pasa de 0 a **1,11022e-16**.
#
# Con eso basta. La guarda de la etiqueta es `.valor_plot > umbral` con umbral
# 0 por defecto, asi que 1,11e-16 la cruza y el rotulo «0%» sale dibujado sobre
# un segmento de ancho 0 EMU, flotando encima del vecino. El aprobado no rotula
# ninguno: 0 sobre 1.019 etiquetas contra 8 sobre 1.098 del motor.
#
# MEDIDO con traza en la fuente sobre el mazo de Contabilidad, 232 renders:
# **22 renders con fuga y 24 etiquetas**, TODAS con exactamente
# `.valor_plot = 1,11022e-16`, `.pct_units = 0` y `.valor_pct_real = 0`.
#
# La reparacion no toca ni el cierre ni las guardas: reafirma la invariante
# despues del cierre, que es donde se rompia. La cifra manda sobre la
# geometria, igual que ya manda para elegir el texto del rotulo.

#' Vuelve a aplanar los segmentos cuya cifra es 0 %.
#'
#' Se aplica DESPUES del cierre exacto a 1. El faltante que deja es del orden
#' del residuo que el cierre venia a tapar (1e-16), invisible en el render.
#'
#' @param valor_plot Anchos en proporcion, ya cerrados a 1.
#' @param pct_units Unidades enteras de porcentaje de cada segmento, que son
#'   las que se rotulan.
#' @param mostrar_ceros Interruptor `mostrar_categorias_en_cero`. Cuando esta
#'   encendido el analista PIDIO ver los ceros con su piso y su frecuencia al
#'   lado, y entonces esto no toca nada.
#' @return `valor_plot` con un 0 exacto donde la cifra es 0 %.
#' @keywords internal
.barras_reaplanar_cifras_cero <- function(valor_plot, pct_units,
                                          mostrar_ceros = FALSE) {
  if (isTRUE(mostrar_ceros)) return(valor_plot)
  v <- suppressWarnings(as.numeric(valor_plot))
  u <- suppressWarnings(as.numeric(pct_units))
  if (!length(v) || length(u) != length(v)) return(valor_plot)
  v[!is.na(u) & u == 0] <- 0
  v
}
