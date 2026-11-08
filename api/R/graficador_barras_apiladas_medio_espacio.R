# =============================================================================
# graficador_barras_apiladas_medio_espacio.R — la apilada dibujada en medio espacio conserva su letra
# =============================================================================
#
# Ola 4, A1 (captura «I. Cuatro gráficos con exclusión», panel de arriba a la izquierda): la apilada de cinco grupos con
# Top Two Box, dibujada de respaldo en un cajón de ~2.4 in, pedía ~4.6 in de lienzo. El lienzo se arma en fracciones de su
# alto intrínseco, así que al colocarlo en el cajón TODO se encogía en la misma proporción: la banda de la leyenda daba
# para 7 pt (`.barras_leyenda_size_ajustado` bajaba la letra a lo que cabía) y las cifras de fuera de la misma fila
# quedaban pegadas («8%8%», «2%2%»): su ancho se estimaba como fracción de una barra que se suponía más ancha.
#
# Decisión del lead (2026-11-08):
#   (a) las cifras de fuera de una misma fila se separan con su ancho de tinta medido y nunca se montan;
#   (b) la leyenda no baja del cuerpo del estándar (`tipografia.leyenda`): si no cabe, el alto sale del panel de barras,
#       no del tamaño de la letra;
#   (c) si aun así la barra queda bajo el piso de media lámina (`ppt.grosor.piso_panel_cm`), el motor AVISA al analista;
#       no parte la lámina: es su decisión.

#' Alto del lienzo cuando no cabe en su cajón: cede el panel, no la cabecera, la leyenda ni el pie
#'
#' Con `h_total_in > alto` el lienzo se encogía entero al colocarse. Aquí cabecera, leyenda y pie conservan su alto físico
#' y el panel de barras se queda con el resto. Si ni eso deja un panel útil (menos de un tercio del pedido), no se toca:
#' es una lámina que no cabe y lo dice el aviso de medio espacio.
#' @return `list(h_panel_in, h_total_in, cedio)`.
#' @keywords internal
.apiladas_panel_cede_alto <- function(h_header_in, h_panel_in, h_legend_in, h_caption_in, alto) {
  alto <- suppressWarnings(as.numeric(alto)[1])
  fijo <- sum(c(h_header_in, h_legend_in, h_caption_in), na.rm = TRUE)
  total <- fijo + h_panel_in
  sin_cambio <- list(h_panel_in = h_panel_in, h_total_in = total, cedio = FALSE)
  if (!is.finite(alto) || alto <= 0 || !is.finite(total) || total <= alto + 0.005) return(sin_cambio)
  panel <- alto - fijo
  if (!is.finite(panel) || panel < h_panel_in / 3) return(sin_cambio)
  list(h_panel_in = panel, h_total_in = alto, cedio = TRUE)
}

#' Cuerpo mínimo de la leyenda: el del estándar, o el pedido si es menor
#' @keywords internal
.apiladas_leyenda_piso_pt <- function(size_leyenda) {
  s <- suppressWarnings(as.numeric(size_leyenda)[1])
  std <- tryCatch(as.numeric(.std_pt("leyenda")), error = function(e) 10)
  if (!length(std) || !is.finite(std) || std <= 0) std <- 10
  if (!is.finite(s) || s <= 0) return(std)
  min(s, std)
}

