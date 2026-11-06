# Tabla markdown en una nota del cuestionario impreso (checklist editor-conjoint, E8c, 2026-11-06).
#
# Un experimento conjoint muestra dos perfiles lado a lado con una tabla markdown en una nota:
#   | | Persona A | Persona B |
#   |---|---|---|
#   | Edad | 42 | 62 |
# Decision de Gonzalo para el papel: «Par de ejemplo». El editor ya manda la nota con los valores de
# un sorteo de ejemplo y el rotulo «Ejemplo: los niveles se sortean en cada entrevista.»; aqui se
# reconoce la tabla y los dos renderers la dibujan como tabla (antes salian las barras).
# Misma regla que el editor (frontend `helpers/markdownTabla.ts`): una fila `| ... |` seguida de la
# separadora `|---|`.

.FORM_MD_FILA_RX <- "^\\s*\\|.*\\|\\s*$"
.FORM_MD_SEPARADORA_RX <- "^\\s*\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)*\\|?\\s*$"

.form_md_celdas <- function(linea) {
  x <- sub("^\\s*\\|", "", linea)
  x <- sub("\\|\\s*$", "", x)
  trimws(strsplit(x, "|", fixed = TRUE)[[1]])
}

#' Parte el texto de una nota en su tabla markdown y el resto.
#'
#' @param x Texto crudo de la nota (con saltos de linea).
#' @return `NULL` si no hay tabla; si la hay, `list(texto, encabezado, filas)`: `texto` es lo que va
#'   antes y despues de la tabla, `encabezado` un vector y `filas` una lista de vectores, todos con
#'   el mismo numero de celdas.
#' @keywords internal
.form_md_tabla_partir <- function(x) {
  x <- .form_pdf_chr(x)
  if (!nzchar(x) || !grepl("|", x, fixed = TRUE)) return(NULL)
  lineas <- strsplit(gsub("\r\n?", "\n", x), "\n", fixed = TRUE)[[1]]
  n <- length(lineas)
  for (i in seq_len(max(0L, n - 1L))) {
    if (!grepl(.FORM_MD_FILA_RX, lineas[[i]], perl = TRUE) ||
        !grepl(.FORM_MD_SEPARADORA_RX, lineas[[i + 1L]], perl = TRUE)) next
    fin <- i + 1L
    while (fin < n && grepl(.FORM_MD_FILA_RX, lineas[[fin + 1L]], perl = TRUE)) fin <- fin + 1L
    encabezado <- .form_md_celdas(lineas[[i]])
    filas <- if (fin > i + 1L) lapply(lineas[(i + 2L):fin], .form_md_celdas) else list()
    ancho <- max(length(encabezado), vapply(filas, length, integer(1)), 1L)
    completar <- function(v) c(v, rep("", ancho - length(v)))[seq_len(ancho)]
    limpio <- function(v) vapply(completar(v), .form_pdf_paper_text, character(1), USE.NAMES = FALSE)
    resto <- c(if (i > 1L) lineas[seq_len(i - 1L)], if (fin < n) lineas[(fin + 1L):n])
    return(list(
      texto = trimws(paste(resto, collapse = "\n")),
      encabezado = limpio(encabezado),
      filas = lapply(filas, limpio)
    ))
  }
  NULL
}

#' Aparta las tablas markdown de las notas del survey: la columna de rotulo (y `paper_label`, si la
#' trae) se queda con el texto sin la tabla, y la tabla va en `tablas[[fila]]` (NULL si no hay).
#' @keywords internal
.form_md_tablas_del_survey <- function(survey) {
  tablas <- vector("list", nrow(survey))
  if (!nrow(survey) || !"type" %in% names(survey)) return(list(survey = survey, tablas = tablas))
  notas <- which(vapply(survey$type, .form_pdf_type_base, character(1)) == "note")
  for (i in notas) {
    col <- if ("paper_label" %in% names(survey) && nzchar(.form_pdf_chr(survey$paper_label[i]))) "paper_label" else "label"
    t <- .form_md_tabla_partir(survey[[col]][i])
    if (is.null(t)) next
    survey[[col]][i] <- t$texto
    tablas[i] <- list(t)
  }
  list(survey = survey, tablas = tablas)
}

# --- PDF ---------------------------------------------------------------------------------------------

.FORM_MD_PDF_FUENTE <- 7.6
.FORM_MD_PDF_LINEA <- 0.0118
.FORM_MD_PDF_RELLENO <- 0.005

