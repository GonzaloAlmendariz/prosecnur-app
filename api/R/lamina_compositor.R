# =============================================================================
# lamina_compositor.R — la lámina entera del recetario (ADR 0093, N1)
# =============================================================================
#
# El compositor posee la lámina: antetítulo con su barra navy, título, el bloque
# de la ranura, base y folio (`titulo()` y `pie()` de
# `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:112-140`, estilo
# moderno), y la partición en «(cont.)» cuando el bloque no cabe.

#' Título de la lámina: barra navy al borde, antetítulo en versalitas y título coral
#' @keywords internal
.lam_titulo <- function(doc, titulo, ante = NULL, sub = NULL) {
  g <- .std_geom; ml0 <- g("margen_izq_borde"); ml <- g("margen_izq"); yt <- g("titulo_y")
  lz <- .lam_lienzo()
  .lam_caja(lz, ml0, yt - 0.12, 0.05, if (is.null(sub)) 0.72 else 0.98, .std_color("azul"), nombre = "titulo:barra")
  if (!is.null(ante) && nzchar(ante)) {
    .lam_txt(lz, toupper(ante), ml, yt - 0.17, 9, 0.26, .std_pt("antetitulo"), .std_color("texto_suave"), bold = TRUE, nombre = "Antetitulo lamina")
  }
  .lam_txt(lz, titulo, ml, yt + 0.06, 10.4, 0.5, .std_pt("titulo"), .std_color("coral"), bold = TRUE, nombre = "Titulo lamina")
  if (!is.null(sub) && nzchar(sub)) .lam_txt(lz, sub, ml, yt + 0.55, 10.4, 0.32, 12.5, .std_color("texto_suave"), nombre = "Subtitulo lamina")
  .lam_agrupar(doc, lz, nombre = "prosecnur:titulo")
}

#' Pie de la lámina: base en negrita y folio a la derecha
#' @keywords internal
.lam_pie <- function(doc, base, folio) {
  g <- .std_geom; lz <- .lam_lienzo()
  if (!is.null(base) && nzchar(base)) .lam_txt(lz, base, g("margen_izq"), g("base_y"), 10.5, 0.4, .std_pt("base"), .std_color("azul"), bold = TRUE, nombre = "Base lamina")
  if (!is.null(folio)) .lam_txt(lz, as.character(folio), g("ancho") - g("margen_der") - 0.6, g("base_y"), 0.6, 0.3, .std_pt("base"),
                                .std_color("texto_suave"), align = "right", nombre = "Folio lamina")
  .lam_agrupar(doc, lz, nombre = "prosecnur:pie")
}

#' Láminas de un gráfico de escala, con su partición
#'
#' @param doc Documento `officer`.
#' @param espec Resultado de `preparar_escala()`.
#' @param folio Folio de la primera lámina (o `NULL` sin folio).
#' @return Lista con `doc` y `partes` (número de láminas agregadas).
#' @keywords internal
.lam_laminas_escala <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  premisas <- .lam_escala_premisas(espec)
  partes <- .lam_escala_partir(premisas)
  for (k in seq_along(partes)) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    # El subtítulo sólo en la primera parte, bajo el título (recetario.R:122).
    doc <- .lam_titulo(doc, paste0(titulo, if (k > 1) " (cont.)" else ""), ante = ante, sub = if (k == 1L) sub else NULL)
    lz <- .lam_lienzo()
    .lam_bloque_escala(lz, espec, partes[[k]], solo = length(partes) == 1L)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:escala")
    doc <- .lam_pie(doc, base, if (is.null(folio)) NULL else folio + k - 1L)
    doc <- por_lamina(doc)
  }
  list(doc = doc, partes = length(partes))
}

#' Antetítulo de cada lámina del plan: la sección vigente, o el que declare la lámina
#'
#' En el recetario el antetítulo es el capítulo en que cae la lámina («CUERPO
#' ACADÉMICO»). Se toma del último separador de sección del plan; una lámina lo
#' puede fijar con `meta$antetitulo`.
#' @return Vector de caracteres del largo del plan (`NA` donde no hay).
#' @keywords internal
.lam_antetitulos <- function(plan) {
  vigente <- NA_character_
  vapply(plan, function(slide) {
    if (identical(slide$.slide_type, "section")) {
      t <- slide$slots$title %||% slide$title %||% NA_character_
      vigente <<- as.character(t)[1]
    }
    as.character((slide$meta %||% list())$antetitulo %||% vigente)[1]
  }, character(1))
}

