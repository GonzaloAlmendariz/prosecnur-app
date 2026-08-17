#' Un mapeo guardado que sólo es una copia vieja de los defaults no debe congelar
#'
#' El `.pulso` persiste `config$mapping` entero, y ahí no se distingue lo que el
#' analista eligió a mano de la lista de candidatos que el motor puso por
#' defecto el día que se guardó. Como el ADR 0035 hace **exclusivo** todo rol
#' mapeado —no une los defaults, a propósito, para que el resolver no le robe la
#' columna al usuario—, un proyecto guardado se queda con la lista de aquel día
#' **para siempre**.
#'
#' Ése es el defecto que se arrastra hace meses: ampliar los candidatos del
#' motor no arregla ningún proyecto existente. Medido en HSVG2026, guardado el
#' 2026-08-06: su `mapping$session_type` es
#' `session_type, tipo_sesion, tipo_clase, actividad` —la lista por defecto de
#' entonces, no una elección de nadie—, y con ella la columna real de la base,
#' **`Tipo Curso`**, resuelve a `''`. Con los defaults de hoy resuelve. El
#' criterio de tipo de sesión, que es el que define el marco, llevaba meses sin
#' poder declararse en ese proyecto y nadie lo veía.
#'
#' La distinción es simple y no toca el ADR 0035: un mapeo **de verdad** nombra
#' UNA columna; una copia de los defaults es una lista de varios candidatos
#' genéricos que ya están todos en los defaults de hoy. Sólo en ese segundo caso
#' se refresca. Un rol con una columna elegida a mano sigue siendo exclusivo.
#'
#' @keywords internal
NULL

#' ¿Este mapeo guardado es una copia de los defaults y no una elección?
#'
#' @param custom Lo que el proyecto tiene guardado para el rol.
#' @param defaults_rol Los candidatos por defecto de HOY para ese rol.
#' @keywords internal
.cm_aulas_mapeo_es_copia_de_defaults <- function(custom, defaults_rol) {
  claves <- unique(.cm_aulas_text_key(.cm_aulas_chr_vec(custom)))
  claves <- claves[nzchar(claves)]
  # Un mapeo hecho a mano nombra una sola columna. Con dos o más se está
  # mirando una lista de candidatos, no una decisión.
  if (length(claves) < 2L) return(FALSE)
  base <- .cm_aulas_text_key(.cm_aulas_chr_vec(defaults_rol))
  all(claves %in% base)
}
