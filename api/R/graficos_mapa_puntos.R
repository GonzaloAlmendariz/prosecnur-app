# =============================================================================
# graficos_mapa_puntos.R — puntos de referencia sobre un mapa: un lugar, su rótulo y su color
# =============================================================================
#
# Gonzalo, 2026-11-02: «definir un punto por coordenada o por enlace de Google Maps y marcarlo con un punto rojo, o de
# otro color elegante, con una etiqueta», p. ej. la PUCP sobre el mapa de distritos donde viven los estudiantes.
# Cada punto se declara con `etiqueta` y uno de: `coordenadas` («-12.0693, -77.0794», latitud primero, como las copia
# Google Maps), `enlace` (la URL larga de Google Maps: «@lat,lon», «!3dlat!4dlon», «q=lat,lon» o «ll=lat,lon») o `lat` y
# `lon`. El color es opcional (por defecto el coral de la casa). También vale una línea de texto por punto
# «Etiqueta | coordenadas o enlace | color», que es lo que escribe la UI.
# Los enlaces cortos (maps.app.goo.gl, goo.gl/maps) sólo se resuelven consultando la red, y el motor no sale a la red:
# se piden el enlace largo o las coordenadas, con un mensaje que lo dice.

#' Latitud y longitud desde un texto de coordenadas o un enlace largo de Google Maps
#' @return `c(lat, lon)` o `NULL` si no se reconoce.
#' @keywords internal
.mapa_punto_latlon <- function(txt) {
  s <- utils::URLdecode(trimws(as.character(txt %||% "")[1]))
  if (is.na(s) || !nzchar(s)) return(NULL)
  num <- "(-?[0-9]{1,3}(?:\\.[0-9]+)?)"
  patrones <- c(paste0("!3d", num, "!4d", num), paste0("@", num, ",\\s*", num), paste0("[?&](?:q|ll|query|center|destination)=", num, ",\\s*", num),
                paste0("^", num, "\\s*[,; ]\\s*", num, "$"))
  for (p in patrones) {
    m <- regmatches(s, regexec(p, s, perl = TRUE))[[1]]
    if (length(m) == 3L) {
      ll <- suppressWarnings(as.numeric(m[2:3]))
      if (all(is.finite(ll)) && abs(ll[1]) <= 90 && abs(ll[2]) <= 180) return(ll)
    }
  }
  NULL
}

