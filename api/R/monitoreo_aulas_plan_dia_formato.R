# El formato de «Plan del día» en Google Sheets — hermana de B19.
#
# Dictados de Gonzalo (2026-09-03, mirando el libro vivo): «Plan del día
# también está muy feo» y luego «mejora la estética de las hojas asignación,
# plan del día». Misma doctrina que «Avance de campo» y «Asignación de
# aplicadores»: TODO derivado FILA A FILA del contenido realmente publicado
# —jamás números mágicos— y la paleta compartida del libro (navy #002457 para
# títulos, #E7EEF9/#1B4B8F para cabeceras de tabla, el rojo suave para lo que
# exige acción). Los strings detectados son los que emiten
# `aulas_libro_hoja_plan_dia()` y el selector B20 — si un renderer cambia un
# rótulo, el test de este archivo lo dice.
#
# Estructura real de la hoja (selector B20 + listado B2.1b):
#   «VER EL DÍA:»                → título del selector (navy); la celda
#                                   ELEGIBLE de al lado va en el ámbar de la
#                                   casa — es LA celda donde se actúa
#   «PLAN DEL DÍA ELEGIDO»       → título del área de spill (navy)
#   «FECHA AGENDADA …»           → cabecera de tabla (dos veces: área y
#                                   listado) (azul claro, con wrap para que
#                                   los títulos largos bajen de línea)
#   «Total de la jornada …»      → cierre de cada grupo de fecha (banda
#                                   neutra cálida en negrita: subtotal, no
#                                   título)
#   «Pendientes de jornadas anteriores» → sección de acción (rojo suave)
#   «Sin pendientes…»            → nota; sin banda.
#
# Encima de las bandas: anchos de columna por rangos agrupados (los 15
# títulos de `.capd_CABECERA` a su medida — nombres de curso y docente
# anchos, horas compactas) y las columnas de hora y de elegibles centradas.

.mapdf_NAVY <- "#002457"
.mapdf_BLANCO <- "#FFFFFF"
.mapdf_CABECERA_BG <- "#E7EEF9"
.mapdf_CABECERA_FG <- "#1B4B8F"
.mapdf_TOTAL_BG <- "#F3EDEA"
.mapdf_TOTAL_FG <- "#5B4636"
.mapdf_ALERTA_BG <- "#FBE9EA"
.mapdf_ALERTA_FG <- "#8F3A42"
# El ámbar de la casa (el mismo par de «EN CONTACTO» en el semáforo): la
# celda elegible del selector es gestión en curso, no un dato.
.mapdf_SELECTOR_BG <- "#FDF3D8"
.mapdf_SELECTOR_FG <- "#7A5B12"

# Anchos por RANGOS agrupados sobre las 15 columnas de `.capd_CABECERA`:
# fecha/día compactos, horas parejas, curso y docente anchos.
.mapdf_ANCHOS <- list(
  list(desde = 0L, hasta = 2L, px = 102L),   # FECHA AGENDADA · DÍA
  list(desde = 2L, hasta = 3L, px = 88L),    # HORA (texto libre del equipo)
  list(desde = 3L, hasta = 5L, px = 64L),    # INICIO · FIN
  list(desde = 5L, hasta = 6L, px = 118L),   # CURSO-HORARIO
  list(desde = 6L, hasta = 7L, px = 252L),   # NOMBRE DEL CURSO
  list(desde = 7L, hasta = 9L, px = 158L),   # FACULTAD · SESIONES Y AULA
  list(desde = 9L, hasta = 10L, px = 208L),  # NOMBRE DE DOCENTE
  list(desde = 10L, hasta = 11L, px = 116L), # TELÉFONO DE DOCENTE
  list(desde = 11L, hasta = 12L, px = 84L),  # ELEGIBLES
  list(desde = 12L, hasta = 13L, px = 152L), # APLICADOR
  list(desde = 13L, hasta = 15L, px = 136L)  # ESTADO · ENLACE DE LA FICHA
)

# La celda ELEGIBLE del selector: la de al lado del rótulo, en ámbar y a
# 11 pt — sobre la banda navy de su fila se lee como el control que es.
.mapdf_celda_selector <- function(sheet_id, fila, col) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(
      backgroundColor = .monitoreo_sheets_rgb(.mapdf_SELECTOR_BG),
      textFormat = list(
        bold = TRUE, fontSize = 11L,
        foregroundColor = .monitoreo_sheets_rgb(.mapdf_SELECTOR_FG)
      ),
      horizontalAlignment = "CENTER"
    )),
    fields = "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ))
}

#' Requests de formato de «Plan del día» para el batch-2 del motor.
#'
#' @param sheet_id id numérico de la pestaña.
#' @param rows los values realmente publicados (selector + listado).
#' @return lista de requests de batchUpdate (vacía sin filas).
#' @keywords internal
monitoreo_aulas_plan_dia_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, "VER EL DÍA:")) {
      poner(.maaf_banda(sheet_id, i, n_cols, .mapdf_NAVY, .mapdf_BLANCO, size = 12L))
      poner(.maaf_alto_fila(sheet_id, i, 32L))
      # La celda elegible es la siguiente al rótulo en SU fila (así la sembró
      # el selector B20); el resalte va después de la banda para ganarle.
      j <- which(celdas == "VER EL DÍA:")[1]
      poner(.mapdf_celda_selector(sheet_id, i, j + 1L))
    } else if (identical(primera, "PLAN DEL DÍA ELEGIDO")) {
      poner(.maaf_banda(sheet_id, i, n_cols, .mapdf_NAVY, .mapdf_BLANCO, size = 12L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (identical(primera, "FECHA AGENDADA")) {
      poner(.maaf_banda(sheet_id, i, n_cols, .mapdf_CABECERA_BG, .mapdf_CABECERA_FG,
                        wrap = TRUE))
    } else if (identical(primera, "Total de la jornada")) {
      poner(.maaf_banda(sheet_id, i, n_cols, .mapdf_TOTAL_BG, .mapdf_TOTAL_FG))
    } else if (identical(primera, "Pendientes de jornadas anteriores")) {
      poner(.maaf_banda(sheet_id, i, n_cols, .mapdf_ALERTA_BG, .mapdf_ALERTA_FG))
    }
  }
  # Anchos y centrados — solo con la tabla completa publicada (las 15
  # columnas de `.capd_CABECERA`); un rectángulo más angosto no tiene esta
  # geometría.
  if (n_cols >= 15L) {
    for (a in .mapdf_ANCHOS) poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
    poner(.maaf_centrar(sheet_id, 2L, 5L, length(rows)))    # HORA · INICIO · FIN
    poner(.maaf_centrar(sheet_id, 11L, 12L, length(rows)))  # ELEGIBLES
  }
  requests
}
