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
      base <- if (is.na(cap_numero)) "0" else cap_numero
      list(nivel = "subcapitulo", numero = as.character(meta$numero %||% paste0(base, ".", n_sub)),
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
