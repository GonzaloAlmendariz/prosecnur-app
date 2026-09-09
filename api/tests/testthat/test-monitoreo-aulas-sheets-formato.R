# Formato + desplegables de la publicación del libro de aulas a Sheets.
#
# Oleada W2 de B8 (checklist docs/qa/checklist-operativo-aulas-2026-08-31.md).
# Dictado textual de Gonzalo tras ver la siembra real: «no hay nada del formato
# que el Excel tenía, los colores, se ve genuinamente fatal»; «el status de
# muestra está como sin contactar pero no hay ningún desplegable»; «la forma de
# contacto solo debería ser o por teléfono o por correo».
#
# Contrato congelado (NUEVO api/R/monitoreo_aulas_sheets_formato.R):
#
#   A) `monitoreo_aulas_sheets_formato_requests(hoja, sheet_id, n_filas,
#      n_cols)` → requests de batchUpdate para UNA hoja del libro: freeze de
#      la(s) fila(s) de cabecera (1 en «Aulas Agendadas»/«Plan del día», 2 en
#      las demás — el reparto de `.malp_cabeceras`), cabecera navy + texto
#      blanco en negrita CON LA PALETA DEL XLSX, anchos de columna por RANGOS
#      agrupados (≤8 requests de dimensión para 253 columnas, jamás una por
#      columna — hoy el motor genérico emite UNA POR COLUMNA,
#      monitoreo_engine.R:5685) y presupuesto total ≤30 para el libro de 4
#      hojas.
#   B) `monitoreo_aulas_sheets_validaciones_requests(hoja, sheet_id, n_filas,
#      profundidad)` → setDataValidation ONE_OF_LIST para las columnas con
#      vocabulario de las hojas del EQUIPO, desde los MISMOS vocabularios de la
#      hoja «Listas» del xlsx (carga_aulas_libro_generar.R:721-731). El
#      vocabulario de MEDIO DE CONTACTO pasa a exactamente {Teléfono, Correo}
#      y el cambio va en la CONSTANTE (`AULAS_LIBRO_MEDIO_CONTACTO`,
#      carga_aulas_libro_formato.R:82) para que xlsx y Sheets digan lo mismo:
#      una lista, no dos.
#   C) Integración en `monitoreo_aulas_publicar_libro`: la siembra de hojas del
#      equipo lleva values + formato + validaciones (la única vez que se les
#      escribe, y el formato viaja DESPUÉS de los values — patrón batch-2 del
#      motor); las hojas de la app reciben formato solo al crearse o cambiar de
#      dimensiones; y la regla de dueño queda INTACTA: republicar con hojas del
#      equipo pobladas = cero requests sobre sus sheetId, también de formato.
#
# La paleta pineada se LEE del formato xlsx (carga_aulas_libro_formato.R):
#   #002457 fondo de cabecera + #FFFFFF texto en negrita (estilo `cabecera`,
#   líneas 206-209; es también `aulas_libro_colores_eslabon(1L)`),
#   la banda de cada reemplazo con su tono de eslabón (DERIVADO de
#   `aulas_libro_colores_eslabon`, nunca un hex a mano — B18 cambia la paleta),
#   #E3F3E8/#155E2E verde del semáforo de estados AGENDADA/APLICADA (l. 384-386).
#
# Sin red (mock compartido `.sheets_api_mock`, helper-sheets-mock.R). Todo
# acceso por `[[` — el `$` parcial-matchea.

# --- lectores de requests -----------------------------------------------------

# Un color de la API ({red,green,blue} en 0-1) devuelto como hex, para comparar
# contra la paleta del xlsx sin arrastrar flotantes.
.masf_hex <- function(color) {
  comp <- function(nm) {
    v <- suppressWarnings(as.numeric(color[[nm]] %||% 0))[1]
    if (is.na(v)) v <- 0
    max(0, min(1, v))
  }
  sprintf(
    "#%02X%02X%02X",
    as.integer(round(comp("red") * 255)),
    as.integer(round(comp("green") * 255)),
    as.integer(round(comp("blue") * 255))
  )
}

.masf_es_color <- function(v) {
  is.list(v) && length(v) &&
    all(names(v) %||% "" %in% c("red", "green", "blue", "alpha")) &&
    any(c("red", "green", "blue") %in% (names(v) %||% character(0)))
}

# Todos los colores declarados en una estructura de requests, como hex únicos.
.masf_colores_en <- function(x) {
  out <- character(0)
  if (!is.list(x)) return(out)
  for (v in x) {
    if (.masf_es_color(v)) out <- c(out, .masf_hex(v)) else if (is.list(v)) out <- c(out, .masf_colores_en(v))
  }
  unique(out)
}

