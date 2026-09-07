# La hoja «Avance de campo» del xlsx se lee como tabla — unidades S3 y S10 del
# loop de mejora estética (2026-09-07).
#
# Vara (dictado de Gonzalo, 2026-09-01, textual): «tiene una estructura muy,
# muy fea; no se ven bien las tablas, no se organiza bien, no se entiende cómo
# se organiza; se ve como toda esa información, no como una tabla».
#
# Medido antes del cambio en el libro real del 07/09 (70 filas × 12 columnas):
# la banda de «Avance contra la meta» se pintaba con `cols = 1:2` y la de «De
# dónde salió este libro» igual, sobre una hoja cuya tabla más ancha (avance
# por facultad) tiene doce columnas: el subrayado de sección se cortaba a la
# mitad y el ojo no sabía dónde terminaba cada bloque. Y la marca «Última vez
# que la app leyó un libro lleno» salía como `2026-09-07T20:41:36Z`, en UTC y
# en formato de máquina, para un equipo que lee horas de Lima.
#
# Fixtures autocontenidos (los helpers de otro test file no se ven).

.calax_plan <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20)
)

.calax_respuestas <- function() data.frame(
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.calax_partes <- function() list(
  list(operational_code = "CH 1", applied_by = "Equipo A", effective_surveys = 20),
  list(operational_code = "CH 2", applied_by = "Equipo B", effective_surveys = 8)
)

.calax_cuotas <- function() list(
  meta_diseno = 40, meta_operativa = 60,
  facultades = list(
    list(facultad = "Letras", cuota = 40, cuota_sexo = list(F = 20, M = 20))
  )
)

.calax_modelo_completo <- function() aulas_libro_indicadores(
  .calax_plan(),
  efectivas = c(`CH 1` = 18, `CH 2` = 12),
  responses = .calax_respuestas(),
  validas = c(TRUE, TRUE, TRUE),
  partes = .calax_partes(),
  cuotas = .calax_cuotas()
)

# Sin efectivas, sin cuotas ni partes: el bloque de meta gana la nota de «sin
# dato», no hay tabla de facultades y el diario declara su vacío.
.calax_modelo_minimo <- function() aulas_libro_indicadores(
  .calax_plan(),
  responses = .calax_respuestas(),
  validas = c(TRUE, TRUE, TRUE)
)

.calax_procedencia <- function() list(
  importado_en = "2026-09-07T20:41:36Z",
  resumen = list(unidades = 1392L, partes_de_campo = 7L, filas_de_control = 9L)
)

# Escribe la hoja en un xlsx y devuelve lo que hace falta para mirarla: las
# celdas (sin cabecera, sin saltar vacíos) y los objetos de estilo con sus
# filas y columnas, tal como los deja `openxlsx::loadWorkbook`.
.calax_hoja <- function(ind, procedencia = NULL) {
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind, hoja = "Avance de campo", procedencia = procedencia)
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  celdas <- openxlsx::read.xlsx(path, sheet = "Avance de campo", colNames = FALSE,
                                skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  wb2 <- openxlsx::loadWorkbook(path)
  list(celdas = celdas, estilos = wb2$styleObjects, n_cols = ncol(celdas),
       # `<mergeCell ref="A11:L11"/>` por fusión; alturas con nombre = fila.
       fusiones = as.character(wb2$worksheets[[1]]$mergeCells %||% character(0)),
       alturas = wb2$rowHeights[[1]] %||% character(0))
}

# La fila (1-based) cuya primera columna EMPIEZA por `texto`, o NA.
.calax_fila_que_empieza <- function(celdas, texto) {
  col1 <- as.character(celdas[[1]])
  idx <- which(!is.na(col1) & startsWith(col1, texto))
  if (length(idx)) idx[[1]] else NA_integer_
}

# ¿La fila está fusionada de la columna A a la última de la hoja?
.calax_fusionada_a_lo_ancho <- function(h, fila) {
  ref <- sprintf('ref="A%d:%s%d"', fila, openxlsx::int2col(h$n_cols), fila)
  any(grepl(ref, h$fusiones, fixed = TRUE))
}

# ¿Algún estilo de la fila lleva ajuste de texto?
.calax_con_wrap <- function(h, fila) {
  for (so in h$estilos) {
    if (!identical(so$sheet, "Avance de campo") || !(fila %in% so$rows)) next
    if (isTRUE(so$style$wrapText)) return(TRUE)
  }
  FALSE
}

# La fila (1-based) cuya primera columna es exactamente `texto`, o NA.
.calax_fila_de <- function(celdas, texto) {
  col1 <- as.character(celdas[[1]])
  idx <- which(!is.na(col1) & col1 == texto)
  if (length(idx)) idx[[1]] else NA_integer_
}

# Las columnas que cubren, en esa fila, los estilos con borde o relleno: eso
# es una banda. Un estilo de texto solo (negrita, color) no cuenta.
.calax_cols_de_banda <- function(estilos, fila) {
  cols <- integer(0)
  for (so in estilos) {
    if (!identical(so$sheet, "Avance de campo")) next
    if (!(fila %in% so$rows)) next
    st <- so$style
    con_borde <- length(st$borderBottom %||% character(0)) > 0L ||
      length(st$borderTop %||% character(0)) > 0L
    con_fondo <- !is.null(st$fill)
    if (con_borde || con_fondo) cols <- union(cols, so$cols[so$rows == fila])
  }
  sort(cols)
}

test_that("S3: cada banda de sección cubre el ancho de la hoja, no el de su tabla", {
  h <- .calax_hoja(.calax_modelo_completo(), procedencia = .calax_procedencia())
  expect_gte(h$n_cols, 12L)   # la tabla por facultad fija el ancho
  for (titulo in c("Avance contra la meta", "Avance por facultad",
                   "Producción por aplicador", "Avance diario",
                   "De dónde salió este libro")) {
    fila <- .calax_fila_de(h$celdas, titulo)
    expect_false(is.na(fila), info = sprintf("la hoja perdió el título «%s»", titulo))
    cols <- .calax_cols_de_banda(h$estilos, fila)
    expect_identical(cols, seq_len(h$n_cols),
                     info = sprintf("la banda de «%s» cubre %s de %d columnas",
                                    titulo, paste(range(cols), collapse = "–"), h$n_cols))
  }
})

test_that("S3: con otra geometría (sin facultades ni partes) las bandas siguen cubriendo la hoja entera", {
  # Sin cuotas no hay tabla por facultad y sin partes el xlsx omite la de
  # aplicadores (el guard de `aulas_libro_escribir_indicadores`; el Sheets, en
  # cambio, declara su vacío — asimetría anotada en el loop, no es de S3). La
  # hoja queda a cuatro columnas (el diario) y las bandas que quedan la cubren.
  h <- .calax_hoja(.calax_modelo_minimo())
  expect_true(is.na(.calax_fila_de(h$celdas, "Avance por facultad")))
  expect_identical(h$n_cols, 4L)
  for (titulo in c("Avance contra la meta", "Avance diario")) {
    fila <- .calax_fila_de(h$celdas, titulo)
    expect_false(is.na(fila), info = sprintf("la hoja perdió el título «%s»", titulo))
    cols <- .calax_cols_de_banda(h$estilos, fila)
    expect_identical(cols, seq_len(h$n_cols),
                     info = sprintf("la banda de «%s» cubre %s de %d columnas (mínimo)",
                                    titulo, paste(range(cols), collapse = "–"), h$n_cols))
  }
})

test_that("S10: la marca de lectura del libro sale en hora local legible, no en ISO UTC", {
  expect_identical(.cai_marca_local("2026-09-07T20:41:36Z", tz = "America/Lima"), "07/09/2026 15:41")
  expect_identical(.cai_marca_local("2026-09-07T20:41:36Z", tz = "UTC"), "07/09/2026 20:41")
  # Lo que no es una marca ISO se deja como llegó: el texto de «ninguna lectura».
  expect_identical(.cai_marca_local("Ninguna: sale sólo del plan", tz = "UTC"), "Ninguna: sale sólo del plan")
  expect_identical(.cai_marca_local("", tz = "UTC"), "")

  h <- .calax_hoja(.calax_modelo_completo(), procedencia = .calax_procedencia())
  fila <- .calax_fila_de(h$celdas, "Última vez que la app leyó un libro lleno")
  expect_false(is.na(fila))
  valor <- as.character(h$celdas[fila, 2])
  expect_match(valor, "^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}$",
               info = sprintf("la marca salió «%s»", valor))
})

test_that("S2: cada nota va fusionada a lo ancho de la hoja, baja de línea y su fila tiene alto propio", {
  # Medido en el libro real del 07/09: las notas iban en UNA celda de la
  # columna A sin fusionar ni ajustar; en Sheets se derramaban hasta la primera
  # celda ocupada y sobresalían de su tabla.
  h <- .calax_hoja(.calax_modelo_completo(), procedencia = .calax_procedencia())
  notas <- c("La meta y el avance diario", "La cuota es de cada facultad",
             "La muestra es la cuota del diseño", "Si editaste el libro")
  for (nota in notas) {
    fila <- .calax_fila_que_empieza(h$celdas, nota)
    expect_false(is.na(fila), info = sprintf("la hoja perdió la nota «%s…»", nota))
    expect_true(.calax_fusionada_a_lo_ancho(h, fila),
                info = sprintf("la nota «%s…» (fila %d) no está fusionada de A a %s",
                               nota, fila, openxlsx::int2col(h$n_cols)))
    expect_true(.calax_con_wrap(h, fila),
                info = sprintf("la nota «%s…» (fila %d) no baja de línea", nota, fila))
    expect_true(as.character(fila) %in% names(h$alturas),
                info = sprintf("la nota «%s…» (fila %d) no tiene alto propio", nota, fila))
  }
  # Las filas de tabla NO se fusionan: una fusión ahí rompería la lectura.
  fila_letras <- .calax_fila_de(h$celdas, "Letras")
  expect_false(.calax_fusionada_a_lo_ancho(h, fila_letras))
})
