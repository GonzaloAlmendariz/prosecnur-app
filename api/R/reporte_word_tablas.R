# =============================================================================
# reporte_word_tablas.R — tablas y franja de cifras del Word del recetario (N8.10)
# =============================================================================
#
# Portan `ft_base`, `poner_tabla`, `tabla` y `franja` (recetario_word.R:75-89, 321-326): tablas nativas de Word con
# filetes horizontales finos y sin cebra («como un informe formal»), cabecera en navy entre dos filetes, la primera
# columna en negrita, el ancho útil exacto y la cabecera que se repite al pasar de página; rótulo «Tabla N» con su
# campo SEQ, como las figuras.

#' Tabla base del recetario: Arial, cuerpo de 9.5 pt en el gris del texto, cabecera y primera columna en negrita
#' @param anchos Anchos relativos de las columnas (se escalan al ancho útil al ponerla).
#' @keywords internal
.word_ft_base <- function(df, anchos = rep(1, ncol(df)), size = 9.5) {
  ft <- flextable::flextable(df) |>
    flextable::font(fontname = .std_word("tipografia", "fuente"), part = "all") |>
    flextable::fontsize(size = size, part = "all") |> flextable::color(color = .std_word("colores", "texto"), part = "all") |>
    flextable::bold(part = "header") |> flextable::bold(j = 1) |>
    flextable::padding(padding.top = 4, padding.bottom = 4, part = "all") |> flextable::valign(valign = "top", part = "body")
  for (j in seq_along(anchos)) ft <- flextable::width(ft, j = j, width = anchos[j])
  ft
}

#' Pone una tabla con el formato del recetario: ancho útil exacto, cabecera navy de 8.5 pt entre un filete de 1.25 y uno de
#' 0.75, filetes grises de 0.5 entre filas, el de cierre navy y sin sangría a la izquierda de la primera columna
#' @param cebra Fondo alterno; el recetario lo deja apagado (informe formal).
#' @keywords internal
.word_poner_tabla <- function(doc, ft, cebra = FALSE) {
  navy <- .std_word("colores", "titulos")
  w <- dim(ft)$widths
  ft <- flextable::width(ft, j = seq_along(w), width = w * .std_word("pagina", "ancho_util") / sum(w))
  ft <- ft |> flextable::bg(bg = "transparent", part = "header") |> flextable::color(color = navy, part = "header") |>
    flextable::fontsize(size = 8.5, part = "header") |> flextable::border_remove() |>
    flextable::hline_top(border = officer::fp_border(color = navy, width = 1.25), part = "header") |>
    flextable::hline_bottom(border = officer::fp_border(color = navy, width = 0.75), part = "header") |>
    flextable::hline(border = officer::fp_border(color = .std_word("colores", "filete"), width = 0.5), part = "body") |>
    flextable::hline_bottom(border = officer::fp_border(color = navy, width = 0.75), part = "body") |>
    flextable::padding(j = 1, padding.left = 0, part = "all")
  nb <- flextable::nrow_part(ft, "body")
  if (isTRUE(cebra) && nb > 2) ft <- flextable::bg(ft, i = seq(2, nb, 2), bg = .std_word("colores", "recuadro"), part = "body")
  flextable::body_add_flextable(doc, flextable::paginate(ft, init = TRUE, hdr_ftr = TRUE), align = "left")
}

#' Tabla numerada del informe: rótulo «Tabla N» con SEQ y título en cursiva, la tabla y, si la hay, la base debajo
#' @keywords internal
.word_tabla <- function(doc, n, titulo, ft, base = NULL, cebra = FALSE) {
  doc <- .word_rotulo(doc, n, titulo, etiqueta = "Tabla")
  doc <- .word_poner_tabla(doc, ft, cebra = cebra)
  if (!is.null(base) && nzchar(trimws(base))) .word_base(doc, base) else officer::body_add_par(doc, "")
}

#' Tabla de las cifras de un radar (la «Tabla 4» de la página 33): eje por fila, grupo por columna, cifras de la espec
#' @keywords internal
.word_df_radar <- function(espec) {
  ci <- as.matrix(espec$cifras)
  df <- data.frame(x = as.character(espec$ejes), ci, check.names = FALSE, stringsAsFactors = FALSE)
  names(df) <- c(espec$encabezado %||% "Indicador", as.character(espec$grupos))
  rownames(df) <- NULL
  df
}

#' Franja de cifras (`franja()`): tres o cuatro cifras grandes de 24 pt en navy, cada una con su rótulo de 9 pt debajo,
#' separadas por un filete gris vertical; sin cabecera ni bordes
#' @keywords internal
.word_franja <- function(doc, valores, rotulos) {
  f <- .std_word("tipografia", "fuente"); k <- length(valores)
  cc <- as.data.frame(t(as.character(valores)), stringsAsFactors = FALSE); names(cc) <- paste0("v", seq_len(k))
  ft <- flextable::flextable(cc) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(width = .std_word("pagina", "ancho_util") / k) |> flextable::font(fontname = f, part = "all")
  for (j in seq_len(k)) {
    ft <- flextable::compose(ft, j = j, value = flextable::as_paragraph(
      flextable::as_chunk(as.character(valores[j]), props = officer::fp_text(font.family = f, font.size = 24, bold = TRUE, color = .std_word("colores", "titulos"))),
      "\n", flextable::as_chunk(as.character(rotulos[j]), props = officer::fp_text(font.family = f, font.size = 9, color = .std_word("colores", "suave")))))
  }
  ft <- ft |> flextable::align(align = "left") |> flextable::line_spacing(space = 1) |>
    flextable::padding(padding.left = 10, padding.top = 4, padding.bottom = 4) |> flextable::padding(j = 1, padding.left = 0)
  if (k > 1) ft <- flextable::border(ft, j = seq_len(k)[-1], border.left = officer::fp_border(color = .std_word("colores", "filete"), width = 0.75))
  doc <- flextable::body_add_flextable(doc, ft, align = "left")
  officer::body_add_par(doc, "")
}