# Los formatos de celda (fondo + texto) de una estructura, da igual si vienen
# de un repeatCell, un updateCells o una regla condicional.
.masf_formatos_en <- function(x) {
  out <- list()
  if (!is.list(x)) return(out)
  nombres <- names(x) %||% rep("", length(x))
  if (all(c("backgroundColor", "textFormat") %in% nombres)) {
    tf <- x[["textFormat"]] %||% list()
    fg <- tf[["foregroundColor"]]
    out[[length(out) + 1L]] <- list(
      fondo = .masf_hex(x[["backgroundColor"]] %||% list()),
      negrita = isTRUE(tf[["bold"]]),
      texto = if (is.list(fg)) .masf_hex(fg) else ""
    )
  }
  for (v in x) if (is.list(v)) out <- c(out, .masf_formatos_en(v))
  out
}

.masf_frozen_rows_en <- function(x) {
  out <- integer(0)
  if (!is.list(x)) return(out)
  nombres <- names(x) %||% rep("", length(x))
  for (i in seq_along(x)) {
    v <- x[[i]]
    if (identical(nombres[[i]], "frozenRowCount") && length(v) == 1L) {
      n <- suppressWarnings(as.integer(v))
      if (!is.na(n)) out <- c(out, n)
    } else if (is.list(v)) {
      out <- c(out, .masf_frozen_rows_en(v))
    }
  }
  out
}

# Todos los sheetId referidos dentro de una estructura, recursivo (mismo lector
# que el test de dueño de test-monitoreo-aulas-publicar-libro.R).
.masf_sheet_ids_en <- function(x) {
  out <- integer(0)
  if (!is.list(x)) return(out)
  nombres <- names(x) %||% rep("", length(x))
  for (i in seq_along(x)) {
    v <- x[[i]]
    if (identical(nombres[[i]], "sheetId") && length(v) == 1L) {
      id <- suppressWarnings(as.integer(v))
      if (!is.na(id)) out <- c(out, id)
    } else if (is.list(v)) {
      out <- c(out, .masf_sheet_ids_en(v))
    }
  }
  unique(out)
}

# Las requests de anchos de columna: updateDimensionProperties sobre COLUMNS.
.masf_dim_columnas <- function(reqs) {
  Filter(Negate(is.null), lapply(reqs, function(r) {
    udp <- r[["updateDimensionProperties"]]
    if (is.null(udp)) return(NULL)
    rango <- udp[["range"]] %||% list()
    if (!identical(as.character(rango[["dimension"]] %||% ""), "COLUMNS")) return(NULL)
    list(
      desde = suppressWarnings(as.integer(rango[["startIndex"]] %||% NA_integer_))[1],
      hasta = suppressWarnings(as.integer(rango[["endIndex"]] %||% NA_integer_))[1],
      pixeles = suppressWarnings(as.numeric((udp[["properties"]] %||% list())[["pixelSize"]] %||% NA_real_))[1]
    )
  }))
}

# Las validaciones de datos, aplanadas a lo que el contrato pinea.
.masf_validaciones_en <- function(reqs) {
  Filter(Negate(is.null), lapply(reqs, function(r) {
    sdv <- r[["setDataValidation"]]
    if (is.null(sdv)) return(NULL)
    regla <- sdv[["rule"]] %||% list()
    cond <- regla[["condition"]] %||% list()
    valores <- vapply(cond[["values"]] %||% list(), function(v) {
      as.character(v[["userEnteredValue"]] %||% "")
    }, character(1))
    rango <- sdv[["range"]] %||% list()
    list(
      tipo = as.character(cond[["type"]] %||% ""),
      valores = valores,
      chip = isTRUE(regla[["showCustomUi"]]),
      estricta = isTRUE(regla[["strict"]]),
      sheet_id = suppressWarnings(as.integer(rango[["sheetId"]] %||% NA_integer_))[1],
      fila_desde = suppressWarnings(as.integer(rango[["startRowIndex"]] %||% NA_integer_))[1],
      col_desde = suppressWarnings(as.integer(rango[["startColumnIndex"]] %||% NA_integer_))[1],
      col_hasta = suppressWarnings(as.integer(rango[["endColumnIndex"]] %||% NA_integer_))[1]
    )
  }))
}

# Requests estructurales (todo batchUpdate que no sea de values) del mock.
.masf_estructurales <- function(calls) {
  out <- list()
  for (call in calls) {
    if (!grepl(":batchUpdate$", call$url)) next
    if (grepl("values:batchUpdate", call$url, fixed = TRUE)) next
    out <- c(out, call$body$requests %||% list())
  }
  out
}

# Los estructurales que refieren a UN sheetId concreto.
.masf_estructurales_de <- function(calls, sheet_id) {
  Filter(function(r) sheet_id %in% .masf_sheet_ids_en(r), .masf_estructurales(calls))
}

