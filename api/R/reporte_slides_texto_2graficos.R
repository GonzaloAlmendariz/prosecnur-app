# reporte_slides_texto_2graficos.R — "Dos gráficos con texto a la izquierda / a la derecha" en la composición nativa.
#
# Las dos láminas iban por la plantilla anterior (`left_2graficos_texto` / `right_2graficos_texto`): los gráficos apilados en
# cajones de 1.6 in, dibujados para 6.1 in de ancho sin alto, y la base que pinta cada gráfico anclada a una esquina a 3 in
# de él ("Estos aún no se ven bien", Gonzalo, 2026-11-09). Ahora van por `.composicion_render` como las de tres y cuatro
# gráficos: los dos gráficos lado a lado, como las fichas del recetario (recetario_fichas.R: texto de 3.5 in, gráficos de
# 4.2 in y alto de la zona de datos; ranuras en el estándar, estandar_pulso.json), cada gráfico renderizado con el ancho y el alto reales de su ranura, y el texto en su
# columna con el filete coral de la narrativa. La plantilla queda de respaldo (motor_nativo = FALSE o ningún panel cabe) y
# allí el texto y el pie van a sus marcadores, como antes.

.TEXTO2_TIPOS <- c("text_l2", "text_r2")

#' Rectángulos de "dos gráficos con texto", leídos de `ppt.tipos_lamina` del estándar (una sola fuente con la plantilla de
#' respaldo, plantilla_layouts_estandar.R)
#'
#' Los gráficos toman x, y y ancho de su ranura y, como el panel de abajo de las demás mixtas, dibujan hasta el fin del
#' contenido; el texto, su x, y y ancho, y llega hasta el fin del contenido.
#' @param tipo `"text_l2"` o `"text_r2"`.
#' @return Como `.lam_mixta_geo()`: `paneles` (gráfico 1, gráfico 2), `filetes` y `texto` (x, y, w, h de la columna de texto).
#' @keywords internal
.lam_texto2_geo <- function(tipo) {
  if (!tipo %in% .TEXTO2_TIPOS) return(NULL)
  id <- if (identical(tipo, "text_l2")) "p_slide_2_graficos_texto_izquierda" else "p_slide_2_graficos_texto_derecha"
  r <- .std_tipo_lamina(id)$ranuras
  g <- Filter(function(z) identical(z$tipo, "grafico"), r); t <- Filter(function(z) identical(z$tipo, "texto"), r)
  if (length(g) != 2L || length(t) != 1L) return(NULL)
  yf <- .std_geom("contenido_y1"); t <- t[[1]]
  P <- function(q, k) list(x = q$x, y = q$y, w = q$w, h = yf - q$y - .lam_reserva_inferior(k), receta = .lam_receta_ranura(k))
  list(paneles = list(P(g[[1]], 1L), P(g[[2]], 2L)),
       filetes = list(list(tipo = "v", x = (g[[1]]$x + g[[1]]$w + g[[2]]$x) / 2, y0 = g[[1]]$y, y1 = yf)),
       texto = list(x = t$x, y = t$y, w = t$w, h = yf - t$y))
}

#' Ancho y alto (in) con que se renderiza cada gráfico de "dos gráficos con texto": los de su ranura
#'
#' @return Lista con `anchos` (numérico) y `altos` (numérico), o `NULL` si `stype` no es de estas láminas.
#' @keywords internal
.texto2_medidas <- function(stype) {
  geo <- .lam_texto2_geo(stype)
  if (is.null(geo)) return(NULL)
  list(anchos = vapply(geo$paneles, `[[`, 0, "w"), altos = vapply(geo$paneles, `[[`, 0, "h"))
}

#' El texto de la lámina: la etiqueta y el texto en un bloque (como el único marcador de la plantilla)
#' @keywords internal
.texto2_texto <- function(slots) .lam_narrativo_texto(slots %||% list())

#' Título inferido de "dos gráficos con texto": el del primer gráfico si la lámina no trae el suyo (K12a)
#' @keywords internal
.texto2_con_titulo <- function(slide, title_of_var) {
  if (!as.character(slide$.slide_type %||% "")[1] %in% .TEXTO2_TIPOS) return(slide)
  slots <- slide$slots %||% list()
  if (!is.null(slots$title %||% slide$title)) return(slide)
  el1 <- slots$plot1
  if (!inherits(el1, "ppt_element")) return(slide)
  tt <- el1$title_slide %||% (if (!is.null(el1$var) && is.function(title_of_var)) .plan_con_etiquetas_cortas(el1, title_of_var(el1$var)))
  if (!is.null(tt) && length(tt) && !is.na(tt[1]) && nzchar(trimws(tt[1]))) slide$slots$title <- tt[1]
  slide
}

#' Tamaño del texto de la columna: 15 pt (la narrativa del recetario) y, si no cabe en el alto de la columna, hasta 12 pt
#' @keywords internal
.texto2_size <- function(texto, w, h) {
  for (s in c(15, 14, 13, 12)) if (.lam_narrativa_alto(texto, w, s) <= h) return(s)
  12
}

