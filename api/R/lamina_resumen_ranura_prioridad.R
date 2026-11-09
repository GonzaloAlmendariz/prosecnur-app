# =============================================================================
# lamina_resumen_ranura_prioridad.R — el contraste en una ranura recorta por lo que cabe y por su prioridad (P5)
# =============================================================================
#
# Prueba con Arte (2026-11-09): en la lámina de dos o de cuatro gráficos el contraste se recortaba dos veces: el
# graficador a 14 pares (el tope de la lámina de página entera) y la ranura, después, a las primeras que cabían en el
# orden de la lámina (por la diferencia CON signo: las brechas negativas grandes se caían primero). El pie decía las dos
# cosas. Ahora en una ranura el graficador no recorta (`.tope_espacio_en_ranura`) y la ranura deja las filas que caben
# en el orden de su prioridad —la mayor diferencia absoluta, la misma del recorte de página entera— y las dibuja en el
# orden de la lámina. El pie lo dice una vez; con regla, en la frase de la regla (`.tope_espacio_frase`).

#' Prioridad de cada fila del contraste (1 = la primera que se queda): la mayor diferencia absoluta sobre las cifras que
#' se leen, el valor sin redondear desempata y luego el orden declarado. Con separadores, el orden declarado (un
#' bloque no se parte por la diferencia).
#' @param dif Diferencia redondeada por fila (en el orden de la lámina). @param V Valores sin redondear (filas × grupos).
#' @param declarado Posición declarada de cada fila. @param sep Separadores.
#' @keywords internal
.contraste_prioridad <- function(dif, V, declarado, sep = integer(0)) {
  n <- length(dif)
  if (!n) return(integer(0))
  if (length(sep)) return(seq_len(n))
  fino <- abs(.contraste_diferencia(V)); fino[!is.finite(fino)] <- -Inf
  a <- abs(dif); a[!is.finite(a)] <- -Inf
  o <- order(-a, -round(fino, 6L), declarado)
  p <- integer(n); p[o] <- seq_len(n)
  p
}

#' Las filas de la ranura del contraste: se prueban en el orden de su prioridad y quedan en el orden de la lámina
#'
#' Sin prioridad (o con separadores) se comporta como `.lam_rr_filas`: las primeras. Con más filas que las de una lámina
#' de página entera, la ranura puede quedarse con dos: lo que no cabe va en otra lámina y el pie lo dice.
#' @return Lo de `.lam_rr_filas`, `por_prioridad` y, si quedan menos y no son las primeras, `filas` (índices en el orden
#'   de la lámina).
#' @keywords internal
.lam_rr_contraste_filas <- function(espec, w_max, disponible, pasos, par) {
  n <- length(espec$rotulos)
  pr <- suppressWarnings(as.integer(espec$prioridad))
  idx <- if (length(pr) == n && !anyNA(pr) && !length(espec$separadores)) order(pr) else seq_len(n)
  filas <- function(m, n_min = max(2L, ceiling(m / 2))) {
    .lam_rr_filas(espec$rotulos[idx[seq_len(m)]], 1.2, w_max, disponible, pasos[idx[seq_len(m)]], if (par) 0.22 else 0.13,
                  if (par) 0.45 else 0.24, desde = 11, n_min = min(m, n_min))
  }
  # Una ranura nunca lleva más que la lámina de página entera: se parte de ese tope, en el orden de la prioridad, y si ni
  # con los rótulos cortados caben, se quitan filas desde la de menor prioridad hasta dos.
  m <- min(n, .contraste_tope_filas(length(espec$grupos)))
  f <- filas(m)
  while (is.null(f) && m > 2L) { m <- m - 1L; f <- filas(m, n_min = m) }
  if (is.null(f)) return(f)
  f$por_prioridad <- length(pr) == n && !anyNA(pr) && !length(espec$separadores)
  if (f$k >= n || identical(idx, seq_len(n))) return(f)
  quedan <- idx[seq_len(f$k)]
  pos <- order(quedan)
  f$alturas <- f$alturas[pos]; f$textos <- f$textos[pos]
  f$filas <- sort(quedan)
  f
}