.masf_desde <- function(calls, corte) {
  if (length(calls) <= corte) return(list())
  calls[seq.int(corte + 1L, length(calls))]
}

# La columna (1-based) de un campo del bloque de agenda, por bloque. Derivada
# de la spec (`AULAS_AGENDADAS_BLOQUE`), no de números a mano: si el bloque
# gana un campo, esto sigue apuntando al correcto.
.masf_cols_bloque <- function(campo, profundidad) {
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) identical(s$campo, campo), logical(1)))[[1]]
  vapply(seq_len(profundidad), function(b) {
    1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + idx
  }, integer(1))
}

# Geometría de la hoja de campo, derivada de las MISMAS specs que usan los dos
# generadores (nunca un 35 a mano): cada bloque de intento mide ID MATCH + las
# columnas de agenda que repite + los títulos propios del parte.
.masf_ancho_campo <- function() {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE + length(prosecnurapp:::.calg_titulos_campo())
}

# La columna (1-based) de un título del parte de campo en cada intento.
.masf_cols_campo <- function(titulo, intentos) {
  idx <- which(prosecnurapp:::.calg_titulos_campo() == titulo)[[1]]
  vapply(seq_len(intentos), function(b) {
    (b - 1L) * .masf_ancho_campo() + 1L + AULAS_AGENDADAS_ANCHO_BLOQUE + idx
  }, integer(1))
}

# Un parte de campo, para que la hoja de aplicadas tenga titular (mismo fixture
# que test-monitoreo-aulas-publicar-libro.R; los helpers de un test file no se
# ven desde otro).
.masf_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 30,
       refusals = 2, duplicates = 0, effective_surveys = 28,
       applied_by = "Ana", actual_room = "L321", applied_date = "2026-08-12")
)

# --- contexto (verde deliberado): la paleta del xlsx es la que se copia ------

test_that("contexto: los hex pineados son los del formato xlsx", {
  # El navy del titular es el ancla de marca del libro y se pinea literal; los
  # tonos de eslabón se DERIVAN de `aulas_libro_colores_eslabon` en los tests
  # de abajo (B18 los cambia a una paleta cíclica y un literal aquí quedaría
  # midiendo la paleta vieja).
  expect_identical(aulas_libro_colores_eslabon(1L), "#002457")
  expect_identical(aulas_libro_colores_eslabon(3L)[[1]], "#002457")
})

# --- A. formato por hoja ------------------------------------------------------

test_that("formato Sheets: la cabecera copia la paleta del xlsx (navy + blanco negrita + banda)", {
  reqs <- monitoreo_aulas_sheets_formato_requests(
    hoja = "Aulas Agendadas", sheet_id = 111L, n_filas = 43L, n_cols = 64L
  )
  expect_gt(length(reqs), 0L)

  # Cabecera con el MISMO estilo que el xlsx: fondo #002457, texto #FFFFFF en
  # negrita (carga_aulas_libro_formato.R:206-209). Hoy el motor genérico pinta
  # #123B70/#0F355E: se ve como cualquier reporte, no como el libro del equipo.
  formatos <- .masf_formatos_en(reqs)
  expect_true(any(vapply(formatos, function(f) {
    identical(f$fondo, "#002457") && isTRUE(f$negrita) && identical(f$texto, "#FFFFFF")
  }, logical(1))))

  # La banda del primer reemplazo lleva su tono de eslabón —derivado de la
  # escala, no un hex a mano—, que es lo que distingue titular de reservas en
  # el Excel.
  expect_true(aulas_libro_colores_eslabon(3L)[[2]] %in% .masf_colores_en(reqs))

  # Y todo lo emitido apunta a la hoja pedida, no a otra.
  expect_identical(.masf_sheet_ids_en(reqs), 111L)
})

test_that("formato Sheets: el semáforo de estados viaja con los colores del xlsx", {
  # Verde de lo cerrado (AGENDADA/APLICADA): fondo #E3F3E8, texto #155E2E
  # (carga_aulas_libro_formato.R:384-386). Es la parte de «los colores» que el
  # dictado echa de menos: el estado se ve sin leerlo.
  reqs <- monitoreo_aulas_sheets_formato_requests(
    hoja = "Aulas Agendadas", sheet_id = 111L, n_filas = 43L, n_cols = 64L
  )
  colores <- .masf_colores_en(reqs)
  expect_true("#E3F3E8" %in% colores)
  expect_true("#155E2E" %in% colores)
})

