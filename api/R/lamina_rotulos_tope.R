# =============================================================================
# lamina_rotulos_tope.R — el área del gráfico manda: la columna de rótulos tiene un tope de la casa (O2)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre el resumen de Arte (su versión revisada a mano): angostó a mano la columna de rótulos de la
# escala y del contraste y dejó los rótulos en dos líneas. Cajas que dejó (ancho de la caja del rótulo, en pulgadas):
#   - "Preguntas con mayor proporción de Sin información" (escala): 3.54;
#   - "Preguntas con menos de 60 %" (escala, 20 filas en su versión): 4.11;
#   - "Preguntas comunes a docentes y estudiantes" (contraste de dos públicos): 3.07;
#   - "Diferencias por ciclo" (contraste con tres grupos): 2.89.
# Sobre el ancho útil de la lámina (13.333 - 0.495 - 0.315 = 12.52 in): la escala 0.28 (3.5 in, la de "Sin
# información": la de 4.11 in llevaba 20 filas y rótulos de cuatro líneas montados) y el contraste 0.24 (3.0 in, la
# media de 3.07 y 2.89). Regla:
#   1. El área del gráfico tiene prioridad: la columna nunca pasa del tope de su familia.
#   2. Un rótulo va en una línea sólo si cabe dentro del tope; si no, se parte en dos (tres o cuatro si hace falta),
#      medido con la tinta real (`.lam_rotulos_columna`). Nunca "…".

#' Fracción del ancho útil de la lámina que puede tomar la columna de rótulos, por familia
#' @keywords internal
.LAM_ROTULOS_TOPE_FR <- c(escala = 0.28, contraste = 0.24)

#' Tope de la columna de rótulos (in) de una familia a página entera
#' @keywords internal
.lam_rotulos_tope <- function(familia = c("escala", "contraste")) {
  familia <- match.arg(familia)
  g_ <- .std_geom
  unname(.LAM_ROTULOS_TOPE_FR[[familia]]) * (g_("ancho") - g_("margen_izq") - g_("margen_der"))
}

#' La columna de rótulos con el tope de la casa: primero dentro del tope; sólo si así no caben todas las filas, hasta el
#' ancho que deja el área del gráfico en su mínimo (`w_max`)
#'
#' El tope cede antes que mandar la lámina a la imagen o dejar filas fuera: mostrar todas las filas pesa más que el ancho
#' del área (P11). Los demás argumentos, los de `.lam_rotulos_columna`.
#' @keywords internal
.lam_rotulos_columna_tope <- function(textos, prioridad = NULL, w_min, w_max, tope, ...) {
  r <- .lam_rotulos_columna(textos, prioridad, w_min = w_min, w_max = max(w_min, min(w_max, tope)), ...)
  if (tope >= w_max - 1e-9 || (!is.null(r) && r$k >= r$n_total)) return(r)
  r2 <- .lam_rotulos_columna(textos, prioridad, w_min = w_min, w_max = w_max, ...)
  if (!is.null(r2) && (is.null(r) || r2$k > r$k)) r2 else r
}
