# Vara V4 en Graficos, sobre estudios multibase.
#
# `graficos_ppt_ok` y `graficos_word_ok` son escalares de la base ACTIVA: se
# escriben al generar y `.estudio_apply_stage_flags()` los intercambia al
# cambiar de base. La verdad por base vive en `graficos_status_por_base`, se
# persiste en el .pulso y nunca salia al cliente.
#
# En `acrconta_mazo`, con tres bases:
#
#   docentes     PPT si  Word no
#   estudiantes  PPT si  Word no
#   egresados    PPT NO  Word no
#
# El escalar dice TRUE porque la base activa es una de las dos primeras, asi
# que el riel de etapas y la tarjeta del Home marcaban Graficos como hecho
# mientras `egresados` no tenia ni un mazo. Un estudio no esta entregado
# porque dos tercios lo esten.

#' Bases de un estudio que todavia no produjeron ningun entregable de Graficos
#'
#' El criterio es el mismo que usa la UI para dar la etapa por hecha: una base
#' cuenta cuando tiene PPT **o** Word. Solo se nombran las bases del estudio,
#' en su orden; una entrada residual de `graficos_status_por_base` que ya no
#' corresponde a ninguna base no se reporta como pendiente.
#'
#' @param bases Nombres de las bases del estudio, en orden.
#' @param statuses Lista `graficos_status_por_base` de la sesion.
#' @return Vector de nombres pendientes; `character(0)` cuando no falta ninguna.
graficos_bases_sin_mazo <- function(bases, statuses = list()) {
  bases <- as.character(bases %||% character(0))
  bases <- bases[!is.na(bases) & nzchar(trimws(bases))]
  if (!length(bases)) return(character(0))
  if (is.null(statuses) || !is.list(statuses)) statuses <- list()
  pendientes <- vapply(bases, function(nombre) {
    st <- statuses[[nombre]]
    if (is.null(st) || !is.list(st)) return(TRUE)
    !(isTRUE(st$graficos_ppt_ok) || isTRUE(st$graficos_word_ok))
  }, logical(1))
  unname(bases[pendientes])
}
