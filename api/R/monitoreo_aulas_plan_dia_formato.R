# El formato de «Plan del día» en Google Sheets — hermana de B19.
#
# Dictado de Gonzalo (2026-09-03, mirando el libro vivo): «Plan del día
# también está muy feo». Misma doctrina que «Avance de campo» y «Asignación
# de aplicadores»: bandas derivadas FILA A FILA del contenido realmente
# publicado —jamás números mágicos— y la paleta compartida del libro (navy
# #002457 para títulos, #E7EEF9/#1B4B8F para cabeceras de tabla, el rojo
# suave para lo que exige acción). Los strings detectados son los que emiten
# `aulas_libro_hoja_plan_dia()` y el selector B20 — si un renderer cambia un
# rótulo, el test de este archivo lo dice.
#
# Estructura real de la hoja (selector B20 + listado B2.1b):
#   «VER EL DÍA:»                → título del selector (navy)
#   «PLAN DEL DÍA ELEGIDO»       → título del área de spill (navy)
#   «FECHA AGENDADA …»           → cabecera de tabla (dos veces: área y
#                                   listado) (azul claro)
#   «Total de la jornada …»      → cierre de cada grupo de fecha (banda
#                                   neutra cálida en negrita: subtotal, no
#                                   título)
#   «Pendientes de jornadas anteriores» → sección de acción (rojo suave)
#   «Sin pendientes de jornadas anteriores» → nota; sin banda.

.mapdf_NAVY <- "#002457"
.mapdf_BLANCO <- "#FFFFFF"
.mapdf_CABECERA_BG <- "#E7EEF9"
.mapdf_CABECERA_FG <- "#1B4B8F"
.mapdf_TOTAL_BG <- "#F3EDEA"
.mapdf_TOTAL_FG <- "#5B4636"
.mapdf_ALERTA_BG <- "#FBE9EA"
.mapdf_ALERTA_FG <- "#8F3A42"

#' Requests de formato de «Plan del día» para el batch-2 del motor.
#'
#' @param sheet_id id numérico de la pestaña.
#' @param rows los values realmente publicados (selector + listado).
#' @return lista de requests `repeatCell` (vacía sin filas).
#' @keywords internal
monitoreo_aulas_plan_dia_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (primera %in% c("VER EL DÍA:", "PLAN DEL DÍA ELEGIDO")) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, .mapdf_NAVY, .mapdf_BLANCO)
    } else if (identical(primera, "FECHA AGENDADA")) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, .mapdf_CABECERA_BG, .mapdf_CABECERA_FG)
    } else if (identical(primera, "Total de la jornada")) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, .mapdf_TOTAL_BG, .mapdf_TOTAL_FG)
    } else if (identical(primera, "Pendientes de jornadas anteriores")) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, .mapdf_ALERTA_BG, .mapdf_ALERTA_FG)
    }
  }
  requests
}
