# lamina_pie_parte.R — el pie automático de una lámina partida dice las bases de los públicos que ESA parte dibuja
# (Renzo, informe Arte, N15, 2026-10-22: «Gestión y planificación (cont.)» decía «Base: 115 docentes y 85 administrativos»
# y solo mostraba docentes). Solo cambia el texto del pie: cada base sale de los mismos conteos que armó el pie completo,
# se quita la que no se dibuja. Un texto que no tiene la forma automática «Base: N público y N público» no se toca.

#' Texto sin mayúsculas ni tildes, para comparar el rótulo de un público con la palabra de su base
#' @keywords internal
.lam_pie_norm <- function(x) tolower(trimws(iconv(as.character(x), to = "ASCII//TRANSLIT")))

#' Pie de una parte: solo las bases de los públicos que la parte dibuja
#'
#' `base` es el pie completo («Base: 115 docentes y 85 administrativos», con una nota detrás tras «. » si la hay). Cada
#' base se asocia a los públicos (rótulos de actor) de la especificación entera por su palabra o por su N; una base que no
#' se asocia a ninguno se conserva. En la parte se mantiene la base si se asocia a algún público que dibuja.
#' @param actores_parte Rótulos de actor de las filas de esa parte.
#' @param actores_todos Rótulos de actor de las filas de toda la lámina.
#' @param ns_todos,ns_parte Casos de las filas (toda la lámina / esa parte), para asociar por N cuando la palabra no coincide.
#' @return El pie de la parte; `base` sin cambios si no tiene la forma automática o no hay nada que quitar.
#' @keywords internal
.lam_base_de_parte <- function(base, actores_parte, actores_todos, ns_parte = numeric(0), ns_todos = numeric(0)) {
  if (is.null(base) || !length(base) || is.na(base[1]) || !nzchar(base[1])) return(base)
  b <- as.character(base)[1]
  m <- regmatches(b, regexec("^([^0-9]*?)([0-9][0-9.,]*\\s.*)$", b, perl = TRUE))[[1]]
  if (length(m) != 3L) return(base)
  prefijo <- m[2]; resto <- m[3]
  corte <- regexpr("\\.\\s", resto)
  nucleo <- if (corte > 0) substr(resto, 1L, corte - 1L) else resto
  cola <- if (corte > 0) substr(resto, corte, nchar(resto)) else ""
  piezas <- strsplit(nucleo, ",\\s+(?=[0-9])|\\s+y\\s+(?=[0-9])", perl = TRUE)[[1]]
  if (length(piezas) < 2L) return(base)
  todos <- unique(actores_todos[nzchar(actores_todos)]); parte <- unique(actores_parte[nzchar(actores_parte)])
  if (!length(todos)) return(base)
  asocia <- function(pieza, actores, ns) {
    n <- suppressWarnings(as.numeric(gsub(",", "", sub("^([0-9][0-9.,]*).*$", "\\1", pieza))))
    palabra <- .lam_pie_norm(sub("^[0-9][0-9.,]*\\s*", "", pieza))
    a <- .lam_pie_norm(actores)
    por_palabra <- nzchar(palabra) & vapply(a, function(x) nzchar(x) && (x == palabra || grepl(x, palabra, fixed = TRUE) || grepl(palabra, x, fixed = TRUE)), TRUE)
    any(por_palabra) || (is.finite(n) && any(ns %in% n))
  }
  nominal <- vapply(piezas, asocia, TRUE, actores = todos, ns = ns_todos)         # la base nombra a un público de la lámina
  if (!all(nominal)) return(base)                                                 # una base que no nombra a un público de la lámina: texto manual, no se toca
  queda <- vapply(piezas, asocia, TRUE, actores = parte, ns = ns_parte)
  if (all(queda) || !any(queda)) return(base)
  p <- piezas[queda]
  nucleo2 <- if (length(p) == 1L) p else if (length(p) == 2L) paste(p, collapse = " y ") else paste0(paste(p[-length(p)], collapse = ", "), " y ", p[length(p)])
  paste0(prefijo, nucleo2, cola)
}

#' El pie de la parte `k` de una escala partida (premisas con filas por público); una sola parte no cambia el pie
#' @keywords internal
.lam_base_de_parte_escala <- function(base, espec, partes, k) {
  if (length(partes) < 2L) return(base)
  filas <- function(ps) unlist(lapply(ps, function(p) p$filas), recursive = FALSE)
  ft <- filas(unlist(partes, recursive = FALSE)); fk <- filas(partes[[k]])
  rot <- function(f) vapply(f, function(x) as.character(x$actor %||% "")[1], "")
  nn <- function(f) suppressWarnings(as.numeric(vapply(f, function(x) as.numeric(x$valid %||% NA_real_)[1], 0)))
  .lam_base_de_parte(base, rot(fk), rot(ft), nn(fk), nn(ft))
}

#' El pie de la parte `k` de una multilista partida por bloques (cada bloque trae sus premisas con filas por público)
#' @keywords internal
.lam_base_de_parte_multilista <- function(base, partes, k) {
  if (length(partes) < 2L) return(base)
  filas <- function(items) unlist(lapply(items, function(it) unlist(lapply(it$premisas, function(p) p$filas), recursive = FALSE)), recursive = FALSE)
  ft <- filas(unlist(partes, recursive = FALSE)); fk <- filas(partes[[k]])
  rot <- function(f) vapply(f, function(x) as.character(x$actor %||% "")[1], "")
  nn <- function(f) suppressWarnings(as.numeric(vapply(f, function(x) as.numeric(x$valid %||% NA_real_)[1], 0)))
  .lam_base_de_parte(base, rot(fk), rot(ft), nn(fk), nn(ft))
}
