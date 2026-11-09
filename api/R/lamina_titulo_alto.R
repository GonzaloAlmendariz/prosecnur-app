# lamina_titulo_alto.R — un título largo baja la zona de datos en vez de pisarla.
#
# La caja del título mide 0.5 in y no se ajusta (`noAutofit`): un título de cuatro líneas a 24 pt se derrama hasta
# ~2.0 in y la zona de datos empieza en 1.65 in. En el mazo de Arte y Diseño (2026-10-12) la lámina «La Facultad de
# Arte y Diseño fomenta la participación…» montaba su cuarta línea sobre el rótulo de la primera premisa. El aviso de
# más de dos líneas (K12b) se mantiene: avisar no evita el choque, esto sí.

#' Cuánto hay que bajar la zona de datos para que el título no la pise (pulgadas, 0 si cabe)
#' @keywords internal
.lam_titulo_desplazo <- function(titulo) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) return(0)
  n <- .lam_lineas_tinta(t, 10.4, .std_pt("titulo"), TRUE)
  fondo <- .std_valor("ppt", "geometria", "titulo_y") + 0.06 + 0.05 + n * .std_pt("titulo") * 1.2 / 72
  # Hasta tres líneas el título termina en el borde de la zona (1.67 contra 1.65 in) y ya convivía en el mazo aprobado:
  # se baja sólo lo que de verdad invade, más un respiro.
  invade <- fondo - .std_valor("ppt", "geometria", "zona_datos_y0")
  if (invade <= 0.05) 0 else round(invade + 0.15, 3)
}

#' Evalúa `expr` con la zona de datos bajada lo que pida el título (se suma al desplazo de la narrativa)
#' @keywords internal
.lam_con_titulo <- function(titulos, expr) {
  dy <- max(0, vapply(titulos, .lam_titulo_desplazo, 0))
  viejo <- options(prosecnur.lam_desplazo_titulo = dy); on.exit(options(viejo), add = TRUE)
  force(expr)
}

#' Dónde termina el bloque del título (antetítulo, título y subtítulo), en pulgadas desde arriba
#'
#' Lo dibuja `.lam_titulo`: el subtítulo baja lo que miden las líneas de más del título. Lo usan las láminas que ponen algo
#' bajo el título fuera de la zona de datos (la pregunta del mapa), para no pisar el subtítulo.
#' @keywords internal
.lam_titulo_fondo <- function(titulo, sub = NULL) {
  yt <- .std_valor("ppt", "geometria", "titulo_y"); tp <- .std_pt("titulo")
  t <- trimws(as.character(titulo %||% "")[1]); if (is.na(t)) t <- ""
  nt <- max(1L, .lam_lineas_tinta(t, 10.4, tp, TRUE))
  s <- trimws(as.character(sub %||% "")[1])
  if (is.na(s) || !nzchar(s)) return(yt + 0.06 + 0.05 + nt * tp * 1.2 / 72)
  ns <- max(1L, .lam_lineas_tinta(s, 10.4, .std_pt("subtitulo"), FALSE))
  yt + 0.55 + (nt - 1L) * tp * 1.2 / 72 + 0.05 + ns * .std_pt("subtitulo") * 1.2 / 72
}

