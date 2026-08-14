# =============================================================================
# PLAN / SLIDES (contenedores con layout FIJO)  -  v2 (CONSISTENTE)
# - Elimina duplicados (p_slide_2pop/5pop/6pop) y unifica contratos.
# - Normaliza validaciones y textos opcionales.
# - Implementa p_slide_1_left / p_slide_1_right.
# - Corrige bug en p_numerico() (cruce = cruce).
# =============================================================================

# ---- Helpers internos --------------------------------------------------------

.ppt_norm_text1 <- function(x, blank = NULL) {
  if (is.null(x)) return(NULL)
  if (length(x) == 0L) return(blank)
  if (all(is.na(x))) return(blank)
  x <- as.character(x)[1]
  if (is.na(x)) return(blank)
  if (!nzchar(trimws(x))) return(blank)
  if (identical(trimws(x), "NA")) return(blank)
  x
}

.ppt_chk_meta <- function(meta) {
  if (!is.list(meta)) .plan_spec_abort("`meta` debe ser una lista.")
  invisible(TRUE)
}

# Un `estilo` guardado y releido via JSON (round-trip GET/POST) puede llegar
# como data.frame de 1 fila: jsonlite colapsa asi un objeto que mezcla
# escalares con vectores de la misma longitud (ver iconos_focos_cover_width,
# etc. en p_slide_indice). Sobre un data.frame, `estilo$campo <- vector`
# revienta con "replacement has N rows, data has 1" en vez de simplemente
# reemplazar la columna. Lo normalizamos a lista, recuperando los vectores
# originales de las columnas-lista.
.ppt_norm_estilo <- function(estilo) {
  if (is.data.frame(estilo)) {
    estilo <- lapply(as.list(estilo), function(v) {
      if (is.list(v) && length(v) == 1L && is.null(names(v))) v[[1]] else v
    })
  }
  if (!is.list(estilo)) .plan_spec_abort("`estilo` debe ser una lista.")
  estilo
}

.ppt_chk_element <- function(x, nm) {
  if (is.null(x) || !inherits(x, "ppt_element")) {
    .plan_spec_abort("`", nm, "` debe ser un `ppt_element` (p_*()).")
  }
  invisible(TRUE)
}

.ppt_chk_element_or_text <- function(x, nm) {
  ok <- inherits(x, c("ppt_element", "ppt_element_text")) ||
    (is.character(x) && length(x) == 1L)
  if (!ok) {
    .plan_spec_abort("`", nm, "` debe ser un `p_*()` compatible o `character(1)`.")
  }
  invisible(TRUE)
}

.ppt_norm_text_lines <- function(texto = NULL, bullets = NULL, blank = NULL) {
  text_parts <- character(0)

  if (!is.null(texto)) {
    if (!is.character(texto)) .plan_spec_abort("`texto` debe ser character o NULL.")
    texto <- as.character(texto)
    texto <- texto[!is.na(texto)]
    texto <- trimws(texto)
    texto <- texto[nzchar(texto)]
    if (length(texto)) text_parts <- c(text_parts, texto)
  }

  if (!is.null(bullets)) {
    if (!is.character(bullets)) .plan_spec_abort("`bullets` debe ser character o NULL.")
    bullets <- as.character(bullets)
    bullets <- bullets[!is.na(bullets)]
    bullets <- trimws(bullets)
    bullets <- bullets[nzchar(bullets)]
    if (length(bullets)) {
      text_parts <- c(text_parts, paste0("• ", bullets))
    }
  }

  if (!length(text_parts)) return(blank)
  paste(text_parts, collapse = "\n")
}

.ppt_norm_text_like <- function(x, nm = "texto", blank = NULL) {
  if (is.null(x)) return(blank)
  if (inherits(x, "ppt_element_text")) {
    return(.ppt_norm_text1(x$text %||% NULL, blank = blank))
  }
  if (is.character(x) && length(x) == 1L) {
    return(.ppt_norm_text1(x, blank = blank))
  }
  .plan_spec_abort("`", nm, "` debe ser `character(1)`, `p_text()` o NULL.")
}

.ppt_parse_technical_table_rows <- function(filas) {
  clean <- function(x) {
    x <- as.character(x)
    x[is.na(x)] <- ""
    trimws(x)
  }

  normalize_df <- function(df) {
    df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
    if (ncol(df) < 2L) {
      .plan_spec_abort("`filas` debe tener al menos dos columnas: etiqueta y detalle.")
    }
    df <- df[, seq_len(2L), drop = FALSE]
    names(df) <- c("criterio", "detalle")
    df$criterio <- clean(df$criterio)
    df$detalle <- clean(df$detalle)
    df <- df[nzchar(df$criterio) | nzchar(df$detalle), , drop = FALSE]
    if (!nrow(df)) {
      .plan_spec_abort("`filas` debe contener al menos una fila con texto.")
    }
    df
  }

  parse_lines <- function(lines) {
    lines <- clean(lines)
    lines <- unlist(strsplit(lines, "\\r?\\n", perl = TRUE), use.names = FALSE)
    lines <- clean(lines)
    lines <- lines[nzchar(lines)]
    if (!length(lines)) {
      .plan_spec_abort("`filas` debe contener al menos una fila con texto.")
    }
    rows <- lapply(lines, function(line) {
      parts <- regexpr("\\s*[:|\\t]\\s*", line, perl = TRUE)
      if (parts[[1]] > 0L) {
        start <- parts[[1]]
        len <- attr(parts, "match.length")[[1]]
        criterio <- substr(line, 1L, start - 1L)
        detalle <- substr(line, start + len, nchar(line))
      } else {
        criterio <- ""
        detalle <- line
      }
      data.frame(
        criterio = clean(criterio),
        detalle = clean(detalle),
        stringsAsFactors = FALSE
      )
    })
    normalize_df(do.call(rbind, rows))
  }

  if (is.data.frame(filas)) return(normalize_df(filas))
  if (is.character(filas)) return(parse_lines(filas))

  if (is.list(filas)) {
    if (all(c("criterio", "detalle") %in% names(filas))) {
      return(normalize_df(data.frame(
        criterio = unlist(filas$criterio, use.names = FALSE),
        detalle = unlist(filas$detalle, use.names = FALSE),
        stringsAsFactors = FALSE
      )))
    }
    if (all(c("campo", "valor") %in% names(filas))) {
      return(normalize_df(data.frame(
        criterio = unlist(filas$campo, use.names = FALSE),
        detalle = unlist(filas$valor, use.names = FALSE),
        stringsAsFactors = FALSE
      )))
    }
    if (length(filas) && all(vapply(filas, is.list, logical(1)))) {
      row_value <- function(row, named, pos) {
        val <- row[[named]] %||% NULL
        if (!is.null(val)) return(val)
        if (length(row) >= pos) return(row[[pos]])
        ""
      }
      rows <- lapply(filas, function(row) {
        data.frame(
          criterio = clean(row$criterio %||% row$campo %||% row_value(row, "criterio", 1L)),
          detalle = clean(row$detalle %||% row$valor %||% row_value(row, "detalle", 2L)),
          stringsAsFactors = FALSE
        )
      })
      return(normalize_df(do.call(rbind, rows)))
    }
  }

  .plan_spec_abort("`filas` debe ser un data.frame, una lista de filas o texto en formato 'Campo: valor'.")
}

.ppt_as_slide <- function(slide) {
  class(slide) <- c("ppt_slide", "list")
  slide
}

# =============================================================================
# PLAN
# =============================================================================

#' @title Construir un plan de diapositivas
#'
#' @description
#' Une objetos `p_slide_*()` en un plan ordenado. La entrada puede ser una lista
#' o argumentos sueltos.
#'
#' @param ... Objetos `ppt_slide`.
#' @param slides Alternativa a `...`: lista de slides.
#'
#' @return Lista de slides (plan) con clase `"ppt_plan"`.
#'
#' @family reporte
#' @export
p_plan <- function(..., slides = NULL) {
  out <- if (!is.null(slides)) {
    if (!is.list(slides)) .plan_spec_abort("`slides` debe ser lista.")
    slides
  } else {
    list(...)
  }

  if (!length(out)) {
    out <- structure(list(), class = c("ppt_plan", "list"))
    return(out)
  }

  bad <- vapply(out, function(x) !inherits(x, "ppt_slide"), logical(1))
  if (any(bad)) {
    .plan_spec_abort("`p_plan()`: todos los elementos deben ser `ppt_slide`. Malos: ",
                     paste(which(bad), collapse = ", "))
  }

  class(out) <- c("ppt_plan", "list")
  out
}

# =============================================================================
# SLIDES  -  PORTADA / SECCION / UTILITARIOS
# =============================================================================

#' @title Slide de seccion
#'
#' @param titulo Titulo de la seccion.
#' @param subtitulo Subtitulo opcional.
#' @param introduccion_word Parrafo editorial opcional para Word. No se imprime en PPT.
#' @param meta Lista libre para notas internas (no se imprime).
#'
#' @return Objeto con clase `"ppt_slide"`.
#'
#' @family reporte
#' @export
p_slide_seccion <- function(titulo, subtitulo = NULL, introduccion_word = NULL, meta = list()) {
  titulo <- .ppt_norm_text1(titulo)
  if (is.null(titulo)) .plan_spec_abort("`titulo` debe ser un texto no vacio.")

  subtitulo <- .ppt_norm_text1(subtitulo, blank = NULL)
  introduccion_word <- .ppt_norm_text1(introduccion_word, blank = NULL)
  .ppt_chk_meta(meta)

  .ppt_as_slide(list(
    .slide_type = "section",
    title       = titulo,
    subtitle    = subtitulo,
    word_intro  = introduccion_word,
    slots       = list(
      title    = titulo,
      subtitle = subtitulo
    ),
    meta        = meta
  ))
}

#' @title Slide de texto
#'
#' @param titulo Titulo principal.
#' @param texto Texto libre o vector de parrafos.
#' @param bullets Vector opcional de bullets; se convierte en listado.
#' @param base Texto/base opcional al final del cuerpo.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_texto <- function(
    titulo,
    texto = NULL,
    bullets = NULL,
    base = NULL,
    meta = list()
) {
  titulo <- .ppt_norm_text1(titulo)
  if (is.null(titulo)) .plan_spec_abort("`titulo` debe ser un texto no vacio.")

  body_text <- .ppt_norm_text_lines(texto = texto, bullets = bullets, blank = NULL)
  if (is.null(body_text)) {
    .plan_spec_abort("`texto` o `bullets` debe contener al menos una linea no vacia.")
  }

  body_base <- .ppt_norm_text_like(base, nm = "base", blank = NULL)
  if (!is.null(body_base)) {
    body_text <- paste(body_text, body_base, sep = "\n\n")
  }

  .ppt_chk_meta(meta)

  .ppt_as_slide(list(
    .slide_type = "text_slide",
    title       = titulo,
    slots       = list(
      title = titulo,
      text  = body_text,
      base  = body_base
    ),
    meta = meta
  ))
}

#' @title Slide de tabla tecnica
#'
#' @param titulo Titulo principal.
#' @param filas Tabla con al menos dos columnas: etiqueta y detalle.
#' @param pie Texto/base opcional al final.
#' @param estilo Lista opcional de ajustes visuales para el render PPT.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_tabla_tecnica <- function(
    titulo,
    filas,
    pie = NULL,
    estilo = list(),
    meta = list()
) {
  titulo <- .ppt_norm_text1(titulo)
  if (is.null(titulo)) .plan_spec_abort("`titulo` debe ser un texto no vacio.")

  filas <- .ppt_parse_technical_table_rows(filas)

  body_base <- .ppt_norm_text_like(pie, nm = "pie", blank = NULL)

  estilo <- .ppt_norm_estilo(estilo)
  .ppt_chk_meta(meta)

  .ppt_as_slide(list(
    .slide_type = "technical_table",
    title       = titulo,
    slots       = list(
      title = titulo,
      table = filas,
      base  = body_base
    ),
    style = estilo,
    meta = meta
  ))
}

#' @title Slide de portada
#'
#' @param titulo Titulo principal.
#' @param subtitulo Subtitulo opcional.
#' @param fecha Fecha opcional.
#' @param subtexto Texto auxiliar inferior opcional.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_portada <- function(
    titulo,
    subtitulo = NULL,
    fecha = NULL,
    subtexto = NULL,
    meta = list()
) {
  titulo <- .ppt_norm_text1(titulo)
  if (is.null(titulo)) .plan_spec_abort("`titulo` debe ser texto no vacio.")

  .ppt_chk_meta(meta)

  .ppt_as_slide(list(
    .slide_type = "title_slide",
    title       = titulo,
    slots       = list(
      title    = titulo,
      subtitle = .ppt_norm_text1(subtitulo, blank = NULL),
      date     = .ppt_norm_text1(fecha, blank = NULL),
      subtexto = .ppt_norm_text1(subtexto, blank = NULL)
    ),
    meta = meta
  ))
}

