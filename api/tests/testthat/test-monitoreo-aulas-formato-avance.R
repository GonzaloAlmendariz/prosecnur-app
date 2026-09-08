# El layout de «Avance de campo» en Google Sheets — unidad B19 (oleada v4-app).
#
# Dictado de Gonzalo (2026-09-01, textual): «tiene una estructura muy, muy fea;
# no se ven bien las tablas, no se organiza bien, no se entiende cómo se
# organiza; se ve como toda esa información, no como una tabla».
#
# Contrato congelado por el lead: cada bloque del modelo (meta «Avance contra
# la meta», avance por facultad, producción por aplicador, avance diario) sale
# como TABLA con banda de título propia y cabecera de columnas formateada; el
# formato de Sheets de ESA hoja emite requests de banda para cada título de
# bloque y de cabecera para cada tabla, DERIVANDO las filas del contenido del
# renderer, no de números mágicos. Los números pineados de la equivalencia
# xlsx↔Sheets NO cambian (test-carga-aulas-libro-avance-sheets.R): el
# contenido es el mismo, cambia la presentación.
#
# SOLAPE DECLARADO: estos pines caerían naturalmente en
# test-monitoreo-aulas-sheets-formato.R, pero ese archivo lo está trabajando
# la oleada autor-libro-v4 en paralelo; viven aquí en archivo propio a
# propósito (regla de ownership de la oleada v4-app). La frontera pineada es
# `.malp_formato_requests(sheet_id, tab_name, rows)` — el adaptador que el
# motor de publicación invoca en su batch-2 con los rows realmente publicados,
# así que las filas de banda TIENEN que salir del contenido.
#
# Hoy (rojo): «Avance de campo» cae en el else genérico de
# `monitoreo_aulas_sheets_formato_requests` — pinta las dos primeras filas
# como si fueran cabecera y un ancho único, y ninguna request alcanza los
# títulos de bloque ni las cabeceras de tabla.

# --- fixtures (autocontenidos: los helpers de otro test file no se ven) -------

.mfa_plan <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20)
)

.mfa_respuestas <- function() data.frame(
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.mfa_partes <- function() list(
  list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
  list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8)
)

.mfa_cuotas <- function() list(
  meta_diseno = 40, meta_operativa = 60,
  facultades = list(
    list(facultad = "Letras", cuota = 40, cuota_sexo = list(F = 20, M = 20))
  )
)

# Modelo COMPLETO: los cuatro bloques presentes (facultades exige cuotas).
.mfa_modelo_completo <- function() aulas_libro_indicadores(
  .mfa_plan(),
  efectivas = c(`CH 1` = 18, `CH 2` = 12),
  responses = .mfa_respuestas(),
  validas = c(TRUE, TRUE, TRUE),
  partes = .mfa_partes(),
  cuotas = .mfa_cuotas()
)

# Modelo con OTRA geometría: sin efectivas (el bloque de meta gana la nota de
# «sin dato» y desplaza todo lo de abajo), sin cuotas (no hay bloque de
# facultades) y sin partes (aplicadores declara su vacío en vez de tabla).
# Los títulos que quedan viven en filas DISTINTAS a las del modelo completo.
.mfa_modelo_minimo <- function() aulas_libro_indicadores(
  .mfa_plan(),
  responses = .mfa_respuestas(),
  validas = c(TRUE, TRUE, TRUE)
)

# Los rows que el motor pasa al adaptador: el data.frame del renderer como
# filas de values (mismo camino que la publicación real).
.mfa_rows <- function(ind) {
  .malp_df_a_values(aulas_libro_hoja_avance(ind, fecha = as.Date("2026-08-15")))
}

# --- lectura de rows y de requests --------------------------------------------

# La fila (1-based) del primer row que trae la etiqueta como celda, o NA.
.mfa_fila_de <- function(rows, etiqueta) {
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    if (etiqueta %in% celdas) return(i)
  }
  NA_integer_
}

# Todos los GridRange (startRowIndex/endRowIndex) que una request contenga,
# a cualquier profundidad: updateCells$range, repeatCell$range, los ranges de
# una regla condicional, un banding… La forma exacta es del implementador.
.mfa_grid_ranges <- function(request) {
  out <- list()
  walk <- function(nodo) {
    if (!is.list(nodo)) return(invisible(NULL))
    if (!is.null(nodo$startRowIndex) && !is.null(nodo$endRowIndex)) {
      out[[length(out) + 1L]] <<- nodo
    }
    for (hijo in nodo) walk(hijo)
    invisible(NULL)
  }
  walk(request)
  out
}

