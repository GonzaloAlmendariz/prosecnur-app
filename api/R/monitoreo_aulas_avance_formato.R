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

# S5: la fila de cierre del avance diario, tal como la escribe
# `.cali_cierre_diario()` (carga_aulas_libro_cierre_diario.R). V2 (2026-09-08):
# también la fila «Total» de la tabla por facultad (`.calaf_fila_total()`):
# toda fila cuya primera celda diga «Total» es un cierre y se viste igual.
.maaf_FILA_TOTAL <- "Total"

# Una banda de UNA fila a lo ancho del rectángulo publicado: fondo, tinta en
# negrita. `repeatCell` con fields acotado a userEnteredFormat — no toca
# values ni dataValidation. Los opcionales dan la jerarquía tipográfica
# (tamaño, itálica, peso) y `wrap` deja que una cabecera larga baje de línea
# en su columna en vez de cortarse; los defaults reproducen la banda clásica,
# así que los llamadores existentes no cambian de salida.
.maaf_banda <- function(sheet_id, fila, n_cols, fondo, tinta,
                        size = NULL, italic = FALSE, bold = TRUE, wrap = FALSE) {
  texto <- list(
    bold = isTRUE(bold),
    foregroundColor = .monitoreo_sheets_rgb(tinta)
  )
  if (!is.null(size)) texto$fontSize <- as.integer(size)
  if (isTRUE(italic)) texto$italic <- TRUE
  formato <- list(
    backgroundColor = .monitoreo_sheets_rgb(fondo),
    textFormat = texto
  )
  campos <- "userEnteredFormat(backgroundColor,textFormat)"
  if (isTRUE(wrap)) {
    formato$wrapStrategy <- "WRAP"
    formato$verticalAlignment <- "MIDDLE"
    campos <- "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)"
  }
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
    ),
    cell = list(userEnteredFormat = formato),
    fields = campos
  ))
}

# El alto en píxeles de UNA fila (updateDimensionProperties ROWS): el aire de
# los títulos, que a alto por defecto se ven apretados contra su banda.
.maaf_alto_fila <- function(sheet_id, fila, pixeles) {
  list(updateDimensionProperties = list(
    range = list(
      sheetId = sheet_id, dimension = "ROWS",
      startIndex = as.integer(fila - 1L), endIndex = as.integer(fila)
    ),
    properties = list(pixelSize = as.integer(pixeles)),
    fields = "pixelSize"
  ))
}

# Centrado horizontal de un rango de columnas a toda la altura publicada
# (horas, conteos): fields acotado al alineamiento — no pisa bandas ni values.
.maaf_centrar <- function(sheet_id, desde_col, hasta_col, n_filas) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = 0L, endRowIndex = as.integer(n_filas),
      startColumnIndex = as.integer(desde_col), endColumnIndex = as.integer(hasta_col)
    ),
    cell = list(userEnteredFormat = list(horizontalAlignment = "CENTER")),
    fields = "userEnteredFormat(horizontalAlignment)"
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
      # S1: la cabecera baja de línea en su columna («Cursos-horario
      # asignados» no cabe en la suya) en vez de cortarse.
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE)
    } else if (identical(primera, .maaf_FILA_TOTAL)) {
      # S5/V2: la fila «Total» (del avance diario y de la tabla por facultad),
      # vestida como cierre: fondo apenas tintado y la cifra en negrita navy,
      # sin confundirse con una cabecera.
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#F3F5F9", "#002457")
    }
  }
  # S1: anchos por columna y cifras a la derecha, derivados del contenido.
  # Van DESPUÉS del ancho único de la capa genérica, que así queda pisado.
  m <- .maaf_celdas(rows, n_cols)
  c(requests, .maaf_ancho_requests(sheet_id, m), .maaf_alinear_requests(sheet_id, m),
    .maaf_nota_requests(sheet_id, m))
}

# --- S1 (loop estética-aulas-sheets, 2026-09-07): la hoja se lee como tabla ---
#
# Medido antes: la capa genérica (`monitoreo_aulas_sheets_formato_requests`)
# congela título y columna A —eso se conserva— y fija UN ancho de 150 px para
# las doce columnas; con eso «Aulas que llegaron a SU meta» se corta y las
# cifras, que viajan como texto, quedan pegadas a la izquierda igual que un
# rótulo. Aquí cada columna pide el ancho que su contenido necesita, la
# cabecera de tabla baja de línea en vez de ensanchar la columna, y las
# columnas cuyas celdas de datos son cifras se alinean a la derecha. Todo se
# deriva de los rows publicados; ninguna posición viene de un número mágico.

