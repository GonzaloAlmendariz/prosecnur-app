# lamina_panel_cabecera_box.R — la cabecera «TOP TWO BOX» de un Likert de panel queda dentro de su panel y bajo su pregunta
#
# Ola 2, G5 (lámina «Cuatro gráficos con exclusión», panel derecho): la cabecera de la columna Top Two Box se centraba
# sobre la columna y, al crecer con la tinta (1.4 in para una columna de 1 in), salía 0.2 in por la derecha del panel;
# además arrancaba 0.15 in por encima del final de la pregunta de 16 pt, encima de su texto. Sólo geometría.

#' Alto de la caja de la pregunta de un panel (la misma cuenta que `.lam_panel_titulo`)
#' @keywords internal
.lam_panel_titulo_alto <- function(texto, w, size = .std_pt("pregunta")) {
  if (is.null(texto) || !nzchar(texto)) return(0)
  (0.3 + 0.22 * (.lam_panel_lineas(texto, w, size) - 1)) * size / .std_pt("pregunta")
}

#' `y0` del Likert de un panel con columna Top Two Box: su cabecera (que va 0.05 in sobre `y0`) no pisa la pregunta
#' @param y0 El `y0` que decidió la geometría del panel. @param y Arriba del panel.
#' @param publico Si la pregunta lleva su «N respuestas» debajo (0.26 in más).
#' @keywords internal
.lam_panel_y0_bajo_pregunta <- function(y0, y, w, pregunta, publico = FALSE, size = .std_pt("pregunta")) {
  alto <- .lam_panel_titulo_alto(pregunta, w, size)
  if (alto <= 0) return(y0)
  max(y0, y + alto + (if (isTRUE(publico)) 0.26 else 0) + 0.07)
}

#' `x` de la cabecera de ancho `wr` centrada sobre la columna, sin salir del panel `[x, x + w]`
#' @keywords internal
.lam_cabecera_box_x <- function(x, w, wttb, wr) min(x + w - wttb / 2 - wr / 2, x + w - wr)
