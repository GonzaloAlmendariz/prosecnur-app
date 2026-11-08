# =============================================================================
# graficos_espec_divergentes.R — lo que afirman las barras divergentes (ADR 0093, N3; lámina 71)
# =============================================================================
#
# Reglas de recetario_m3a.R:50-77: el desacuerdo crece a la izquierda del centro y
# el acuerdo a la derecha; cada lado suma sus cifras rotuladas (el de acuerdo es el
# Top Two Box, como la lámina 19); «SIN INF» no entra en ningún lado y va en su
# columna a la derecha; las afirmaciones se ordenan por el lado de acuerdo, de mayor
# a menor. Si la escala tiene neutro, se parte en el centro.

#' Encabezado de la columna del no sustantivo en la escala del resumen (ADR 0135)
#' @keywords internal
.DIVERGENTES_RESUMEN_SIN_INF <- "Sin información"

.DIVERGENTES_ESPECIAL <- "^(SIN INF|Sin información|No sabe|No sé|No se|NS/NR|NS/NO|No responde|No opina|No aplica|Ninguno de los anteriores)"

#' ¿Qué opciones de la escala no son sustantivas? Un solo detector para la escala (ADR 0135 §3)
#'
#' `.graficos_no_sustantivos_escala`: la metadata de la lista (`choices$especial` sí/no manda), un código 90-99 o un
#' rótulo de no respuesta en cualquier punta («Prefiero no responder», «No tengo información suficiente», «Ninguna de
#' las anteriores», «Otro»). El rango de códigos no decide: una escala 1, 3, 5, 7, 9 es entera. «Ninguna confianza» o
#' «Ninguno» como nivel siguen en la escala. La usan la tabla del render (reparto y punto medio sobre las sustantivas) y
#' la especificación (fuera de los lados), así que no pueden discrepar.
#' @param rotulos Rótulos de las opciones.
#' @param codigos Códigos alineados con `rotulos` (o `NULL`/`NA`: decide el rótulo).
#' @param codigos_lista Se acepta por compatibilidad; ya no decide.
#' @param especiales,sustantivos Códigos que la metadata de la lista declara especiales o de la escala.
#' @param direccion `negativo_positivo` o `positivo_negativo`: dónde está la mitad negativa (raíces ambiguas).
#' @return Lógico alineado con `rotulos`.
#' @keywords internal
.divergentes_especiales <- function(rotulos, codigos = NULL, codigos_lista = NULL, especiales = character(0),
                                    sustantivos = character(0), direccion = "negativo_positivo") {
  rot <- trimws(as.character(rotulos)); rot[is.na(rot)] <- ""
  cod <- if (is.null(codigos)) rep(NA_character_, length(rot)) else trimws(as.character(codigos))
  hay <- !is.na(cod) & nzchar(cod)
  # `codigos_lista` ya no decide: el rango de códigos no dice qué es escala (graficos_no_sustantivos.R).
  .graficos_no_sustantivos_escala(ifelse(hay, cod, ""), rot, especiales = especiales, sustantivos = sustantivos, direccion = direccion)
}

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
                               decimales = 0L, colores = NULL, incluir_neutro = TRUE, reparto_explicito = FALSE, codigos = NULL,
                               orden = "top_two_box", estilo = "recetario") {
  rot <- unname(etiquetas[cols_porcentaje]); rot[is.na(rot)] <- cols_porcentaje[is.na(rot)]
  # Especial por etiqueta, por código (90-99, punto 2 del ADR 0093) o por el detector común de no sustantivos (ADR 0135
  # §3): nunca entra en un lado ni en el Top Two Box. La lista completa de códigos de la escala (atributo
  # `codigos_lista`, la pone `.ola4_tabla_escala`) fija el rango aunque una opción del medio se haya excluido.
  cod <- if (!is.null(codigos)) unname(as.character(codigos[cols_porcentaje])) else cols_porcentaje
  cod[is.na(cod)] <- cols_porcentaje[is.na(cod)]
  especial <- .divergentes_especiales(rot, cod, attr(codigos, "codigos_lista", exact = TRUE),
                                      especiales = attr(codigos, "especiales", exact = TRUE) %||% character(0),
                                      sustantivos = attr(codigos, "sustantivos", exact = TRUE) %||% character(0))
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
  # ADR 0134: el resumen ordena también por «Sin información» (la lámina del desconocimiento) o como se declaró.
  tsi <- rowSums(U[, lado == "sin_inf", drop = FALSE])
  o <- switch(as.character(orden %||% "top_two_box")[1],
              sin_informacion = order(-tsi, -tp, seq_along(tp)),
              declarado = seq_along(tp),
              order(-tp, seq_along(tp)))
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
  col[lado == "neu"] <- .std_paleta("likert_neutro")[3]
  if (length(orden_neg) == 1L) col[orden_neg] <- lk[2]
  if (length(orden_pos) == 1L) col[orden_pos] <- lk[3]
  # ADR 0097: una paleta pinta por ETIQUETA (o por columna), nunca por posición; una sin nombres no dice de qué
  # opción es cada color y se ignora. La opción que no nombra sale gris residual con su aviso.
  por_rotulo <- .espec_divergentes_colores(colores, cols_porcentaje, rot)
  if (!is.null(por_rotulo)) col <- unname(por_rotulo)
  # ADR 0135 (decisión del 2026-11-07): en el estilo resumen la columna del no sustantivo y su leyenda dicen siempre
  # «Sin información»; es el encabezado de la columna, no el rótulo de la lista («SIN INF», «No tengo información
  # suficiente», «No sabe» van ahí). El recetario (lámina 71) conserva el rótulo de la lista.
  if (identical(estilo, "resumen")) rot[lado == "sin_inf"] <- .DIVERGENTES_RESUMEN_SIN_INF
  espec <- list(version = "divergentes/1", tipo = "divergentes",
       filas = as.character(data[[var_categoria]])[o],
       categorias = data.frame(col = cols_porcentaje, rotulo = rot, color = col, lado = lado, stringsAsFactors = FALSE),
       orden_neg = orden_neg, orden_pos = orden_pos,
       unidades = U[o, , drop = FALSE], cifras = cifras[o, , drop = FALSE],
       total_neg = tn[o], total_pos = tp[o], cifras_neg = .pulso_fmt_pct_unidades(tn[o], dec), cifras_pos = .pulso_fmt_pct_unidades(tp[o], dec),
       decimales = dec)
  # Lo que el detalle de cifras necesita y la lámina no rotula (graficos_cifras_detalle.R): la proporción exacta de cada
  # celda (para la suma con cada método de redondeo) y la base de cada fila, ponderada y en casos, si la tabla la trae.
  espec$proporciones <- P[o, , drop = FALSE]
  base_attr <- function(nm) {
    v <- attr(data, nm, exact = TRUE)
    if (length(v) == nrow(data)) suppressWarnings(as.numeric(v))[o] else NULL
  }
  espec$n <- base_attr("ola4_n_pond"); espec$n_casos <- base_attr("ola4_n_casos")
  if (!is.null(por_rotulo)) espec$colores <- por_rotulo
  espec$estilo <- if (identical(estilo, "resumen")) "resumen" else "recetario"
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
