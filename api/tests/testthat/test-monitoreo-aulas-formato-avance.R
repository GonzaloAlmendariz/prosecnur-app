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
  # Con fecha agendada: desde el 2026-09-08 las «Efectivas esperadas» del avance
  # diario son la suma de las metas de las aulas AGENDADAS ese día, así que sin
  # agenda esa columna queda vacía y con ella la diferencia.
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20, scheduled_date = "2026-08-10",
       scheduled_time = "10:00"),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20, scheduled_date = "2026-08-11",
       scheduled_time = "10:00")
)

.mfa_respuestas <- function() data.frame(
  collectorID = c("CH 1", "CH 1", "CH 2"),
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.mfa_cfg <- function() list(source_mapping = list(collector_var = "collectorID"))

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
  cuotas = .mfa_cuotas(),
  cfg = .mfa_cfg(),
  asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo B")
)

# Modelo con OTRA geometría: sin efectivas (el bloque de meta gana la nota de
# «sin dato» y desplaza todo lo de abajo), sin cuotas (no hay bloque de
# facultades) y sin partes (aplicadores declara su vacío en vez de tabla).
# Los títulos que quedan viven en filas DISTINTAS a las del modelo completo.
.mfa_modelo_minimo <- function() aulas_libro_indicadores(
  .mfa_plan(),
  responses = .mfa_respuestas(),
  validas = c(TRUE, TRUE, TRUE),
  cfg = .mfa_cfg()
)

# Los rows que el motor pasa al adaptador: las filas del renderer tal cual
# (mismo camino que la publicación real). Desde el 2026-09-08 llevan celdas
# NUMÉRICAS y no pasan por `.malp_df_a_values`, que las convertiría a texto.
.mfa_rows <- function(ind) {
  aulas_libro_hoja_avance(ind, fecha = as.Date("2026-08-15"))
}

# La fila (1-based) de la cabecera de una tabla, por su CLAVE. Cuatro de las
# cinco empiezan por «Facultad», así que la primera celda ya no las distingue.
.mfa_cabecera_de <- function(rows, clave) {
  for (i in seq_along(rows)) {
    celdas <- vapply(rows[[i]], function(x) as.character(x), character(1))
    if (identical(prosecnurapp:::.calac_tabla_de_cabecera(celdas), clave)) return(i)
  }
  NA_integer_
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

# ¿Hay una BANDA sobre esa fila? Una banda es un `repeatCell` con color de
# fondo que cubre EXACTAMENTE esa fila: así es como se visten los títulos de
# bloque, las cabeceras de tabla y la fila «Total».
#
# El detector pedía «cualquier formato en un rango de ≤ 3 filas» y eso dejó de
# discriminar el 2026-09-08: las requests de numberFormat cubren el rango de su
# tabla, que con dos filas de datos también mide ≤ 3, así que una fila de datos
# cualquiera pasaba por banda. Un pin que se vuelve inespecífico no avisa: pasa.
.mfa_alguna_pinta_fila <- function(requests, fila) {
  for (request in requests) {
    rc <- request$repeatCell
    if (is.null(rc) || is.null(rc$cell$userEnteredFormat$backgroundColor)) next
    rg <- rc$range
    if (identical(as.integer(rg$startRowIndex), as.integer(fila - 1L)) &&
        identical(as.integer(rg$endRowIndex), as.integer(fila))) return(TRUE)
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
  for (titulo in unname(AULAS_AVANCE_TITULOS)) {
    fila <- .mfa_fila_de(rows, titulo)
    expect_false(is.na(fila), info = sprintf("el renderer perdió el título «%s»", titulo))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("sin banda para «%s» (fila %d del contenido)", titulo, fila))
  }
})

test_that("B19: el formato viste la cabecera de columnas de cada tabla del modelo", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  for (clave in names(AULAS_AVANCE_CABECERAS)) {
    fila <- .mfa_cabecera_de(rows, clave)
    expect_false(is.na(fila),
                 info = sprintf("el renderer perdió la cabecera de «%s»", clave))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("cabecera de «%s» sin formato (fila %d del contenido)", clave, fila))
  }
})

