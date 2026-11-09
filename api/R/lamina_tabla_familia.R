# =============================================================================
# lamina_tabla_familia.R — un solo estilo de tabla nativa para el radar entre públicos y sus variantes (R12-4)
# =============================================================================
#
# La tabla de datos del radar y de las líneas y puntos salía con el estilo del recetario (`tabla_ttb`: encabezado sin
# relleno con filete azul, primera columna en negrita, cebra y filete al pie); la de las barras comparativas, por el
# camino general, con la rejilla completa gris y el encabezado relleno. Es la misma tabla —criterios por públicos— en
# tres formas del mismo gráfico, así que lleva un solo estilo: el del recetario. Las medidas del camino general (letra
# de 12 pt, fila fija de 0,42 in) no cambian: las usó la decisión de sitio (`.lam_tabla_costado_geom`).

#' Flextable con el estilo del recetario (`tabla_ttb`): encabezado azul con filete, primera columna en negrita y cebra
#'
#' @param d `data.frame` de texto; sus nombres son los rótulos del encabezado.
#' @param ws Anchos de columna (in). @param rowh,rowh_cuerpo Alto del encabezado y de cada fila del cuerpo (in).
#' @param cuerpo_pt,enc_pt Letra del cuerpo y del encabezado.
#' @keywords internal
.lam_tabla_ttb_ft <- function(d, ws, rowh, rowh_cuerpo = rowh, cuerpo_pt = 13, enc_pt = .lam_tabla_m()$enc_pt) {
  azul <- .std_color("azul"); fuente <- .std_pt("fuente")
  # Los rótulos del encabezado no son las claves de las columnas: uno vacío (la primera columna sin encabezado, que el
  # informe avisa) o dos iguales hacían caer `flextable` con «undefined columns selected», y con él el mazo entero
  # (acrconta_mazo, lámina 48). Claves internas seguras y el encabezado tal cual.
  d <- as.data.frame(d, stringsAsFactors = FALSE, check.names = FALSE)
  rotulos <- as.character(names(d)); rotulos[is.na(rotulos)] <- ""
  names(d) <- paste0("c", seq_along(d))
  for (j in seq_along(d)) { v <- as.character(d[[j]]); v[is.na(v)] <- ""; d[[j]] <- v }
  ft <- flextable::flextable(d)
  ft <- flextable::set_header_labels(ft, values = stats::setNames(as.list(rotulos), names(d)))
  ft <- flextable::font(ft, fontname = fuente, part = "all")
  ft <- flextable::fontsize(ft, size = cuerpo_pt, part = "body"); ft <- flextable::fontsize(ft, size = enc_pt, part = "header")
  ft <- flextable::color(ft, color = azul, part = "all"); ft <- flextable::bold(ft, part = "header"); ft <- flextable::bold(ft, j = 1, part = "body")
  if (ncol(d) >= 2L) ft <- flextable::align(ft, j = seq(2, ncol(d)), align = "center", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::border_remove(ft); ft <- flextable::bg(ft, bg = "transparent", part = "header")
  if (nrow(d) >= 2) ft <- flextable::bg(ft, i = seq(2, nrow(d), 2), bg = .std_color("cebra"), part = "body")
  ft <- flextable::hline_bottom(ft, border = officer::fp_border(color = azul, width = 1.25), part = "header")
  ft <- flextable::hline_bottom(ft, border = officer::fp_border(color = .std_color("filete"), width = 0.75), part = "body")
  ft <- flextable::padding(ft, padding = 6, part = "all"); ft <- flextable::width(ft, width = ws)
  ft <- flextable::height(ft, height = rowh, part = "header"); ft <- flextable::height(ft, height = rowh_cuerpo, part = "body")
  ft <- flextable::hrule(ft, rule = "exact", part = "header"); ft <- flextable::hrule(ft, rule = "exact", part = "body")
  ft
}

#' La tabla de datos del camino general (barras comparativas y respaldo de líneas y puntos) con el estilo del recetario
#'
#' Lo llama `.tabla_nativa_flextable()` cuando la tabla decidió su sitio (`lugar_auto`). Anchos: los medidos al decidir
#' (`anchos_in`); altos: los de la misma medida (`.lam_tabla_costado_medidas`, sin comprimir), así la tabla ocupa
#' exactamente el alto con que se la colocó.
#' @param tabla `data.frame` de la tabla. @param estilo Estilo adjunto por `.radar_mb_tabla_adjuntar`, más `anchos_in`.
#' @keywords internal
.tabla_nativa_familia_ft <- function(tabla, estilo = list()) {
  M <- .lam_tabla_m("tabla_general")
  med <- .lam_tabla_costado_medidas(estilo$tabla_ejes %||% as.character(tabla[[1]]), estilo$tabla_grupos %||% names(tabla)[-1L],
                                    estilo$tabla_encabezado %||% names(tabla)[1L], M = M, comprimible = FALSE)
  ws <- suppressWarnings(as.numeric(unlist(estilo$anchos_in)))
  if (length(ws) != ncol(tabla) || !all(is.finite(ws) & ws > 0)) ws <- med$ws
  num <- function(x, d) { v <- suppressWarnings(as.numeric(x)[1]); if (length(v) && is.finite(v)) v else d }
  .lam_tabla_ttb_ft(tabla, ws, med$h_enc, med$nat, cuerpo_pt = num(estilo$body_size, M$cuerpo_pt),
                    enc_pt = num(estilo$header_size, M$enc_pt))
}