test_that("formato Sheets: cada hoja congela sus filas de cabecera", {
  # El reparto es el de `.malp_cabeceras` (y el del lector): 1 en «Aulas
  # Agendadas» y «Plan del día», 2 en las demás. Hoy el motor genérico congela
  # 1 para todas: en la hoja de campo la fila de títulos queda suelta.
  casos <- list(
    list(hoja = "Aulas Agendadas", cabeceras = 1L, n_cols = 64L),
    list(hoja = "Plan del día", cabeceras = 1L, n_cols = 13L),
    # La asignación corona con UNA fila de título: dos congeladas pintaban de
    # navy la nota del sorteo (fila 2).
    list(hoja = "Asignación de aplicadores", cabeceras = 1L, n_cols = 8L),
    list(hoja = "Aulas Aplicadas (Campo)", cabeceras = 2L, n_cols = 105L),
    list(hoja = "Base de control", cabeceras = 2L, n_cols = 43L)
  )
  for (caso in casos) {
    reqs <- monitoreo_aulas_sheets_formato_requests(
      hoja = caso$hoja, sheet_id = 111L, n_filas = 20L, n_cols = caso$n_cols
    )
    congeladas <- .masf_frozen_rows_en(reqs)
    expect_identical(sort(unique(congeladas)), caso$cabeceras, info = caso$hoja)
  }
})

test_that("formato Sheets: los anchos van por rangos agrupados, jamás uno por columna", {
  # 253 columnas = 1 + 12x21, la agenda real de HSVG2026 a profundidad 12. El
  # motor genérico emite 253 updateDimensionProperties (una por columna,
  # monitoreo_engine.R:5685-5693); el contrato pinea ≤8 rangos que cubren todo.
  reqs <- monitoreo_aulas_sheets_formato_requests(
    hoja = "Aulas Agendadas", sheet_id = 111L, n_filas = 843L, n_cols = 253L
  )
  dims <- .masf_dim_columnas(reqs)
  expect_gte(length(dims), 1L)
  expect_lte(length(dims), 8L)

  # Los rangos traen su ancho y entre todos cubren las 253 columnas: una
  # columna sin ancho queda en el defecto de 100px, que es el volcado de hoy.
  cubiertas <- rep(FALSE, 253L)
  for (d in dims) {
    expect_true(is.finite(d$pixeles) && d$pixeles > 0)
    expect_true(is.finite(d$desde) && is.finite(d$hasta) && d$hasta > d$desde)
    cubiertas[seq.int(d$desde + 1L, min(253L, d$hasta))] <- TRUE
  }
  expect_true(all(cubiertas))
})

test_that("formato Sheets: el libro completo cabe en 45 requests de formato", {
  # Presupuesto pineado por el contrato: la siembra ya cuesta metadata + values
  # + estado; el formato no puede convertirla en cientos de requests (la cuota
  # de batchUpdate es compartida con el resto del monitoreo).
  #
  # **Subió de 30 a 45 el 2026-09-08, y con motivo.** El presupuesto compraba
  # baratura a costa de no declarar el `numberFormat` de las fechas y del
  # porcentaje de asistencia; las celdas se veían bien mientras nadie las
  # reescribiera, y el día que una migración las reescribió salieron 243 fechas
  # como «46273» en el libro del operativo. El formato de número no es adorno:
  # es lo único que distingue una fecha perdida de una fecha mal enseñada.
  #
  # El coste crece con los BLOQUES (dos fechas por eslabón de agenda, un
  # porcentaje por intento de campo), no con las filas, y el fixture trae los
  # suyos. Si un día no cabe, la salida no es dejar de declararlo.
  hojas <- list(
    list(hoja = "Aulas Agendadas", df = aulas_libro_hoja_agendadas(.libro_de_prueba())),
    list(hoja = "Aulas Aplicadas (Campo)", df = aulas_libro_hoja_aplicadas(.libro_de_prueba(), partes = .masf_partes())),
    list(hoja = "Base de control", df = aulas_libro_hoja_control(.libro_de_prueba())),
    list(hoja = "Plan del día", df = aulas_libro_hoja_plan_dia(.libro_de_prueba(), partes = .masf_partes()))
  )
  total <- 0L
  for (h in hojas) {
    reqs <- monitoreo_aulas_sheets_formato_requests(
      hoja = h$hoja, sheet_id = 111L, n_filas = nrow(h$df), n_cols = ncol(h$df)
    )
    expect_gt(length(reqs), 0L, label = sprintf("requests de %s", h$hoja))
    total <- total + length(reqs)
  }
  expect_lte(total, 45L)
})

# --- B. validaciones (desplegables) -------------------------------------------

test_that("el medio de contacto es exactamente Teléfono o Correo, en UNA lista", {
  # Dictado: «la forma de contacto solo debería ser o por teléfono o por
  # correo». El vocabulario vive en la constante que comparten el xlsx (hoja
  # «Listas», carga_aulas_libro_generar.R:724) y el Sheets: el cambio va AHÍ
  # para que los dos digan lo mismo. Hoy: Llamada | Correo Electrónico |
  # Presencial.
  expect_identical(AULAS_LIBRO_MEDIO_CONTACTO, c("Teléfono", "Correo"))
})

