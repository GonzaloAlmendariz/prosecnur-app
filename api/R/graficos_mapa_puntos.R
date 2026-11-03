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
