# =============================================================================
# graficos_espec_divergentes.R — lo que afirman las barras divergentes (ADR 0093, N3; lámina 71)
# =============================================================================
#
# Reglas de recetario_m3a.R:50-77: el desacuerdo crece a la izquierda del centro y
# el acuerdo a la derecha; cada lado suma sus cifras rotuladas (el de acuerdo es el
# Top Two Box, como la lámina 19); «SIN INF» no entra en ningún lado y va en su
# columna a la derecha; las afirmaciones se ordenan por el lado de acuerdo, de mayor
# a menor. Si la escala tiene neutro, se parte en el centro.

.DIVERGENTES_ESPECIAL <- "^(SIN INF|Sin información|No sabe|No sé|No se|NS/NR|NS/NO|No responde|No opina|No aplica|Ninguno de los anteriores)"

#' Especificación de unas barras divergentes
#'
#' @param data,var_categoria,cols_porcentaje,etiquetas Los del graficador.
#' @param particion Resultado de `.divergentes_reparto()` (negativas, neutro, positivas).
#' @param incluir_neutro El del graficador (para rehacer el reparto si una categoría especial cayó en un lado).
#' @return Lista `divergentes/1` con `filas` (rótulo por afirmación, ya ordenadas), `categorias` (col, rotulo, color,
#'   lado), `orden_neg`/`orden_pos` (índices de cada lado, del centro hacia afuera), `unidades` y `cifras`,
#'   `total_neg`/`total_pos` (sumas rotuladas).
#' @keywords internal
.espec_divergentes <- function(data, var_categoria, cols_porcentaje, etiquetas, particion, escala_valor = "proporcion_100",
                               decimales = 0L, colores = NULL, incluir_neutro = TRUE, reparto_explicito = FALSE, codigos = NULL) {
  rot <- unname(etiquetas[cols_porcentaje]); rot[is.na(rot)] <- cols_porcentaje[is.na(rot)]
  # Especial por etiqueta o por código (90-99, punto 2 del ADR 0093): nunca entra en un lado ni en el Top Two Box.
  cod <- if (!is.null(codigos)) unname(as.character(codigos[cols_porcentaje])) else cols_porcentaje
  cod[is.na(cod)] <- cols_porcentaje[is.na(cod)]
  especial <- grepl(.DIVERGENTES_ESPECIAL, trimws(rot), ignore.case = TRUE) | grepl("^9[0-9]$", cod)
  normales <- cols_porcentaje[!especial]
  # El reparto posicional cuenta la especial como un nivel más: si cayó en un lado, se rehace sin ella.
  # Si el reparto lo declaró la escala, sólo se saca la especial de su lado.
  if (any(cols_porcentaje[especial] %in% c(particion$neutro, particion$positivas, particion$negativas))) {
    if (isTRUE(reparto_explicito)) {
      particion <- lapply(particion, function(x) setdiff(x, cols_porcentaje[especial]))
    } else {
      particion <- .divergentes_reparto(normales, length(intersect(particion$negativas, normales)), incluir_neutro)
    }
  }
  lado <- ifelse(especial, "sin_inf", ifelse(cols_porcentaje %in% particion$negativas, "neg",
                 ifelse(cols_porcentaje %in% particion$neutro, "neu", "pos")))
  P <- vapply(cols_porcentaje, function(c) suppressWarnings(as.numeric(data[[c]])), numeric(nrow(data)))
  P <- matrix(P, nrow = nrow(data)); P[!is.finite(P)] <- 0
  if (identical(escala_valor, "proporcion_100")) P <- P / 100
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  U <- t(apply(P, 1, function(r) .pulso_pct_unidades(r, dec, "estandar")))
  if (ncol(P) == 1L) U <- t(U)
  cifras <- matrix(.pulso_fmt_pct_unidades(U, dec), nrow(U))
  tn <- rowSums(U[, lado == "neg", drop = FALSE]); tp <- rowSums(U[, lado == "pos", drop = FALSE])
  o <- order(-tp, seq_along(tp))
  # Del centro hacia afuera: el nivel de cada lado más cercano al otro lado va primero (sirve en las dos
  # direcciones de la escala).
  ineg <- which(lado == "neg"); ipos <- which(lado == "pos")
  centro <- mean(c(if (length(ineg)) max(ineg) else NULL, if (length(ipos)) min(ipos) else NULL, which(lado == "neu")))
  if (length(ineg) && length(ipos) && max(ineg) > min(ipos)) centro <- mean(c(min(ineg), max(ipos)))
  orden_neg <- ineg[order(abs(ineg - centro))]; orden_pos <- ipos[order(abs(ipos - centro))]
  # Colores por significado (paleta likert del recetario): del extremo al centro en cada lado, gris para la especial.
  lk <- unname(.std_paleta("likert"))
  col <- rep(lk[5], length(cols_porcentaje))
  if (length(orden_neg)) col[orden_neg] <- grDevices::colorRampPalette(c(lk[2], lk[1]))(max(2L, length(orden_neg)))[seq_along(orden_neg)]
  if (length(orden_pos)) col[orden_pos] <- grDevices::colorRampPalette(c(lk[3], lk[4]))(max(2L, length(orden_pos)))[seq_along(orden_pos)]
  col[lado == "neu"] <- "#D9D9D9"
  if (length(orden_neg) == 1L) col[orden_neg] <- lk[2]
  if (length(orden_pos) == 1L) col[orden_pos] <- lk[3]
  # ADR 0097: una paleta pinta por ETIQUETA (o por columna), nunca por posición; una sin nombres no dice de qué
  # opción es cada color y se ignora. La opción que no nombra sale gris residual con su aviso.
  por_rotulo <- .espec_divergentes_colores(colores, cols_porcentaje, rot)
  if (!is.null(por_rotulo)) col <- unname(por_rotulo)
  espec <- list(version = "divergentes/1", tipo = "divergentes",
       filas = as.character(data[[var_categoria]])[o],
       categorias = data.frame(col = cols_porcentaje, rotulo = rot, color = col, lado = lado, stringsAsFactors = FALSE),
       orden_neg = orden_neg, orden_pos = orden_pos,
       unidades = U[o, , drop = FALSE], cifras = cifras[o, , drop = FALSE],
       total_neg = tn[o], total_pos = tp[o], cifras_neg = .pulso_fmt_pct_unidades(tn[o], dec), cifras_pos = .pulso_fmt_pct_unidades(tp[o], dec),
       decimales = dec)
  if (!is.null(por_rotulo)) espec$colores <- por_rotulo
  espec
}

#' Colores de las divergentes por rótulo (nombres = rótulo), desde una paleta con nombres de rótulo o de columna
#'
#' `NULL` sin paleta o con una sin nombres. Lo que la paleta no nombra sale gris residual y se avisa
#' (`.reporte_plan_palette_for_levels`).
#' @keywords internal
.espec_divergentes_colores <- function(colores, cols, rotulos) {
  if (is.null(colores) || !length(colores) || is.null(names(colores)) || !any(nzchar(names(colores)))) return(NULL)
  pal <- stats::setNames(as.character(unlist(colores, use.names = FALSE)), names(unlist(colores)))
  # Una paleta por columna (`pct_1`, ...) se lleva a rótulos antes de emparejar.
  por_col <- names(pal) %in% cols
  names(pal)[por_col] <- rotulos[match(names(pal)[por_col], cols)]
  pal <- .paleta_heredar_attrs(pal, colores)
  out <- .reporte_plan_palette_for_levels(attr(colores, "paleta_lista", exact = TRUE) %||% "", rotulos,
                                          choices_use = attr(colores, "paleta_choices", exact = TRUE), palette = pal)
  if (is.null(out)) return(NULL)
  stats::setNames(as.character(unname(out[rotulos])), rotulos)
}
