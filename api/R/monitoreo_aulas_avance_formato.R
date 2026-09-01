# El formato de «Avance de campo» en Google Sheets — unidad B19 (v4-app).
#
# Dictado de Gonzalo (2026-09-01, textual): «tiene una estructura muy, muy fea;
# no se ven bien las tablas, no se organiza bien, no se entiende cómo se
# organiza; se ve como toda esa información, no como una tabla».
#
# Cada bloque del modelo (meta, facultades, aplicadores, diario) sale como
# TABLA: banda de título propia y cabecera de columnas formateada. Las filas
# se DERIVAN del contenido del renderer (`aulas_libro_hoja_avance`), jamás de
# números mágicos: un modelo sin cuotas no trae bloque de facultades y las
# bandas de los demás siguen a SU contenido, esté donde esté.
#
# Vive en archivo propio y NO en monitoreo_aulas_sheets_formato.R: ese archivo
# lo trabaja la oleada autor-libro-v4 en paralelo (regla de ownership de la
# oleada v4-app). `.malp_formato_requests` — el adaptador que el motor invoca
# en su batch-2 con los rows realmente publicados — integra estas requests
# DESPUÉS de las genéricas de la hoja.
#
# La paleta no se inventa: navy #002457 con blanco en negrita es la cabecera
# del xlsx (`carga_aulas_libro_formato.R` / estilo `cabecera` de indicadores),
# y el par #E7EEF9/#1B4B8F es el azul de la casa que el semáforo del libro ya
# usa («EN RESERVA», monitoreo_aulas_sheets_formato.R).

# Los títulos de bloque del renderer — los mismos strings que emite
# `aulas_libro_hoja_avance()`; si el renderer gana un bloque, su título entra
# aquí para ganar banda (contrato pineado en
# test-monitoreo-aulas-formato-avance.R).
.maaf_TITULOS_BLOQUE <- c(
  "Avance contra la meta", "Avance por facultad",
  "Producción por aplicador", "Avance diario"
)

# La primera columna de la cabecera de cada tabla del modelo: los nombres los
# fija `aulas_libro_indicadores()` (Facultad / Aplicador / Dia) y el renderer
# los escribe tal cual como fila de nombres.
.maaf_CABECERAS_TABLA <- c("Facultad", "Aplicador", "Dia")

# Una banda de UNA fila a lo ancho del rectángulo publicado: fondo, tinta en
# negrita. `repeatCell` con fields acotado a userEnteredFormat — no toca
# values ni dataValidation.
.maaf_banda <- function(sheet_id, fila, n_cols, fondo, tinta) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
    ),
    cell = list(userEnteredFormat = list(
      backgroundColor = .monitoreo_sheets_rgb(fondo),
      textFormat = list(
        bold = TRUE,
        foregroundColor = .monitoreo_sheets_rgb(tinta)
      )
    )),
    fields = "userEnteredFormat(backgroundColor,textFormat)"
  ))
}

# Las requests de banda y cabecera de «Avance de campo», derivadas fila a fila
# del contenido publicado: título de bloque = banda navy; fila de nombres de
# tabla = cabecera azul clara. Lo que no es ni lo uno ni lo otro (cifras,
# notas, vacíos declarados) no se tiñe.
.maaf_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (primera %in% .maaf_TITULOS_BLOQUE) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF")
    } else if (primera %in% .maaf_CABECERAS_TABLA) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F")
    }
  }
  requests
}
