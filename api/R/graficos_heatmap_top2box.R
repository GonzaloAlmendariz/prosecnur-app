# =============================================================================
# graficos_heatmap_top2box.R — columna Top Two Box de la tabla de calor pregunta × cruce (L10-10, bandeja CCSS)
# =============================================================================
#
# En CCSS Perfil 2026 (lámina 63 del mazo V2) la tabla de calor de una escala de acuerdo por carrera no traía el Top
# Two Box, que es lo que el título compara («el esfuerzo basta… varía según la carrera»). La columna se agrega al final,
# separada por un filete y con las cifras en el verde del Top Two Box de las multiapiladas; no entra a la escala de color
# (no es parte de la distribución de la fila).
#
# Criterio: el de las multiapiladas (`.box_decidir`, graficador_box_cobertura.R). El box suma las categorías DECLARADAS
# en `top2box_labels`; nunca se deducen del orden de la escala. La columna está encendida por defecto cuando la escala es
# ordinal de cuatro o más puntos sustantivos; ahí, sin categorías declaradas, se omite y se avisa como en las apiladas.
# `top2box = FALSE` la apaga; declarar las categorías la enciende en cualquier escala que el criterio admita.
# Las opciones viajan por `overrides` (el constructor `p_dim_heatmap()` no las tiene como formales).

#' Opciones del box que declaró la lámina (`overrides` del elemento que se está dibujando)
#' @keywords internal
.heatmap_box_del_elemento <- function() {
  el <- dynGet("el", ifnotfound = NULL)
  ov <- if (is.list(el)) el$overrides %||% list() else list()
  # `[[` exacto: `ov$top2box` haría match parcial con `top2box_labels`.
  list(top2box = ov[["top2box", exact = TRUE]], top2box_labels = ov[["top2box_labels", exact = TRUE]])
}

#' Columnas (opciones) que suma el Top Two Box de la tabla, o `NULL` si la columna no va
#'
#' @param opciones Rótulos de las opciones de la pregunta, en el orden de la tabla.
#' @param box `list(top2box, top2box_labels)`.
#' @keywords internal
.heatmap_pc_box_cols <- function(opciones, box = NULL) {
  box <- box %||% list()
  on <- box[["top2box", exact = TRUE]]   # `box$top2box` haría match parcial con `top2box_labels`
  if (identical(on, FALSE) || identical(on, "false")) return(NULL)
  labels <- trimws(as.character(unlist(box[["top2box_labels", exact = TRUE]] %||% character(0))))
  labels <- labels[!is.na(labels) & nzchar(labels)]
  if (is.null(on)) {
    sust <- opciones[!grepl(.CATEGORIAS_RESIDUALES, trimws(opciones), ignore.case = TRUE)]
    on <- length(labels) > 0L || (length(sust) >= 4L && isTRUE(.goc_pistas_orden(sust)))
  }
  if (!isTRUE(as.logical(on))) return(NULL)
  dec <- .box_decidir(labels, etiquetas_grupos = stats::setNames(opciones, opciones), cols_porcentaje = opciones, minimo = 3L)
  if (isTRUE(dec$dibujar)) return(dec$cols)
  if (identical(dec$motivo, "sin_declaracion")) {
    .pulso_aviso(.aviso_en_lamina(paste0(
      "la columna «", .PPT_ROTULO_TOP_TWO_BOX, "» se omite: no hay categorías declaradas. Elígelas en la ",
      "pestaña Gráfico de la lámina; el motor ya no las deduce del orden de la escala.")))
  } else if (identical(dec$motivo, "no_empareja")) {
    .pulso_aviso(.aviso_en_lamina(sprintf(
      "la columna «%s» se omite: las categorías declaradas (%s) no están en la escala de la pregunta.",
      .PPT_ROTULO_TOP_TWO_BOX, paste(labels, collapse = ", "))))
  }
  NULL
}

#' Agrega la columna Top Two Box a la especificación de la tabla (al final, fuera de la escala de color)
#'
#' @param e Especificación `heatmap/1` de la variante pregunta × cruce.
#' @param cols Opciones que suma el box (`.heatmap_pc_box_cols`).
#' @keywords internal
.heatmap_pc_con_box <- function(e, cols) {
  # Nunca las no sustantivas («No sabe», SIN INF), aunque se declaren: no son valores superiores de la escala.
  cols <- cols[!grepl(paste0(.CATEGORIAS_RESIDUALES, "|^SIN INF"), trimws(cols), ignore.case = TRUE)]
  if (!length(cols)) return(e)
  crudo <- e$valores_crudos
  # Como en las multiapiladas (graficos_espec_escala.R, lámina 19): la suma de las cifras rotuladas, para que el box
  # cuadre con lo que la fila muestra (26 % + 21 % = 47 %, no el 48 % de sumar sin redondear).
  ttb <- rowSums(e$valores[, cols, drop = FALSE])
  e$valores_crudos <- cbind(crudo, rowSums(crudo[, cols, drop = FALSE])); colnames(e$valores_crudos)[ncol(crudo) + 1L] <- .PPT_ROTULO_TOP_TWO_BOX
  v <- cbind(e$valores, unname(ttb)); dimnames(v) <- dimnames(e$valores_crudos)
  e$valores <- v
  e$columnas <- rbind(e$columnas, data.frame(rotulo = .PPT_ROTULO_TOP_TWO_BOX, n = NA_real_, stringsAsFactors = FALSE))
  e$col_box <- ncol(v)
  e$box_cols <- cols
  e
}

#' Ancho de la columna Top Two Box de la tabla de calor (pulgadas; 0 sin ella): angosta, para que las opciones de la
#' escala sigan en dos líneas
#' @keywords internal
.lam_calor_box_ancho <- function(espec) if (is.null(espec$col_box)) 0 else 1.2

#' Dibuja la columna Top Two Box de la tabla de calor (rótulo y cifras en el verde del box, con su filete)
#' @keywords internal
.lam_calor_box <- function(lz, espec, x, wc, y0, hc, dos = FALSE) {
  j <- espec$col_box; if (is.null(j)) return(invisible(lz))
  verde <- .std_color("verde_top_two_box"); nf <- nrow(espec$valores)
  .lam_caja(lz, x - 0.01, y0 - 0.1, 0.02, nf * hc + 0.1, .std_color("azul"), nombre = "calor:filete")
  .lam_txt(lz, espec$columnas$rotulo[j], x, y0 - (if (dos) 0.62 else 0.58), wc, if (dos) 0.46 else 0.26, 11, verde, bold = TRUE,
           align = "center", nombre = "calor:box_columna")
  for (i in seq_len(nf)) {
    .lam_txt(lz, paste0(espec$valores[i, j], "%"), x, y0 + (i - 1) * hc + (hc - 0.32) / 2, wc, 0.32, .std_pt("cifra"), verde, bold = TRUE,
             align = "center", nombre = "calor:box_cifra")
  }
  invisible(lz)
}