test_that("validaciones Sheets: la agenda recibe ONE_OF_LIST con los vocabularios del xlsx", {
  reqs <- monitoreo_aulas_sheets_validaciones_requests(
    hoja = "Aulas Agendadas", sheet_id = 222L, n_filas = 43L, profundidad = 3L
  )
  vs <- .masf_validaciones_en(reqs)
  expect_gt(length(vs), 0L)

  # Los desplegables de vocabulario van ONE_OF_LIST con chip visible
  # (showCustomUi): sin él no hay desplegable que ver, que es la queja literal
  # del dictado. Desde B12 conviven con validaciones DATE_IS_VALID (el
  # calendario) en la misma llamada, así que el «todas» se acota a las de
  # lista — el pin absoluto de antes contradecía al de B12 por construcción.
  listas <- Filter(function(v) identical(v$tipo, "ONE_OF_LIST"), vs)
  expect_gt(length(listas), 0L)
  expect_true(all(vapply(listas, function(v) isTRUE(v$chip), logical(1))))
  expect_true(all(vapply(vs, function(v) identical(v$sheet_id, 222L), logical(1))))

  # Ninguna pisa la cabecera, y cada una cubre UNA columna: la lección del
  # xlsx (un sqref rectangular dejaba el desplegable de STATUS MUESTRA sobre
  # el nombre del docente, 20 columnas en medio).
  expect_true(all(vapply(vs, function(v) is.finite(v$fila_desde) && v$fila_desde >= 1L, logical(1))))
  expect_true(all(vapply(vs, function(v) {
    is.finite(v$col_desde) && is.finite(v$col_hasta) && (v$col_hasta - v$col_desde) == 1L
  }, logical(1))))

  # STATUS MUESTRA: el vocabulario del xlsx a profundidad 3, en las columnas
  # que la spec del bloque declara (una por eslabón).
  status <- Filter(function(v) setequal(v$valores, aulas_libro_status_muestra(3L)), vs)
  expect_identical(
    sort(vapply(status, function(v) v$col_desde, integer(1))),
    .masf_cols_bloque("sample_status", 3L) - 1L
  )

  # MEDIO DE CONTACTO: exactamente {Teléfono, Correo}, en sus columnas.
  medio <- Filter(function(v) setequal(v$valores, c("Teléfono", "Correo")), vs)
  expect_identical(
    sort(vapply(medio, function(v) v$col_desde, integer(1))),
    .masf_cols_bloque("contact_medium", 3L) - 1L
  )
  # …y de la MISMA lista que el xlsx, no de una copia local.
  for (v in medio) expect_true(setequal(v$valores, AULAS_LIBRO_MEDIO_CONTACTO))

  # DÍA: la lista corta de tres letras, igual que la hoja «Listas».
  expect_true(any(vapply(vs, function(v) setequal(v$valores, AULAS_LIBRO_DIA), logical(1))))

  # Las opciones viejas del medio NO están en ningún desplegable.
  todas <- unlist(lapply(vs, function(v) v$valores), use.names = FALSE)
  expect_false(any(c("Llamada", "Correo Electrónico", "Presencial") %in% todas))
})

test_that("B12: las columnas de fecha de la agenda reciben el calendario (DATE_IS_VALID)", {
  # Pedido de Gonzalo (2026-09-01): «apenas aprieto la celda [de FECHA DE
  # LLAMADA o FECHA AGENDADA] me sale el calendario, ¿es posible?». En Sheets
  # el date picker aparece cuando la celda lleva dataValidation DATE_IS_VALID;
  # hoy la siembra solo emite ONE_OF_LIST y las fechas se teclean a ciegas.
  # Los campos de fecha del bloque de agenda son `contact_date` (FECHA DE
  # LLAMADA) y `scheduled_date` (FECHA AGENDADA) — por índice derivado de
  # `AULAS_AGENDADAS_BLOQUE`, no literal.
  reqs <- monitoreo_aulas_sheets_validaciones_requests(
    hoja = "Aulas Agendadas", sheet_id = 222L, n_filas = 43L, profundidad = 3L
  )
  vs <- .masf_validaciones_en(reqs)
  fechas <- Filter(function(v) identical(v$tipo, "DATE_IS_VALID"), vs)

  # Una request por columna-hoja, como las ONE_OF_LIST: dos campos de fecha
  # por eslabón, y ni una más (el presupuesto de batchUpdate es compartido).
  expect_length(fechas, 6L)
  esperadas <- sort(c(
    .masf_cols_bloque("contact_date", 3L),
    .masf_cols_bloque("scheduled_date", 3L)
  )) - 1L
  expect_identical(sort(vapply(fechas, function(v) v$col_desde, integer(1))), esperadas)

  for (v in fechas) {
    # Cada una cubre UNA columna y arranca bajo la cabecera, igual que las
    # ONE_OF_LIST de al lado.
    expect_identical(v$col_hasta - v$col_desde, 1L)
    expect_true(is.finite(v$fila_desde) && v$fila_desde >= 1L)
    expect_identical(v$sheet_id, 222L)
    # DATE_IS_VALID no lleva lista de valores…
    expect_length(v$valores, 0L)
    # …y no es estricta: los libros existentes traen fechas tecleadas de todas
    # las formas y la validación no debe pelearse con ellas (la misma
    # coherencia `strict = FALSE` de las ONE_OF_LIST de esta capa).
    expect_false(v$estricta)
  }

  # Las ONE_OF_LIST existentes no se resienten: el vocabulario sigue viajando.
  expect_true(any(vapply(vs, function(v) identical(v$tipo, "ONE_OF_LIST"), logical(1))))
})

