# =============================================================================
# lamina_tarjetas_publicos.R — la tarjeta entre tres o más públicos: una línea por par marcado (ADR 0138 §3)
# =============================================================================
#
# Con dos públicos la tarjeta es la de dos grupos del ADR 0129 sin fila Total (lamina_tarjetas_diferencias.R). Con tres o
# más, debajo del antetítulo «ENTRE PÚBLICOS» y del tema, una línea por par marcado: «Docentes 78% frente a Estudiantes
# 64%: +14 pp ▲» (△ y azul medio si es frágil). Las primitivas son las del backend de la tarjeta (`rect`, `txt`), así que
# el PPT y el Word la dibujan con el mismo código.

#' Alto de una línea de par (in), con la tinta real de Arial y la holgura de la tarjeta
#' @keywords internal
.lam_tarjeta_publicos_lineas_n <- function(s, wi, m) {
  max(1L, as.integer(.lam_lineas_tinta(s, wi * .TARJETA_TINTA_TITULO + 0.22, m$pt_nombre, FALSE)))
}

#' Alto (in) de la tarjeta con líneas de pares
#' @param h_fila Alto del encabezado (tema) ya medido por `.lam_tarjeta_alto`.
#' @keywords internal
.lam_tarjeta_publicos_alto <- function(t, w, m, h_fila) {
  wi <- w - 2 * m$pad_x
  lineas <- vapply(t$lineas, .lam_tarjeta_publicos_lineas_n, integer(1), wi = wi, m = m)
  m$pad_t + m$alto_cruce + h_fila + sum(lineas) * m$pt_nombre * 1.25 / 72 + (length(lineas) - 1L) * 0.05 + m$pad_b + 0.06
}

#' Dibuja las líneas de pares desde `y` (in de diseño) con un backend de tarjeta
#' @keywords internal
.lam_tarjeta_publicos_lineas <- function(b, t, x0, y, wi, m) {
  for (k in seq_along(t$lineas)) {
    fr <- isTRUE(t$lineas_fragil[k])
    n <- .lam_tarjeta_publicos_lineas_n(t$lineas[k], wi, m)
    h <- n * m$pt_nombre * 1.25 / 72
    b$txt(t$lineas[k], x0, y, wi, h, m$pt_nombre, .std_color(if (fr) "tarjeta_borde_95" else "azul"), bold = !fr,
          nombre = if (fr) "tarjeta:par:95" else "tarjeta:par:99")
    y <- y + h + 0.05
  }
  y
}

#' La lámina del contraste con sus tarjetas entre públicos y el pie de la prueba sobre «Base:» (gancho de lamina_citas.R)
#'
#' El contraste nativo no escribe la nota de significancia; aquí se reserva su alto y se escribe una sola vez en cada
#' lámina (`.lam_con_nota_sig`). El gráfico se compone sin la nota para no dibujarla dos veces.
#' @param compone `function(p, por_lamina)` que compone la lámina con el panel de tarjetas.
#' @keywords internal
.lam_tpub_slide_1 <- function(doc, p, por_lamina, compone) {
  nota <- .lam_nota_sig_de(p)
  attr(p, "pulso_sig_nota") <- NULL
  .lam_con_nota_sig(nota, por_lamina, function(por_lamina) compone(p, por_lamina))
}
