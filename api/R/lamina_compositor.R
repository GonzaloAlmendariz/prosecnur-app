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
  # El documento officer se modifica en sitio: un folio perezoso (`length(doc) + 1L`) se evaluaría después del
  # primer add_slide y saldría corrido. Se fuerza antes de tocar el documento (verificador de N1).
  force(folio)
  premisas <- .lam_escala_premisas(espec)
  # Con fila Total o Bottom Two Box el recetario compone filas bajo cada pregunta (lámina 77); se parte por
  # bloques y, si hace falta, por filas repitiendo la Total (verificador de N2).
  en_filas <- .lam_escala_en_filas(espec)
  partes <- if (en_filas) .lam_filas_planear(espec, premisas) else .lam_escala_partir(premisas)
  for (k in seq_along(partes)) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    # El subtítulo sólo en la primera parte, bajo el título (recetario.R:122).
    doc <- .lam_titulo(doc, paste0(titulo, if (k > 1) " (cont.)" else ""), ante = ante, sub = if (k == 1L) sub else NULL)
    lz <- .lam_lienzo()
    if (en_filas) .lam_bloque_filas(lz, espec, partes[[k]]) else .lam_bloque_escala(lz, espec, partes[[k]], solo = length(partes) == 1L)
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
  if (is.null(espec)) return(FALSE)
  # N4: los gráficos de números son nativos cuando traen su especificación con grupos que dibujar.
  # N4: los gráficos de números son nativos cuando caben (rótulos, cifras, series que no se encimen); lo que no
  # cabe sigue por la ruta anterior (verificador de N4).
  if (espec$tipo %in% c("histograma", "numerico", "boxplot", "media_rango", "pesas", "serie2")) {
    return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_numericos_cabe(espec)))
  }
  # N5: mapas de calor y comparativo de dimensiones, si caben.
  if (espec$tipo %in% c("heatmap_dim", "comparativo_dim")) {
    return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_dimensiones_cabe(espec)))
  }
  # N6: los gráficos que siguen en ggplot van en la lámina del recetario.
  if (identical(espec$tipo, "ggplot_marco")) return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && inherits(p, "ggplot"))
  # N6: radar con tabla (lámina 90), si cabe.
  if (identical(espec$tipo, "radar")) return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_radar_cabe(espec)))
  # N6: torta y dona (láminas 69 y 70), si caben.
  if (identical(espec$tipo, "pie")) return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_circular_cabe(espec)))
  # N3: barras divergentes (lámina 71) y ranking con puntos (lámina 72), si caben.
  if (identical(espec$tipo, "divergentes")) return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_divergentes_cabe(espec)))
  if (identical(espec$tipo, "categorica") && identical(espec$forma, "lollipop")) {
    return(!identical((slide$meta %||% list())$motor_nativo, FALSE) && isTRUE(.lam_lollipop_cabe(espec)))
  }
  if (identical(espec$tipo, "categorica")) {
    # N3: la categórica de una serie (columnas, lámina 68) es nativa cuando tiene categorías que dibujar.
    # Va nativa si cabe en columnas o en barras; si no cabe en ninguna, sigue la ruta anterior (verificador de N3).
    if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
    return(.lam_dicotomia_cabe(espec, .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")) ||
             !is.na(.lam_categorica_forma(espec)))
  }
  if (!identical(espec$tipo, "escala") || NROW(espec$filas) < 1L) return(FALSE)
  if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
  # Actores (lámina 217), fila Total y Bottom Two Box (lámina 77) ya son nativos (N2).
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
                                base_auto, nota_de, sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc,
                                titulo_de_var = NULL) {
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
  base_var <- sub("\\$.*$", "", as.character(el_plot$var %||% "")[1])
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  # La base de una categórica viaja en la nota del gráfico (su caption en la ruta anterior).
  if (!isTRUE(sin_base) && is.null(texto(base)) && is.null(texto(pie))) base <- texto(espec$nota)
  if (espec$tipo %in% c("heatmap_dim", "comparativo_dim")) {
    # Si los casos de las columnas son los que respondieron la batería, el pie dice esa misma base (no la del
    # universo), salvo que la lámina declare la suya: una lámina, una base.
    # Si la lámina oculta la base (sin_base) no se escribe ninguna; si la base no tiene la forma «Base: N …» (otro
    # formato del preset) se deja como viene (verificador de N5, ronda 3).
    n_tot <- espec$n_respondieron_total %||% NA_real_
    b0 <- texto(base)
    if (!isTRUE(sin_base) && is.finite(n_tot) && is.null(como_texto(slots$base)) && !is.null(b0) && grepl("^Base:\\s*[0-9]", b0)) {
      cola <- sub("^Base:\\s*[0-9][0-9.,]*\\s*", "", b0)
      base <- paste0("Base: ", format(round(n_tot), big.mark = ",", trim = TRUE), if (nzchar(cola)) paste0(" ", cola) else "",
                     " que respondieron la batería")
    }
    comunes <- list(doc = doc, espec = espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                    base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                    layout = layout, master = master, por_lamina = por_lamina)
    o <- if (identical(espec$tipo, "heatmap_dim")) do.call(.lam_laminas_heatmap_dim, comunes) else do.call(.lam_laminas_comparativo_dim, comunes)
    return(o$doc)
  }
  if (espec$tipo %in% c("histograma", "numerico", "boxplot", "media_rango", "pesas", "serie2")) {
    # Los gráficos de números (láminas 79-87): el público de la base nombra los casos («22 estudiantes»).
    unidad <- if (grepl("$", el_plot$var %||% "", fixed = TRUE) && nzchar(base_var)) base_var else "respuestas"
    # La unidad del valor («años») sale de la etiqueta de la variable, no de una constante.
    etiqueta_var <- if (is.function(titulo_de_var) && !is.null(el_plot$var)) tryCatch(titulo_de_var(el_plot$var), error = function(e) NULL)
    unidad_valor <- .unidad_de_etiqueta(etiqueta_var %||% "")
    # Una sola fuente para la unidad (la etiqueta del instrumento): el histograma reescribe su mediana con ella, y
    # sobre la edad la caja y media y rango llevan el encabezado del eje del recetario («Edad, en años»).
    if (identical(espec$tipo, "histograma") && nzchar(unidad_valor) && is.finite(espec$mediana %||% NA_real_)) {
      espec$texto_mediana <- sprintf("Mediana: %s %s", format(round(espec$mediana, 1), trim = TRUE), unidad_valor)
    }
    encabezado_eje <- if (identical(unidad_valor, "años")) "Edad, en años" else NULL
    comunes <- list(doc = doc, espec = espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                    base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                    layout = layout, master = master, por_lamina = por_lamina)
    o <- switch(espec$tipo,
      histograma = do.call(.lam_laminas_histograma, comunes),
      numerico = do.call(.lam_laminas_numerico, c(comunes, list(unidad_n = unidad, encabezado = espec$etiqueta))),
      boxplot = do.call(.lam_laminas_boxplot, c(comunes, list(unidad = unidad_valor, encabezado = encabezado_eje))),
      media_rango = do.call(.lam_laminas_media_rango, c(comunes, list(unidad_n = unidad, encabezado = encabezado_eje))),
      pesas = do.call(.lam_laminas_pesas, c(comunes, list(unidad_n = unidad))),
      serie2 = do.call(.lam_laminas_serie2, comunes))
    return(o$doc)
  }
  if (identical(espec$tipo, "ggplot_marco")) {
    return(.lam_laminas_ggplot(doc, p, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                               base = paste(c(texto(base), texto(pie), espec$lectura), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                               layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  if (identical(espec$tipo, "radar")) {
    return(.lam_laminas_radar(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                              base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                              layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  if (identical(espec$tipo, "pie")) {
    unidad <- if (grepl("$", el_plot$var %||% "", fixed = TRUE) && nzchar(base_var)) base_var else "respuestas"
    f <- if (identical(espec$forma, "pie")) .lam_laminas_torta else .lam_laminas_dona
    return(f(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo), base = paste(c(texto(base), texto(pie)), collapse = ". "),
             folio = length(doc) + 1L, sub = texto(subtitulo), unidad_n = unidad, layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  if (identical(espec$tipo, "divergentes")) {
    return(.lam_laminas_divergentes(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                                    base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                                    layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  if (identical(espec$tipo, "categorica") && identical(espec$forma, "lollipop")) {
    # Ranking con puntos (lámina 72); en selección múltiple lleva el encabezado del recetario.
    # La nota del recorte («Se muestran 5 de 12 categorías.») va siempre en el pie, junto a la base.
    return(.lam_laminas_lollipop(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                                 base = paste(c(texto(base), texto(pie), texto(espec$nota_recorte)), collapse = ". "), folio = length(doc) + 1L, sub = texto(subtitulo),
                                 encabezado = if (sum(espec$valores) > 1.02) "% de encuestados que marcó cada opción" else NULL,
                                 layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  if (.lam_dicotomia_cabe(espec, .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der"))) {
    # Dos categorías que reparten el 100 % de un público: la dicotomía partida a todo el ancho (lámina 74). La
    # pregunta encabeza el panel cuando la lámina tiene su propio título; si no, el título ya es la pregunta.
    pregunta <- if (!is.null(slide$title) && is.function(titulo_de_var) && !is.null(el_plot$var)) {
      tryCatch(texto(titulo_de_var(el_plot$var)), error = function(e) NULL)
    }
    n_pub <- .espec_n_base(espec)
    publico <- if (is.finite(n_pub) && nzchar(base_var) && grepl("$", el_plot$var %||% "", fixed = TRUE)) {
      paste(format(round(n_pub), big.mark = ",", trim = TRUE), base_var)
    }
    return(.lam_laminas_dicotomia(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo), pregunta = pregunta,
                                  publico = publico, base = paste(c(texto(base), texto(pie)), collapse = ". "),
                                  folio = length(doc) + 1L, sub = texto(subtitulo), layout = layout, master = master,
                                  por_lamina = por_lamina)$doc)
  }
  if (identical(espec$tipo, "categorica")) {
    # La pregunta categórica va en columnas (lámina 68); «N estudiantes» nombra al público de la base.
    unidad <- if (grepl("$", el_plot$var %||% "", fixed = TRUE) && nzchar(base_var)) base_var else "respuestas"
    # La agrupada de una serie va en barras horizontales (lámina 73); en selección múltiple (los porcentajes
    # suman más de 100) lleva el encabezado del recetario.
    forma <- .lam_categorica_forma(espec, if (identical(el_plot$.element_type, "barras_agrupadas")) "barras" else "columnas")
    multiple <- sum(espec$valores) > 1.02
    return(.lam_laminas_categorica(doc, espec, titulo = texto(titulo) %||% "", ante = texto(antetitulo),
                                   base = paste(c(texto(base), texto(pie)), collapse = ". "), folio = length(doc) + 1L,
                                   sub = texto(subtitulo), forma = forma, unidad_n = unidad,
                                   encabezado = if (identical(forma, "barras") && multiple) "% de encuestados que marcó cada opción" else NULL,
                                   layout = layout, master = master, por_lamina = por_lamina)$doc)
  }
  # Una batería de afirmaciones se ordena por Top Two Box (lámina 221); los niveles de un cruce no.
  if (identical(el_plot$.element_type, "barras_multiapiladas") && identical(el_plot$modo %||% "var", "var")) {
    espec <- .espec_ordenar_por_box(espec)
  }
  # Con fila Total o Bottom Two Box la pregunta encabeza el bloque (lámina 77) cuando la lámina tiene su
  # propio título; si no lo tiene, su título ya es la pregunta y no se repite.
  if (.lam_escala_en_filas(espec) && !is.null(slide$title) && is.function(titulo_de_var) && !is.null(el_plot$var)) {
    espec$pregunta <- tryCatch(as.character(titulo_de_var(el_plot$var))[1], error = function(e) NULL)
  }
  # Una afirmación de un solo público: el recetario la encabeza con la pregunta y nombra al público junto a
  # la barra («Estudiantes · 172 respuestas», lámina 216). El público es la base de la variable
  # («estudiantes$p16_6»).
  if (!.lam_escala_en_filas(espec) && NROW(espec$filas) == 1L && all(is.na(espec$filas$grupo_id)) && grepl("$", el_plot$var %||% "", fixed = TRUE) && nzchar(base_var)) {
    espec$filas$grupo_id <- base_var
    espec$filas$grupo_titulo <- espec$filas$rotulo
    espec$filas$rotulo <- paste0(toupper(substr(base_var, 1, 1)), substr(base_var, 2, nchar(base_var)))
  }
  attr(p, "pulso_espec") <- espec
  .lam_compositor_slide_1(doc, p, titulo, subtitulo, base, pie, antetitulo, layout = layout, master = master,
                          por_lamina = por_lamina)$doc
}

#' ¿La lámina de varios gráficos se compone con piezas nativas?
#'
#' Sí cuando cada gráfico trae una especificación de escala, ninguno pide filas con Total o Bottom Two Box
#' (piezas de la lámina de un gráfico), todos comparten la escala (una sola leyenda) y cada panel cabe sobre
#' la leyenda con la barra mínima.
#' @keywords internal
.lam_compositor_aplica_paneles <- function(ps, slide = NULL, tipo = "p_slide_2_graficos") {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE)) return(FALSE)
  especs <- lapply(ps, function(p) if (inherits(p, "ggplot")) attr(p, "pulso_espec") else NULL)
  if (any(vapply(especs, is.null, TRUE))) return(FALSE)
  if (!all(vapply(especs, function(e) identical(e$tipo, "escala") && NROW(e$filas) >= 1L && !.lam_escala_en_filas(e), TRUE))) return(FALSE)
  if (!.lam_paneles_misma_escala(especs)) return(FALSE)
  # La apilada mide con su propia geometría: los bloques van uno bajo otro (verificador de N2).
  if (identical(tipo, "p_slide_2_graficos_vertical")) return(isTRUE(.lam_vertical_geo(especs)$cabe))
  disp <- (.std_geom("leyenda_y") - 0.1) - (.std_geom("zona_datos_y0") + 0.8)
  all(vapply(especs, function(e) disp / NROW(e$filas) >= 0.24 + 0.36, TRUE))
}

#' La rama `slide_2` del motor, en nativo (enganche de `reporte_ppt_plan`)
#' @keywords internal
.lam_slide_paneles_nativa <- function(doc, ps, els, slide, titulo, presets, layout, master, antetitulo, base_auto, nota_de,
                                      por_lamina = function(doc) doc, titulo_de_var = NULL, tipo = "p_slide_2_graficos") {
  slots <- slide$slots %||% list()
  como_texto <- function(x) if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
  base <- como_texto(slots$base)
  if (is.null(base)) base <- base_auto(els = els, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                                        formato = presets$base$args$formato %||% "Base: %s")
  nota <- como_texto(slots$right_text)
  if (is.null(nota) || !nzchar(trimws(nota[1]))) {
    nota <- nota_de(ps[[1]], els[[1]]$overrides$nota_pie %||% els[[1]]$nota_pie %||%
                      nota_de(ps[[2]], els[[2]]$overrides$nota_pie %||% els[[2]]$nota_pie %||% NULL))
  }
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  base_txt <- paste(c(texto(base), texto(nota)), collapse = ". ")
  preguntas <- lapply(els, function(el) {
    texto(el$overrides$titulo) %||% texto(el$title_slide) %||%
      (if (is.function(titulo_de_var) && !is.null(el$var)) texto(tryCatch(titulo_de_var(el$var), error = function(e) NULL))) %||% ""
  })
  especs <- lapply(seq_along(ps), function(k) {
    e <- attr(ps[[k]], "pulso_espec")
    if (identical(els[[k]]$.element_type, "barras_multiapiladas") && identical(els[[k]]$modo %||% "var", "var")) e <- .espec_ordenar_por_box(e)
    e
  })
  ante <- texto(antetitulo)
  .lam_laminas_paneles(doc, especs, preguntas, tipo = tipo, titulo = texto(titulo) %||% "", ante = ante, base = base_txt,
                       folio = length(doc) + 1L, layout = layout, master = master, por_lamina = por_lamina)
}

#' La lámina lleva su antetítulo para los renderers que viven fuera de `reporte_ppt_plan`
#' @keywords internal
.lam_con_antetitulo <- function(slide, antetitulo) {
  if (!is.null(antetitulo) && length(antetitulo) && !is.na(antetitulo[1]) && is.null((slide$meta %||% list())$antetitulo)) {
    slide$meta <- utils::modifyList(slide$meta %||% list(), list(antetitulo = as.character(antetitulo)[1]))
  }
  slide
}

#' Láminas de composición del recetario compuestas en nativo (`.composicion_render`)
#'
#' Hoy `graficos_2_vertical` (lámina 142). Devuelve el documento o `NULL` si el tipo aún no es nativo.
#' @keywords internal
.lam_composicion_nativa <- function(doc, stype, rendered, els, slide, titulo_de_var = NULL) {
  if (!identical(stype, "graficos_2_vertical")) return(NULL)
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  slots <- slide$slots %||% list()
  base <- if (is.character(slots$base)) texto(slots$base) else if (inherits(slots$base, "ppt_element_text")) texto(slots$base$text) else NULL
  if (is.null(base)) {
    # `.base_por_grafico` deja la base de cada gráfico en su nota al pie (reporte_plan_base_por_grafico.R).
    bases <- unique(unlist(lapply(els, function(el) texto(el$overrides$nota_pie %||% NULL))))
    base <- if (length(bases)) paste(bases, collapse = ". ") else NULL
  }
  preguntas <- lapply(els, function(el) {
    texto(el$overrides$titulo) %||% texto(el$title_slide) %||%
      (if (is.function(titulo_de_var) && !is.null(el$var)) texto(tryCatch(titulo_de_var(el$var), error = function(e) NULL))) %||% ""
  })
  especs <- lapply(seq_along(rendered), function(k) {
    e <- attr(rendered[[k]], "pulso_espec")
    if (identical(els[[k]]$.element_type, "barras_multiapiladas") && identical(els[[k]]$modo %||% "var", "var")) e <- .espec_ordenar_por_box(e)
    e
  })
  .lam_laminas_vertical(doc, especs, preguntas, titulo = texto(slots$title %||% slide$title) %||% "",
                        ante = texto((slide$meta %||% list())$antetitulo), base = base, folio = length(doc) + 1L)
}