test_that("B12: en la hoja de campo el calendario va SOLO en la fecha tecleable del parte", {
  # B9 sembró las columnas de agenda de cada bloque de la hoja de campo como
  # FÓRMULAS de arrastre (='Aulas Agendadas'!…): una validación de fecha sobre
  # una columna de fórmula marcaría lo que computa el arrastre y le diría al
  # equipo que teclee donde no debe. La única columna de fecha que el parte
  # TECLEA es FECHA DE APLICACIÓN (posición derivada de `.calg_titulos_campo()`).
  reqs <- monitoreo_aulas_sheets_validaciones_requests(
    hoja = "Aulas Aplicadas (Campo)", sheet_id = 333L, n_filas = 20L, profundidad = 3L
  )
  vs <- .masf_validaciones_en(reqs)
  fechas <- Filter(function(v) identical(v$tipo, "DATE_IS_VALID"), vs)

  esperadas <- sort(.masf_cols_campo("FECHA DE APLICACIÓN", 3L)) - 1L
  expect_identical(sort(vapply(fechas, function(v) v$col_desde, integer(1))), esperadas)

  # Ninguna validación de fecha cae en la banda de arrastre: ID MATCH + las
  # columnas de agenda de cada bloque, que desde B9 son fórmulas.
  ancho <- .masf_ancho_campo()
  arrastre0 <- unlist(lapply(seq_len(3L), function(b) {
    (b - 1L) * ancho + seq.int(0L, AULAS_AGENDADAS_ANCHO_BLOQUE)
  }))
  for (v in fechas) {
    expect_false(v$col_desde %in% arrastre0)
    expect_identical(v$col_hasta - v$col_desde, 1L)
    # Dos filas de cabecera en la hoja de campo: la validación no las pisa.
    expect_true(is.finite(v$fila_desde) && v$fila_desde >= 2L)
    expect_identical(v$sheet_id, 333L)
    expect_false(v$estricta)
  }
})

test_that("B15: MOMENTO DE LA CLASE recibe su desplegable NO absoluto en Sheets", {
  # Dictado (2026-09-01): el momento gana desplegable con tres valores y texto
  # libre permitido — ONE_OF_LIST strict = FALSE, el patrón que esta capa ya
  # usa para todo vocabulario. Columnas derivadas de la spec, una por eslabón.
  reqs <- monitoreo_aulas_sheets_validaciones_requests(
    hoja = "Aulas Agendadas", sheet_id = 222L, n_filas = 43L, profundidad = 3L
  )
  vs <- .masf_validaciones_en(reqs)
  tres <- c("Al inicio de la clase", "En el receso", "Al final de la clase")
  momento <- Filter(function(v) setequal(v$valores, tres), vs)
  expect_identical(
    sort(vapply(momento, function(v) v$col_desde, integer(1))),
    .masf_cols_bloque("scheduled_moment", 3L) - 1L
  )
  for (v in momento) {
    expect_identical(v$tipo, "ONE_OF_LIST")
    expect_true(v$chip)
    # NO absoluto: el texto libre («a las 9:30, tras el control de lectura»)
    # sigue siendo válido — es la mitad del dictado.
    expect_false(v$estricta)
    expect_identical(v$col_hasta - v$col_desde, 1L)
  }
})

test_that("B18: la banda de eslabones del Sheets emite la MISMA paleta que el xlsx", {
  # Paridad pineada por derivación: cada tono que la escala declara para una
  # cadena de profundidad 6 tiene que viajar en las requests de la agenda. Si
  # el Sheets copiara una paleta propia, un cambio de escala los separaría en
  # silencio (dos capas, dos lecturas de la misma regla).
  profundidad <- 6L
  n_cols <- 1L + profundidad * AULAS_AGENDADAS_ANCHO_BLOQUE
  reqs <- monitoreo_aulas_sheets_formato_requests(
    hoja = "Aulas Agendadas", sheet_id = 111L, n_filas = 43L, n_cols = n_cols
  )
  emitidos <- .masf_colores_en(reqs)
  for (tono in aulas_libro_colores_eslabon(profundidad)) {
    expect_true(toupper(tono) %in% toupper(emitidos),
                info = sprintf("el tono %s de la escala no llega al Sheets", tono))
  }
})

