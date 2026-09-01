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