#' @title Slide de indice predeterminado
#'
#' @param titulo Titulo del indice. Si se omite junto con `secciones` y
#'   `subtemas`, el export PPT usa el layout de indice de la plantilla.
#' @param secciones Vector/lista o texto separado por saltos de linea con las
#'   secciones principales.
#' @param subtemas Vector/lista o texto separado por saltos de linea con los
#'   subtemas a mostrar bajo el indice. Si `subindices` no se define, se
#'   asocian a la ultima seccion.
#' @param subindices Lista nombrada o tabla con subindices por seccion.
#' @param iconos_focos Vector opcional con nombres internos o rutas SVG/PNG para
#'   los iconos de los focos.
#' @param redibujar_focos Si es `TRUE`, redibuja desde cero la zona izquierda de
#'   focos. Por defecto se conservan los focos de la plantilla y solo se limpian
#'   los iconos previos cuando se agregan iconos personalizados.
#' @param mostrar_iconos_focos Si es `TRUE`, muestra los iconos dentro de los
#'   focos.
#' @param iconos_focos_fill Colores opcionales de los focos.
#' @param iconos_focos_objeto_unico Si es `TRUE`, inserta circulo e icono como
#'   una sola imagen editable en PowerPoint.
#' @param iconos_focos_diametro_cm Diametro de los circulos de icono, en cm.
#' @param iconos_focos_icon_scale Escala interna del icono dentro del circulo.
#' @param iconos_focos_left_cm Compatibilidad historica; las posiciones del
#'   layout de focos son fijas.
#' @param iconos_focos_top_cm Compatibilidad historica; las posiciones del
#'   layout de focos son fijas.
#' @param subtopic_badge_fill Color de las marcas numeradas del subindice.
#' @param subtopic_badge_width Ancho de las marcas numeradas del subindice.
#' @param subtopic_badge_gap Separacion entre marca numerada y texto.
#' @param estilo Lista opcional de parametros visuales del indice.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_indice <- function(titulo = NULL,
                           secciones = NULL,
                           subtemas = NULL,
                           subindices = NULL,
                           iconos_focos = NULL,
                           redibujar_focos = FALSE,
                           mostrar_iconos_focos = TRUE,
                           iconos_focos_fill = NULL,
                           iconos_focos_objeto_unico = NULL,
                           iconos_focos_diametro_cm = NULL,
                           iconos_focos_icon_scale = NULL,
                           iconos_focos_left_cm = NULL,
                           iconos_focos_top_cm = NULL,
                           subtopic_badge_fill = NULL,
                           subtopic_badge_width = NULL,
                           subtopic_badge_gap = NULL,
                           estilo = list(),
                           meta = list()) {
  estilo <- .ppt_norm_estilo(estilo)

  parse_numeric_vec <- function(x) {
    if (is.null(x) || length(x) == 0L) return(NULL)
    if (is.character(x) && length(x) == 1L) {
      x <- unlist(strsplit(x, "[,;|\\r\\n\\t ]+", perl = TRUE), use.names = FALSE)
    }
    x <- suppressWarnings(as.numeric(x))
    x <- x[is.finite(x)]
    if (!length(x)) NULL else x
  }
  recycle_focus_vec <- function(x, n = 5L) {
    if (is.null(x)) return(NULL)
    if (length(x) == 1L) return(rep(x, n))
    x
  }
  cm_to_in_vec <- function(x) {
    x <- parse_numeric_vec(x)
    if (is.null(x)) NULL else x / 2.54
  }

  if (!is.null(iconos_focos)) estilo$iconos_focos <- iconos_focos
  if (!is.null(redibujar_focos)) estilo$redibujar_focos <- isTRUE(redibujar_focos)
  if (!is.null(mostrar_iconos_focos)) estilo$mostrar_iconos_focos <- isTRUE(mostrar_iconos_focos)
  if (!is.null(iconos_focos_fill)) estilo$iconos_focos_fill <- iconos_focos_fill
  if (!is.null(iconos_focos_objeto_unico)) estilo$iconos_focos_objeto_unico <- isTRUE(iconos_focos_objeto_unico)
  if (!is.null(iconos_focos_diametro_cm)) {
    diametro_in <- recycle_focus_vec(cm_to_in_vec(iconos_focos_diametro_cm))
    if (!is.null(diametro_in)) {
      estilo$iconos_focos_cover_width <- diametro_in
      estilo$iconos_focos_cover_height <- diametro_in
    }
  }
  icon_scale <- recycle_focus_vec(parse_numeric_vec(iconos_focos_icon_scale))
  if (!is.null(icon_scale)) estilo$iconos_focos_icon_scale <- icon_scale
  if (!is.null(subtopic_badge_fill)) estilo$subtopic_badge_fill <- .ppt_norm_text1(subtopic_badge_fill, blank = NULL)
  if (!is.null(subtopic_badge_width)) estilo$subtopic_badge_width <- parse_numeric_vec(subtopic_badge_width)[1]
  if (!is.null(subtopic_badge_gap)) estilo$subtopic_badge_gap <- parse_numeric_vec(subtopic_badge_gap)[1]
  .ppt_chk_meta(meta)

  .ppt_as_slide(list(
    .slide_type = "indice",
    title       = .ppt_norm_text1(titulo, blank = NULL),
    slots       = list(
      title = .ppt_norm_text1(titulo, blank = NULL),
      secciones = secciones,
      subtemas = subtemas,
      subindices = subindices,
      iconos_focos = iconos_focos,
      redibujar_focos = redibujar_focos,
      mostrar_iconos_focos = mostrar_iconos_focos,
      iconos_focos_fill = iconos_focos_fill,
      iconos_focos_objeto_unico = iconos_focos_objeto_unico,
      iconos_focos_diametro_cm = iconos_focos_diametro_cm,
      iconos_focos_icon_scale = iconos_focos_icon_scale,
      iconos_focos_left_cm = iconos_focos_left_cm,
      iconos_focos_top_cm = iconos_focos_top_cm,
      subtopic_badge_fill = subtopic_badge_fill,
      subtopic_badge_width = subtopic_badge_width,
      subtopic_badge_gap = subtopic_badge_gap,
      estilo = estilo
    ),
    style       = estilo,
    meta        = meta
  ))
}

#' @title Slide explicativo de Top Two Box
#'
#' @param titulo Titulo principal.
#' @param texto Parrafo explicativo.
#' @param valores Porcentajes de la escala. Por defecto usa 5%, 5%, 35% y 55%.
#' @param etiquetas Etiquetas de la escala/leyenda.
#' @param top_two_indices Posiciones de `valores` que componen el Top Two Box.
#' @param extremo_izquierda Texto del extremo izquierdo de la escala.
#' @param extremo_derecha Texto del extremo derecho de la escala.
#' @param accent_color Color de acento para título y anotación de Top Two Box.
#' @param grosor_barra Grosor visual de la barra de referencia.
#' @param size_texto_porcentajes Tamaño del texto de porcentajes dentro de la
#'   barra de referencia.
#' @param size_texto_porcentajes_peq Tamaño alternativo para porcentajes en
#'   segmentos pequeños.
#' @param color_texto_porcentajes Color del texto de porcentajes dentro de la
#'   barra.
#' @param margen_llave Margen lateral extra para la llave que engloba el Top
#'   Two Box.
#' @param grosor_flecha Grosor de la flecha inferior de escala.
#' @param estilo Lista opcional de parametros visuales.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_top_two_box <- function(
    titulo = "TOP TWO BOX",
    texto = NULL,
    valores = c(5, 5, 35, 55),
    etiquetas = c("1", "2", "3", "4"),
    top_two_indices = c(3, 4),
    extremo_izquierda = "Totalmente\nen desacuerdo",
    extremo_derecha = "Totalmente\nde acuerdo",
    accent_color = NULL,
    colores = NULL,
    grosor_barra = NULL,
    size_texto_porcentajes = NULL,
    size_texto_porcentajes_peq = NULL,
    color_texto_porcentajes = NULL,
    margen_llave = NULL,
    grosor_flecha = NULL,
    estilo = list(),
    meta = list()
) {
  estilo <- .ppt_norm_estilo(estilo)
  if (!is.null(accent_color)) estilo$accent_color <- .ppt_norm_text1(accent_color, blank = NULL)
  if (!is.null(colores)) estilo$colores <- colores
  if (!is.null(grosor_barra)) estilo$grosor_barra <- grosor_barra
  if (!is.null(size_texto_porcentajes)) estilo$size_texto_porcentajes <- size_texto_porcentajes
  if (!is.null(size_texto_porcentajes_peq)) estilo$size_texto_porcentajes_peq <- size_texto_porcentajes_peq
  if (!is.null(color_texto_porcentajes)) estilo$color_texto_porcentajes <- .ppt_norm_text1(color_texto_porcentajes, blank = NULL)
  if (!is.null(margen_llave)) estilo$margen_llave <- margen_llave
  if (!is.null(grosor_flecha)) estilo$grosor_flecha <- grosor_flecha
  .ppt_chk_meta(meta)
  texto_default <- "Con el fin de hacer la lectura de datos de forma más amigable, se plantea la suma de los dos valores superiores de la escala, comúnmente llamada top two box. Esta suma permite comparar de manera más rápida y eficiente los datos entre categorías o con mediciones de otros años."
  if (is.null(texto)) texto <- texto_default
  texto <- .ppt_norm_text1(texto, blank = texto_default)

  .ppt_as_slide(list(
    .slide_type = "top_two_box",
    title       = .ppt_norm_text1(titulo, blank = "TOP TWO BOX"),
    slots       = list(
      title = .ppt_norm_text1(titulo, blank = "TOP TWO BOX"),
      text = texto,
      valores = valores,
      etiquetas = etiquetas,
      top_two_indices = top_two_indices,
      extremo_izquierda = extremo_izquierda,
      extremo_derecha = extremo_derecha,
      accent_color = accent_color,
      colores = colores,
      grosor_barra = grosor_barra,
      size_texto_porcentajes = size_texto_porcentajes,
      size_texto_porcentajes_peq = size_texto_porcentajes_peq,
      color_texto_porcentajes = color_texto_porcentajes,
      margen_llave = margen_llave,
      grosor_flecha = grosor_flecha,
      estilo = estilo
    ),
    style       = estilo,
    meta        = meta
  ))
}

#' @title Slide metodologico de redondeo
#'
#' Lamina reutilizable que explica los dos metodos de redondeo mostrando la
#' MISMA distribucion rotulada por cada uno, con su suma al lado. Hermana de
#' `p_slide_top_two_box()`: mismo layout y mismos tres slots.
#'
#' El ejemplo por defecto no es redondo a proposito. Son los casos de una
#' pregunta real con dos categorias de una sola persona, que es donde los dos
#' metodos discrepan de forma visible; con un ejemplo comodo la lamina no
#' ensenaria nada.
#'
#' @param titulo Titulo de la lamina.
#' @param texto Parrafo explicativo. `NULL` usa el de la casa.
#' @param casos Frecuencias del ejemplo.
#' @param etiquetas Nombres de las categorias del ejemplo.
#' @param decimales Resolucion rotulada en el ejemplo.
#' @param accent_color Color de acento del titulo y de la suma que no cierra.
#' @param colores Paleta de los segmentos.
#' @param estilo Lista de estilo del slide.
#' @param meta Metadatos del slide.
#' @export
p_slide_redondeo <- function(
    titulo = "CÓMO SE REDONDEAN LAS CIFRAS",
    texto = NULL,
    casos = .REDONDEO_SLIDE_CASOS,
    etiquetas = .REDONDEO_SLIDE_ETIQUETAS,
    decimales = 0,
    accent_color = NULL,
    colores = NULL,
    estilo = list(),
    meta = list()
) {
  estilo <- .ppt_norm_estilo(estilo)
  if (!is.null(accent_color)) estilo$accent_color <- .ppt_norm_text1(accent_color, blank = NULL)
  if (!is.null(colores)) estilo$colores <- colores
  .ppt_chk_meta(meta)

  texto_default <- .redondeo_slide_texto()
  if (is.null(texto)) texto <- texto_default
  texto <- .ppt_norm_text1(texto, blank = texto_default)

  .ppt_as_slide(list(
    .slide_type = "redondeo",
    title       = .ppt_norm_text1(titulo, blank = "CÓMO SE REDONDEAN LAS CIFRAS"),
    slots       = list(
      title = .ppt_norm_text1(titulo, blank = "CÓMO SE REDONDEAN LAS CIFRAS"),
      text = texto,
      casos = casos,
      etiquetas = etiquetas,
      decimales = decimales,
      accent_color = accent_color,
      colores = colores,
      estilo = estilo
    ),
    style       = estilo,
    meta        = meta
  ))
}

#' @title Slide objetivo con icono
#'
#' @param icono Elemento grafico principal del lateral.
#' @param texto Texto principal del slide.
#' @param titulo Titulo opcional.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_objetivo_icono <- function(icono, texto, titulo = NULL, meta = list()) {
  .ppt_chk_element(icono, "icono")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  .ppt_as_slide(list(
    .slide_type = "objetivo_icono",
    title       = titulo,
    slots       = list(
      title = titulo,
      text  = .ppt_norm_text1(texto, blank = " "),
      icon  = icono
    ),
    meta = meta
  ))
}

# =============================================================================
# SLIDES  -  BASICAS (1 grafico / 2 graficos)
# =============================================================================

#' @title Slide con 1 grafico
#'
#' @param grafico Elemento principal.
#' @param titulo Titulo opcional.
#' @param subtitulo Subtitulo opcional.
#' @param base Elemento o texto opcional para la base.
#' @param pie Elemento o texto opcional para el pie.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_1_grafico <- function(grafico, titulo = NULL, subtitulo = NULL, base = NULL, pie = NULL, meta = list()) {
  .ppt_chk_element(grafico, "grafico")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  subtitulo <- .ppt_norm_text1(subtitulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }

  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "slide_1",
    title       = titulo,
    slots       = list(
      title    = titulo,
      subtitle = subtitulo,
      plot     = grafico,
      base     = base,
      footer   = pie
    ),
    meta        = meta
  ))
}

