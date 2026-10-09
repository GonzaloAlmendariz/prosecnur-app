# =============================================================================
# lamina_identidad.R — las láminas de identidad del recetario (capítulo 1; ADR 0093, N7)
# =============================================================================
#
# Separadores (recetario_capitulos.R:6-18):
# - capítulo, variante B aprobada (láminas 4, 66, 116, 207, 254): sobre el layout «Section
#   Header» de la plantilla, el rótulo «CAPÍTULO n» en coral, un filete coral corto, el
#   título a 36 pt y el subtítulo a 15 pt;
# - subcapítulo sobrio (5, 22, 30…): la ruta «CAPÍTULO n: TÍTULO» a 11 pt, el número
#   «n.m» en coral y el título a 30 pt, y el subtítulo; se lee como subtítulo, no como portada.
#
# El motor tenía un solo nivel (`p_slide_seccion`, con el título en el marcador y el
# subtítulo ignorado). Ahora el nivel lo declara `meta$nivel = "subcapitulo"`; el número
# sale del orden del plan, salvo que `meta$numero` lo fije, y `meta$rotulo` cambia
# «CAPÍTULO» por otra palabra («SECCIÓN», «PARTE»).

#' Número y nivel de cada separador del plan
#'
#' @param plan Lista de láminas.
#' @return Lista paralela al plan: `NULL` para las que no son separador; para los separadores, `nivel`
#'   («capitulo» o «subcapitulo»), `numero` y el título y número de su capítulo.
#' @keywords internal
.lam_secciones_numeradas <- function(plan) {
  n_cap <- 0L; n_sub <- 0L; cap_titulo <- NA_character_; cap_numero <- NA_character_
  lapply(plan, function(slide) {
    if (!identical(slide$.slide_type, "section")) return(NULL)
    meta <- slide$meta %||% list(); titulo <- as.character(slide$slots$title %||% slide$title %||% "")[1]
    if (identical(meta$nivel, "subcapitulo")) {
      n_sub <<- n_sub + 1L
      # Sin capítulo antes, el subcapítulo se numera solo («1», no «0.1»; verificador de N7).
      num <- if (is.na(cap_numero)) as.character(n_sub) else paste0(cap_numero, ".", n_sub)
      list(nivel = "subcapitulo", numero = as.character(meta$numero %||% num),
           capitulo = cap_titulo, capitulo_numero = cap_numero, rotulo = as.character(meta$rotulo %||% "Capítulo")[1])
    } else {
      n_cap <<- n_cap + 1L; n_sub <<- 0L
      cap_numero <<- as.character(meta$numero %||% n_cap)[1]; cap_titulo <<- titulo
      list(nivel = "capitulo", numero = cap_numero, rotulo = as.character(meta$rotulo %||% "Capítulo")[1])
    }
  })
}