test_that("B19: las filas de banda se derivan del contenido — otra geometría, mismas bandas", {
  # El modelo mínimo corre los bloques de sitio (nota de «sin dato» en el bloque
  # general, sin facultades, aplicadores con vacío declarado): si el formato
  # llevara números mágicos, las bandas caerían donde el modelo completo las
  # tenía. Aquí se exige que sigan a SU contenido.
  rows <- .mfa_rows(.mfa_modelo_minimo())
  requests <- .mfa_requests(rows)
  expect_true(is.na(.mfa_cabecera_de(rows, "facultad")),
              info = "el fixture mínimo no debería traer tabla por facultad")
  for (titulo in unname(AULAS_AVANCE_TITULOS)) {
    fila <- .mfa_fila_de(rows, titulo)
    expect_false(is.na(fila), info = sprintf("el renderer perdió el título «%s»", titulo))
    expect_true(.mfa_alguna_pinta_fila(requests, fila),
                info = sprintf("sin banda para «%s» (fila %d del contenido mínimo)", titulo, fila))
  }
  # Y la tabla que queda con datos (el avance diario) conserva su cabecera.
  fila_dia <- .mfa_cabecera_de(rows, "diario")
  expect_false(is.na(fila_dia))
  expect_true(.mfa_alguna_pinta_fila(requests, fila_dia),
              info = sprintf("cabecera del diario sin formato (fila %d del mínimo)", fila_dia))
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
              info = "la cifra «Efectivas» de Letras no va a la derecha")
  cab_fac <- .mfa_cabecera_de(rows, "facultad")
  nombres_fac <- vapply(rows[[cab_fac]], function(x) as.character(x), character(1))
  expect_true("RIGHT" %in% .mfa_alineacion_de(
    requests, fila, which(nombres_fac == "Faltantes muestra")),
              info = "la cifra «Faltantes muestra» de Letras no va a la derecha")
  expect_false("RIGHT" %in% .mfa_alineacion_de(requests, fila, 1L),
               info = "el rótulo «Letras» no debe ir a la derecha")
  # La fila equivalente del bloque general, presente con cuotas y sin ellas.
  fila_meta <- .mfa_fila_de(rows, "Efectivas")
  expect_false(is.na(fila_meta), info = "el renderer perdió la fila «Efectivas»")
  expect_true("RIGHT" %in% .mfa_alineacion_de(requests, fila_meta, 2L),
              info = "la cifra del bloque general no va a la derecha")
  # Las dos filas de título no se alinean: son texto de portada.
  expect_length(.mfa_alineacion_de(requests, 1L, 2L), 0L)
})

test_that("S1: la cabecera de cada tabla baja de línea en su columna en vez de cortarse", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  fila <- .mfa_cabecera_de(rows, "aplicador")   # «Tasa de rendimiento esperada en facultad» no cabe
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
  primeras <- vapply(rows, function(r) trimws(as.character(r[[1]] %||% "")), character(1))
  # **Se DETECTAN, no se listan.** La lista era de literales —las notas
  # didácticas, retiradas el 2026-09-22— y con ellas fuera el test se quedaba
  # midiendo un conjunto vacío y pasando en verde. Lo que se fija es la regla
  # del formateador: una fila con UNA sola celda con texto largo en la columna A
  # se fusiona. Hoy la cumplen el titular de «Avance general» y el vacío
  # declarado de cada tabla sin filas (C3), que son justo los que se quedan.
  solo_una <- vapply(rows, function(r) {
    sum(nzchar(vapply(r, function(x) trimws(as.character(x %||% "")), character(1)))) == 1L
  }, logical(1))
  notas <- which(solo_una & nchar(primeras) > 20L &
                   !(primeras %in% unname(AULAS_AVANCE_TITULOS)))
  expect_gte(length(notas), 1L)
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
  for (etiqueta in c("Letras", "Avance general", "Indicadores", "Efectivas")) {
    fila <- .mfa_fila_de(rows, etiqueta)
    expect_identical(.mfa_fusiones_de(requests, fila, n_cols), 0L,
                     info = sprintf("«%s» (fila %d) no debe fusionarse", etiqueta, fila))
  }
})

# --- S5: la fila «Total» de la tabla por facultad se viste como cierre ---------

test_that("S5: la fila «Total» lleva banda propia, y las filas de datos no", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  fila_total <- .mfa_fila_de(rows, "Total")
  expect_false(is.na(fila_total), info = "el renderer no trae la fila «Total»")
  expect_true(.mfa_alguna_pinta_fila(requests, fila_total), info = "la fila «Total» va sin banda")
  fila_dia <- .mfa_fila_de(rows, "2026-08-10")
  expect_false(.mfa_alguna_pinta_fila(requests, fila_dia), info = "una fila de día no debe llevar banda")
})

# --- El SEMÁFORO y el formato de número (dictado del 2026-09-08) --------------