# --- C. integración en el publicador ------------------------------------------

test_that("siembra a Sheets: values, formato y validaciones viajan, y el formato va después de los values", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .masf_partes()
  )

  calls <- mock$env$calls
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  id_aplicadas <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$sheetId
  id_control <- mock$env$sheets[["Base de control"]]$sheetId
  id_plan_dia <- mock$env$sheets[["Plan del día"]]$sheetId

  # Freeze correcto por hoja en el flujo real (equipo Y app: las cuatro se
  # crean en la siembra, así que las cuatro reciben su formato).
  esperados <- list(
    list(id = id_agendadas, cabeceras = 1L, hoja = "Aulas Agendadas"),
    list(id = id_aplicadas, cabeceras = 2L, hoja = "Aulas Aplicadas (Campo)"),
    list(id = id_control, cabeceras = 2L, hoja = "Base de control"),
    list(id = id_plan_dia, cabeceras = 1L, hoja = "Plan del día")
  )
  for (e in esperados) {
    congeladas <- .masf_frozen_rows_en(.masf_estructurales_de(calls, e$id))
    expect_identical(sort(unique(congeladas)), e$cabeceras, info = e$hoja)
  }

  # La paleta del xlsx llega a la agenda, y los anchos van agrupados también
  # en el flujo real (ni cero requests de dimensión, ni una por columna).
  de_agendadas <- .masf_estructurales_de(calls, id_agendadas)
  expect_true("#002457" %in% .masf_colores_en(de_agendadas))
  n_dims <- length(.masf_dim_columnas(de_agendadas))
  expect_gte(n_dims, 1L)
  expect_lte(n_dims, 8L)

  # Las validaciones de la siembra: Teléfono/Correo en la agenda y el status
  # de aplicación en la hoja de campo.
  vs <- .masf_validaciones_en(.masf_estructurales(calls))
  expect_true(any(vapply(vs, function(v) {
    identical(v$sheet_id, id_agendadas) && setequal(v$valores, c("Teléfono", "Correo"))
  }, logical(1))))
  expect_true(any(vapply(vs, function(v) {
    identical(v$sheet_id, id_aplicadas) && "NO APLICADA" %in% v$valores
  }, logical(1))))

  # Orden del patrón batch-2: los values de la siembra primero, el batch con
  # las validaciones después (formatear una pestaña vacía y llenarla luego
  # dejaría la ventana en la que el equipo ve el esqueleto sin datos).
  es_values <- vapply(calls, function(c) grepl("/values:batchUpdate$", c$url), logical(1))
  con_validacion <- vapply(calls, function(c) {
    if (!grepl(":batchUpdate$", c$url) || grepl("values:batchUpdate", c$url, fixed = TRUE)) return(FALSE)
    length(.masf_validaciones_en(c$body$requests %||% list())) > 0L
  }, logical(1))
  expect_true(any(es_values))
  expect_true(any(con_validacion))
  expect_gt(min(which(con_validacion)), max(which(es_values)))
})

test_that("B12: la siembra real lleva el calendario a las dos hojas del equipo, nunca a una fórmula", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .masf_partes()
  )

  vs <- .masf_validaciones_en(.masf_estructurales(mock$env$calls))
  fechas <- Filter(function(v) identical(v$tipo, "DATE_IS_VALID"), vs)
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  id_aplicadas <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$sheetId

  # El calendario llega a la agenda (FECHA DE LLAMADA / FECHA AGENDADA) y a la
  # hoja de campo (FECHA DE APLICACIÓN del parte) en la MISMA siembra.
  expect_true(any(vapply(fechas, function(v) identical(v$sheet_id, id_agendadas), logical(1))))
  expect_true(any(vapply(fechas, function(v) identical(v$sheet_id, id_aplicadas), logical(1))))

  # En la hoja de campo, toda fecha validada queda en la banda TECLEABLE del
  # parte: la posición dentro del bloque (módulo ancho) cae después de
  # ID MATCH + agenda, que son las columnas de fórmula del arrastre (B9).
  ancho <- .masf_ancho_campo()
  de_campo <- Filter(function(v) identical(v$sheet_id, id_aplicadas), fechas)
  expect_gt(length(de_campo), 0L)
  for (v in de_campo) {
    expect_gte(v$col_desde %% ancho, AULAS_AGENDADAS_ANCHO_BLOQUE + 1L)
  }
})