#' El contraste con sólo algunas de sus filas (todas las piezas por fila, en el mismo orden)
#' @keywords internal
.contraste_espec_filas <- function(espec, filas) {
  n <- length(espec$rotulos)
  for (nm in names(espec)) {
    x <- espec[[nm]]
    if (nm %in% c("grupos", "colores", "colores_cifra", "formas", "leyenda", "universos", "con_cobertura", "eje", "separadores")) next
    if (is.matrix(x) && nrow(x) == n) espec[[nm]] <- x[filas, , drop = FALSE]
    else if (is.atomic(x) && !is.matrix(x) && length(x) == n && n > 1L) espec[[nm]] <- x[filas]
  }
  espec$separadores <- integer(0)
  espec
}

#' La regla del contraste en su especificación (para reescribir su nota si la ranura recorta)
#' @keywords internal
.contraste_regla_en_espec <- function(p, el, total = NULL) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (!is.list(espec) || !identical(espec$tipo, "contraste") || is.null(el$regla)) return(p)
  entre <- is.null(el$cruce)
  espec$regla_recorte <- list(regla = el$regla, universo = if (entre) "preguntas comunes" else "preguntas de escala",
                              grupos_unidad = if (entre) "públicos" else "grupos", total = total)
  attr(p, "pulso_espec") <- espec
  p
}

#' Si el contraste de la ranura tiene regla, registra la frase que reemplaza su nota en el pie; TRUE si lo hizo
#' @keywords internal
.lam_rr_reemplazo_regla <- function(espec, geo) {
  rr <- espec$regla_recorte
  viejo <- sub("[.[:space:]]+$", "", trimws(as.character(espec$texto_regla %||% "")[1]))
  if (!identical(geo$clase, "contraste") || is.null(rr) || is.na(viejo) || !nzchar(viejo)) return(FALSE)
  nuevo <- .tope_espacio_frase(rr$regla, geo$k, geo$n_total, criterio = if (isTRUE(geo$por_prioridad)) "de mayor diferencia" else "primeras",
                               universo = rr$universo, n_grupos = length(espec$grupos), grupos_unidad = rr$grupos_unidad,
                               total = rr$total)
  .LAM_RR_PIE$reemplazos <- c(.LAM_RR_PIE$reemplazos, list(c(viejo = viejo, nuevo = sub("[.[:space:]]+$", "", nuevo))))
  TRUE
}

#' Aplica al pie los reemplazos de nota registrados por las ranuras (y los vacía); el que no está en el pie se agrega
#' @keywords internal
.lam_rr_pie_reemplazar <- function(base) {
  rs <- .LAM_RR_PIE$reemplazos; .LAM_RR_PIE$reemplazos <- NULL
  if (!length(rs)) return(base)
  b <- as.character(base %||% "")[1]; if (is.na(b)) b <- ""
  minus <- function(x) paste0(tolower(substr(x, 1, 1)), substring(x, 2))
  extra <- character(0)
  for (r in unique(rs)) {
    if (grepl(r[["nuevo"]], b, fixed = TRUE) || grepl(minus(r[["nuevo"]]), b, fixed = TRUE)) next   # el mismo gráfico en dos ranuras
    if (grepl(r[["viejo"]], b, fixed = TRUE)) b <- sub(r[["viejo"]], r[["nuevo"]], b, fixed = TRUE)
    else if (grepl(minus(r[["viejo"]]), b, fixed = TRUE)) b <- sub(minus(r[["viejo"]]), minus(r[["nuevo"]]), b, fixed = TRUE)
    else extra <- c(extra, r[["nuevo"]])
  }
  if (!length(extra)) return(b)
  .lam_con_punto(do.call(.lam_unir_base, as.list(c(if (nzchar(b)) b, extra))))
}