#' Separador del recetario: capítulo (variante B) o subcapítulo sobrio
#'
#' @param info Lo que devuelve `.lam_secciones_numeradas()` para esta lámina.
#' @param layout_capitulo Layout del capítulo (el «Section Header» de la plantilla, con su ilustración).
#' @param layout_subcapitulo Layout del subcapítulo (el general de la lámina).
#' @keywords internal
.lam_laminas_seccion <- function(doc, titulo, subtitulo = NULL, info, layout_capitulo = "Section Header", layout_subcapitulo = "Graficos",
                                 master = "Office Theme", por_lamina = function(doc) doc) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  titulo <- as.character(titulo %||% "")[1]
  sub <- if (is.null(subtitulo) || !nzchar(trimws(as.character(subtitulo)[1]))) NULL else trimws(as.character(subtitulo)[1])
  lz <- .lam_lienzo()
  if (identical(info$nivel, "subcapitulo")) {
    doc <- officer::add_slide(doc, layout = layout_subcapitulo, master = master)
    xt <- .std_geom("margen_izq"); fin <- .std_geom("ancho") - .std_geom("margen_der")
    if (!is.na(info$capitulo %||% NA)) {
      ruta <- toupper(paste0(info$rotulo, " ", info$capitulo_numero, ": ", info$capitulo))
      .lam_txt(lz, ruta, xt, 2.75, 9, 0.3, 11, suave, bold = TRUE, nombre = "seccion:ruta")
    }
    wn <- .lam_ancho_tinta(info$numero, 30, TRUE)
    .lam_txt(lz, info$numero, xt, 3.1, wn + 0.3, 0.6, 30, coral, bold = TRUE, nombre = "seccion:numero")
    .lam_txt(lz, titulo, xt + wn + 0.3, 3.1, fin - xt - wn - 0.3, 0.6, 30, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, xt, 3.72, 10, 0.4, 15, suave, nombre = "seccion:subtitulo")
  } else {
    doc <- officer::add_slide(doc, layout = layout_capitulo, master = master)
    .lam_txt(lz, toupper(paste(info$rotulo, info$numero)), 2.5, 3.85, 6, 0.36, 15, coral, bold = TRUE, nombre = "seccion:rotulo")
    .lam_caja(lz, 2.6, 4.27, 1.1, 0.04, coral, nombre = "seccion:filete")
    h <- max(0.75, .lam_alto_tinta(titulo, 9.8, 36, TRUE))                    # un título de dos líneas empuja al subtítulo
    .lam_txt(lz, titulo, 2.5, 4.42, 9.8, h, 36, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, 2.5, 4.42 + h - 0.02, 9.8, 0.4, 15, suave, nombre = "seccion:subtitulo")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:seccion")
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El separador cabe? Un título de más de dos líneas a 36 pt (o de una a 30 pt en el subcapítulo) no entra en el
#' separador del recetario y sigue por la ruta anterior.
#' @keywords internal
.lam_seccion_cabe <- function(titulo, info) {
  titulo <- as.character(titulo %||% "")[1]
  if (!nzchar(trimws(titulo)) || is.null(info)) return(FALSE)
  if (identical(info$nivel, "subcapitulo")) {
    fin <- .std_geom("ancho") - .std_geom("margen_der"); xt <- .std_geom("margen_izq")
    return(.lam_ancho_tinta(titulo, 30, TRUE) <= fin - xt - .lam_ancho_tinta(info$numero, 30, TRUE) - 0.4)
  }
  .lam_alto_tinta(titulo, 9.8, 36, TRUE) <= 1.4
}

# ---- «Cómo leer este informe»: Top Two Box (lámina 19, recetario.R:534-552) ---------------------------------------

.TTB_TEXTO_MOTOR <- paste("Con el fin de hacer la lectura de datos de forma más amigable, se plantea la suma de los dos valores superiores",
                          "de la escala, comúnmente llamada top two box. Esta suma permite comparar de manera más rápida y eficiente los",
                          "datos entre categorías o con mediciones de otros años.")
.TTB_TEXTO_RECETARIO <- paste("Es la suma de los dos valores superiores de la escala. Resume en una cifra el acuerdo de cada grupo",
                              "y permite compararlo entre actores y con mediciones de otros años.")

#' Lámina «Top Two Box» del recetario
#'
#' Una barra de ejemplo de 8.9 in con sus cifras, la llave verde sobre los dos valores superiores con «Los dos valores
#' superiores», y a la derecha la cifra del Top Two Box a 44 pt con su suma; la leyenda numerada debajo. El texto del
#' motor por defecto se cambia por el del recetario; uno escrito por el analista se respeta.
#' @keywords internal
.lam_laminas_top_two_box <- function(doc, slots, folio = NULL, ante = "Cómo leer este informe", layout = "Graficos",
                                     master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der"); yt <- g_("zona_datos_y0")
  verde <- .std_color("verde_top_two_box"); azul <- .std_color("azul")
  v <- suppressWarnings(as.numeric(slots$valores %||% c(5, 5, 35, 55))); k <- length(v)
  idx <- as.integer(slots$top_two_indices %||% c(k - 1L, k))
  et <- as.character(slots$etiquetas %||% seq_len(k))
  pal <- if (k == 5L) .std_paleta("likert_neutro") else .std_paleta("likert")[seq_len(k)]
  rot <- if (k == 4L) .std_valor("ppt", "paletas", "likert", "rotulos")[1:4] else {
    r <- rep("", k); r[1] <- gsub("\\s*\\n\\s*", " ", slots$extremo_izquierda %||% ""); r[k] <- gsub("\\s*\\n\\s*", " ", slots$extremo_derecha %||% ""); r
  }
  titulo <- as.character(slots$title %||% "Top Two Box")[1]
  if (identical(toupper(titulo), "TOP TWO BOX")) titulo <- "Top Two Box"
  texto <- as.character(slots$text %||% .TTB_TEXTO_RECETARIO)[1]
  if (identical(gsub("\\s+", " ", texto), gsub("\\s+", " ", .TTB_TEXTO_MOTOR))) texto <- .TTB_TEXTO_RECETARIO
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  .lam_txt(lz, texto, ml, yt + 0.05, W - ml - mr - 0.5, 0.9, 17, azul, nombre = "ttb:texto")
  xb <- ml + 0.4; wb <- 8.9; yb <- 4.0; g <- 0.8
  seg <- data.frame(ancho = v / sum(v), cifra = paste0(.pulso_fmt_half_up(v, 0), "%"), color = pal, dibujar = v > 0, stringsAsFactors = FALSE)
  .lam_barra_apilada(lz, xb, yb, wb, seg, g)
  x3 <- xb + wb * sum(v[seq_len(min(idx) - 1L)]) / sum(v); x4 <- xb + wb * sum(v[seq_len(max(idx))]) / sum(v)
  .lam_caja(lz, x3, yb - 0.32, x4 - x3, 0.025, verde, nombre = "ttb:llave")
  .lam_caja(lz, x3, yb - 0.32, 0.025, 0.2, verde, nombre = "ttb:llave"); .lam_caja(lz, x4 - 0.025, yb - 0.32, 0.025, 0.2, verde, nombre = "ttb:llave")
  .lam_caja(lz, (x3 + x4) / 2 - 0.0125, yb - 0.5, 0.025, 0.2, verde, nombre = "ttb:llave")
  .lam_txt(lz, "Los dos valores superiores", (x3 + x4) / 2 - 2, yb - 0.85, 4, 0.3, 12, verde, bold = TRUE, align = "center", nombre = "ttb:llave_rotulo")
  xt <- xb + wb + 0.35; wt <- W - mr - xt
  .lam_txt(lz, "Top Two Box", xt, yb - 0.5, wt, 0.3, 13, verde, bold = TRUE, align = "center", nombre = "ttb:rotulo")
  .lam_txt(lz, paste0(.pulso_fmt_half_up(sum(v[idx]), 0), "%"), xt, yb - 0.12, wt, 0.75, 44, verde, bold = TRUE, align = "center", nombre = "ttb:cifra")
  .lam_txt(lz, paste(paste0(.pulso_fmt_half_up(v[idx], 0), "%"), collapse = " + "), xt, yb + 0.7, wt, 0.32, 14, verde, align = "center", nombre = "ttb:suma")
  .lam_leyenda(lz, yb + g + 0.45, trimws(paste0(et, "  ", rot)), pal, centrar_en = xb + wb / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:top_two_box")
  doc <- .lam_pie(doc, NULL, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El Top Two Box va en nativo? Una escala de 3 a 7 puntos con valores positivos y dos índices contiguos dentro de ella
#' @keywords internal
.lam_top_two_box_cabe <- function(slots) {
  v <- suppressWarnings(as.numeric(slots$valores %||% c(5, 5, 35, 55))); idx <- suppressWarnings(as.integer(slots$top_two_indices %||% c(length(v) - 1L, length(v))))
  length(v) >= 3L && length(v) <= 7L && all(is.finite(v)) && all(v >= 0) && sum(v) > 0 && length(idx) >= 1L && all(idx %in% seq_along(v)) &&
    all(diff(sort(idx)) == 1L) && length(slots$etiquetas %||% seq_along(v)) == length(v)
}