# ¿Alguna request de FORMATO cubre la fila (1-based) con un rango acotado?
# «Acotado» = a lo más 3 filas: una banda o una cabecera visten SU fila (o su
# par título+cabecera), no el rectángulo entero — el updateCells genérico que
# hoy pinta las «cabeceras» de arriba no puede colarse como banda de un bloque.
.mfa_alguna_pinta_fila <- function(requests, fila) {
  for (request in requests) {
    txt <- paste(deparse(request), collapse = " ")
    if (!grepl("userEnteredFormat|backgroundColor|textFormat|bandedRange", txt)) next
    for (rg in .mfa_grid_ranges(request)) {
      ini <- suppressWarnings(as.integer(rg$startRowIndex))
      fin <- suppressWarnings(as.integer(rg$endRowIndex))
      if (!length(ini) || !length(fin) || is.na(ini) || is.na(fin)) next
      if (ini <= fila - 1L && (fila - 1L) < fin && (fin - ini) <= 3L) return(TRUE)
    }
  }
  FALSE
}

.mfa_requests <- function(rows) {
  .malp_formato_requests(sheet_id = 501L, tab_name = "Avance de campo", rows = rows)
}

# --- B19: bandas de título y cabeceras de tabla -------------------------------

test_that("B19: el formato emite una banda para CADA título de bloque de «Avance de campo»", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  for (titulo in c("Avance contra la meta", "Avance por facultad",
                   "Producción por aplicador", "Avance diario")) {
    fila <- .mfa_fila_de(rows, titulo)
    expect_false(is.na(fila), info = sprintf("el renderer perdió el título «%s»", titulo))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("sin banda para «%s» (fila %d del contenido)", titulo, fila))
  }
})

test_that("B19: el formato viste la cabecera de columnas de cada tabla del modelo", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  # La fila de nombres de cada tabla, localizada por su primera columna:
  # Facultad (avance por facultad), Aplicador (producción), Dia (diario).
  for (cabecera in c("Facultad", "Aplicador", "Dia")) {
    fila <- .mfa_fila_de(rows, cabecera)
    expect_false(is.na(fila),
                 info = sprintf("el renderer perdió la cabecera «%s»", cabecera))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("cabecera «%s» sin formato (fila %d del contenido)", cabecera, fila))
  }
})

test_that("B19: las filas de banda se derivan del contenido — otra geometría, mismas bandas", {
  # El modelo mínimo corre los bloques de sitio (nota de «sin dato» en la
  # meta, sin facultades, aplicadores con vacío declarado): si el formato
  # llevara números mágicos, las bandas caerían donde el modelo completo las
  # tenía. Aquí se exige que sigan a SU contenido.
  rows <- .mfa_rows(.mfa_modelo_minimo())
  requests <- .mfa_requests(rows)
  expect_true(is.na(.mfa_fila_de(rows, "Avance por facultad")),
              info = "el fixture mínimo no debería traer bloque de facultades")
  for (titulo in c("Avance contra la meta", "Producción por aplicador",
                   "Avance diario")) {
    fila <- .mfa_fila_de(rows, titulo)
    expect_false(is.na(fila), info = sprintf("el renderer perdió el título «%s»", titulo))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("sin banda para «%s» (fila %d del contenido mínimo)", titulo, fila))
  }
  # Y la única tabla que queda (el diario) conserva su cabecera vestida.
  fila_dia <- .mfa_fila_de(rows, "Dia")
  expect_false(is.na(fila_dia))
  expect_true(.mfa_alguna_pinta_fila(requests, fila_dia),
              info = sprintf("cabecera «Dia» sin formato (fila %d del contenido mínimo)", fila_dia))
})

# --- S1 (loop estética-aulas-sheets, 2026-09-07): la hoja se lee como tabla ---
#
# Medido antes del cambio con el modelo completo (27 filas × 12 columnas): la
# capa genérica congela 2 filas + columna A y emite UN solo ancho (150 px) para
# las doce columnas; ninguna request alinea cifras. Con 150 px «Aulas que
# llegaron a SU meta» se corta y las cifras —publicadas como texto— quedan
# pegadas a la izquierda como rótulos. Vara (dictado 2026-09-01): «se ve como
# toda esa información, no como una tabla».

# El ancho EFECTIVO por columna (1-based) tras aplicar las requests en orden:
# la última que cubre la columna manda, igual que hace la API.
.mfa_anchos_efectivos <- function(requests, n_cols) {
  anchos <- rep(NA_integer_, n_cols)
  for (request in requests) {
    d <- request$updateDimensionProperties
    if (is.null(d) || !identical(d$range$dimension, "COLUMNS")) next
    desde <- as.integer(d$range$startIndex)
    hasta <- min(as.integer(d$range$endIndex), n_cols)
    if (hasta <= desde) next
    anchos[seq.int(desde + 1L, hasta)] <- as.integer(d$properties$pixelSize)
  }
  anchos
}