#' Las cifras de fuera de una misma fila, separadas por su tinta medida (A1a, ola 4)
#'
#' Sólo actúa sobre las filas donde dos cifras de fuera quedan a menos de `aire_min_in` (o montadas): ahí las reparte con
#' `.lam_callouts_sin_solape` (el mismo reparto que la lámina nativa) sobre el área de barras y corre su guía con ellas.
#' Las filas que ya no chocan quedan como estaban.
#' @param ancho_barras_in Ancho físico del área de barras (`.apiladas_ancho_barras_in`).
#' @keywords internal
.apiladas_arriba_sin_choque <- function(df_lab, var_categoria, ancho_barras_in, negrita = TRUE,
                                        aire_in = 0.08, aire_min_in = 0.03) {
  W <- suppressWarnings(as.numeric(ancho_barras_in)[1])
  if (!NROW(df_lab) || !is.finite(W) || W <= 0 || !".label_arriba" %in% names(df_lab)) return(df_lab)
  arriba <- which(df_lab$.label_arriba %in% TRUE & nzchar(as.character(df_lab$lab %||% "")))
  if (length(arriba) < 2L) return(df_lab)
  filas <- if (var_categoria %in% names(df_lab)) split(arriba, as.character(df_lab[[var_categoria]][arriba])) else list(arriba)
  for (idx in filas) {
    if (length(idx) < 2L) next
    idx <- idx[order(df_lab$x_label[idx])]
    w <- .apiladas_ancho_cifra_frac(df_lab$lab[idx], df_lab$.size_label[idx], negrita, W) * W
    if (!all(is.finite(w)) || any(w <= 0)) next
    x <- df_lab$x_label[idx] * W
    hueco <- diff(x) - (w[-1] + w[-length(w)]) / 2
    if (all(hueco >= aire_min_in)) next
    cs <- suppressWarnings(as.numeric(df_lab$x_center[idx])) * W
    cs[!is.finite(cs)] <- x[!is.finite(cs)]
    pos <- .lam_callouts_sin_solape(cs, w, 0, W, aire = aire_in)
    d <- pos / W - df_lab$x_label[idx]
    df_lab$x_label[idx] <- pos / W
    if ("x_conector_label" %in% names(df_lab)) df_lab$x_conector_label[idx] <- df_lab$x_conector_label[idx] + d
  }
  df_lab
}

#' Grosor (fracción de fila) con el que la cifra que sube no toca la barra de arriba (A1, ola 4)
#'
#' La cifra se centra sobre el techo de su barra a `max(offset, conector + media letra + 0.03 in)` (lo que fija
#' `.grosor_reubicar_cifras_arriba`); su techo tiene que quedar `aire_in` bajo la barra de arriba (o bajo la caja de su cifra
#' interior, si la barra es más fina que la letra), que está a un paso.
#' Sólo achica: si la barra ya deja ese aire, o si ni sin barra cabría, devuelve `g_frac`.
#' @param fila_in,paso_in Alto físico de una unidad del eje y del paso entre barras (in).
#' @param size_pt Cuerpo de la cifra (pt).
#' @keywords internal
.apiladas_grosor_sin_montar <- function(g_frac, fila_in, paso_in, size_pt, offset_u = 0.13, conector_u = 0.06, aire_in = 0.03) {
  f <- suppressWarnings(as.numeric(fila_in)[1]); p <- suppressWarnings(as.numeric(paso_in)[1])
  s <- suppressWarnings(as.numeric(size_pt)[1]); g <- suppressWarnings(as.numeric(g_frac)[1])
  if (!all(is.finite(c(f, p, s, g))) || f <= 0 || p <= 0 || s <= 0) return(g_frac)
  centro <- max(offset_u * f, conector_u * f + s * 0.72 / 72 / 2 + 0.03)
  h <- s * 0.76 / 72   # alto de la caja de la cifra
  # La barra de arriba ocupa hacia abajo lo que el mayor de su media barra y la media caja de su cifra interior.
  R <- p - centro - h / 2 - aire_in
  g_max_in <- if (R >= h) R else 2 * R - h
  if (g_max_in <= 0) return(g_frac)
  min(g, g_max_in / f)
}

#' El aviso de medio espacio: la barra del respaldo quedó bajo el piso de media lámina (A1c, ola 4)
#'
#' @param grosores Grosor físico (in) de la barra de cada respaldo redibujado, nombrado por su pregunta.
#' @return Las preguntas avisadas (invisible).
#' @keywords internal
.lam_respaldo_avisar_medio_espacio <- function(grosores) {
  piso <- tryCatch(.std_piso_panel_in(), error = function(e) NA_real_)
  g <- suppressWarnings(as.numeric(grosores))
  if (!length(g) || !is.finite(piso) || piso <= 0) return(invisible(character(0)))
  nm <- names(grosores) %||% rep("", length(g))
  bajo <- which(is.finite(g) & g < piso - 1e-3)
  for (k in bajo) {
    x <- trimws(nm[k]); if (is.na(x) || !nzchar(x)) x <- "sin título"
    .pulso_aviso(sprintf("El gráfico «%s» no cabe en medio espacio a tamaño estándar: conviene una lámina propia.", x))
  }
  invisible(nm[bajo])
}
