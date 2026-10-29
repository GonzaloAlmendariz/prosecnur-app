# lamina_escala_llenar.R — la lámina de escala aprovecha su alto como Contabilidad (Gonzalo, 2026-10-28: «sigo encontrando
# errores de distribución donde no se aprovecha el alto del slide correctamente y tampoco se separa adecuadamente con la
# leyenda»).
#
# Medido sobre el informe de Contabilidad (motor antiguo, 03.09.2026), mediana por número de barras de la lámina:
#   barras   grosor   última barra termina   leyenda (borde a borde con la última barra)
#     2       0,71          5,54 in                0,56 in
#     3       0,69          5,98                   0,75
#     4       0,59          6,36                   0,47
#     5       0,51          6,32                   0,43
#     6       0,51          6,61                   0,30
# Arte, con el grosor del piso (0,44) y el sobrante debajo, terminaba en 4,1 in con dos barras y 4,9 con tres.
#
# Sólo se usa el alto que SOBRA en la lámina ya partida: el grosor crece hacia el de Contabilidad y el resto va entre
# temas. La partición y el número de láminas no cambian (se decide antes, con el grosor del estándar).

#' Grosor de Contabilidad por número de barras de la lámina (in)
#' @keywords internal
.lam_grosor_holgado <- function(nb) {
  tabla <- list(c(2, 0.70), c(3, 0.66), c(4, 0.58), c(6, 0.51), c(9, 0.38))
  for (t in tabla) if (nb <= t[1]) return(t[2])
  0.32
}

# Aire máximo entre las barras de los públicos de una sola pregunta cuando la lámina llena su alto (Conta: 0,65–0,84 in).
.LAM_LLENAR_AIRE_PUBLICOS <- 0.65
# Tope del aire entre temas cuando la lámina llena su alto (Conta: mediana 0,74 in, 0,6–1,2 en láminas de pocas barras).
# Gonzalo, 2026-10-28: «está bien que haya una separación entre temáticas, pero veo una separación como de 4 centímetros».
.LAM_LLENAR_ENTRE_MAX <- 1.0

# Aire entre la última barra (o el texto de la última premisa) y la leyenda cuando la lámina tiene alto de sobra.
.LAM_LLENAR_AIRE_LEYENDA <- 0.45

#' Piso de la leyenda de una fila: `base_y - 0,32` (el tope de `.lam_leyenda`), menos lo que reserve el pie
#'
#' La nota de significancia reserva su alto sobre «Base:» (`prosecnur.lam_reserva_pie`, lamina_nota_significancia.R):
#' `leyenda_y` ya lo descuenta, `base_y` no, y la leyenda que bajaba hasta su piso pisaba la nota.
#' @keywords internal
.lam_piso_leyenda <- function() .std_geom("base_y") - 0.32 - getOption("prosecnur.lam_reserva_pie", 0)

#' Alto disponible para el bloque de una lámina de escala que llena su alto: hasta la leyenda en su piso
#'
#' La leyenda de una fila baja hasta `base_y - 0,32` (`.lam_leyenda`); el bloque termina `.LAM_LLENAR_AIRE_LEYENDA` antes.
#' @keywords internal
.lam_escala_alto_llenar <- function(y0) {
  .lam_piso_leyenda() - .LAM_LLENAR_AIRE_LEYENDA - y0
}

#' Cuánto engrosar la barra con el alto que sobra: hacia el grosor de Contabilidad, sin pasarlo
#'
#' @param g Grosor decidido (in). @param nb Barras de la lámina. @param sobra Alto que sobra (in).
#' @return El incremento de grosor por barra (>= 0).
#' @keywords internal
.lam_escala_engrosar <- function(g, nb, sobra) {
  if (!is.finite(sobra) || sobra <= 0 || nb < 1) return(0)
  max(0, min(.lam_grosor_holgado(nb) - g, sobra / nb))
}

#' Cuánto bajar el bloque para centrarlo en la lámina con lo que sigue sobrando tras engrosar y separar temas
#'
#' «Los gráficos donde sólo hay un tema o un solo gráfico […] no los centras en la diapositiva» (Gonzalo, 2026-10-28). El
#' bloque y su leyenda quedan centrados entre el inicio de la zona de datos y el piso de la leyenda.
#' @param fin `y` donde termina el bloque compuesto sin desplazar. @return Desplazamiento (in, >= 0).
#' @keywords internal
.lam_escala_centrar <- function(fin) {
  max(0, (.lam_piso_leyenda() - .LAM_LLENAR_AIRE_LEYENDA - fin) / 2)
}