# Las alineaciones horizontales que las requests aplican a la celda (fila,
# col), 1-based; vacío si ninguna la toca.
.mfa_alineacion_de <- function(requests, fila, col) {
  out <- character(0)
  for (request in requests) {
    rc <- request$repeatCell
    if (is.null(rc)) next
    al <- rc$cell$userEnteredFormat$horizontalAlignment
    if (is.null(al)) next
    rg <- rc$range
    if (rg$startRowIndex <= fila - 1L && (fila - 1L) < rg$endRowIndex &&
        rg$startColumnIndex <= col - 1L && (col - 1L) < rg$endColumnIndex) {
      out <- c(out, al)
    }
  }
  out
}

test_that("S1: cada columna de «Avance de campo» tiene su ancho, derivado del contenido", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  n_cols <- max(lengths(rows))
  anchos <- .mfa_anchos_efectivos(.mfa_requests(rows), n_cols)
  expect_false(anyNA(anchos), info = "hay columnas publicadas sin ancho")
  expect_true(all(anchos >= 90L & anchos <= 320L),
              info = paste("anchos fuera de [90, 320]:", paste(anchos, collapse = ", ")))
  # La columna de rótulos («Aulas que llegaron a SU meta», «Efectivas
  # conseguidas») pide más que una columna de cifras.
  expect_gt(anchos[1], anchos[2])
  # Y no es un ancho único para todas.
  expect_gt(length(unique(anchos)), 1L)
})

test_that("S1: las cifras van a la derecha y los rótulos se quedan a la izquierda", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  fila <- .mfa_fila_de(rows, "Letras")
  expect_false(is.na(fila), info = "el renderer perdió la fila de datos de Letras")
  expect_true("RIGHT" %in% .mfa_alineacion_de(requests, fila, 2L),
              info = "la cifra «Muestra» de Letras no va a la derecha")
  expect_true("RIGHT" %in% .mfa_alineacion_de(requests, fila, 11L),
              info = "el «Avance» (75 %) de Letras no va a la derecha")
  expect_false("RIGHT" %in% .mfa_alineacion_de(requests, fila, 1L),
               info = "el rótulo «Letras» no debe ir a la derecha")
  # V3 (2026-09-08): con cuotas del diseño el bloque de meta es la tabla de las
  # dos metas por sexo, y «Encuestas de la meta» —la suma de `expected_valid`
  # del plan— ya no lo preside. La fila equivalente, presente con cuotas y sin
  # ellas, es «Efectivas conseguidas».
  fila_meta <- .mfa_fila_de(rows, "Efectivas conseguidas")
  expect_false(is.na(fila_meta), info = "el renderer perdió la fila «Efectivas conseguidas»")
  expect_true("RIGHT" %in% .mfa_alineacion_de(requests, fila_meta, 2L),
              info = "la cifra del bloque de meta no va a la derecha")
  # Las dos filas de título no se alinean: son texto de portada.
  expect_length(.mfa_alineacion_de(requests, 1L, 2L), 0L)
})

test_that("S1: la cabecera de cada tabla baja de línea en su columna en vez de cortarse", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  fila <- .mfa_fila_de(rows, "Aplicador")   # «Cursos-horario asignados» no cabe en su columna
  con_wrap <- FALSE
  for (request in requests) {
    rc <- request$repeatCell
    if (is.null(rc)) next
    rg <- rc$range
    if (rg$startRowIndex <= fila - 1L && (fila - 1L) < rg$endRowIndex &&
        identical(rc$cell$userEnteredFormat$wrapStrategy, "WRAP")) con_wrap <- TRUE
  }
  expect_true(con_wrap, info = sprintf("la cabecera de la fila %d no baja de línea", fila))
})

test_that("S1: el título queda congelado y la columna de rótulos NO, nunca la hoja entera", {
  # **La columna dejó de congelarse el 2026-09-08.** «Avance de campo» no es una
  # tabla: es una pila de tablas distintas con sus notas, y su columna A rotula
  # unas veces la meta, otras la facultad y otras el aplicador — congelarla
  # enseña el rótulo equivocado al desplazarse. Y además lo impedía: sus notas se
  # combinan de la columna A hasta el final, y Google rechaza el batch entero
  # con «no se pueden combinar columnas inmovilizadas con columnas no
  # inmovilizadas». Se vio publicando, cuando la Base de control pasó de 43 a 55
  # columnas y el formato volvió a enviarse.
  for (modelo in list(.mfa_modelo_completo(), .mfa_modelo_minimo())) {
    rows <- .mfa_rows(modelo)
    requests <- .mfa_requests(rows)
    freezes <- Filter(Negate(is.null), lapply(requests, function(r) {
      r$updateSheetProperties$properties$gridProperties
    }))
    expect_gte(length(freezes), 1L)
    ultimo <- freezes[[length(freezes)]]
    expect_identical(as.integer(ultimo$frozenRowCount), 2L)
    expect_identical(as.integer(ultimo$frozenColumnCount), 0L)
    expect_lt(as.integer(ultimo$frozenRowCount), length(rows))
  }
})