#' Normaliza los puntos declarados a un data.frame `etiqueta`, `lat`, `lon`, `color`; aborta con un mensaje claro si uno
#' no se puede ubicar
#' @keywords internal
.mapa_puntos_normalizar <- function(puntos) {
  if (is.null(puntos) || !length(puntos)) return(NULL)
  if (is.character(puntos)) puntos <- as.list(unlist(strsplit(paste(puntos, collapse = "\n"), "\n", fixed = TRUE)))
  if (is.data.frame(puntos)) puntos <- split(puntos, seq_len(nrow(puntos)))
  if (is.list(puntos) && !is.null(names(puntos)) && any(c("etiqueta", "coordenadas", "enlace", "lat") %in% names(puntos))) puntos <- list(puntos)
  filas <- lapply(puntos, function(p) {
    if (is.character(p)) {   # «Etiqueta | coordenadas o enlace | color»
      if (!nzchar(trimws(p))) return(NULL)
      partes <- trimws(strsplit(p, "|", fixed = TRUE)[[1]])
      p <- list(etiqueta = partes[1], coordenadas = partes[2] %||% "", color = if (length(partes) > 2) partes[3] else NULL)
    }
    p <- lapply(p, function(v) if (is.list(v)) unlist(v) else v)
    etq <- trimws(as.character(p$etiqueta %||% "")[1])
    ll <- if (!is.null(p$lat) && !is.null(p$lon)) suppressWarnings(as.numeric(c(p$lat[1], p$lon[1]))) else
      .mapa_punto_latlon(p$coordenadas %||% p$enlace %||% "")
    origen <- as.character(p$coordenadas %||% p$enlace %||% "")[1]
    if (is.null(ll) || !all(is.finite(ll))) {
      corto <- grepl("maps\\.app\\.goo\\.gl|goo\\.gl/maps", origen)
      .plan_spec_abort(sprintf("Punto «%s»: %s", etq, if (corto)
        "un enlace corto de Google Maps no trae las coordenadas. Pega el enlace largo (el de la barra del navegador) o las coordenadas «latitud, longitud»."
        else "no se reconocen las coordenadas. Usa «latitud, longitud» (p. ej. «-12.0693, -77.0794») o el enlace largo de Google Maps."))
    }
    col <- trimws(as.character(p$color %||% "")[1])
    if (!nzchar(col) || inherits(try(grDevices::col2rgb(col), silent = TRUE), "try-error")) col <- .std_color("coral")
    data.frame(etiqueta = etq, lat = ll[1], lon = ll[2], color = col, stringsAsFactors = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) NULL else do.call(rbind, filas)
}

#' La caja gana mar al oeste para que el rótulo de cada punto quepa fuera de tierra
#'
#' Gonzalo, 2026-11-02: en el mapa distrital, con la caja ajustada a los datos, el rótulo y su guía caían sobre un
#' distrito. En Lima, el Callao y el Perú el mar está al oeste: la caja se corre a la izquierda —más allá del territorio,
#' sobre el mar— lo que pida el rótulo más ancho más su aire. Sin puntos, la caja no cambia.
#' @keywords internal
.mapa_puntos_caja_con_mar <- function(caja, puntos) {
  if (is.null(puntos) || !NROW(puntos)) return(caja)
  ancho <- caja[["xmax"]] - caja[["xmin"]]
  w_txt <- .lam_ancho_tinta(puntos$etiqueta, 9, TRUE) / 3 * ancho   # ~3 in de mapa, como en `.mapa_puntos_capas`
  caja[["xmin"]] <- min(caja[["xmin"]], min(puntos$lon - w_txt - 0.3 * ancho))
  caja
}

#' Capas de los puntos sobre el ggplot del mapa: punto chico con halo blanco y rótulo sobre el mar, unido por una guía
#'
#' Gonzalo, 2026-11-02: «el punto muy grande; la etiqueta puede irse al mar, con flecha; de costado o en diagonal hacia
#' arriba». El rótulo arranca en el borde izquierdo de la caja (el mar, que `.mapa_puntos_caja_con_mar` reservó) y un
#' poco más arriba que su punto; una línea fina en diagonal lo une al punto. Si dos rótulos se acercan, el de abajo baja.
#' Sólo se dibujan los puntos dentro de la caja (fuera del recorte el dispositivo del PPT se cae).
#' @keywords internal
.mapa_puntos_capas <- function(puntos, caja) {
  if (is.null(puntos) || !NROW(puntos)) return(list())
  p <- puntos[puntos$lon >= caja[["xmin"]] & puntos$lon <= caja[["xmax"]] & puntos$lat >= caja[["ymin"]] & puntos$lat <= caja[["ymax"]], , drop = FALSE]
  if (!nrow(p)) return(list())
  ancho <- caja[["xmax"]] - caja[["xmin"]]; alto <- caja[["ymax"]] - caja[["ymin"]]
  p <- p[order(-p$lat), , drop = FALSE]
  w_txt <- .lam_ancho_tinta(p$etiqueta, 9, TRUE) / 3 * ancho
  margen <- 0.02 * ancho
  al_mar <- p$lon - caja[["xmin"]] >= w_txt + margen + 0.05 * ancho   # cabe entre el borde (el mar) y el punto
  p$x_txt <- ifelse(al_mar, caja[["xmin"]] + margen, pmin(caja[["xmax"]] - w_txt - margen, p$lon + 0.12 * ancho))
  p$hjust <- 0
  p$x_guia <- ifelse(al_mar, p$x_txt + w_txt + 0.01 * ancho, p$x_txt - 0.01 * ancho)
  p$y_txt <- pmin(p$lat + 0.08 * alto, caja[["ymax"]] - 0.03 * alto)   # en diagonal hacia arriba
  for (k in seq_len(nrow(p))[-1]) p$y_txt[k] <- min(p$y_txt[k], p$y_txt[k - 1] - 0.06 * alto)   # rótulos que no se pisan
  azul <- .std_color("azul")
  list(
    ggplot2::geom_segment(data = p, ggplot2::aes(.data$x_guia, .data$y_txt, xend = .data$lon, yend = .data$lat), inherit.aes = FALSE,
                          colour = azul, linewidth = 0.3),
    ggplot2::geom_point(data = p, ggplot2::aes(.data$lon, .data$lat), inherit.aes = FALSE, shape = 21, size = 1.6, stroke = 0.5,
                        colour = "#FFFFFF", fill = p$color),
    ggplot2::geom_text(data = p, ggplot2::aes(.data$x_txt, .data$y_txt, label = .data$etiqueta, hjust = .data$hjust), inherit.aes = FALSE,
                       size = 9 / ggplot2::.pt, fontface = "bold", colour = azul, family = .std_pt("fuente"))
  )
}