# Anchos de columna: la primera (rotulo de fila) lleva el 30 %; el resto se reparte en partes iguales.
.form_md_tabla_anchos <- function(n, w) {
  if (n <= 1L) return(w)
  primera <- w * 0.30
  c(primera, rep((w - primera) / (n - 1L), n - 1L))
}

# Geometria de la tabla a ancho `w`: lineas de cada celda y alto de cada fila (misma cuenta para el
# paginado y el dibujo).
.form_md_tabla_pdf_geom <- function(tabla, w) {
  anchos <- .form_md_tabla_anchos(length(tabla$encabezado), w)
  partir <- function(fila, cara) lapply(seq_along(fila), function(k) {
    .form_pdf_wrap_fit(fila[[k]], anchos[[k]] - 2 * .FORM_MD_PDF_RELLENO,
                       fontsize = .FORM_MD_PDF_FUENTE, fontface = cara)
  })
  todas <- c(list(tabla$encabezado), tabla$filas)
  lineas <- lapply(seq_along(todas), function(r) {
    partir(todas[[r]], if (r == 1L) "bold" else "plain")
  })
  altos <- vapply(lineas, function(celdas) {
    max(1L, vapply(celdas, length, integer(1))) * .FORM_MD_PDF_LINEA + 2 * .FORM_MD_PDF_RELLENO
  }, numeric(1))
  list(anchos = anchos, lineas = lineas, altos = altos, h = sum(altos) + 0.006)
}

# Dibuja la tabla con su esquina superior izquierda en (x, y); devuelve la `y` de abajo.
.form_md_tabla_pdf_dibujar <- function(tabla, x, y, w, tk) {
  g <- .form_md_tabla_pdf_geom(tabla, w)
  y <- y - 0.003
  for (r in seq_along(g$lineas)) {
    h <- g$altos[[r]]
    cx <- x
    for (k in seq_along(g$anchos)) {
      cw <- g$anchos[[k]]
      rotulo <- r == 1L || k == 1L
      grid::grid.rect(x = grid::unit(cx + cw / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                      width = grid::unit(cw, "npc"), height = grid::unit(h, "npc"),
                      gp = grid::gpar(fill = if (rotulo) "#EFEFEF" else NA, col = tk$tbl_frame, lwd = 0.5))
      .form_pdf_text("", cx + .FORM_MD_PDF_RELLENO, y - .FORM_MD_PDF_RELLENO, cw,
                     lines = g$lineas[[r]][[k]], fontsize = .FORM_MD_PDF_FUENTE,
                     fontface = if (r == 1L) "bold" else "plain", line_h = .FORM_MD_PDF_LINEA)
      cx <- cx + cw
    }
    y <- y - h
  }
  y - 0.003
}

# --- Word --------------------------------------------------------------------------------------------

# La tabla como flextable: encabezado y primera columna sombreados, bordes finos, ancho de la pagina.
.form_md_tabla_word <- function(tabla, usable) {
  if (!requireNamespace("flextable", quietly = TRUE)) return(NULL)
  n <- length(tabla$encabezado)
  df <- as.data.frame(do.call(rbind, c(list(), lapply(tabla$filas, function(f) f))),
                      stringsAsFactors = FALSE)
  if (!nrow(df)) df <- as.data.frame(matrix("", nrow = 0, ncol = n), stringsAsFactors = FALSE)
  claves <- sprintf("c%d", seq_len(n))
  names(df) <- claves
  ft <- flextable::flextable(df)
  ft <- flextable::set_header_labels(ft, values = stats::setNames(as.list(tabla$encabezado), claves))
  borde <- officer::fp_border(color = "#7F7F7F", width = 0.5)
  ft <- flextable::border_outer(ft, border = borde, part = "all")
  ft <- flextable::border_inner(ft, border = borde, part = "all")
  ft <- flextable::bg(ft, bg = "#EFEFEF", part = "header")
  ft <- flextable::bg(ft, j = 1, bg = "#EFEFEF", part = "body")
  ft <- flextable::bold(ft, part = "header")
  ft <- flextable::fontsize(ft, size = 9, part = "all")
  ft <- flextable::valign(ft, valign = "top", part = "all")
  ft <- flextable::padding(ft, padding = 3, part = "all")
  flextable::width(ft, j = seq_len(n), width = .form_md_tabla_anchos(n, usable))
}
