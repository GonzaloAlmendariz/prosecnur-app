# =============================================================================
# lamina_barras_jerarquia.R — temas y subtemas en las barras de una serie (TXT-26, CCSS 2026-10-25)
# =============================================================================
#
# La lámina de temas de un texto abierto (`temas_de_texto`, reporte_plan_temas_texto.R) pone bajo cada módulo partido
# sus subtemas «B · …». Con la misma tinta, grosor y color, el módulo y sus subtemas se leían como pares. La espec trae
# `jerarquia` («tema» / «subtema», alineada con `rotulos`) y aquí se traduce en estilo, con colores del estándar:
#
#  - tema (primer nivel): rótulo en negrita en el azul de la casa, barra azul, cifra en negrita;
#  - subtema: rótulo regular en el tono suave del texto, barra en el azul medio, cifra regular.
#
# Las barras, sus largos, las cifras y el orden no cambian. El resalte que pide el analista (`resaltar`) manda sobre la
# jerarquía, y la paleta propia del usuario (ADR 0097) conserva el color de sus barras. Sin `jerarquia`, nada cambia.

#' ¿La espec trae una jerarquía de temas utilizable?
#' @keywords internal
.lam_jer_activa <- function(espec) {
  j <- espec$jerarquia
  !is.null(j) && length(j) == length(espec$rotulos) && any(j == "subtema") && !length(espec$resaltar %||% character(0))
}

#' Negrita del rótulo de cada fila: los temas en negrita, los subtemas no; sin jerarquía, `base` tal cual
#' @keywords internal
.lam_jer_negrita <- function(espec, base = FALSE) {
  if (!.lam_jer_activa(espec)) return(rep(isTRUE(base), length(espec$rotulos)))
  espec$jerarquia != "subtema"
}

#' Estilo de la fila `k` (`NULL` sin jerarquía: la fila sigue la regla de siempre)
#' @keywords internal
.lam_jer_estilo <- function(espec, k, fill_usuario = NULL) {
  if (!.lam_jer_activa(espec)) return(NULL)
  sub <- identical(espec$jerarquia[[k]], "subtema")
  list(
    bold = !sub,
    color_rotulo = .std_color(if (sub) "texto_suave" else "azul"),
    fill = fill_usuario %||% .std_color(if (sub) "azul_medio" else "azul"),
    cifra_bold = !sub
  )
}

#' Alto de los rótulos para decidir si la categórica cabe en barras
#'
#' Con jerarquía se mide con la tinta (`.lam_alto_tinta`, la misma que da el ancho de la columna en `.lam_barras_geo`)
#' y con la negrita de cada fila; sin ella, la estimación por carácter de siempre.
#' @keywords internal
.lam_jer_altos <- function(espec, wlab, size) {
  if (!.lam_jer_activa(espec)) return(vapply(espec$rotulos, function(r) .lam_alto_txt(r, wlab, size), 0))
  nb <- .lam_jer_negrita(espec)
  vapply(seq_along(espec$rotulos), function(k) unname(.lam_alto_tinta(espec$rotulos[[k]], wlab, size, nb[[k]])), 0)
}