test_that("B13a: la siembra y el desplegable de STATUS MUESTRA dicen el mismo vocablo", {
  skip_if_not_installed("digest")
  # Reporte del dueño sobre el Sheets real: el chip del estado inicial sale con
  # warning rojo porque la celda dice `SIN_CONTACTAR` y la lista del
  # desplegable no lo ofrece. El pin es de COHERENCIA, no de categorías (eso es
  # D-B13, que espera la poda del dueño): lo que la siembra escribe para el
  # estado inicial ESTÁ, byte a byte, en la lista de su desplegable, y en forma
  # legible sin guion bajo — la misma que `.capd_estado_legible` da al Plan del
  # día.
  mock <- .sheets_api_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)

  unidades <- .libro_de_prueba()
  unidades[[1]]$sample_status <- "sin_contactar" # el estado inicial del plan

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = unidades, partes = .masf_partes()
  )

  # Lo que la siembra ESCRIBIÓ en STATUS MUESTRA del bloque titular.
  col_status <- .masf_cols_bloque("sample_status", 1L)[[1]]
  fila <- as.list(mock$env$sheets[["Aulas Agendadas"]]$values[[2]] %||% list())
  escrito <- if (length(fila) >= col_status) as.character(fila[[col_status]] %||% "") else ""
  expect_true(nzchar(escrito))
  expect_false(grepl("_", escrito, fixed = TRUE))

  # Lo que el desplegable de ESA columna ofrece: el vocablo escrito está dentro.
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  vs <- .masf_validaciones_en(.masf_estructurales(mock$env$calls))
  status_vs <- Filter(function(v) {
    identical(v$sheet_id, id_agendadas) && identical(v$tipo, "ONE_OF_LIST") &&
      identical(v$col_desde, col_status - 1L)
  }, vs)
  expect_gte(length(status_vs), 1L)
  for (v in status_vs) {
    expect_true(escrito %in% v$valores, info = sprintf(
      "la siembra escribe «%s» y el desplegable ofrece %s",
      escrito, paste(v$valores, collapse = " | ")
    ))
  }
})

test_that("dueño intacto: republicar con hojas del equipo pobladas = cero requests de formato sobre ellas", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  # El equipo ya trabajó sus dos hojas EN el Sheets.
  mock$seed("Aulas Agendadas", values = list(
    list("ID MATCH", "OLA"),
    list("CH 1", "agendada a mano por el equipo")
  ))
  mock$seed("Aulas Aplicadas (Campo)", values = list(
    list("IDENTIDAD DEL AULA"),
    list("CODIGO DE CURSO"),
    list("CH 1")
  ))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  id_agendadas <- mock$env$sheets[["Aulas Agendadas"]]$sheetId
  id_aplicadas <- mock$env$sheets[["Aulas Aplicadas (Campo)"]]$sheetId

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro",
    plan = .libro_de_prueba(),
    partes = .masf_partes()
  )

  # Ni formato ni validaciones sobre los sheetId del equipo: `respetada` es NO
  # tocarlas, tampoco para embellecerlas.
  expect_length(.masf_estructurales_de(mock$env$calls, id_agendadas), 0L)
  expect_length(.masf_estructurales_de(mock$env$calls, id_aplicadas), 0L)

  # Y NO por ausencia de la capa de formato: la Base de control se creó en esta
  # misma publicación y sí recibió su freeze de dos cabeceras.
  id_control <- mock$env$sheets[["Base de control"]]$sheetId
  congeladas <- .masf_frozen_rows_en(.masf_estructurales_de(mock$env$calls, id_control))
  expect_identical(sort(unique(congeladas)), 2L)
})

test_that("republicar sin cambios no reenvía formato ni validaciones", {
  skip_if_not_installed("digest")
  mock <- .sheets_api_mock()
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler)
  plan <- .libro_de_prueba()

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = plan, partes = .masf_partes()
  )
  corte <- length(mock$env$calls)

  monitoreo_aulas_publicar_libro(
    spreadsheet_id = "sheet_libro", plan = plan, partes = .masf_partes()
  )

  # Segunda vuelta: el equipo es dueño de sus hojas ya sembradas y las de la
  # app no cambiaron de contenido ni de dimensiones → el formato de la siembra
  # se conserva, no se rehace (patrón batch-2: formato solo en creación o
  # cambio de dims).
  nuevas <- .masf_estructurales(.masf_desde(mock$env$calls, corte))
  expect_length(.masf_validaciones_en(nuevas), 0L)
  expect_length(.masf_dim_columnas(nuevas), 0L)
  expect_length(.masf_frozen_rows_en(nuevas), 0L)
})

test_that("la capa de formato vive en su archivo propio", {
  r_dir <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(r_dir), "sin fuentes R/ a mano (paquete instalado)")
  expect_true(file.exists(file.path(r_dir, "monitoreo_aulas_sheets_formato.R")))
})