#' @title Slide con 2 graficos
#'
#' @param izquierda Grafico izquierdo.
#' @param derecha Grafico derecho.
#' @param titulo Titulo opcional.
#' @param base Elemento o texto opcional para la base.
#' @param pie Elemento o texto opcional para el pie derecho.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_2_graficos <- function(izquierda, derecha, titulo = NULL, base = NULL, pie = NULL, meta = list()) {
  .ppt_chk_element(izquierda, "izquierda")
  .ppt_chk_element(derecha, "derecha")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }

  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "slide_2",
    title       = titulo,
    slots       = list(
      title      = titulo,
      left       = izquierda,
      right      = derecha,
      base       = base,
      footer     = pie,
      right_text = if (inherits(pie, "ppt_element_text")) {
        pie$text %||% NULL
      } else if (is.character(pie)) {
        pie
      } else {
        NULL
      }
    ),
    meta = meta
  ))
}

#' @title Slide narrativo con 1 grafico
#'
#' @param grafico Elemento principal.
#' @param texto Bloque narrativo superior.
#' @param titulo Titulo opcional.
#' @param etiqueta Texto corto opcional superior.
#' @param base Elemento o texto opcional para la base.
#' @param pie Elemento o texto opcional para el pie.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_1_grafico_narrativo <- function(
    grafico,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico, "grafico")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "slide_1_narrativo",
    title       = titulo,
    slots       = list(
      title  = titulo,
      plot   = grafico,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

#' @title Slide narrativo con 2 graficos
#'
#' @param izquierda Grafico izquierdo.
#' @param derecha Grafico derecho.
#' @param texto Bloque narrativo superior.
#' @param titulo Titulo opcional.
#' @param etiqueta Texto corto opcional superior.
#' @param base Elemento o texto opcional para la base.
#' @param pie Elemento o texto opcional para el pie.
#' @param meta Lista libre para notas internas.
#'
#' @return Objeto con clase `"ppt_slide"`.
#' @family reporte
#' @export
p_slide_2_graficos_narrativo <- function(
    izquierda,
    derecha,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(izquierda, "izquierda")
  .ppt_chk_element(derecha, "derecha")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "slide_2_narrativo",
    title       = titulo,
    slots       = list(
      title  = titulo,
      left   = izquierda,
      right  = derecha,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

# =============================================================================
# SLIDES  -  TEXTO + GRAFICO(S)
# =============================================================================

#' @family reporte
#' @export
p_slide_grafico_texto_derecha <- function(
    grafico,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico, "grafico")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "text_r",
    title       = titulo,
    slots       = list(
      title  = titulo,
      plot   = grafico,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_grafico_texto_izquierda <- function(
    grafico,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico, "grafico")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "text_l",
    title       = titulo,
    slots       = list(
      title  = titulo,
      plot   = grafico,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_2_graficos_texto_derecha <- function(
    grafico_1,
    grafico_2,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico_1, "grafico_1")
  .ppt_chk_element(grafico_2, "grafico_2")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "text_r2",
    title       = titulo,
    slots       = list(
      title  = titulo,
      plot1  = grafico_1,
      plot2  = grafico_2,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_2_graficos_texto_izquierda <- function(
    grafico_1,
    grafico_2,
    texto = " ",
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico_1, "grafico_1")
  .ppt_chk_element(grafico_2, "grafico_2")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "text_l2",
    title       = titulo,
    slots       = list(
      title  = titulo,
      plot1  = grafico_1,
      plot2  = grafico_2,
      text   = .ppt_norm_text1(texto, blank = " "),
      tag    = .ppt_norm_text1(etiqueta, blank = NULL),
      base   = base,
      footer = pie
    ),
    meta = meta
  ))
}

# =============================================================================
# SLIDES  -  GRAFICOS DE POBLACION
# =============================================================================

#' @family reporte
#' @export
p_slide_2_graficos_poblacion <- function(
    izquierda,
    derecha,
    titulo = NULL,
    texto = " ",
    icono = NULL,
    base = NULL,
    meta = list()
) {
  .ppt_chk_element(izquierda, "izquierda")
  .ppt_chk_element(derecha, "derecha")
  if (!is.null(icono)) .ppt_chk_element(icono, "icono")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  base <- .ppt_norm_text_like(base, nm = "base", blank = NULL)

  .ppt_as_slide(list(
    .slide_type = "poblacion_2",
    title       = titulo,
    slots       = list(
      title = titulo,
      left  = izquierda,
      right = derecha,
      text  = .ppt_norm_text1(texto, blank = " "),
      icon  = icono,
      base  = base
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_4_graficos_poblacion <- function(
    superior_izquierda,
    superior_derecha,
    inferior_izquierda,
    inferior_derecha,
    titulo = NULL,
    icono = NULL,
    base = NULL,
    meta = list()
) {
  .ppt_chk_element(superior_izquierda, "superior_izquierda")
  .ppt_chk_element(superior_derecha, "superior_derecha")
  .ppt_chk_element(inferior_izquierda, "inferior_izquierda")
  .ppt_chk_element(inferior_derecha, "inferior_derecha")
  if (!is.null(icono)) .ppt_chk_element(icono, "icono")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "poblacion_4",
    title       = titulo,
    slots       = list(
      title        = titulo,
      up_left      = superior_izquierda,
      up_right     = superior_derecha,
      bottom_left  = inferior_izquierda,
      bottom_right = inferior_derecha,
      base         = base,
      icon         = icono
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_4_graficos <- function(
    superior_izquierda,
    superior_derecha,
    inferior_izquierda,
    inferior_derecha,
    titulo = NULL,
    etiqueta = NULL,
    base = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(superior_izquierda, "superior_izquierda")
  .ppt_chk_element(superior_derecha, "superior_derecha")
  .ppt_chk_element(inferior_izquierda, "inferior_izquierda")
  .ppt_chk_element(inferior_derecha, "inferior_derecha")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(base)) {
    .ppt_chk_element_or_text(base, "base")
    if (is.character(base)) base <- .ppt_norm_text1(base, blank = NULL)
  }
  if (!is.null(pie)) {
    .ppt_chk_element_or_text(pie, "pie")
    if (is.character(pie)) pie <- .ppt_norm_text1(pie, blank = NULL)
  }

  .ppt_as_slide(list(
    .slide_type = "paneles_4",
    title       = titulo,
    slots       = list(
      title        = titulo,
      up_left      = superior_izquierda,
      up_right     = superior_derecha,
      bottom_left  = inferior_izquierda,
      bottom_right = inferior_derecha,
      tag          = .ppt_norm_text1(etiqueta, blank = NULL),
      base         = base,
      footer       = pie
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_5_graficos_poblacion <- function(
    grafico_superior_1,
    grafico_superior_2,
    grafico_superior_3,
    grafico_inferior_1,
    grafico_inferior_2,
    titulo = NULL,
    etiqueta = NULL,
    icono = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico_superior_1, "grafico_superior_1")
  .ppt_chk_element(grafico_superior_2, "grafico_superior_2")
  .ppt_chk_element(grafico_superior_3, "grafico_superior_3")
  .ppt_chk_element(grafico_inferior_1, "grafico_inferior_1")
  .ppt_chk_element(grafico_inferior_2, "grafico_inferior_2")
  if (!is.null(icono)) .ppt_chk_element(icono, "icono")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  etiqueta <- .ppt_norm_text1(etiqueta, blank = NULL)
  pie <- .ppt_norm_text1(pie, blank = NULL)

  .ppt_as_slide(list(
    .slide_type = "poblacion_5",
    title       = titulo,
    slots       = list(
      title  = titulo,
      tag    = etiqueta,
      icon   = icono,
      footer = pie,
      pic1   = grafico_superior_2,
      pic2   = grafico_superior_1,
      pic3   = grafico_superior_3,
      pic4   = grafico_inferior_2,
      pic5   = grafico_inferior_1
    ),
    meta = meta
  ))
}

#' @family reporte
#' @export
p_slide_6_graficos_poblacion <- function(
    grafico_superior_1,
    grafico_superior_2,
    grafico_superior_3,
    grafico_inferior_1,
    grafico_inferior_2,
    grafico_inferior_3,
    titulo = NULL,
    etiqueta = NULL,
    icono = NULL,
    pie = NULL,
    meta = list()
) {
  .ppt_chk_element(grafico_superior_1, "grafico_superior_1")
  .ppt_chk_element(grafico_superior_2, "grafico_superior_2")
  .ppt_chk_element(grafico_superior_3, "grafico_superior_3")
  .ppt_chk_element(grafico_inferior_1, "grafico_inferior_1")
  .ppt_chk_element(grafico_inferior_2, "grafico_inferior_2")
  .ppt_chk_element(grafico_inferior_3, "grafico_inferior_3")
  if (!is.null(icono)) .ppt_chk_element(icono, "icono")
  .ppt_chk_meta(meta)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  etiqueta <- .ppt_norm_text1(etiqueta, blank = NULL)
  pie <- .ppt_norm_text1(pie, blank = NULL)

  .ppt_as_slide(list(
    .slide_type = "poblacion_6",
    title       = titulo,
    slots       = list(
      title  = titulo,
      tag    = etiqueta,
      icon   = icono,
      footer = pie,
      pic1   = grafico_superior_2,
      pic2   = grafico_superior_1,
      pic3   = grafico_superior_3,
      pic4   = grafico_inferior_3,
      pic5   = grafico_inferior_1,
      pic6   = grafico_inferior_2
    ),
    meta = meta
  ))
}

# =============================================================================
# ELEMENTOS p_* (objetos declarativos)
# =============================================================================

#' @keywords internal
.ppt_norm_filters <- function(filtros) {
  if (is.null(filtros)) return(list())
  if (!is.list(filtros)) .plan_spec_abort("`filtros` debe ser lista.")

  nms <- names(filtros)
  if (length(filtros) && is.null(nms)) {
    .plan_spec_abort("`filtros` debe ser una lista nombrada por variable.")
  }
  if (!is.null(nms)) {
    if (any(!nzchar(trimws(nms)))) {
      .plan_spec_abort("`filtros` debe ser una lista nombrada por variable.")
    }
    names(filtros) <- trimws(nms)
  }

  filtros
}

.ppt_norm_chr_vec_arg <- function(x, nm) {
  if (is.null(x)) return(NULL)
  if (!is.character(x)) .plan_spec_abort("`", nm, "` debe ser NULL o character().")
  x <- trimws(as.character(x))
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return(NULL)
  unique(x)
}

#' @title Barras agrupadas (1 variable)
#' @param filtros Lista nombrada de filtros por igualdad/inclusion,
#'   por ejemplo `list(region = "Lima", sexo = c("Mujer", "Otro"))`.
#' @param mostrar_ceros Si `TRUE`, conserva opciones del instrumento con
#'   `n = 0`; si `FALSE`/`NULL`, se grafican solo categorias con casos.
#' @examples
#' p_barras_agrupadas("p102", filtros = list(region = "Lima"))
#' @family reporte
#' @export
p_barras_agrupadas <- function(var, titulo = NULL, cruces = NULL, overrides = list(), base = list(), filtros = list(), mostrar_ceros = NULL, excluir_opciones = NULL) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(cruces)) {
    if (!is.character(cruces) || length(cruces) != 1L || !nzchar(trimws(cruces))) {
      .plan_spec_abort("`cruces` debe ser NULL o character(1) no vacio.")
    }
    cruces <- trimws(cruces)
  }

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  if (!is.null(mostrar_ceros) &&
      (!is.logical(mostrar_ceros) || length(mostrar_ceros) != 1L || is.na(mostrar_ceros))) {
    .plan_spec_abort("`mostrar_ceros` debe ser NULL o logical(1).")
  }
  filtros <- .ppt_norm_filters(filtros)
  excluir_opciones <- .ppt_norm_chr_vec_arg(excluir_opciones, "excluir_opciones")

  el <- list(
    .element_type = "barras_agrupadas",
    var           = var,
    title_slide   = titulo,
    cruces        = cruces,
    mostrar_ceros = mostrar_ceros,
    excluir_opciones = excluir_opciones,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Barras categoricas
#'
#' @description
#' Grafico especial para pocas categorias (maximo 10 por defecto), con una barra
#' vertical por categoria y color propio por categoria. Puede mostrar promedio
#' en el pie cuando el graficador recibe o calcula un puntaje.
#'
#' @param var Variable categorica a resumir.
#' @param titulo Titulo opcional del elemento.
#' @param overrides Lista de overrides para `graficar_barras_categoricas()`.
#' @param base Lista de opciones de base.
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @param mostrar_ceros Si `TRUE`, conserva opciones del instrumento con `n = 0`.
#' @param excluir_opciones Opciones/codigos a ocultar antes de recalcular.
#' @param max_categorias Maximo de categorias visibles.
#' @param mostrar_promedio Si `TRUE`, intenta mostrar promedio en el pie.
#' @param ... Argumentos adicionales de conveniencia para el graficador.
#'
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_barras_categoricas <- function(
    var,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    mostrar_ceros = NULL,
    excluir_opciones = NULL,
    max_categorias = NULL,
    mostrar_promedio = NULL,
    ...
) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)
  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  extra <- list(...)
  if (length(extra)) overrides <- utils::modifyList(overrides, extra)
  if (!is.null(max_categorias)) overrides$max_categorias <- overrides$max_categorias %||% max_categorias
  if (!is.null(mostrar_promedio)) overrides$mostrar_promedio <- overrides$mostrar_promedio %||% isTRUE(mostrar_promedio)
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  if (!is.null(mostrar_ceros) &&
      (!is.logical(mostrar_ceros) || length(mostrar_ceros) != 1L || is.na(mostrar_ceros))) {
    .plan_spec_abort("`mostrar_ceros` debe ser NULL o logical(1).")
  }
  filtros <- .ppt_norm_filters(filtros)
  excluir_opciones <- .ppt_norm_chr_vec_arg(excluir_opciones, "excluir_opciones")

  el <- list(
    .element_type = "barras_categoricas",
    var           = var,
    title_slide   = titulo,
    mostrar_ceros = mostrar_ceros,
    excluir_opciones = excluir_opciones,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Barras apiladas (1 variable)
#' @param filtros Lista nombrada de filtros por igualdad/inclusion,
#'   por ejemplo `list(region = "Lima", sexo = c("Mujer", "Otro"))`.
#' @examples
#' p_barras_apiladas("p102", filtros = list(region = "Lima"))
#' @family reporte
#' @export
p_barras_apiladas <- function(var, titulo = NULL, cruces = NULL, overrides = list(), base = list(), filtros = list(), excluir_opciones = NULL) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(cruces)) {
    if (!is.character(cruces) || length(cruces) != 1L || !nzchar(trimws(cruces))) {
      .plan_spec_abort("`cruces` debe ser NULL o character(1) no vacio.")
    }
    cruces <- trimws(cruces)
  }

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)
  excluir_opciones <- .ppt_norm_chr_vec_arg(excluir_opciones, "excluir_opciones")

  el <- list(
    .element_type = "barras_apiladas",
    var           = var,
    title_slide   = titulo,
    cruces        = cruces,
    excluir_opciones = excluir_opciones,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Barras multi-apiladas (varias variables o 1 variable cruzada)
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @param bloques En `modo = "multilista"`, lista de bloques. Cada bloque debe
#'   ser una lista con al menos `modo` (`"var"`, `"cruce"` o `"var_cruce"`),
#'   y los argumentos necesarios para ese submodo (`vars`, `var`, `cruces`,
#'   `titulos_grupo`, etc.). Cada bloque puede incluir opcionalmente
#'   `altura_rel`, `overrides`, `base` y `filtros`.
#' @examples
#' p_barras_multiapiladas(
#'   modo = "cruce",
#'   var = "p102",
#'   cruces = "region",
#'   filtros = list(sexo = "Mujer")
#' )
#'
#' En `modo = "var_cruce"`, `vars` tambien puede ser una lista nombrada de
#' bloques. Cada bloque debe contener referencias `fuente$variable` cuando se
#' comparan varias bases en un mismo grafico.
#'
#' En `modo = "multilista"`, se pueden apilar varios bloques con distintas
#' escalas dentro de una sola composicion vertical.
#' @family reporte
#' @export
p_barras_multiapiladas <- function(
    modo = c("var", "cruce", "var_cruce", "multilista"),
    vars = NULL,
    bloques = NULL,
    var  = NULL,
    titulo = NULL,
    cruces = NULL,
    wrap_y = 50,
    top2box        = FALSE,
    top2box_codes  = NULL,
    top2box_labels = NULL,
    titulos_grupo  = NULL,
    numerar_oe = NULL,
    prefijo_grupos = NULL,
    overrides = list(),
    base = list(),
    filtros = list()
) {
  .ppt_as_chr_vec <- function(x, keep_names = FALSE) {
    if (is.null(x)) return(NULL)
    if (is.character(x)) return(x)
    if (is.list(x)) {
      out <- unlist(x, recursive = FALSE, use.names = keep_names)
      if (is.null(out)) return(character(0))
      out <- as.character(out)
      if (keep_names && !is.null(names(x)) && is.null(names(out))) names(out) <- names(x)
      return(out)
    }
    as.character(x)
  }

  modo <- match.arg(modo)
  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(numerar_oe) &&
      (!is.logical(numerar_oe) || length(numerar_oe) != 1L || is.na(numerar_oe))) {
    .plan_spec_abort("`numerar_oe` debe ser NULL o logical(1).")
  }

  # `numerar_oe` es el alias del control viejo; `prefijo_grupos` es el campo, y
  # la palabra que lleva es la que el estudio use para sus grupos.
  if (!is.null(prefijo_grupos) &&
      (!is.character(prefijo_grupos) || length(prefijo_grupos) != 1L || is.na(prefijo_grupos))) {
    .plan_spec_abort("`prefijo_grupos` debe ser NULL o character(1).")
  }

  if (!is.null(cruces)) {
    if (!is.character(cruces) || length(cruces) != 1L || !nzchar(trimws(cruces))) {
      .plan_spec_abort("`cruces` debe ser NULL o character(1) no vacio.")
    }
    cruces <- trimws(cruces)
  }

  if (!is.numeric(wrap_y) || length(wrap_y) != 1L || !is.finite(wrap_y) || wrap_y < 10) {
    .plan_spec_abort("`wrap_y` debe ser numerico (>=10).")
  }

  # NOTE: top2box_codes se deja por compatibilidad futura; por ahora se usa top2box_labels
  if (!is.logical(top2box) || length(top2box) != 1L || is.na(top2box)) {
    .plan_spec_abort("`top2box` debe ser logical(1).")
  }
  top2box_labels <- .ppt_as_chr_vec(top2box_labels)
  # La UI serializa un campo opcional vacio como `[]`, que jsonlite
  # reconstruye como `list()`. Semánticamente equivale a NULL: el renderer
  # debe usar las dos ultimas categorias de la escala.
  if (!is.null(top2box_labels) && !length(top2box_labels)) {
    top2box_labels <- NULL
  }
  if (!is.null(top2box_labels)) {
    if (!is.character(top2box_labels)) {
      .plan_spec_abort("`top2box_labels` debe ser NULL o character() no vacio.")
    }
    top2box_labels <- trimws(top2box_labels)
    top2box_labels <- top2box_labels[nzchar(top2box_labels)]
    if (!length(top2box_labels)) top2box_labels <- NULL
  }
  titulos_grupo <- .ppt_as_chr_vec(titulos_grupo, keep_names = TRUE)
  if (!is.null(titulos_grupo) && is.null(names(titulos_grupo)) &&
      any(grepl("=", titulos_grupo, fixed = TRUE))) {
    # El registry documenta el formato textual "clave=Titulo" (uno por
    # linea); se parsea aqui para que esa promesa sea cierta tambien fuera
    # del builder de la UI (que ya envia objeto nombrado). GOAL motor PPT P20.
    piezas <- unlist(strsplit(titulos_grupo, "\r?\n"))
    piezas <- piezas[grepl("=", piezas, fixed = TRUE)]
    claves <- trimws(sub("=.*$", "", piezas))
    valores <- trimws(sub("^[^=]*=", "", piezas))
    ok <- nzchar(claves) & nzchar(valores)
    titulos_grupo <- if (any(ok)) stats::setNames(valores[ok], claves[ok]) else NULL
  }
  if (!is.null(titulos_grupo)) {
    if (!is.character(titulos_grupo) || !length(titulos_grupo)) {
      .plan_spec_abort("`titulos_grupo` debe ser NULL o character() no vacio.")
    }
    titulos_grupo <- trimws(titulos_grupo)
    titulos_grupo <- titulos_grupo[nzchar(titulos_grupo)]
    if (!length(titulos_grupo)) {
      titulos_grupo <- NULL
    } else if (is.null(names(titulos_grupo)) || any(!nzchar(trimws(names(titulos_grupo))))) {
      .plan_spec_abort("`titulos_grupo` debe ser un vector nombrado por variable.")
    } else {
      names(titulos_grupo) <- trimws(names(titulos_grupo))
      titulos_grupo <- titulos_grupo[nzchar(names(titulos_grupo))]
      if (!length(titulos_grupo)) titulos_grupo <- NULL
    }
  }

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser una lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser una lista.")
  filtros <- .ppt_norm_filters(filtros)

  if (identical(modo, "multilista")) {
    if (!is.list(bloques) || !length(bloques)) {
      .plan_spec_abort("modo='multilista': `bloques` debe ser una lista no vacia.")
    }

    bloques_norm <- lapply(seq_along(bloques), function(i) {
      block <- bloques[[i]]
      if (!is.list(block)) {
        .plan_spec_abort("modo='multilista': cada bloque debe ser una lista.")
      }

      modo_block <- block[["modo", exact = TRUE]] %||% NULL
      if (!is.character(modo_block) || length(modo_block) != 1L || !nzchar(trimws(modo_block))) {
        .plan_spec_abort("modo='multilista': cada bloque debe definir `modo`.")
      }
      modo_block <- trimws(modo_block)
      if (identical(modo_block, "multilista")) {
        .plan_spec_abort("modo='multilista': no se permiten bloques anidados de tipo `multilista`.")
      }

      filtros_block <- utils::modifyList(filtros, .ppt_norm_filters(block[["filtros", exact = TRUE]] %||% list()))
      base_block <- utils::modifyList(base, block[["base", exact = TRUE]] %||% list())
      overrides_block <- utils::modifyList(overrides, block[["overrides", exact = TRUE]] %||% list())

      titulo_block <- .ppt_norm_text1(block[["titulo", exact = TRUE]] %||% NULL, blank = NULL)
      subtitulo_block <- .ppt_norm_text1(block[["subtitulo", exact = TRUE]] %||% NULL, blank = NULL)

      # En multilista, por defecto los subbloques NO deben heredar titulos
      # automaticos ni desde presets ni desde otros overrides. Solo se muestran
      # si el usuario los define explicitamente en el bloque.
      overrides_block$titulo <- titulo_block %||% ""
      overrides_block$subtitulo <- subtitulo_block %||% ""

      child <- p_barras_multiapiladas(
        modo = modo_block,
        vars = block[["vars", exact = TRUE]] %||% NULL,
        bloques = NULL,
        var = block[["var", exact = TRUE]] %||% NULL,
        titulo = titulo_block,
        cruces = block[["cruces", exact = TRUE]] %||% NULL,
        wrap_y = block[["wrap_y", exact = TRUE]] %||% wrap_y,
        top2box = block[["top2box", exact = TRUE]] %||% FALSE,
        top2box_codes = block[["top2box_codes", exact = TRUE]] %||% NULL,
        top2box_labels = block[["top2box_labels", exact = TRUE]] %||% NULL,
        titulos_grupo = block[["titulos_grupo", exact = TRUE]] %||% NULL,
        numerar_oe = block[["numerar_oe", exact = TRUE]] %||% numerar_oe,
        prefijo_grupos = block[["prefijo_grupos", exact = TRUE]] %||% prefijo_grupos,
        overrides = overrides_block,
        base = base_block,
        filtros = filtros_block
      )
      child$title_slide <- NULL
      child$.multilista_block_title <- titulo_block
      child$.multilista_block_subtitle <- subtitulo_block
      child$altura_rel <- block[["altura_rel", exact = TRUE]] %||% NULL
      child
    })

    el <- list(
      .element_type  = "barras_multiapiladas",
      modo           = "multilista",
      bloques        = bloques_norm,
      vars           = NULL,
      var            = NULL,
      cruce          = NULL,
      title_slide    = titulo,
      wrap_y         = wrap_y,
      top2box        = FALSE,
      top2box_codes  = NULL,
      top2box_labels = NULL,
      titulos_grupo  = NULL,
      numerar_oe     = numerar_oe,
      prefijo_grupos = prefijo_grupos,
      overrides      = overrides,
      base           = base,
      filtros        = filtros
    )
    class(el) <- c("ppt_element", "list")
    return(el)
  }

  if (identical(modo, "var")) {
    if (is.null(vars)) .plan_spec_abort("modo='var': `vars` no puede ser NULL.")
    vars <- .ppt_as_chr_vec(vars)
    if (!is.character(vars) || length(vars) < 1L) .plan_spec_abort("modo='var': `vars` debe ser character() con >= 1 variable.")
    vars <- trimws(vars)
    vars <- vars[nzchar(vars)]
    if (!length(vars)) .plan_spec_abort("modo='var': `vars` quedo vacio luego de limpiar.")

    # `titulos_grupo` es el nombre con el que el plan rotula filas en
    # `var_cruce`; en `var` el renderer lee `overrides$etiquetas_vars`. La firma
    # aceptaba el primero en TODOS los modos y en `var` lo ignoraba en silencio:
    # declarar enunciados breves —como hace el deck de acreditacion— no tenia
    # efecto y salia el label completo de la variable. Se traduce aqui, en el
    # constructor, para no tocar el renderer (congelado) y para que valga
    # tambien dentro de un bloque de `multilista`, que pasa por este mismo
    # camino. Un `etiquetas_vars` explicito manda: es el nombre nativo del modo.
    if (!is.null(titulos_grupo) && length(titulos_grupo)) {
      overrides$etiquetas_vars <- utils::modifyList(
        as.list(titulos_grupo),
        as.list(overrides$etiquetas_vars %||% character(0))
      )
    }

    el <- list(
      .element_type  = "barras_multiapiladas",
      modo           = "var",
      vars           = vars,
      var            = NULL,
      cruce          = cruces,
      title_slide    = titulo,
      wrap_y         = wrap_y,
      top2box        = isTRUE(top2box),
      top2box_codes  = top2box_codes,
      top2box_labels = top2box_labels,
      titulos_grupo  = NULL,
      numerar_oe     = numerar_oe,
      prefijo_grupos = prefijo_grupos,
      overrides      = overrides,
      base           = base,
      filtros        = filtros
    )
    class(el) <- c("ppt_element", "list")
    return(el)
  }

  if (identical(modo, "var_cruce")) {
    if (is.null(vars)) .plan_spec_abort("modo='var_cruce': `vars` no puede ser NULL.")
    if (is.character(vars)) {
      if (length(vars) < 1L) .plan_spec_abort("modo='var_cruce': `vars` debe ser character() con >= 1 variable.")
      vars <- trimws(vars)
      vars <- vars[nzchar(vars)]
      if (!length(vars)) .plan_spec_abort("modo='var_cruce': `vars` quedo vacio luego de limpiar.")

      if (is.null(cruces)) .plan_spec_abort("modo='var_cruce': `cruces` es obligatorio (character(1)).")
    } else if (is.list(vars)) {
      if (!length(vars)) .plan_spec_abort("modo='var_cruce': `vars` no puede ser una lista vacia.")
      if (is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
        .plan_spec_abort("modo='var_cruce': cuando `vars` es lista, debe ser una lista nombrada.")
      }
      names(vars) <- trimws(names(vars))
      vars <- vars[nzchar(names(vars))]
      if (!length(vars)) .plan_spec_abort("modo='var_cruce': `vars` quedo vacio luego de limpiar.")

      vars <- lapply(vars, function(x) {
        x <- .ppt_as_chr_vec(x)
        if (!is.character(x) || !length(x)) {
          .plan_spec_abort("modo='var_cruce': cada bloque de `vars` debe ser character() no vacio.")
        }
        x <- trimws(x)
        x <- x[nzchar(x)]
        if (!length(x)) {
          .plan_spec_abort("modo='var_cruce': un bloque de `vars` quedo vacio luego de limpiar.")
        }
        x
      })
    } else {
      .plan_spec_abort("modo='var_cruce': `vars` debe ser character() o lista nombrada.")
    }

    el <- list(
      .element_type  = "barras_multiapiladas",
      modo           = "var_cruce",
      vars           = vars,
      var            = NULL,
      cruce          = cruces,
      title_slide    = titulo,
      wrap_y         = wrap_y,
      top2box        = isTRUE(top2box),
      top2box_codes  = top2box_codes,
      top2box_labels = top2box_labels,
      titulos_grupo  = titulos_grupo,
      numerar_oe     = numerar_oe,
      prefijo_grupos = prefijo_grupos,
      overrides      = overrides,
      base           = base,
      filtros        = filtros
    )
    class(el) <- c("ppt_element", "list")
    return(el)
  }

  # modo == "cruce"
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("modo='cruce': `var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  if (is.null(cruces)) .plan_spec_abort("modo='cruce': `cruces` es obligatorio (character(1)).")

  el <- list(
    .element_type  = "barras_multiapiladas",
    modo           = "cruce",
    vars           = NULL,
    var            = var,
    cruce          = cruces,
    title_slide    = titulo,
    wrap_y         = wrap_y,
    top2box        = isTRUE(top2box),
    top2box_codes  = top2box_codes,
    top2box_labels = top2box_labels,
    titulos_grupo  = NULL,
    numerar_oe     = numerar_oe,
    prefijo_grupos = prefijo_grupos,
    overrides      = overrides,
    base           = base,
    filtros        = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}



#' @title Pie (torta)
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @examples
#' p_pie("p108", filtros = list(sexo = "Mujer", edad_grupo = c("60-69", "70+")))
#' @family reporte
#' @export
p_pie <- function(var, titulo = NULL, top_k = NULL, etiqueta_otros = NULL,
                  overrides = list(), base = list(), filtros = list()) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)
  # top_k/etiqueta_otros existian solo como formals del graficador: sin
  # formal aqui la UI no podia ofrecerlos (B22).
  if (!is.null(top_k) && is.null(overrides$top_k)) {
    overrides$top_k <- suppressWarnings(as.integer(top_k)[1])
  }
  if (!is.null(etiqueta_otros) && is.null(overrides$etiqueta_otros)) {
    overrides$etiqueta_otros <- as.character(etiqueta_otros)[1]
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  el <- list(
    .element_type = "pie",
    var           = var,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Donut
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @family reporte
#' @export
p_donut <- function(var, titulo = NULL, top_k = NULL, etiqueta_otros = NULL,
                  overrides = list(), base = list(), filtros = list()) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)
  # top_k/etiqueta_otros existian solo como formals del graficador: sin
  # formal aqui la UI no podia ofrecerlos (B22).
  if (!is.null(top_k) && is.null(overrides$top_k)) {
    overrides$top_k <- suppressWarnings(as.integer(top_k)[1])
  }
  if (!is.null(etiqueta_otros) && is.null(overrides$etiqueta_otros)) {
    overrides$etiqueta_otros <- as.character(etiqueta_otros)[1]
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  el <- list(
    .element_type = "donut",
    var           = var,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Nube de palabras
#' @param var Variable de texto abierto.
#' @param parent_var Variable madre que habilita la opcion Otro/Otros.
#' @param titulo Titulo opcional.
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_nube_palabras <- function(
    var,
    parent_var = NULL,
    titulo = NULL,
    max_palabras = NULL,
    min_chars = NULL,
    overrides = list(),
    base = list(),
    filtros = list()
) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)
  # La UI curaba max_palabras/min_chars pero el puente payload->constructor
  # los descartaba por no ser formals: eran controles muertos (B19).
  if (!is.null(max_palabras) && is.null(overrides$max_palabras)) {
    overrides$max_palabras <- suppressWarnings(as.integer(max_palabras)[1])
  }
  if (!is.null(min_chars) && is.null(overrides$min_chars)) {
    overrides$min_chars <- suppressWarnings(as.integer(min_chars)[1])
  }

  if (!is.null(parent_var)) {
    if (!is.character(parent_var) || length(parent_var) != 1L || !nzchar(trimws(parent_var))) {
      .plan_spec_abort("`parent_var` debe ser NULL o character(1) no vacio.")
    }
    parent_var <- trimws(parent_var)
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  el <- list(
    .element_type = "nube_palabras",
    var           = var,
    parent_var    = parent_var,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title KPI numerico
#'
#' @param var Variable base (opcional segun metrica).
#' @param metrica "mean" (default), "median", "N" o "pct". Sin cruce, `pct` es
#'   la cobertura (casos validos sobre casos de la base); con cruce, la
#'   participacion de cada grupo sobre el total valido.
#' @param cruce Variable opcional de cruce (si el renderer lo soporta).
#' @param titulo Titulo opcional.
#' @param formato Formato de salida (p.ej. `"%.0f%%"`).
#' @param overrides Lista de overrides (p.ej. `fn`, `denom`, `na_rm`).
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @examples
#' p_numerico("p118_tbc_a", cruce = "region", filtros = list(sexo = "Mujer"))
#'
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_numerico <- function(
    var = NULL,
    # H36: el orden manda el default. Era "N" mientras el motor rendia medias y
    # el registry ofrecia "mean" primero; se unifica en "mean".
    metrica = c("mean", "median", "N", "pct"),
    cruce = NULL,
    titulo = NULL,
    formato = NULL,
    overrides = list(),
    filtros = list()
) {
  metrica <- match.arg(metrica)

  if (!is.null(var)) {
    if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
      .plan_spec_abort("`var` debe ser NULL o character(1) no vacio.")
    }
    var <- trimws(var)
  }

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  titulo  <- .ppt_norm_text1(titulo,  blank = NULL)
  formato <- .ppt_norm_text1(formato, blank = NULL)

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  el <- list(
    .element_type = "numerico",
    var           = var,
    metrica       = metrica,
    cruce         = cruce,
    title_slide   = titulo,
    formato       = formato,
    overrides     = overrides,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Histograma numerico
#'
#' @param var Variable numerica a convertir en intervalos.
#' @param grupo Variable categorica opcional para apilar cada intervalo.
#' @param titulo Titulo opcional del elemento.
#' @param modo `porcentaje_total`, `porcentaje_bin` o `conteo`.
#' @param overrides Lista de overrides para `graficar_histograma()`.
#' @param base Lista de opciones de base (reservado para consistencia de API).
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @param ... Argumentos adicionales de conveniencia para `graficar_histograma()`
#'   (por ejemplo, `ancho_bin`, `bins`, `mostrar_frecuencia`). Se incorporan
#'   como `overrides`.
#'
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_histograma <- function(
    var,
    grupo = NULL,
    titulo = NULL,
    modo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    ...
) {
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  if (!is.null(grupo)) {
    if (!is.character(grupo) || length(grupo) != 1L || !nzchar(trimws(grupo))) {
      .plan_spec_abort("`grupo` debe ser NULL o character(1) no vacio.")
    }
    grupo <- trimws(grupo)
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  extra <- list(...)
  if (length(extra)) overrides <- utils::modifyList(overrides, extra)
  if (!is.null(modo)) {
    modo <- match.arg(modo, c("porcentaje_total", "porcentaje_bin", "conteo"))
    overrides$modo <- overrides$modo %||% modo
  }
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  el <- list(
    .element_type = "histograma",
    var           = var,
    grupo         = grupo,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Boxplot numerico por categoria
#'
#' @param var Variable numerica a resumir en el boxplot.
#' @param cruce Variable categorica opcional para segmentar cajas.
#' @param decimales_promedio Entero opcional para el chip de promedio:
#'   solo permite `0`, `1` o `2` decimales.
#' @param tamano_promedio Tamano de texto opcional para el chip del promedio.
#'   Se mapea a `size_media` del graficador y debe ser numerico positivo.
#' @param cortes_chip Cortes semaforicos para clasificar el promedio en chip
#'   (`rojo`/`ambar`/`verde`). Debe tener al menos 2 valores numericos.
#' @param chip_colores Colores del chip semaforico. Puede ser un vector
#'   nombrado con `rojo`, `ambar`, `verde`, o un vector de largo 3 en ese orden.
#' @param titulo Titulo opcional del elemento.
#' @param overrides Lista de overrides para el renderer/graficador.
#' @param base Lista de opciones de base (reservado para consistencia de API).
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @param ... Argumentos adicionales de conveniencia para `graficar_boxplot()`
#'   (por ejemplo, `mostrar_puntos`, `mostrar_media`, `orientacion`). Se
#'   incorporan como `overrides`.
#'
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_boxplot <- function(
    var,
    cruce = NULL,
    decimales_promedio = NULL,
    tamano_promedio = NULL,
    cortes_chip = NULL,
    modo_semaforo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    chip_colores = NULL,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    ...
) {
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  if (!is.null(decimales_promedio)) {
    decimales_promedio <- suppressWarnings(as.integer(decimales_promedio)[1])
    if (!is.finite(decimales_promedio) || is.na(decimales_promedio) || !(decimales_promedio %in% 0:2)) {
      .plan_spec_abort("`decimales_promedio` debe ser NULL o entero en {0, 1, 2}.")
    }
  }
  if (!is.null(tamano_promedio)) {
    tamano_promedio <- suppressWarnings(as.numeric(tamano_promedio)[1])
    if (!is.finite(tamano_promedio) || is.na(tamano_promedio) || tamano_promedio <= 0) {
      .plan_spec_abort("`tamano_promedio` debe ser NULL o numerico positivo.")
    }
  }
  if (!is.null(cortes_chip)) {
    cortes_chip <- suppressWarnings(as.numeric(cortes_chip))
    cortes_chip <- cortes_chip[is.finite(cortes_chip)]
    if (length(cortes_chip) < 2L) {
      .plan_spec_abort("`cortes_chip` debe ser NULL o numerico con al menos 2 valores.")
    }
    cortes_chip <- sort(unique(cortes_chip))[1:2]
  }
  if (!is.null(chip_colores)) {
    if (!is.atomic(chip_colores) || !length(chip_colores)) {
      .plan_spec_abort("`chip_colores` debe ser NULL o vector atomico no vacio.")
    }
    chip_colores <- as.character(chip_colores)
    if (length(chip_colores) < 3L) {
      nms <- names(chip_colores)
      ok_nms <- !is.null(nms) && all(c("rojo", "ambar", "verde") %in% tolower(trimws(as.character(nms))))
      if (!ok_nms) {
        .plan_spec_abort("`chip_colores` debe tener largo >= 3 o nombres rojo/ambar/verde.")
      }
    }
  }

  dots <- list(...)
  if (length(dots)) {
    overrides <- modifyList(dots, overrides)
  }
  if (!is.null(decimales_promedio) && is.null(overrides$chip_decimales)) {
    overrides$chip_decimales <- decimales_promedio
  }
  if (!is.null(tamano_promedio) && is.null(overrides$size_media)) {
    overrides$size_media <- tamano_promedio
  }
  if (!is.null(cortes_chip) && is.null(overrides$cortes_chip)) {
    overrides$cortes_chip <- cortes_chip
  }
  if (is.null(overrides$modo_semaforo)) {
    overrides$modo_semaforo <- modo_semaforo
  }
  if (!is.null(chip_colores) && is.null(overrides$chip_colores)) {
    overrides$chip_colores <- chip_colores
  }

  el <- list(
    .element_type = "boxplot",
    var           = var,
    cruce         = cruce,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Media + rango por categorias
#' @param ... Argumentos adicionales de conveniencia para `graficar_media_rango()`
#'   (por ejemplo, `tipo_rango`, `limites_y`, `mostrar_chip`). Se incorporan
#'   como `overrides`.
#'
#' @return Objeto `"ppt_element"`.
#' @family reporte
#' @export
p_media_rango <- function(
    var,
    cruce = NULL,
    decimales_promedio = NULL,
    tamano_promedio = NULL,
    mostrar_ref_label = NULL,
    cortes_chip = NULL,
    modo_semaforo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    chip_colores = NULL,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    ...
) {
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    .plan_spec_abort("`var` debe ser character(1) no vacio.")
  }
  var <- trimws(var)

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  filtros <- .ppt_norm_filters(filtros)

  if (!is.null(decimales_promedio)) {
    decimales_promedio <- suppressWarnings(as.integer(decimales_promedio)[1])
    if (!is.finite(decimales_promedio) || is.na(decimales_promedio) || !(decimales_promedio %in% 0:2)) {
      .plan_spec_abort("`decimales_promedio` debe ser NULL o entero en {0, 1, 2}.")
    }
  }
  if (!is.null(tamano_promedio)) {
    tamano_promedio <- suppressWarnings(as.numeric(tamano_promedio)[1])
    if (!is.finite(tamano_promedio) || is.na(tamano_promedio) || tamano_promedio <= 0) {
      .plan_spec_abort("`tamano_promedio` debe ser NULL o numerico positivo.")
    }
  }
  if (!is.null(mostrar_ref_label) && !isTRUE(mostrar_ref_label) && !identical(mostrar_ref_label, FALSE)) {
    .plan_spec_abort("`mostrar_ref_label` debe ser NULL, TRUE o FALSE.")
  }
  if (!is.null(cortes_chip)) {
    cortes_chip <- suppressWarnings(as.numeric(cortes_chip))
    cortes_chip <- cortes_chip[is.finite(cortes_chip)]
    if (length(cortes_chip) < 2L) {
      .plan_spec_abort("`cortes_chip` debe ser NULL o numerico con al menos 2 valores.")
    }
    cortes_chip <- sort(unique(cortes_chip))[1:2]
  }
  if (!is.null(chip_colores)) {
    if (!is.atomic(chip_colores) || !length(chip_colores)) {
      .plan_spec_abort("`chip_colores` debe ser NULL o vector atomico no vacio.")
    }
    chip_colores <- as.character(chip_colores)
    if (length(chip_colores) < 3L) {
      nms <- names(chip_colores)
      ok_nms <- !is.null(nms) && all(c("rojo", "ambar", "verde") %in% tolower(trimws(as.character(nms))))
      if (!ok_nms) {
        .plan_spec_abort("`chip_colores` debe tener largo >= 3 o nombres rojo/ambar/verde.")
      }
    }
  }

  dots <- list(...)
  if (length(dots)) {
    overrides <- modifyList(dots, overrides)
  }
  if (!is.null(decimales_promedio) && is.null(overrides$chip_decimales)) {
    overrides$chip_decimales <- decimales_promedio
  }
  if (!is.null(tamano_promedio) && is.null(overrides$size_media)) {
    overrides$size_media <- tamano_promedio
  }
  if (!is.null(mostrar_ref_label) && is.null(overrides$mostrar_ref_label)) {
    overrides$mostrar_ref_label <- isTRUE(mostrar_ref_label)
  }
  if (!is.null(cortes_chip) && is.null(overrides$cortes_chip)) {
    overrides$cortes_chip <- cortes_chip
  }
  if (is.null(overrides$modo_semaforo)) {
    overrides$modo_semaforo <- modo_semaforo
  }
  if (!is.null(chip_colores) && is.null(overrides$chip_colores)) {
    overrides$chip_colores <- chip_colores
  }

  el <- list(
    .element_type = "media_rango",
    var           = var,
    cruce         = cruce,
    title_slide   = titulo,
    overrides     = overrides,
    base          = base,
    filtros       = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Radar + tabla derecha (SM o Top/Bottom 2 Box)
#' @param filtros Lista nombrada de filtros por igualdad/inclusion.
#' @family reporte
#' @export
p_radar_tabla <- function(
    modo = c("sm", "box"),
    var  = NULL,
    vars = NULL,
    cruce = NULL,
    box_labels = NULL,
    titulo_tabla = NULL,
    colores_series = NULL,
    titulo = NULL,
    top_n = NULL,
    sm_omit_codes  = NULL,
    sm_omit_labels = NULL,
    sm_omit_na     = TRUE,
    overrides = list(),
    base = list(),
    filtros = list()
) {
  modo <- match.arg(modo)

  if (identical(modo, "sm")) {
    if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
      .plan_spec_abort("p_radar_tabla(modo='sm'): `var` debe ser character(1) no vacio.")
    }
    var <- trimws(var)
    if (!is.null(vars)) .plan_spec_abort("p_radar_tabla(modo='sm'): no usar `vars`.")
  }

  if (identical(modo, "box")) {
    if (is.character(vars)) {
      if (length(vars) < 1L) {
        .plan_spec_abort("p_radar_tabla(modo='box'): `vars` debe ser character() con >=1 variable.")
      }
      vars <- trimws(vars); vars <- vars[nzchar(vars)]
      if (!length(vars)) .plan_spec_abort("p_radar_tabla(modo='box'): `vars` quedo vacio.")
    } else if (is.list(vars)) {
      if (!length(vars)) {
        .plan_spec_abort("p_radar_tabla(modo='box'): `vars` no puede ser una lista vacia.")
      }
      if (is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
        .plan_spec_abort("p_radar_tabla(modo='box'): cuando `vars` es lista, debe ser una lista nombrada.")
      }
      names(vars) <- trimws(names(vars))
      vars <- vars[nzchar(names(vars))]
      if (!length(vars)) .plan_spec_abort("p_radar_tabla(modo='box'): `vars` quedo vacio luego de limpiar.")

      vars <- lapply(vars, function(x) {
        if (!is.character(x) || !length(x)) {
          .plan_spec_abort("p_radar_tabla(modo='box'): cada bloque de `vars` debe ser character() no vacio.")
        }
        x <- trimws(x)
        x <- x[nzchar(x)]
        if (!length(x)) {
          .plan_spec_abort("p_radar_tabla(modo='box'): un bloque de `vars` quedo vacio luego de limpiar.")
        }
        x
      })
    } else {
      .plan_spec_abort("p_radar_tabla(modo='box'): `vars` debe ser character() o lista nombrada.")
    }

    if (!is.null(var)) .plan_spec_abort("p_radar_tabla(modo='box'): no usar `var`.")

    if (!is.character(box_labels) || length(box_labels) != 2L) {
      .plan_spec_abort("p_radar_tabla(modo='box'): `box_labels` debe ser character(2).")
    }
    box_labels <- as.character(box_labels)
  }

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  titulo <- .ppt_norm_text1(titulo, blank = NULL)

  if (!is.null(top_n)) {
    if (!is.numeric(top_n) || length(top_n) != 1L || !is.finite(top_n) || top_n < 3) {
      .plan_spec_abort("`top_n` debe ser numerico >= 3 (o NULL).")
    }
    top_n <- as.integer(top_n)
  }

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  if (!is.null(colores_series)) {
    if (!is.atomic(colores_series) || is.null(names(colores_series))) {
      .plan_spec_abort("`colores_series` debe ser NULL o un vector nombrado.")
    }
  }
  filtros <- .ppt_norm_filters(filtros)

  if (is.null(titulo_tabla) || !nzchar(trimws(as.character(titulo_tabla)))) {
    titulo_tabla <- if (identical(modo, "sm")) "Opciones" else "Top 2 Box"
  }

  el <- list(
    .element_type   = "radar_tabla",
    modo            = modo,
    var             = var,
    vars            = vars,
    cruce           = cruce,
    box_labels      = box_labels,
    colores_series  = colores_series,
    sm_omit_codes   = sm_omit_codes,
    sm_omit_labels  = sm_omit_labels,
    sm_omit_na      = sm_omit_na,
    titulo_tabla    = as.character(titulo_tabla)[1],
    title_slide     = titulo,
    top_n           = top_n,
    overrides       = overrides,
    base            = base,
    filtros         = filtros
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Heatmap de dimensiones
#' @family reporte
#' @export
p_dim_heatmap <- function(
    modo = c("general", "indicadores"),
    objetivo,
    cruce = NULL,
    incluir_total = NULL,
    modo_semaforo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    brecha_filas = FALSE,
    etiq_brecha_filas = "Brecha",
    brecha_cols = FALSE,
    etiq_brecha_cols = "Brecha",
    aplicar_gradiente_brecha = TRUE,
    brecha_colores = c(bajo = "#FFFFFF", alto = "#F4B183"),
    brecha_cortes = c(0, 30),
    size_ejes_x = NULL,
    titulo_total_x = "Total",
    titulo_total_y = "Total cruce",
    mostrar_n_cruce_x = FALSE,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    overrides = list(),
    base = list()
) {
  modo <- match.arg(modo)
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)

  if (!is.character(objetivo) || length(objetivo) != 1L || !nzchar(trimws(objetivo))) {
    .plan_spec_abort("`objetivo` debe ser character(1) no vacio.")
  }
  objetivo <- trimws(objetivo)

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  if (!is.null(iter_var)) {
    if (!is.character(iter_var) || length(iter_var) != 1L || !nzchar(trimws(iter_var))) {
      .plan_spec_abort("`iter_var` debe ser NULL o character(1) no vacio.")
    }
    iter_var <- trimws(iter_var)
  }

  if (!is.null(iter_level)) {
    if (!is.character(iter_level) || length(iter_level) != 1L || !nzchar(trimws(iter_level))) {
      .plan_spec_abort("`iter_level` debe ser NULL o character(1) no vacio.")
    }
    iter_level <- trimws(iter_level)
  }

  if (!is.null(incluir_total)) {
    if (!is.logical(incluir_total) || length(incluir_total) != 1L || is.na(incluir_total)) {
      .plan_spec_abort("`incluir_total` debe ser NULL o logical(1).")
    }
  }
  if (!is.logical(brecha_filas) || length(brecha_filas) != 1L || is.na(brecha_filas)) {
    .plan_spec_abort("`brecha_filas` debe ser logical(1).")
  }
  if (!is.logical(brecha_cols) || length(brecha_cols) != 1L || is.na(brecha_cols)) {
    .plan_spec_abort("`brecha_cols` debe ser logical(1).")
  }
  if (!is.logical(aplicar_gradiente_brecha) || length(aplicar_gradiente_brecha) != 1L || is.na(aplicar_gradiente_brecha)) {
    .plan_spec_abort("`aplicar_gradiente_brecha` debe ser logical(1).")
  }

  etiq_brecha_filas <- .ppt_norm_text1(etiq_brecha_filas, blank = "Brecha")
  etiq_brecha_cols <- .ppt_norm_text1(etiq_brecha_cols, blank = "Brecha")

  brecha_colores <- as.character(brecha_colores)
  if (!length(brecha_colores)) brecha_colores <- c(bajo = "#FFFFFF", alto = "#F4B183")

  brecha_cortes <- suppressWarnings(as.numeric(brecha_cortes))
  brecha_cortes <- brecha_cortes[is.finite(brecha_cortes) & !is.na(brecha_cortes)]
  if (length(brecha_cortes) < 2L) brecha_cortes <- c(0, 30)
  brecha_cortes <- sort(brecha_cortes)[1:2]

  if (!is.null(size_ejes_x)) {
    size_ejes_x <- suppressWarnings(as.numeric(size_ejes_x))
    if (!is.finite(size_ejes_x) || is.na(size_ejes_x) || size_ejes_x <= 0) {
      .plan_spec_abort("`size_ejes_x` debe ser NULL o numerico positivo.")
    }
  }
  titulo_total_x <- .ppt_norm_text1(titulo_total_x, blank = "Total")
  titulo_total_y <- .ppt_norm_text1(titulo_total_y, blank = "Total cruce")
  if (!is.logical(mostrar_n_cruce_x) || length(mostrar_n_cruce_x) != 1L || is.na(mostrar_n_cruce_x)) {
    .plan_spec_abort("`mostrar_n_cruce_x` debe ser logical(1).")
  }

  filtros <- .ppt_norm_filters(filtros)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  if (is.null(overrides$modo_semaforo)) overrides$modo_semaforo <- modo_semaforo

  el <- list(
    .element_type = "dim_heatmap",
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    modo_semaforo = modo_semaforo,
    brecha_filas = isTRUE(brecha_filas),
    etiq_brecha_filas = as.character(etiq_brecha_filas)[1],
    brecha_cols = isTRUE(brecha_cols),
    etiq_brecha_cols = as.character(etiq_brecha_cols)[1],
    aplicar_gradiente_brecha = isTRUE(aplicar_gradiente_brecha),
    brecha_colores = brecha_colores,
    brecha_cortes = brecha_cortes,
    size_ejes_x = size_ejes_x,
    titulo_total_x = as.character(titulo_total_x)[1],
    titulo_total_y = as.character(titulo_total_y)[1],
    mostrar_n_cruce_x = isTRUE(mostrar_n_cruce_x),
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level,
    title_slide = .ppt_norm_text1(titulo, blank = NULL),
    overrides = overrides,
    base = base
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Heatmap de criterios por conductor
#' @family reporte
#' @export
p_dim_heatmap_criterios <- function(
    config_criterios,
    titulo = NULL,
    overrides = list(),
    base = list(),
    source = NULL
) {
  if (!is.list(config_criterios) || !length(config_criterios)) {
    .plan_spec_abort("`config_criterios` debe ser una lista no vacia.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  vars_flat <- unlist(lapply(config_criterios, function(cfg) cfg$vars %||% character(0)), use.names = FALSE)
  vars_flat <- as.character(vars_flat)
  vars_flat <- vars_flat[!is.na(vars_flat) & nzchar(trimws(vars_flat))]
  if (!length(vars_flat)) {
    .plan_spec_abort("`config_criterios` debe incluir al menos una variable en `vars`.")
  }

  el <- list(
    .element_type = "dim_heatmap_criterios",
    config_criterios = config_criterios,
    vars = vars_flat,
    source = source,
    title_slide = .ppt_norm_text1(titulo, blank = NULL),
    overrides = overrides,
    base = base
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Radar de dimensiones con fallback automatico a barras
#' @family reporte
#' @export
p_dim_radar <- function(
    modo = c("general", "indicadores"),
    objetivo,
    cruce = NULL,
    incluir_total = NULL,
    radar_min_ejes = NULL,
    inicio_eje_pct = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    overrides = list(),
    base = list()
) {
  modo <- match.arg(modo)

  if (!is.character(objetivo) || length(objetivo) != 1L || !nzchar(trimws(objetivo))) {
    .plan_spec_abort("`objetivo` debe ser character(1) no vacio.")
  }
  objetivo <- trimws(objetivo)

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  if (!is.null(iter_var)) {
    if (!is.character(iter_var) || length(iter_var) != 1L || !nzchar(trimws(iter_var))) {
      .plan_spec_abort("`iter_var` debe ser NULL o character(1) no vacio.")
    }
    iter_var <- trimws(iter_var)
  }

  if (!is.null(iter_level)) {
    if (!is.character(iter_level) || length(iter_level) != 1L || !nzchar(trimws(iter_level))) {
      .plan_spec_abort("`iter_level` debe ser NULL o character(1) no vacio.")
    }
    iter_level <- trimws(iter_level)
  }

  if (!is.null(incluir_total)) {
    if (!is.logical(incluir_total) || length(incluir_total) != 1L || is.na(incluir_total)) {
      .plan_spec_abort("`incluir_total` debe ser NULL o logical(1).")
    }
  }

  if (!is.null(inicio_eje_pct)) {
    inicio_eje_pct <- suppressWarnings(as.numeric(inicio_eje_pct)[1])
    if (!is.finite(inicio_eje_pct) || inicio_eje_pct < 0 || inicio_eje_pct >= 100) {
      .plan_spec_abort("`inicio_eje_pct` debe ser NULL o un numero en [0, 100).")
    }
  }

  filtros <- .ppt_norm_filters(filtros)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  if (!is.null(radar_min_ejes)) {
    radar_min_ejes <- suppressWarnings(as.integer(radar_min_ejes)[1])
    if (!is.finite(radar_min_ejes) || is.na(radar_min_ejes) || radar_min_ejes < 1L) {
      .plan_spec_abort("`radar_min_ejes` debe ser NULL o entero >= 1.")
    }
  }

  el <- list(
    .element_type = "dim_radar",
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    radar_min_ejes = radar_min_ejes,
    inicio_eje_pct = inicio_eje_pct,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level,
    title_slide = .ppt_norm_text1(titulo, blank = NULL),
    overrides = overrides,
    base = base
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Comparativo radar/barras de dimensiones
#' @family reporte
#' @export
p_dim_comparativo_radarbar <- function(
    modo = c("general", "indicadores"),
    objetivo,
    cruce = NULL,
    incluir_total = FALSE,
    radar_min_ejes = 5L,
    inicio_eje_pct = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    overrides = list(),
    base = list()
) {
  modo <- match.arg(modo)

  if (!is.character(objetivo) || length(objetivo) != 1L || !nzchar(trimws(objetivo))) {
    .plan_spec_abort("`objetivo` debe ser character(1) no vacio.")
  }
  objetivo <- trimws(objetivo)

  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }

  if (!is.null(iter_var)) {
    if (!is.character(iter_var) || length(iter_var) != 1L || !nzchar(trimws(iter_var))) {
      .plan_spec_abort("`iter_var` debe ser NULL o character(1) no vacio.")
    }
    iter_var <- trimws(iter_var)
  }

  if (!is.null(iter_level)) {
    if (!is.character(iter_level) || length(iter_level) != 1L || !nzchar(trimws(iter_level))) {
      .plan_spec_abort("`iter_level` debe ser NULL o character(1) no vacio.")
    }
    iter_level <- trimws(iter_level)
  }

  if (!is.null(incluir_total)) {
    if (!is.logical(incluir_total) || length(incluir_total) != 1L || is.na(incluir_total)) {
      .plan_spec_abort("`incluir_total` debe ser NULL o logical(1).")
    }
  }

  radar_min_ejes <- suppressWarnings(as.integer(radar_min_ejes)[1])
  if (!is.finite(radar_min_ejes) || is.na(radar_min_ejes) || radar_min_ejes < 1L) {
    .plan_spec_abort("`radar_min_ejes` debe ser entero >= 1.")
  }

  if (!is.null(inicio_eje_pct)) {
    inicio_eje_pct <- suppressWarnings(as.numeric(inicio_eje_pct)[1])
    if (!is.finite(inicio_eje_pct) || inicio_eje_pct < 0 || inicio_eje_pct >= 100) {
      .plan_spec_abort("`inicio_eje_pct` debe ser NULL o un numero en [0, 100).")
    }
  }

  filtros <- .ppt_norm_filters(filtros)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  el <- list(
    .element_type = "dim_comparativo_radarbar",
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    radar_min_ejes = radar_min_ejes,
    inicio_eje_pct = inicio_eje_pct,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level,
    titulo = titulo,
    overrides = overrides,
    base = base
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title Matriz FODA de dimensiones
#' @family reporte
#' @export
p_dim_foda <- function(
    nivel = c("subindices", "indicadores"),
    objetivo = NULL,
    modo_foda = c("matriz", "dispersion"),
    source = NULL,
    cruce = NULL,
    incluir_total = TRUE,
    solo_indice_general_cruce = FALSE,
    filtros = list(),
    usar_pesos = TRUE,
    ancho_tarjeta_base_rel = 0.72,
    factor_ancho_matriz = 1.00,
    factor_ancho_dispersion = 0.72,
    ancho_recuadro_rel = NULL,
    ancho_recuadro_auto = FALSE,
    ancho_chip_rel = 0.18,
    sufijo_puntaje = " pts",
    cortes_chip = NULL,
    corte_score = NULL,
    modo_semaforo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    tamano_texto_tarjeta = NULL,
    tamano_letra_recuadro = NULL,
    tamano_texto_chip = NULL,
    tarjetas_color_solido = TRUE,
    titulos_areas_foda = NULL,
    mostrar_subtitulo_area = TRUE,
    sd_tecnico = TRUE,
    color_indice_total = "#FF6A00",
    disposicion_recuadro = c("dos_lineas", "una_linea", "sin_cruce"),
    etiqueta_cruce_en_dos_lineas = NULL,
    jitter_x_rel = 0.06,
    jitter_y_rel = 0.03,
    iter_separacion = 12L,
    factor_reduccion_tarjeta_dispersion = 0.85,
    chip_width_rel = NULL,
    score_suffix = NULL,
    titulo = NULL,
    overrides = list(),
    base = list()
) {
  nivel <- match.arg(nivel)
  modo_foda <- match.arg(modo_foda)
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)
  disposicion_recuadro <- as.character(disposicion_recuadro %||% "dos_lineas")[1]
  # `corte_score` es obligatorio en modo_foda='dispersion' (viaja al
  # graficador via overrides; sin formal la UI no podia ofrecerlo).
  if (!is.null(corte_score) && is.null(overrides$corte_score)) {
    overrides$corte_score <- suppressWarnings(as.numeric(corte_score)[1])
  }

  if (!is.null(objetivo)) {
    if (!is.character(objetivo) || length(objetivo) != 1L || !nzchar(trimws(objetivo))) {
      .plan_spec_abort("`objetivo` debe ser NULL o character(1) no vacio.")
    }
    objetivo <- trimws(objetivo)
  }

  if (identical(nivel, "indicadores") && (is.null(objetivo) || !nzchar(objetivo))) {
    .plan_spec_abort("`objetivo` es requerido cuando `nivel = 'indicadores'`.")
  }
  if (!is.null(source)) {
    if (!is.character(source) || length(source) != 1L || !nzchar(trimws(source))) {
      .plan_spec_abort("`source` debe ser NULL o character(1) no vacio.")
    }
    source <- trimws(source)
  }
  if (!is.null(cruce)) {
    if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
      .plan_spec_abort("`cruce` debe ser NULL o character(1) no vacio.")
    }
    cruce <- trimws(cruce)
  }
  if (identical(modo_foda, "matriz") && !is.null(cruce)) {
    .plan_spec_abort("`cruce` solo se admite con `modo_foda = 'dispersion'`.")
  }
  if (!is.logical(incluir_total) || length(incluir_total) != 1L || is.na(incluir_total)) {
    .plan_spec_abort("`incluir_total` debe ser logical(1).")
  }
  if (!is.logical(solo_indice_general_cruce) || length(solo_indice_general_cruce) != 1L || is.na(solo_indice_general_cruce)) {
    .plan_spec_abort("`solo_indice_general_cruce` debe ser logical(1).")
  }

  if (!is.logical(usar_pesos) || length(usar_pesos) != 1L || is.na(usar_pesos)) {
    .plan_spec_abort("`usar_pesos` debe ser logical(1).")
  }
  if (!is.null(chip_width_rel)) ancho_chip_rel <- chip_width_rel
  if (!is.null(score_suffix)) sufijo_puntaje <- score_suffix

  ancho_tarjeta_base_rel <- suppressWarnings(as.numeric(ancho_tarjeta_base_rel)[1])
  if (!is.finite(ancho_tarjeta_base_rel) || is.na(ancho_tarjeta_base_rel) || ancho_tarjeta_base_rel <= 0) {
    .plan_spec_abort("`ancho_tarjeta_base_rel` debe ser numerico positivo.")
  }
  factor_ancho_matriz <- suppressWarnings(as.numeric(factor_ancho_matriz)[1])
  if (!is.finite(factor_ancho_matriz) || is.na(factor_ancho_matriz) || factor_ancho_matriz <= 0) {
    .plan_spec_abort("`factor_ancho_matriz` debe ser numerico positivo.")
  }
  factor_ancho_dispersion <- suppressWarnings(as.numeric(factor_ancho_dispersion)[1])
  if (!is.finite(factor_ancho_dispersion) || is.na(factor_ancho_dispersion) || factor_ancho_dispersion <= 0) {
    .plan_spec_abort("`factor_ancho_dispersion` debe ser numerico positivo.")
  }
  if (!is.null(ancho_recuadro_rel)) {
    ancho_recuadro_rel <- suppressWarnings(as.numeric(ancho_recuadro_rel)[1])
    if (!is.finite(ancho_recuadro_rel) || is.na(ancho_recuadro_rel) || ancho_recuadro_rel <= 0) {
      .plan_spec_abort("`ancho_recuadro_rel` debe ser NULL o numerico positivo.")
    }
  }
  if (!is.logical(ancho_recuadro_auto) || length(ancho_recuadro_auto) != 1L || is.na(ancho_recuadro_auto)) {
    .plan_spec_abort("`ancho_recuadro_auto` debe ser logical(1).")
  }
  ancho_chip_rel <- suppressWarnings(as.numeric(ancho_chip_rel)[1])
  if (!is.finite(ancho_chip_rel) || is.na(ancho_chip_rel) || ancho_chip_rel <= 0) {
    .plan_spec_abort("`ancho_chip_rel` debe ser numerico positivo.")
  }
  sufijo_puntaje <- as.character(sufijo_puntaje %||% " pts")[1]
  if (is.na(sufijo_puntaje)) sufijo_puntaje <- " pts"
  if (!is.null(tamano_letra_recuadro)) tamano_texto_tarjeta <- tamano_letra_recuadro
  if (!is.null(cortes_chip)) {
    cortes_chip <- suppressWarnings(as.numeric(cortes_chip))
    cortes_chip <- cortes_chip[is.finite(cortes_chip)]
    if (length(cortes_chip) < 2L) {
      .plan_spec_abort("`cortes_chip` debe ser NULL o numerico con al menos 2 valores.")
    }
    cortes_chip <- sort(unique(cortes_chip))[1:2]
  }
  if (!is.null(tamano_texto_tarjeta)) {
    tamano_texto_tarjeta <- suppressWarnings(as.numeric(tamano_texto_tarjeta)[1])
    if (!is.finite(tamano_texto_tarjeta) || is.na(tamano_texto_tarjeta) || tamano_texto_tarjeta <= 0) {
      .plan_spec_abort("`tamano_texto_tarjeta` debe ser NULL o numerico positivo.")
    }
  }
  if (!is.null(tamano_texto_chip)) {
    tamano_texto_chip <- suppressWarnings(as.numeric(tamano_texto_chip)[1])
    if (!is.finite(tamano_texto_chip) || is.na(tamano_texto_chip) || tamano_texto_chip <= 0) {
      .plan_spec_abort("`tamano_texto_chip` debe ser NULL o numerico positivo.")
    }
  }
  if (!is.logical(tarjetas_color_solido) || length(tarjetas_color_solido) != 1L || is.na(tarjetas_color_solido)) {
    .plan_spec_abort("`tarjetas_color_solido` debe ser logical(1).")
  }
  if (!is.logical(mostrar_subtitulo_area) || length(mostrar_subtitulo_area) != 1L || is.na(mostrar_subtitulo_area)) {
    .plan_spec_abort("`mostrar_subtitulo_area` debe ser logical(1).")
  }
  if (!is.logical(sd_tecnico) || length(sd_tecnico) != 1L || is.na(sd_tecnico)) {
    .plan_spec_abort("`sd_tecnico` debe ser logical(1).")
  }
  if (!is.null(etiqueta_cruce_en_dos_lineas)) {
    if (!is.logical(etiqueta_cruce_en_dos_lineas) || length(etiqueta_cruce_en_dos_lineas) != 1L || is.na(etiqueta_cruce_en_dos_lineas)) {
      .plan_spec_abort("`etiqueta_cruce_en_dos_lineas` debe ser NULL o logical(1).")
    }
    disposicion_recuadro <- if (isTRUE(etiqueta_cruce_en_dos_lineas)) "dos_lineas" else "una_linea"
  }
  if (!nzchar(disposicion_recuadro) || is.na(disposicion_recuadro)) disposicion_recuadro <- "dos_lineas"
  disposicion_recuadro <- match.arg(disposicion_recuadro, c("dos_lineas", "una_linea", "sin_cruce"))
  color_indice_total <- as.character(color_indice_total %||% "#FF6A00")[1]
  if (!nzchar(trimws(color_indice_total)) || is.na(color_indice_total)) {
    .plan_spec_abort("`color_indice_total` debe ser character(1) no vacio.")
  }
  if (!is.null(titulos_areas_foda)) {
    if (!is.character(titulos_areas_foda) || !length(titulos_areas_foda)) {
      .plan_spec_abort("`titulos_areas_foda` debe ser NULL o un vector character.")
    }
    nms_orig_foda <- names(titulos_areas_foda)
    titulos_areas_foda <- as.character(titulos_areas_foda)
    # as.character() pela los nombres: sin restaurarlos, todo vector nombrado
    # caia a la rama sin-nombres y abortaba con menos de 4 valores.
    if (!is.null(nms_orig_foda)) names(titulos_areas_foda) <- nms_orig_foda
    llaves <- c("fortaleza", "oportunidad", "debilidad", "amenaza")
    # Formato textual del textarea de la UI: lineas "cuadrante=Titulo".
    if (length(titulos_areas_foda) == 1L && grepl("=", titulos_areas_foda, fixed = TRUE)) {
      lineas <- strsplit(titulos_areas_foda, "\n", fixed = TRUE)[[1]]
      lineas <- trimws(lineas)
      lineas <- lineas[nzchar(lineas) & grepl("=", lineas, fixed = TRUE)]
      if (length(lineas)) {
        kv_k <- trimws(sub("=.*$", "", lineas))
        kv_v <- trimws(sub("^[^=]*=", "", lineas))
        keep <- nzchar(kv_k) & nzchar(kv_v)
        titulos_areas_foda <- stats::setNames(kv_v[keep], kv_k[keep])
      }
    }
    nms_raw <- names(titulos_areas_foda %||% character(0))
    if (!is.null(nms_raw)) {
      # Tolerar plurales y alias frecuentes: antes se ignoraban en silencio.
      alias <- c(fortalezas = "fortaleza", oportunidades = "oportunidad",
                 debilidades = "debilidad", amenazas = "amenaza")
      nml <- tolower(trimws(nms_raw))
      hit_alias <- nml %in% names(alias)
      nms_raw[hit_alias] <- unname(alias[nml[hit_alias]])
      names(titulos_areas_foda) <- nms_raw
    }
    nms <- names(titulos_areas_foda %||% character(0))
    if (is.null(nms) || !any(nzchar(trimws(nms)))) {
      if (length(titulos_areas_foda) < 4L) {
        .plan_spec_abort("`titulos_areas_foda` debe tener 4 valores o venir nombrado por cuadrante.")
      }
      titulos_areas_foda <- titulos_areas_foda[seq_along(llaves)]
      names(titulos_areas_foda) <- llaves
    } else {
      nms <- tolower(trimws(as.character(nms)))
      out <- setNames(rep(NA_character_, length(llaves)), llaves)
      for (k in llaves) {
        hit <- which(nms == k)
        if (length(hit)) out[[k]] <- titulos_areas_foda[hit[1]]
      }
      if (all(is.na(out))) {
        .plan_spec_abort("`titulos_areas_foda` nombrado debe usar: fortaleza, oportunidad, debilidad, amenaza.")
      }
      titulos_areas_foda <- out
    }
  }
  jitter_x_rel <- suppressWarnings(as.numeric(jitter_x_rel)[1])
  if (!is.finite(jitter_x_rel) || is.na(jitter_x_rel) || jitter_x_rel < 0) {
    .plan_spec_abort("`jitter_x_rel` debe ser numerico en [0, +Inf).")
  }
  jitter_y_rel <- suppressWarnings(as.numeric(jitter_y_rel)[1])
  if (!is.finite(jitter_y_rel) || is.na(jitter_y_rel) || jitter_y_rel < 0) {
    .plan_spec_abort("`jitter_y_rel` debe ser numerico en [0, +Inf).")
  }
  iter_separacion <- suppressWarnings(as.integer(iter_separacion)[1])
  if (!is.finite(iter_separacion) || is.na(iter_separacion) || iter_separacion < 0L) {
    .plan_spec_abort("`iter_separacion` debe ser entero >= 0.")
  }
  factor_reduccion_tarjeta_dispersion <- suppressWarnings(as.numeric(factor_reduccion_tarjeta_dispersion)[1])
  if (!is.finite(factor_reduccion_tarjeta_dispersion) ||
      is.na(factor_reduccion_tarjeta_dispersion) ||
      factor_reduccion_tarjeta_dispersion <= 0) {
    .plan_spec_abort("`factor_reduccion_tarjeta_dispersion` debe ser numerico positivo.")
  }

  filtros <- .ppt_norm_filters(filtros)
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  if (is.null(overrides$modo_foda)) overrides$modo_foda <- modo_foda
  if (!is.null(cruce) && is.null(overrides$cruce)) overrides$cruce <- cruce
  if (is.null(overrides$incluir_total)) overrides$incluir_total <- isTRUE(incluir_total)
  if (is.null(overrides$solo_indice_general_cruce)) overrides$solo_indice_general_cruce <- isTRUE(solo_indice_general_cruce)
  if (is.null(overrides$ancho_tarjeta_base_rel)) overrides$ancho_tarjeta_base_rel <- ancho_tarjeta_base_rel
  if (is.null(overrides$factor_ancho_matriz)) overrides$factor_ancho_matriz <- factor_ancho_matriz
  if (is.null(overrides$factor_ancho_dispersion)) overrides$factor_ancho_dispersion <- factor_ancho_dispersion
  if (!is.null(ancho_recuadro_rel) && is.null(overrides$ancho_recuadro_rel)) overrides$ancho_recuadro_rel <- ancho_recuadro_rel
  if (is.null(overrides$ancho_recuadro_auto)) overrides$ancho_recuadro_auto <- isTRUE(ancho_recuadro_auto)
  if (is.null(overrides$ancho_chip_rel)) overrides$ancho_chip_rel <- ancho_chip_rel
  if (is.null(overrides$sufijo_puntaje)) overrides$sufijo_puntaje <- sufijo_puntaje
  if (!is.null(cortes_chip) && is.null(overrides$cortes_chip)) overrides$cortes_chip <- cortes_chip
  if (is.null(overrides$modo_semaforo)) overrides$modo_semaforo <- modo_semaforo
  if (!is.null(tamano_texto_tarjeta) && is.null(overrides$tamano_texto_tarjeta)) overrides$tamano_texto_tarjeta <- tamano_texto_tarjeta
  if (!is.null(tamano_texto_chip) && is.null(overrides$tamano_texto_chip)) overrides$tamano_texto_chip <- tamano_texto_chip
  if (is.null(overrides$tarjetas_color_solido)) overrides$tarjetas_color_solido <- isTRUE(tarjetas_color_solido)
  if (!is.null(titulos_areas_foda) && is.null(overrides$titulos_areas_foda)) overrides$titulos_areas_foda <- titulos_areas_foda
  if (is.null(overrides$mostrar_subtitulo_area)) overrides$mostrar_subtitulo_area <- isTRUE(mostrar_subtitulo_area)
  if (is.null(overrides$sd_tecnico)) overrides$sd_tecnico <- isTRUE(sd_tecnico)
  if (is.null(overrides$color_indice_total)) overrides$color_indice_total <- color_indice_total
  if (!is.null(overrides$etiqueta_cruce_en_dos_lineas) && is.null(overrides$disposicion_recuadro)) {
    overrides$disposicion_recuadro <- if (isTRUE(overrides$etiqueta_cruce_en_dos_lineas)) "dos_lineas" else "una_linea"
  }
  if (is.null(overrides$disposicion_recuadro)) overrides$disposicion_recuadro <- disposicion_recuadro
  overrides$etiqueta_cruce_en_dos_lineas <- NULL
  if (is.null(overrides$jitter_x_rel)) overrides$jitter_x_rel <- jitter_x_rel
  if (is.null(overrides$jitter_y_rel)) overrides$jitter_y_rel <- jitter_y_rel
  if (is.null(overrides$iter_separacion)) overrides$iter_separacion <- iter_separacion
  if (is.null(overrides$factor_reduccion_tarjeta_dispersion)) {
    overrides$factor_reduccion_tarjeta_dispersion <- factor_reduccion_tarjeta_dispersion
  }

  el <- list(
    .element_type = "dim_foda",
    nivel = nivel,
    objetivo = objetivo,
    modo_foda = modo_foda,
    source = source,
    modo_semaforo = modo_semaforo,
    cruce = cruce,
    incluir_total = isTRUE(incluir_total),
    filtros = filtros,
    usar_pesos = isTRUE(usar_pesos),
    title_slide = .ppt_norm_text1(titulo, blank = NULL),
    overrides = overrides,
    base = base
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' @title (Retirado) Radar + tabla de dimensiones
#' @export
p_dim_radar_tabla <- function(
    modo = c("general", "indicadores"),
    objetivo,
    cruce = NULL,
    incluir_total = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    titulo_tabla = NULL,
    overrides = list(),
    base = list()
) {
  .plan_spec_abort(
    "`p_dim_radar_tabla()` fue retirado del flujo PPT. Use `p_dim_radar()` o `p_dim_heatmap()`."
  )
}

#' @title Texto (para cajas libres en layouts)
#' @family reporte
#' @export
p_text <- function(text, overrides = list()) {
  if (missing(text) || is.null(text)) .plan_spec_abort("`text` no puede ser NULL.")
  if (!is.character(text) || length(text) != 1L) .plan_spec_abort("`text` debe ser character(1).")

  text <- .ppt_norm_text1(text, blank = " ")

  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")

  el <- list(
    .element_type = "text",
    text          = text,
    overrides     = overrides
  )
  class(el) <- c("ppt_element_text", "ppt_element", "list")
  el
}

#' @title Envolver un ggplot crudo como ppt_element
#' @description Permite usar un ggplot arbitrario dentro de `p_slide_1_grafico()`,
#'   `p_slide_2_graficos()` y layouts equivalentes, sin que pase por un graficador de prosecnur.
#' @param gg Objeto \code{ggplot2::ggplot}.
#' @param titulo Titulo opcional para el slide.
#' @return Un \code{ppt_element}.
#' @family reporte
#' @export
p_ggplot_raw <- function(gg, titulo = NULL) {
  if (!inherits(gg, "gg") && !inherits(gg, "ggplot"))
    .plan_spec_abort("`gg` debe ser un objeto ggplot.")
  el <- list(
    .element_type = "ggplot_raw",
    gg            = gg,
    title_slide   = titulo,
    overrides     = list()
  )
  class(el) <- c("ppt_element", "list")
  el
}

# ---- Sello de ponderacion (Plan de mejoras 2026-07, unidad 1.2) --------------

#' @title Anexar el sello de ponderacion a la nota de base de una lamina
#' @description Toma la nota de base ya armada ("Base: N de M (pct)") y le anexa
#'   el texto canonico del sello de ponderacion (`reporte_ponderacion_sello()`).
#'   Pura y sin side effects: con `estado = NULL` (la corrida no trae
#'   informacion de ponderacion) la nota queda intacta, de modo que ningun deck
#'   historico sin ponderacion cambia. Llamador de produccion (unidad 1.2b):
#'   `.reporte_plan_nota_base_sellada()` (reporte_plan_opciones.R), enganchada
#'   en reporte_plan_ppt.R via `.plot_note_from`/`.ppt_note_from` (notas de pie
#'   PPT/Word) y `.base_auto_from_element` (slot de base, por fuente).
#' @param base Texto de la nota de base (`character(1)`) o NULL.
#' @param estado Objeto de estado de ponderacion (`reporte_ponderacion_estado()`
#'   o el atributo `ponderacion_estado` de la base) o NULL.
#' @return `character(1)` con la nota sellada, o NULL si no hay nada que decir.
#' @family reporte
#' @keywords internal
p_base_nota_con_sello <- function(base, estado = NULL) {
  base <- .ppt_norm_text1(base, blank = NULL)
  if (is.null(estado)) return(base)
  sello <- reporte_ponderacion_sello(estado)
  if (is.null(sello) || !nzchar(sello)) return(base)
  if (is.null(base)) return(sello)
  paste(base, sello, sep = " · ")
}