#' Dibuja la columna de texto sobre la lámina nativa recién compuesta
#'
#' @param doc Documento con la lámina de los dos gráficos ya agregada (cursor en ella).
#' @param slide La lámina del plan.
#' @return `doc`.
#' @keywords internal
.texto2_dibujar_texto <- function(doc, slide) {
  stype <- as.character(slide$.slide_type %||% "")[1]
  geo <- .lam_texto2_geo(stype)
  texto <- .texto2_texto(slide$slots)
  if (is.null(geo) || is.null(texto)) return(doc)
  # Bajo un título de tres líneas los paneles bajan (lamina_mixtas_titulo.R): el texto baja con ellos.
  tit <- slide$slots$title %||% slide$title
  if (inherits(tit, "ppt_element_text")) tit <- tit$text
  geo_t <- .lam_mixta_geo_bajo_titulo(geo, if (is.character(tit) && length(tit)) tit[1] else "", NULL)
  dy <- geo_t$paneles[[1]]$y - geo$paneles[[1]]$y
  T <- geo$texto; y <- T$y + dy; h_max <- .std_geom("contenido_y1") - y
  size <- .texto2_size(texto, T$w, h_max)
  h <- min(h_max, .lam_narrativa_alto(texto, T$w, size))
  lz <- .lam_lienzo(); .lam_narrativa(lz, texto, T$x, y, T$w, h, size = size)
  .lam_agrupar(doc, lz, nombre = "prosecnur:texto")
}

#' Texto, base y pie en la plantilla de respaldo: cada uno a su marcador, como la rama que tenían en `reporte_ppt_plan`
#'
#' La base es la declarada o la automática de los dos gráficos (`base_auto_de_elementos`); el pie, el declarado o la nota de
#' los gráficos (`note_from`). Las dos funciones son closures del motor que llegan en `helpers`.
#' @keywords internal
.texto2_respaldo_textos <- function(doc, slide, contract, helpers, rendered, els, presets) {
  stype <- as.character(slide$.slide_type %||% "")[1]
  if (!stype %in% .TEXTO2_TIPOS) return(doc)
  slots <- slide$slots %||% list()
  vacio <- function(x) is.null(x) || !length(x) || is.na(as.character(x)[1]) || !nzchar(trimws(as.character(x)[1]))
  doc <- helpers$ph_with_strict(doc, .texto2_texto(slots) %||% " ", contract$slots$text)
  base <- slots$base %||% NULL
  if (inherits(base, "ppt_element_text")) base <- base$text
  if (vacio(base) && is.function(helpers$base_auto_de_elementos)) {
    base <- helpers$base_auto_de_elementos(els = els, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                                           formato = presets$base$args$formato %||% "Base: %s")
  }
  # Sin base automática de la lámina, la de cada gráfico (su nota al pie), sin repetir la misma: los gráficos ya no la
  # escriben (`.texto2_respaldo_graficos`), así que es la única.
  if (vacio(base)) {
    notas <- .lam_bases_sin_repetir(unlist(lapply(els, function(e) { v <- (e$overrides %||% list())$nota_pie; if (vacio(v)) NULL else as.character(v)[1] })))
    if (length(notas)) base <- .lam_bases_unir(notas)
  }
  if (!is.null(contract$slots$base)) doc <- helpers$ph_with_strict(doc, if (vacio(base)) " " else as.character(base)[1], contract$slots$base)
  ft <- slots$footer %||% NULL
  if (vacio(ft) && is.function(helpers$note_from)) {
    e1 <- els[[1]]; e2 <- els[[2]]
    ft <- helpers$note_from(rendered[[1]], e1$overrides$nota_pie %||% e1$nota_pie %||%
                              helpers$note_from(rendered[[2]], e2$overrides$nota_pie %||% e2$nota_pie %||% NULL))
    # La base ya va en su marcador: el pie no la repite.
    if (!vacio(ft) && grepl("^\\s*Base:", as.character(ft)[1])) ft <- NULL
  }
  if (!is.null(contract$slots$footer)) doc <- helpers$ph_with_strict(doc, if (vacio(ft)) " " else as.character(ft)[1], contract$slots$footer)
  doc
}

#' Los gráficos de la plantilla de respaldo sin su propia base: la lámina la lleva una vez, en su marcador
#'
#' Se vuelven a dibujar desde el elemento sin la base por gráfico (`els0`); si el analista escribió su nota al pie, el
#' elemento la conserva. La columna de casos por categoría (`mostrar_barra_extra`) repite la base cuando el gráfico no
#' tiene cruce: se apaga, salvo que el analista la haya pedido.
#' @param els0 Elementos sin la base por gráfico. @param rendered Lo ya dibujado (respaldo si el redibujo falla).
#' @keywords internal
.texto2_respaldo_graficos <- function(els0, rendered, anchos, altos, helpers) {
  for (i in seq_along(els0)) {
    el <- els0[[i]]
    if (!inherits(el, "ppt_element")) next
    cr <- trimws(as.character(unlist((el$overrides %||% list())$cruces %||% el$cruces %||% character(0))))
    if (!any(!is.na(cr) & nzchar(cr)) && is.null((el$overrides %||% list())$mostrar_barra_extra)) {
      el$overrides <- utils::modifyList(el$overrides %||% list(), list(mostrar_barra_extra = FALSE))
    }
    # La torta escribe "Base: N" por su cuenta si nadie le da nota: una nota vacía la calla (la del analista se respeta).
    ya <- (el$overrides %||% list())$nota_pie
    if (is.null(ya) || (length(ya) == 1L && is.na(ya))) el$overrides$nota_pie <- ""
    p <- tryCatch(helpers$render_element(helpers$inject_title_override(el), ancho_slot = anchos[[i]], alto_slot = altos[[i]]),
                  error = function(e) NULL)
    if (!is.null(p)) rendered[[i]] <- p
  }
  rendered
}