test_that("S1: una fecha u hora ISO entre las cifras no deja el bloque sin alinear (caso real del 07/09)", {
  # El libro real trae «2026-09-07T20:41:36Z» en la columna B del bloque de
  # meta; una celda así no es texto de rótulo y no debe apagar la alineación.
  m <- .maaf_celdas(list(
    list("Avance de campo"), list("Al 07/09/2026"), list(""),
    list("Avance contra la meta"),
    list("Encuestas de la meta", "3158"), list("Avance", "6,7 %"),
    list("Última respuesta", "2026-09-07T20:41:36Z"), list("Corte", "2026-09-07"),
    list("Hora", "18:30"), list("Sin dato", "\u2014")
  ), 2L)
  expect_identical(.maaf_columnas_cifra(m), c(FALSE, TRUE))
  # Y un texto de verdad sí la apaga: la columna deja de ser de cifras.
  m2 <- .maaf_celdas(list(list("Avance contra la meta"), list("Encuestas de la meta", "3158"),
                          list("Responsable", "Equipo A")), 2L)
  expect_identical(.maaf_columnas_cifra(m2), c(FALSE, FALSE))
})

# --- S2: las notas no se derraman en Sheets ----------------------------------

# Las requests `mergeCells` que cubren la fila (1-based) de A a la última
# columna publicada.
.mfa_fusiones_de <- function(requests, fila, n_cols) {
  out <- 0L
  for (request in requests) {
    mc <- request$mergeCells
    if (is.null(mc)) next
    rg <- mc$range
    if (rg$startRowIndex == fila - 1L && rg$endRowIndex == fila &&
        rg$startColumnIndex == 0L && rg$endColumnIndex == n_cols) out <- out + 1L
  }
  out
}

.mfa_alto_de <- function(requests, fila) {
  for (request in requests) {
    d <- request$updateDimensionProperties
    if (is.null(d) || !identical(d$range$dimension, "ROWS")) next
    if (d$range$startIndex == fila - 1L && d$range$endIndex == fila) return(as.integer(d$properties$pixelSize))
  }
  NA_integer_
}

test_that("S2: cada nota de «Avance de campo» va fusionada a lo ancho, con ajuste de texto y alto de fila", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  n_cols <- max(lengths(rows))
  requests <- .mfa_requests(rows)
  primeras <- vapply(rows, function(r) trimws(as.character(unlist(r)[1] %||% "")), character(1))
  notas <- which(startsWith(primeras, "La meta y el avance diario") |
                 startsWith(primeras, "La cuota es de cada facultad") |
                 startsWith(primeras, "La muestra es la cuota"))
  expect_gte(length(notas), 2L)
  for (fila in notas) {
    expect_identical(.mfa_fusiones_de(requests, fila, n_cols), 1L,
                     info = sprintf("la nota de la fila %d no va fusionada de A a la última columna", fila))
    con_wrap <- FALSE
    for (request in requests) {
      rc <- request$repeatCell
      if (is.null(rc)) next
      rg <- rc$range
      if (rg$startRowIndex <= fila - 1L && (fila - 1L) < rg$endRowIndex &&
          identical(rc$cell$userEnteredFormat$wrapStrategy, "WRAP")) con_wrap <- TRUE
    }
    expect_true(con_wrap, info = sprintf("la nota de la fila %d no baja de línea", fila))
    expect_false(is.na(.mfa_alto_de(requests, fila)),
                 info = sprintf("la nota de la fila %d no tiene alto de fila", fila))
  }
  # Ni las filas de tabla ni las de título se fusionan.
  for (etiqueta in c("Letras", "Avance contra la meta", "Facultad", "Efectivas conseguidas")) {
    fila <- .mfa_fila_de(rows, etiqueta)
    expect_identical(.mfa_fusiones_de(requests, fila, n_cols), 0L,
                     info = sprintf("«%s» (fila %d) no debe fusionarse", etiqueta, fila))
  }
})

# --- S5: la fila «Total» del diario se viste como cierre -------------------------

test_that("S5: la fila «Total» del avance diario lleva banda propia (negrita), y las de los días no", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  fila_total <- .mfa_fila_de(rows, "Total")
  expect_false(is.na(fila_total), info = "el renderer no trae la fila «Total»")
  expect_true(.mfa_alguna_pinta_fila(requests, fila_total), info = "la fila «Total» va sin banda")
  fila_dia <- .mfa_fila_de(rows, "2026-08-10")
  expect_false(.mfa_alguna_pinta_fila(requests, fila_dia), info = "una fila de día no debe llevar banda")
})
