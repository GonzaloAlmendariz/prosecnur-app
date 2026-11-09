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

#' Grosor de Contabilidad por número de barras de la lámina (in), del estándar (`ppt.composicion.llenar.grosor`)
#' @keywords internal
.lam_grosor_holgado <- function(nb) {
  g <- NULL
  for (t in .std_comp("llenar", "grosor")) if (nb <= t$filas_hasta) { g <- t$grosor; break }
  g <- g %||% .std_comp("llenar", "grosor")[[length(.std_comp("llenar", "grosor"))]]$grosor
  # B4: al recomponer una lámina gemela, el engrosamiento no pasa del grosor mínimo de su familia (lamina_grosor_familias.R)
  tope <- .lam_gf_tope(); if (is.numeric(tope) && length(tope) == 1L && is.finite(tope)) g <- min(g, tope)
  g
}

# Los aires de la lámina que llena su alto (leyenda, entre temas, entre públicos) viven en `ppt.composicion.llenar`.

#' Piso de la leyenda de una fila: `base_y - 0,32` (el tope de `.lam_leyenda`), menos lo que reserve el pie
#'
#' La nota de significancia reserva su alto sobre «Base:» (`prosecnur.lam_reserva_pie`, lamina_nota_significancia.R):
#' `leyenda_y` ya lo descuenta, `base_y` no, y la leyenda que bajaba hasta su piso pisaba la nota.
#' @keywords internal
.lam_piso_leyenda <- function() {
  # Una leyenda de varias filas sube 0.3 in por fila sobre «Base:» (`.lam_leyenda`); su piso sube lo mismo, o la última
  # barra quedaba bajo la leyenda (CCSS, batería de gobierno: seis categorías en dos filas).
  k <- suppressWarnings(as.integer(getOption("prosecnur.lam_filas_leyenda", 1L))[1])
  .std_geom("base_y") - .std_comp("llenar", "piso_leyenda") - getOption("prosecnur.lam_reserva_pie", 0) - 0.3 * max(0L, (if (is.na(k)) 1L else k) - 1L)
}

#' Filas que ocupa la leyenda de una escala en su lámina (la cuenta de `.lam_leyenda`)
#' @keywords internal
.lam_escala_filas_leyenda <- function(espec) {
  labels <- tryCatch(espec$categorias$rotulo[espec$leyenda], error = function(e) NULL)
  if (!length(labels)) return(1L)
  length(.lam_leyenda_plan_lamina(labels, (.std_geom("ancho") - .std_reserva_derecha()) / 2)$filas)
}

#' Alto disponible para el bloque de una lámina de escala que llena su alto: hasta la leyenda en su piso
#'
#' La leyenda de una fila baja hasta `base_y - 0,32` (`.lam_leyenda`); el bloque termina `.std_comp("llenar", "aire_leyenda")` antes.
#' @keywords internal
.lam_escala_alto_llenar <- function(y0) {
  .lam_piso_leyenda() - .std_comp("llenar", "aire_leyenda") - y0
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

#' El mayor engrosamiento que todavía cabe, midiendo lo que de verdad crece la lámina
#'
#' `sobra / nb` supone que cada barra crece entera; cuando el alto de una pregunta lo manda su texto, sus barras engrosan
#' sin que la fila crezca (ítems 4–5 de checklist-arte-vs-conta: Arte salía en 0,44 in con 4–6 filas, Conta en 0,51–0,59).
#' @param cabe Función `function(dg)` que dice si la lámina cabe con la barra `dg` más gruesa.
#' @keywords internal
.lam_escala_engrosar_busca <- function(g, nb, cabe) {
  tope <- .lam_grosor_holgado(nb) - g
  if (nb < 1 || !is.finite(tope) || tope <= 0) return(0)
  for (dg in rev(seq(0, tope, by = 0.01))) if (isTRUE(cabe(dg))) return(dg)
  0
}

#' Cuánto bajar el bloque para centrarlo en la lámina con lo que sigue sobrando tras engrosar y separar temas
#'
#' «Los gráficos donde sólo hay un tema o un solo gráfico […] no los centras en la diapositiva» (Gonzalo, 2026-10-28). El
#' bloque y su leyenda quedan centrados entre el inicio de la zona de datos y el piso de la leyenda.
#' @param fin `y` donde termina el bloque compuesto sin desplazar. @return Desplazamiento (in, >= 0).
#' @keywords internal
.lam_escala_centrar <- function(fin) {
  max(0, (.lam_piso_leyenda() - .std_comp("llenar", "aire_leyenda") - fin) / 2)
}