# Las requests de numberFormat que cubren la celda (fila, col), 1-based.
.mfa_numfmt_de <- function(requests, fila, col) {
  out <- character(0)
  for (request in requests) {
    rc <- request$repeatCell
    nf <- rc$cell$userEnteredFormat$numberFormat
    if (is.null(nf)) next
    rg <- rc$range
    if (rg$startRowIndex <= fila - 1L && (fila - 1L) < rg$endRowIndex &&
        rg$startColumnIndex <= col - 1L && (col - 1L) < rg$endColumnIndex) {
      out <- c(out, as.character(nf$pattern))
    }
  }
  out
}

# Las reglas condicionales que cubren la celda (fila, col), 1-based.
.mfa_reglas_de <- function(requests, fila, col) {
  out <- list()
  for (request in requests) {
    r <- request$addConditionalFormatRule
    if (is.null(r)) next
    for (rg in r$rule$ranges) {
      if (rg$startRowIndex <= fila - 1L && (fila - 1L) < rg$endRowIndex &&
          rg$startColumnIndex <= col - 1L && (col - 1L) < rg$endColumnIndex) {
        out[[length(out) + 1L]] <- r$rule
      }
    }
  }
  out
}

test_that("el porcentaje es formato de CELDA, y sólo donde el vocabulario lo declara", {
  # Gonzalo, 2026-09-08: «los que tienen un (%) no se pone en el titulo, es el
  # formato de la celda».
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  cab <- .mfa_cabecera_de(rows, "rendimiento")
  expect_false(is.na(cab))
  nombres <- vapply(rows[[cab]], function(x) as.character(x), character(1))
  col_tasa <- which(nombres == "Tasa de rendimiento de la facultad obtenida")
  col_aulas <- which(nombres == "Aulas aplicadas")
  expect_true("0.0%" %in% .mfa_numfmt_de(requests, cab + 1L, col_tasa))
  expect_true("#,##0" %in% .mfa_numfmt_de(requests, cab + 1L, col_aulas))
  expect_false("0.0%" %in% .mfa_numfmt_de(requests, cab + 1L, col_aulas))
})

test_that("«Diferencia» no es lo mismo en dos tablas: sólo una va en porcentaje", {
  # En «Rendimiento por facultad» es la resta de dos tasas (puntos porcentuales)
  # y en «Avance diario» la resta de dos conteos de encuestas. Con una lista
  # plana de rótulos, el −35 encuestas del martes salía publicado como
  # «−3 500,0 %»; se vio en la primera corrida de humo, antes de publicar.
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  col_de <- function(clave, rotulo) {
    cab <- .mfa_cabecera_de(rows, clave)
    nombres <- vapply(rows[[cab]], function(x) as.character(x), character(1))
    list(fila = cab + 1L, col = which(nombres == rotulo))
  }
  r <- col_de("rendimiento", "Diferencia de tasa")
  d <- col_de("diario", "Diferencia de efectivas")
  expect_true("0.0%" %in% .mfa_numfmt_de(requests, r$fila, r$col))
  expect_true("#,##0" %in% .mfa_numfmt_de(requests, d$fila, d$col))
  expect_false("0.0%" %in% .mfa_numfmt_de(requests, d$fila, d$col))
})

test_that("una DIFERENCIA se pinta en escala con el cero clavado en el medio", {
  # «las diferencias positivas deben estar pintadas en escalas de verde y las
  # negativas en escalas de rojo». La escala automática de Sheets pone el punto
  # medio en la mediana, y entonces «peor de lo esperado» puede salir verde.
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  cab <- .mfa_cabecera_de(rows, "rendimiento")
  nombres <- vapply(rows[[cab]], function(x) as.character(x), character(1))
  reglas <- .mfa_reglas_de(requests, cab + 1L, which(nombres == "Diferencia de tasa"))
  escalas <- Filter(function(r) !is.null(r$gradientRule), reglas)
  expect_length(escalas, 1L)
  g <- escalas[[1]]$gradientRule
  # Los extremos son MIN y MAX; el único punto con valor es el cero.
  expect_identical(g$minpoint$type, "MIN")
  expect_identical(g$maxpoint$type, "MAX")
  if (!is.null(g$midpoint)) {
    expect_identical(g$midpoint$type, "NUMBER")
    expect_identical(g$midpoint$value, "0")
  }
})