# Una celda más larga que esto es una nota, no un rótulo: no manda ancho.
.maaf_NOTA_MIN_CHARS <- 60L

# S2: una fila es NOTA cuando trae UNA sola celda con contenido, en la columna
# A, que no es título de bloque ni cabecera y pasa de este largo (los rótulos
# de la hoja no llegan a 30; «Al 07/09/2026» tampoco).
.maaf_NOTA_DETECTAR_CHARS <- 40L

# Cabecera de tabla: baja de línea, así que aporta a lo más esto al ancho.
.maaf_CABECERA_MAX_CHARS <- 14L

# ¿La celda es un VALOR que se lee alineado a la derecha: cifra (entera,
# decimal, porcentaje), fecha u hora ISO, o un vacío declarado? Medido con el
# libro real del 07/09: el bloque de meta trae una marca `2026-09-07T20:41:36Z`
# en la columna de cifras, y sin esta cláusula esa sola celda dejaba el bloque
# entero pegado a la izquierda.
.maaf_es_cifra <- function(x) {
  x <- trimws(as.character(x))
  !nzchar(x) | x %in% c("\u2014", "-", "n/d", "s/d") |
    grepl("^[-+]?[0-9]+([.,][0-9]+)?\\s*%?$", x) |
    grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ][0-9]{2}:[0-9]{2}(:[0-9]{2})?Z?)?$", x) |
    grepl("^[0-9]{1,2}:[0-9]{2}$", x)
}

# Los rows como matriz de caracteres n_filas x n_cols, rellenando a la
# derecha: la API devuelve filas dentadas y el renderer también las produce.
.maaf_celdas <- function(rows, n_cols) {
  padded <- lapply(rows, function(row) {
    celdas <- trimws(as.character(unlist(row %||% list(), use.names = FALSE)))
    celdas[is.na(celdas)] <- ""
    c(celdas, rep("", max(0L, n_cols - length(celdas))))[seq_len(n_cols)]
  })
  matrix(unlist(padded, use.names = FALSE), ncol = n_cols, byrow = TRUE)
}

# Una fila de DATOS: ni título de bloque, ni cabecera de tabla, ni portada,
# ni nota (esas traen una sola celda con contenido).
.maaf_es_fila_de_datos <- function(celdas_fila) {
  primera <- celdas_fila[[1L]]
  !(primera %in% .maaf_TITULOS_BLOQUE) && !(primera %in% .maaf_CABECERAS_TABLA) &&
    sum(nzchar(celdas_fila)) >= 2L
}

# El ancho en píxeles de cada columna: ~7,2 px por carácter más el aire de la
# celda, entre 90 y 320. Las notas no cuentan; las cabeceras cuentan hasta
# `.maaf_CABECERA_MAX_CHARS` porque bajan de línea.
.maaf_anchos_px <- function(m) {
  es_cabecera <- m[, 1L] %in% .maaf_CABECERAS_TABLA
  vapply(seq_len(ncol(m)), function(j) {
    n <- nchar(m[, j], type = "chars")
    n[n > .maaf_NOTA_MIN_CHARS] <- 0L
    n[es_cabecera] <- pmin(n[es_cabecera], .maaf_CABECERA_MAX_CHARS)
    as.integer(min(320L, max(90L, round(max(0L, n) * 7.2) + 20L)))
  }, integer(1))
}

# Una request de ancho por tramo de columnas contiguas con el mismo ancho.
.maaf_ancho_requests <- function(sheet_id, m) {
  px <- .maaf_anchos_px(m)
  requests <- list()
  ini <- 1L
  for (j in seq_along(px)) {
    if (j == length(px) || px[j + 1L] != px[j]) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, ini - 1L, j, px[j])
      ini <- j + 1L
    }
  }
  requests
}

