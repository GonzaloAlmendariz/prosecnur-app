# analitica_armonizada_notas.R — la base de cada pregunta, de la medición dueña
# ===============================================================================
#
# Medido en HSyVbG (2026-10-22): `base_por_pregunta` de las notas se declara por
# VARIABLE de la base activa (2026), pero el pie del comparativo la buscaba entre
# las variables de TODAS las mediciones de la fila. Los códigos se corren entre
# años (en 2026 se agregó P9): el P11 de 2024/2025 («¿Alguna vez en la vida has
# experimentado VBG?») encontraba la base del P11 de 2026 (tipo de discapacidad)
# y el comparativo imprimía «Base: quienes cuentan con un certificado oficial…».
# Cuatro preguntas salían así.
#
# Antes de mandar el job, cada base declarada por variable se cuelga de la fila
# cuya variable EN LA BASE ACTIVA es esa; lo declarado por id o por etiqueta
# estándar se respeta tal cual.

#' @return `notas` con `base_por_pregunta` indexado por la clave de cada fila.
#' @noRd
.armz_notas_de_la_base <- function(notas, ap, base) {
  bpp <- (notas %||% list())$base_por_pregunta
  if (!length(bpp) || !length(ap$preguntas) || !nzchar(base %||% "")) return(notas)
  variables <- unique(unlist(lapply(ap$preguntas, function(d)
    unlist(d$fila$variables %||% list(), use.names = FALSE)), use.names = FALSE))
  out <- bpp[!names(bpp) %in% variables]
  for (d in ap$preguntas) {
    v <- .armz_txt((d$fila$variables %||% list())[[base]])
    clave <- (d$claves %||% character(0))[1]
    if (nzchar(v %||% "") && !is.na(clave) && !is.null(bpp[[v]]) && is.null(out[[clave]])) {
      out[[clave]] <- bpp[[v]]
    }
  }
  notas$base_por_pregunta <- out
  notas
}
