# =============================================================================
# reporte_formulario_portada.R — portada completa del cuestionario (L36 · D-L36-5)
# =============================================================================
#
# DOC.0c dio un título propio al documento. La portada completa suma, bajo el
# título y su regla, la identidad del estudio y un bloque de control:
#
#   - subtítulo: institución y periodo, en una línea («UNSA · 2026-2»). Se
#     omite si los dos vienen vacíos: ninguna línea sin texto (D-L36-2).
#   - bloque de control: rótulos con una línea para escribir a mano
#     (encuestador, fecha, supervisor). Se activa desde Impreso › Formato.
#
# Los dos motores (Word y PDF) leen el mismo bloque `cover` del modelo; la
# reserva de alto del PDF sale de las mismas cuentas que el dibujo (L19).
# Diseño: docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md (D-L36-19).

.FORM_PORTADA_CONTROL <- c("Encuestador", "Fecha", "Supervisor")

#' Subtítulo y bloque de control de la portada, leídos de las opciones
#' @return `list(subtitulo = chr(1), control = chr())`.
#' @keywords internal
.form_portada_opciones <- function(options) {
  limpio <- function(x) .form_pdf_clean_text(.form_rt_a_plano(.form_pdf_chr(x %||% "")))
  partes <- c(limpio(options$institution), limpio(options$period))
  partes <- partes[nzchar(partes)]
  cb <- options$control_block
  control <- if (is.null(cb)) FALSE
    else if (is.logical(cb)) isTRUE(cb[[1]])
    else tolower(trimws(as.character(cb)[[1]])) %in% c("true", "1", "si", "sí", "t", "yes")
  list(
    subtitulo = paste(partes, collapse = " · "),
    control = if (control) .FORM_PORTADA_CONTROL else character(0)
  )
}

# --- PDF ----------------------------------------------------------------------

# Alto (npc) de lo que la portada suma bajo la regla. Mismas cuentas que el dibujo.
.form_pdf_portada_extra_alto <- function(block) {
  alto <- 0
  if (nzchar(block$subtitle %||% "")) alto <- alto + 0.016
  if (length(block$control %||% character(0))) alto <- alto + 0.030
  alto
}

# Dibuja subtítulo y bloque de control a partir de `y` (bajo la regla). Devuelve la nueva `y`.
.form_pdf_draw_portada_extra <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  if (nzchar(block$subtitle %||% "")) {
    grid::grid.text(block$subtitle, x = grid::unit(x + w / 2, "npc"), y = grid::unit(y, "npc"),
                    just = c("center", "top"), gp = grid::gpar(fontsize = 9, col = tk$ink))
    y <- y - 0.016
  }
  control <- block$control %||% character(0)
  if (length(control)) {
    n <- length(control)
    hueco <- 0.02
    ancho <- (w - hueco * (n - 1)) / n
    base <- y - 0.020
    for (k in seq_len(n)) {
      x0 <- x + (k - 1) * (ancho + hueco)
      grid::grid.text(paste0(control[k], ":"), x = grid::unit(x0, "npc"), y = grid::unit(base + 0.002, "npc"),
                      just = c("left", "bottom"), gp = grid::gpar(fontsize = 8, col = tk$ink))
      grid::grid.lines(x = grid::unit(c(x0, x0 + ancho), "npc"), y = grid::unit(c(base, base), "npc"),
                       gp = grid::gpar(col = tk$ink, lwd = 0.6))
    }
    y <- y - 0.030
  }
  y
}

# --- Word ---------------------------------------------------------------------

# Bloque de control: una fila con una celda por rótulo, cada una con su rótulo y
# un borde inferior donde se escribe. Una celda no se corre al escribir encima,
# a diferencia de una tira de guiones bajos (misma razón que `.form_word_caja_vacia`).
.form_word_portada_control <- function(control, usable, hueco = 0.25) {
  n <- length(control)
  # Rótulo, separador, rótulo…: el separador no lleva borde, así cada casilla tiene su propia línea.
  valores <- as.list(rep("", 2L * n - 1L))
  valores[seq(1L, 2L * n - 1L, by = 2L)] <- as.list(paste0(control, ":"))
  df <- as.data.frame(valores, stringsAsFactors = FALSE)
  names(df) <- paste0("c", seq_along(valores))
  casillas <- names(df)[seq(1L, 2L * n - 1L, by = 2L)]
  separadores <- setdiff(names(df), casillas)
  ft <- flextable::flextable(df)
  ft <- flextable::delete_part(ft, part = "header")
  ft <- flextable::font(ft, fontname = .std_cuestionario("tipografia", "fuente"), part = "all")
  ft <- flextable::fontsize(ft, size = .std_cuestionario("tipografia", "minimo"), part = "all")
  ft <- flextable::color(ft, color = .std_cuestionario("colores", "tinta"), part = "all")
  ancho <- (usable - hueco * (n - 1L)) / n
  for (cid in casillas) ft <- flextable::width(ft, j = cid, width = ancho)
  for (cid in separadores) ft <- flextable::width(ft, j = cid, width = hueco)
  ft <- flextable::height(ft, height = 0.32, part = "body")
  ft <- flextable::hrule(ft, rule = "exact", part = "body")
  ft <- flextable::valign(ft, valign = "bottom", part = "body")
  ft <- flextable::border_remove(ft)
  ft <- flextable::border(ft, j = casillas, part = "body",
                          border.bottom = officer::fp_border(color = .std_cuestionario("colores", "tinta"), width = 0.5))
  flextable::set_table_properties(ft, layout = "fixed", opts_word = list(split = FALSE))
}

# Subtítulo y bloque de control bajo la regla de la portada.
.form_word_portada_extra <- function(doc, block, usable) {
  if (nzchar(block$subtitle %||% "")) {
    doc <- .form_word_par(doc, block$subtitle, size = .std_cuestionario("tipografia", "cuerpo"),
                          color = .std_cuestionario("colores", "tinta"), align = "center", space_after = 8)
  }
  control <- block$control %||% character(0)
  if (length(control)) {
    doc <- flextable::body_add_flextable(doc, .form_word_portada_control(control, usable), align = "center")
    doc <- .form_word_par(doc, "", space_after = 6)
  }
  doc
}