test_that("ninguna regla de color viaja con un número que el idioma pueda releer", {
  # **Salió publicado.** La escala de la diferencia fijaba sus extremos con
  # `type = "NUMBER"` y el valor en texto («-0.3348»), y en el documento quedó
  # con topes de ±3 348: Sheets parsea ese valor CON EL IDIOMA DEL DOCUMENTO, y
  # en español el punto es separador de miles. La regla seguía viva y no pintaba
  # nada, que es el peor de los dos fallos posibles.
  #
  # El guard es sobre la FORMA de la request, que es lo único que se puede
  # comprobar sin publicar: ningún valor de regla puede llevar «.» ni «,».
  for (modelo in list(.mfa_modelo_completo(), .mfa_modelo_minimo())) {
    requests <- .mfa_requests(.mfa_rows(modelo))
    valores <- character(0)
    for (request in requests) {
      r <- request$addConditionalFormatRule
      if (is.null(r)) next
      g <- r$rule$gradientRule
      if (!is.null(g)) {
        for (p in list(g$minpoint, g$midpoint, g$maxpoint)) {
          if (!is.null(p$value)) valores <- c(valores, as.character(p$value))
        }
      }
      b <- r$rule$booleanRule
      if (!is.null(b)) {
        for (v in b$condition$values %||% list()) {
          valores <- c(valores, as.character(v$userEnteredValue %||% ""))
        }
      }
    }
    expect_gt(length(valores), 0L)
    expect_false(any(grepl("[.,]", valores)),
                 info = paste("valores con separador:", paste(valores, collapse = " · ")))
  }
})

test_that("una celda que llegó a su meta se pinta verde; a la sobremuestra, celeste", {
  # «cuando la celda llegue a la meta debe pintarse de verde, y cuando llegue a
  # la sobremuestra que se pinte de azul o celeste». Un cero en una columna de
  # faltantes ES una celda que llegó.
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  cab <- .mfa_cabecera_de(rows, "facultad")
  nombres <- vapply(rows[[cab]], function(x) as.character(x), character(1))
  regla_de <- function(rotulo) {
    reglas <- .mfa_reglas_de(requests, cab + 1L, which(nombres == rotulo))
    booleanas <- Filter(function(r) !is.null(r$booleanRule), reglas)
    expect_length(booleanas, 1L)
    booleanas[[1]]$booleanRule
  }
  muestra <- regla_de("Faltantes muestra")
  sobre <- regla_de("Faltantes sobremuestra")
  for (r in list(muestra, sobre)) {
    expect_identical(r$condition$type, "NUMBER_EQ")
    expect_identical(r$condition$values[[1]]$userEnteredValue, "0")
  }
  # Verde contra la muestra, celeste contra la sobremuestra: dos colores, dos
  # noticias. Si fueran el mismo, la hoja no distinguiría las dos metas.
  expect_gt(muestra$format$backgroundColor$green, muestra$format$backgroundColor$blue)
  expect_gt(sobre$format$backgroundColor$blue, sobre$format$backgroundColor$green)
})

test_that("«Avance muestra» al 100 % se pinta verde y «Avance sobremuestra», celeste", {
  rows <- .mfa_rows(.mfa_modelo_completo())
  requests <- .mfa_requests(rows)
  cab <- .mfa_cabecera_de(rows, "general")
  etiquetas <- vapply(rows[seq(cab + 1L, cab + length(AULAS_AVANCE_FILAS_GENERAL))],
                      function(r) as.character(r[[1]]), character(1))
  fila_de <- function(et) cab + which(etiquetas == et)
  for (par in list(list("Avance muestra", "green"), list("Avance sobremuestra", "blue"))) {
    reglas <- .mfa_reglas_de(requests, fila_de(par[[1]]), 2L)
    booleanas <- Filter(function(r) !is.null(r$booleanRule), reglas)
    expect_length(booleanas, 1L)
    b <- booleanas[[1]]$booleanRule
    expect_identical(b$condition$type, "NUMBER_GREATER_THAN_EQ")
    expect_identical(b$condition$values[[1]]$userEnteredValue, "1")
    fondo <- b$format$backgroundColor
    expect_gt(fondo[[par[[2]]]], fondo$red)
  }
})

# --- los bloques por sexo se separan a la vista -------------------------------
#
# Con las columnas ya intercaladas como Gonzalo las dictó, «Avance por facultad»
# tiene veinte columnas seguidas del mismo ancho y «Rendimiento por facultad»
# diecinueve, todas cifras. La cabecera dice dónde acaba el total y empieza el
# bloque de hombres, pero hay que leerla entera cada vez.