#' ¿La lámina de un gráfico se compone con piezas nativas?
#'
#' Sí cuando el gráfico trae una especificación de escala con filas y la lámina
#' no pidió la ruta anterior (`meta$motor_nativo = FALSE`).
#' @keywords internal
.lam_compositor_aplica <- function(p, slide = NULL) {
  espec <- if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL
  if (is.null(espec) || !identical(espec$tipo, "escala") || NROW(espec$filas) < 1L) return(FALSE)
  if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
  # Alcance de N1: lo que el recetario resuelve con piezas que N2 todavía no porta queda en la ruta
  # anterior en vez de perderse (verificador de N1): la columna Bottom Two Box, la fila Total con su
  # filete y los bloques con actores (una afirmación con varias barras).
  if (!is.null(espec$box2$unidades)) return(FALSE)
  if (any(espec$filas$es_total)) return(FALSE)
  grupos <- espec$filas$grupo_id[!is.na(espec$filas$grupo_id)]
  if (length(grupos) && any(table(grupos) > 1L)) return(FALSE)
  TRUE
}

#' Compone una lámina de un gráfico de escala (p_slide_1_grafico) con el recetario
#'
#' La base de la lámina absorbe el pie: en el recetario la nota va en la misma
#' línea de la base, que es lo único que hay a la izquierda del folio.
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.lam_compositor_slide_1 <- function(doc, p, titulo, subtitulo = NULL, base = NULL, pie = NULL,
                                    antetitulo = NULL, layout = "Graficos2", master = "Office Theme",
                                    por_lamina = function(doc) doc) {
  espec <- attr(p, "pulso_espec")
  texto <- function(x) if (is.null(x) || (is.character(x) && !nzchar(trimws(x[1])))) NULL else trimws(as.character(x)[1])
  base_txt <- paste(c(texto(base), texto(pie)), collapse = ". ")
  ante <- texto(antetitulo); if (!is.null(ante) && is.na(ante)) ante <- NULL
  # El folio se fija ANTES de agregar láminas: el documento officer se modifica en sitio y un argumento
  # perezoso `length(doc) + 1L` se evaluaba después del primer add_slide (folio corrido +1, verificador de N1).
  folio <- length(doc) + 1L
  .lam_laminas_escala(doc, espec, titulo = texto(titulo) %||% "", ante = ante, base = base_txt,
                      folio = folio, sub = texto(subtitulo), layout = layout, master = master,
                      por_lamina = por_lamina)
}

#' La rama `slide_1` del motor, en nativo (enganche de `reporte_ppt_plan`)
#'
#' Resuelve la base y la nota como la rama anterior (`reporte_plan_ppt.R`, rama
#' SLIDE_1: base manual o automática, nota del pie o del gráfico) y compone. Las
#' closures del motor llegan como argumentos.
#' @keywords internal
.lam_slide_1_nativa <- function(doc, p, slide, titulo, subtitulo, el_plot, presets, layout, master, antetitulo,
                                base_auto, nota_de, sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc) {
  slots <- slide$slots %||% list()
  como_texto <- function(x) if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
  base <- if (isTRUE(sin_base)) NULL else como_texto(slots$base)
  if (!isTRUE(sin_base) && is.null(base)) {
    base <- base_auto(el = el_plot, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                      formato = presets$base$args$formato %||% "Base: %s")
  }
  pie <- if (isTRUE(sin_pie)) NULL else como_texto(slots$footer)
  if (!isTRUE(sin_pie) && (is.null(pie) || !nzchar(trimws(as.character(pie)[1])))) {
    pie <- nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
  }
  espec <- attr(p, "pulso_espec")
  # Una batería de afirmaciones se ordena por Top Two Box (lámina 221); los niveles de un cruce no.
  if (identical(el_plot$.element_type, "barras_multiapiladas") && identical(el_plot$modo %||% "var", "var")) {
    espec <- .espec_ordenar_por_box(espec)
  }
  # Una afirmación de un solo público: el recetario la encabeza con la pregunta y nombra al público junto a
  # la barra («Estudiantes · 172 respuestas», lámina 216). El público es la base de la variable
  # («estudiantes$p16_6»).
  base_var <- sub("\\$.*$", "", as.character(el_plot$var %||% "")[1])
  if (NROW(espec$filas) == 1L && all(is.na(espec$filas$grupo_id)) && grepl("$", el_plot$var %||% "", fixed = TRUE) && nzchar(base_var)) {
    espec$filas$grupo_id <- base_var
    espec$filas$grupo_titulo <- espec$filas$rotulo
    espec$filas$rotulo <- paste0(toupper(substr(base_var, 1, 1)), substr(base_var, 2, nchar(base_var)))
  }
  attr(p, "pulso_espec") <- espec
  .lam_compositor_slide_1(doc, p, titulo, subtitulo, base, pie, antetitulo, layout = layout, master = master,
                          por_lamina = por_lamina)$doc
}