# Qué columnas son de cifras: todas sus celdas de datos con contenido son
# cifras. La columna A nunca: son los rótulos.
.maaf_columnas_cifra <- function(m) {
  de_datos <- vapply(seq_len(nrow(m)), function(i) .maaf_es_fila_de_datos(m[i, ]), logical(1))
  datos <- m[de_datos, , drop = FALSE]
  vapply(seq_len(ncol(m)), function(j) {
    if (j == 1L || !nrow(datos)) return(FALSE)
    v <- datos[, j]
    v <- v[nzchar(v)]
    length(v) > 0L && all(.maaf_es_cifra(v))
  }, logical(1))
}

# Alineación a la derecha de un rectángulo, con fields acotado: no pisa
# bandas ni values.
.maaf_derecha <- function(sheet_id, desde_col, hasta_col, desde_fila, n_filas) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde_fila), endRowIndex = as.integer(n_filas),
      startColumnIndex = as.integer(desde_col), endColumnIndex = as.integer(hasta_col)
    ),
    cell = list(userEnteredFormat = list(horizontalAlignment = "RIGHT")),
    fields = "userEnteredFormat(horizontalAlignment)"
  ))
}

# Una request por tramo de columnas de cifras contiguas, desde la fila 3 (las
# dos de portada son texto) hasta el final publicado.
.maaf_alinear_requests <- function(sheet_id, m) {
  cifra <- .maaf_columnas_cifra(m)
  n_filas <- nrow(m)
  desde_fila <- min(2L, n_filas)
  requests <- list()
  j <- 1L
  while (j <= length(cifra)) {
    if (!cifra[j]) { j <- j + 1L; next }
    k <- j
    while (k < length(cifra) && cifra[k + 1L]) k <- k + 1L
    requests[[length(requests) + 1L]] <- .maaf_derecha(sheet_id, j - 1L, k, desde_fila, n_filas)
    j <- k + 1L
  }
  requests
}

# --- S2: las notas no se derraman -------------------------------------------
#
# Medido en el libro real del 07/09: las notas («La cuota es de cada facultad y
# de cada sexo…», «La muestra es la cuota del diseño…») viajan en UNA celda de
# la columna A; en Sheets se derraman hasta la primera celda ocupada y
# sobresalen de su tabla. Aquí cada nota se fusiona a lo ancho publicado, baja
# de línea, se lee desde arriba y su fila crece lo que el texto necesita. El
# reset de pestaña del motor (`.monitoreo_sheets_reset_tab_requests`) deshace
# los merges viejos antes de reformatear, así que una republicación con otra
# geometría no hereda fusiones corridas.

.maaf_es_nota <- function(celdas_fila) {
  con_texto <- which(nzchar(celdas_fila))
  if (length(con_texto) != 1L || con_texto != 1L) return(FALSE)
  primera <- celdas_fila[[1L]]
  !(primera %in% .maaf_TITULOS_BLOQUE) && !(primera %in% .maaf_CABECERAS_TABLA) &&
    nchar(primera, type = "chars") > .maaf_NOTA_DETECTAR_CHARS
}

.maaf_nota_requests <- function(sheet_id, m) {
  n_filas <- nrow(m)
  n_cols <- ncol(m)
  if (!n_filas) return(list())
  # Los caracteres por línea salen de los anchos que esta misma hoja pide
  # (~7,2 px por carácter); así el alto sigue al ancho real, no a una constante.
  chars_por_linea <- max(20L, as.integer(floor(sum(.maaf_anchos_px(m)) / 7.2)))
  requests <- list()
  for (i in seq_len(n_filas)) {
    if (!.maaf_es_nota(m[i, ])) next
    rango <- list(
      sheetId = sheet_id,
      startRowIndex = as.integer(i - 1L), endRowIndex = as.integer(i),
      startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
    )
    requests[[length(requests) + 1L]] <- list(mergeCells = list(range = rango, mergeType = "MERGE_ALL"))
    requests[[length(requests) + 1L]] <- list(repeatCell = list(
      range = rango,
      cell = list(userEnteredFormat = list(
        wrapStrategy = "WRAP",
        verticalAlignment = "TOP",
        textFormat = list(foregroundColor = .monitoreo_sheets_rgb("#5B6472"))
      )),
      fields = "userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)"
    ))
    lineas <- max(1L, ceiling(nchar(m[i, 1L], type = "chars") / chars_por_linea))
    requests[[length(requests) + 1L]] <- .maaf_alto_fila(sheet_id, i, 21L * lineas + 4L)
  }
  requests
}