test_that("el bloque de una columna se decide por su RÓTULO, no por su posición", {
  bloque <- prosecnurapp:::.maaf_bloque_de_columna
  expect_identical(bloque("Efectivas"), "total")
  expect_identical(bloque("Efectivas hombres"), "hombres")
  expect_identical(bloque("Faltantes mujeres sobremuestra"), "mujeres")
  expect_identical(bloque("Muestra hombres"), "hombres")
  # Lo que no dice sexo habla del conjunto, y una celda vacía también.
  expect_identical(bloque("Aulas aplicadas"), "total")
  expect_identical(bloque(""), "total")
  expect_identical(bloque(NULL), "total")
})

test_that("hay un separador en cada junta de bloque, y ninguno en la primera columna", {
  filas <- .mfa_rows(.mfa_modelo_completo())
  n_cols <- max(vapply(filas, function(r) length(r %||% list()), integer(1)))
  m <- prosecnurapp:::.maaf_celdas(filas, n_cols)
  sep <- prosecnurapp:::.maaf_separador_bloques(111L, m)
  # **Que HAYA separadores, primero.** Sin esta línea el test pasa en vacío: una
  # lista vacía cumple todas las comprobaciones de abajo, y la regresión que
  # importa —que el bloque se decida por rótulo— dejaría de vigilarse sin que
  # nada se pusiera rojo. «Avance por facultad» sola tiene nueve juntas.
  expect_gte(length(sep), 9L)
  expect_true(all(vapply(sep, function(r) !is.null(r$updateBorders), logical(1))))
  # Nunca en la columna 1: ahí no hay junta, hay margen.
  cols <- vapply(sep, function(r) r$updateBorders$range$startColumnIndex, integer(1))
  expect_false(any(cols == 0L))
  # Cada separador cae donde la cabecera CAMBIA de bloque respecto de la de su
  # izquierda: es la comprobación que muere si alguien lo ancla por posición.
  for (r in sep) {
    rg <- r$updateBorders$range
    j <- rg$startColumnIndex + 1L
    fila_cab <- rg$startRowIndex + 1L
    aqui <- prosecnurapp:::.maaf_bloque_de_columna(m[fila_cab, j])
    antes <- prosecnurapp:::.maaf_bloque_de_columna(m[fila_cab, j - 1L])
    expect_false(identical(aqui, antes),
                 info = sprintf("columna %d de la cabecera de la fila %d", j, fila_cab))
  }
})

test_that("el separador dibuja la junta y no pinta ninguna celda", {
  # Si pintara fondo se pelearía con las escalas de color que ya lleva la hoja:
  # un rojo de diferencia debajo de un tono de bloque deja de leerse como rojo.
  filas <- .mfa_rows(.mfa_modelo_completo())
  n_cols <- max(vapply(filas, function(r) length(r %||% list()), integer(1)))
  m <- prosecnurapp:::.maaf_celdas(filas, n_cols)
  sep <- prosecnurapp:::.maaf_separador_bloques(111L, m)
  for (r in sep) {
    expect_null(r$updateBorders$range$backgroundColor)
    expect_null(r$repeatCell)
    expect_false(is.null(r$updateBorders$left))
    # Sólo el borde izquierdo: los otros tres se quedan como estén.
    expect_null(r$updateBorders$right)
    expect_null(r$updateBorders$top)
    expect_null(r$updateBorders$bottom)
  }
})

test_that("el tono del separador se distingue sobre los rellenos de las escalas", {
  # Medido, no elegido a ojo: el primer tono (#8FA6C4) daba 1,26 : 1 contra el
  # rojo de la escala y 1,52 : 1 contra el verde, o sea que desaparecía justo en
  # las columnas de diferencia, que son las que llevan color y las que marcan el
  # final de un bloque.
  lum <- function(hex) {
    v <- strtoi(substring(gsub("#", "", hex), c(1, 3, 5), c(2, 4, 6)), 16L) / 255
    v <- ifelse(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055)^2.4)
    sum(v * c(0.2126, 0.7152, 0.0722))
  }
  contraste <- function(a, b) {
    l <- c(lum(a), lum(b))
    (max(l) + 0.05) / (min(l) + 0.05)
  }
  sep <- prosecnurapp:::.MAAF_SEPARADOR_BLOQUE
  fondos <- c(prosecnurapp:::.MAAF_ROJO_ESCALA, prosecnurapp:::.MAAF_VERDE_ESCALA,
              prosecnurapp:::.MAAF_BLANCO_ESCALA, prosecnurapp:::.MAAF_CELESTE_FONDO)
  for (f in fondos) {
    expect_gt(contraste(sep, f), 2.5,
              label = sprintf("contraste del separador sobre %s", f))
  }
})

