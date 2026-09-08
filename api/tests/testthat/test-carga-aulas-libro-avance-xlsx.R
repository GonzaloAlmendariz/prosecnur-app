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
       eligible_n = 30, expected_valid = 20, rendimiento_ref = 0.6),
  list(operational_code = "CH 2", sample_role = "titular", faculty = "Letras",
       eligible_n = 30, expected_valid = 20, rendimiento_ref = 0.6)
)

# Desde el 2026-09-08 el avance diario es POR FACULTAD: cada respuesta tiene que
# poder encontrar su aula o la tabla entera desaparece.
.calax_respuestas <- function() data.frame(
  collectorID = c("CH 1", "CH 1", "CH 2"),
  `_submission_time` = c("2026-08-10T09:00:00", "2026-08-10T10:00:00",
                         "2026-08-11T09:00:00"),
  sexo = c("Mujer", "Hombre", "Mujer"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.calax_cfg <- function() list(source_mapping = list(collector_var = "collectorID"))

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
  cuotas = .calax_cuotas(),
  cfg = .calax_cfg()
)

# Sin efectivas, sin cuotas ni partes: el bloque de meta gana la nota de «sin
# dato», no hay tabla de facultades y el diario declara su vacío.
.calax_modelo_minimo <- function() aulas_libro_indicadores(
  .calax_plan(),
  responses = .calax_respuestas(),
  validas = c(TRUE, TRUE, TRUE),
  cfg = .calax_cfg()
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
  # La tabla por facultad fija el ancho: diecisiete columnas desde el 2026-09-08.
  expect_gte(h$n_cols, 17L)
  for (titulo in c(unname(AULAS_AVANCE_TITULOS), "De dónde salió este libro")) {
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
  # Sin cuotas la tabla por facultad no existe, así que el ancho lo fija la más
  # ancha de las que quedan (el avance diario, diez columnas). Se DERIVA del
  # vocabulario, no se cuenta a mano: una columna nueva no puede romper el pin.
  # «Rendimiento por facultad» sí existe y también empieza por «Facultad», así
  # que la ausencia se comprueba con una columna que sólo la otra tiene.
  expect_true(is.na(.calax_fila_de(h$celdas, "Avance por facultad")))
  expect_false(any(as.character(unlist(h$celdas)) == "Efectivas mujeres", na.rm = TRUE))
  expect_identical(h$n_cols, length(AULAS_AVANCE_CABECERAS$diario))
  for (titulo in c("Avance general", "Avance diario")) {
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
  # La nota al pie de la tabla por facultad empieza «Muestra (40) y
  # sobremuestra (60)…» desde V6 (2026-09-08); hasta entonces «La muestra es
  # la cuota del diseño…», que llamaba «margen» a la sobremuestra.
  #
  # «La meta y el avance diario se miden en la plataforma; la producción por
  # aplicador, en el parte» ya no está: el segundo dictado del 2026-09-08 deja
  # la producción por aplicador midiéndose también en la plataforma, así que no
  # hay dos familias que distinguir y el puente se retiró.
  notas <- c("La cuota es de cada facultad", "Muestra (",
             "Una fila por persona EN CADA FACULTAD", "Una fila por facultad y día",
             "Si editaste el libro")
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

# --- S4: el vacío de una celda de tabla se declara con «—» --------------------

# Modelo con alguien que aplica en una facultad sin tasa declarada (Equipo C) y
# sin variable de sexo: la tasa esperada y las efectivas por sexo quedan NA.
.calax_modelo_con_huecos <- function() aulas_libro_indicadores(
  .calax_plan(),
  efectivas = c(`CH 1` = 18, `CH 2` = 12),
  responses = .calax_respuestas(),
  validas = c(TRUE, TRUE, TRUE),
  partes = .calax_partes(),
  cuotas = .calax_cuotas(),
  cfg = .calax_cfg(),
  asignados = list(`CH 1` = "Equipo A", `CH 2` = "Equipo C")
)

# El tipo de la celda (fila, col) según openxlsx: "n" número, "s" texto, NA
# si no existe. `sheet_data$t` codifica 0 = número, 1 = texto compartido.
.calax_tipo_celda <- function(path, fila, col) {
  sd <- openxlsx::loadWorkbook(path)$worksheets[[1]]$sheet_data
  i <- which(sd$rows == fila & sd$cols == col)
  if (!length(i)) return(NA_character_)
  tt <- sd$t[i[[1]]]
  if (is.na(tt)) NA_character_ else if (tt == 0) "n" else "s"
}

test_that("S4: en el xlsx, la celda sin dato de una tabla sale «—» y las cifras siguen siendo números", {
  ind <- .calax_modelo_con_huecos()
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, ind, hoja = "Avance de campo")
  path <- withr::local_tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  celdas <- openxlsx::read.xlsx(path, sheet = "Avance de campo", colNames = FALSE,
                                skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  # Facultades: sin variable de sexo, «Efectivas mujeres» se declara (la
  # columna se llamaba «Conseguidas mujeres» hasta el dictado del 2026-09-08).
  cab_f <- .calax_fila_de(celdas, "Facultad")
  col_muj <- which(as.character(celdas[cab_f, ]) == "Efectivas mujeres")
  fila_l <- .calax_fila_de(celdas, "Letras")
  expect_identical(as.character(celdas[fila_l, col_muj]), "\u2014")
  expect_identical(.calax_tipo_celda(path, fila_l, col_muj), "s")
  # Y una cifra de la misma fila sigue siendo NÚMERO, no texto: el «—» no
  # convierte la tabla entera en cadenas.
  col_ef <- which(as.character(celdas[cab_f, ]) == "Efectivas")
  expect_identical(.calax_tipo_celda(path, fila_l, col_ef), "n")

  # «Avance general» declara igual sus tres filas de aulas, que no tienen sexo.
  cab_g <- .calax_fila_de(celdas, "Indicadores")
  fila_pl <- .calax_fila_de(celdas, "Aulas planificadas")
  expect_false(is.na(cab_g))
  expect_identical(as.character(celdas[fila_pl, 3]), "\u2014")
})

# --- S5: el «Total» vive donde suma, y el avance diario ya no es ese sitio ----

# ¿Algún estilo de la fila lleva negrita?
.calax_en_negrita <- function(h, fila) {
  for (so in h$estilos) {
    if (!identical(so$sheet, "Avance de campo") || !(fila %in% so$rows)) next
    if (any(grepl("BOLD", toupper(as.character(so$style$fontDecoration %||% "")), fixed = TRUE))) return(TRUE)
  }
  FALSE
}

# La fila (1-based) cuya primera columna es exactamente `texto` a partir de
# `desde`, o NA.
.calax_fila_de_desde <- function(celdas, texto, desde) {
  col1 <- as.character(celdas[[1]])
  idx <- which(!is.na(col1) & col1 == texto & seq_along(col1) > desde)
  if (length(idx)) idx[[1]] else NA_integer_
}

test_that("S5: la tabla por facultad cierra con una fila «Total» en negrita que suma sus celdas", {
  h <- .calax_hoja(.calax_modelo_completo())
  cab <- .calax_fila_de(h$celdas, "Facultad")
  expect_false(is.na(cab))
  fila_total <- .calax_fila_de_desde(h$celdas, "Total", cab)
  expect_false(is.na(fila_total), info = "no hay fila «Total» bajo la tabla por facultad")
  expect_identical(fila_total, cab + 2L)   # cabecera + 1 facultad + total
  nombres <- as.character(h$celdas[cab, ])
  celda <- function(rotulo) as.character(h$celdas[fila_total, which(nombres == rotulo)])
  expect_identical(celda("Muestra"), "40")
  expect_identical(celda("Efectivas"), "30")
  expect_true(.calax_en_negrita(h, fila_total))
})

test_that("S5: el avance diario NO cierra con «Total»: sumaría acumulados de facultades distintas", {
  # Lo hacía cuando la serie era una fila por jornada del estudio entero. Desde
  # el 2026-09-08 es una fila por FACULTAD y día, y un total al pie diría una
  # cifra que no significa nada.
  h <- .calax_hoja(.calax_modelo_completo())
  cab_diario <- .calax_fila_de(h$celdas, "Día de la semana")
  # La cabecera del diario empieza por «Facultad», así que se localiza por una
  # columna que sólo esa tabla tiene.
  fila_cab <- which(apply(h$celdas, 1, function(r) any(as.character(r) == "Día de la semana", na.rm = TRUE)))
  expect_length(fila_cab, 1L)
  expect_true(is.na(.calax_fila_de_desde(h$celdas, "Total", fila_cab[[1]])))
})

# --- S12: el mismo trato en toda la hoja ---------------------------------------

# ¿Algún estilo que cubra (fila, col) lleva los cuatro bordes?
.calax_con_bordes <- function(h, fila, col) {
  for (so in h$estilos) {
    if (!identical(so$sheet, "Avance de campo")) next
    if (!any(so$rows == fila & so$cols == col)) next
    st <- so$style
    lados <- c(st$borderTop, st$borderBottom, st$borderLeft, st$borderRight)
    if (length(lados) == 4L && all(nzchar(lados))) return(TRUE)
  }
  FALSE
}

# El formato numérico y la alineación de la celda (fila, col), si algún estilo los fija.
.calax_formato_de <- function(h, fila, col) {
  out <- list(numFmt = "", halign = "")
  for (so in h$estilos) {
    if (!identical(so$sheet, "Avance de campo")) next
    if (!any(so$rows == fila & so$cols == col)) next
    fmt <- so$style$numFmt
    if (is.list(fmt) && length(fmt$formatCode %||% "")) out$numFmt <- as.character(fmt$formatCode)
    if (length(so$style$halign %||% "")) out$halign <- as.character(so$style$halign)
  }
  out
}

test_that("S12: la tabla de aplicadores lleva bordes como la de facultades", {
  # Visto en el render real: la de facultades con rejilla y la de aplicadores
  # sin ella, en la misma hoja. Un lector no sabe por qué una es tabla y la
  # otra parece una lista.
  h <- .calax_hoja(.calax_modelo_completo())
  fila_fac <- .calax_fila_de(h$celdas, "Letras")
  # La tabla de aplicadores empieza por «Facultad» desde el 2026-09-08, así que
  # su fila se localiza por el nombre de la persona, que va en la segunda.
  fila_apl <- which(as.character(h$celdas[[2]]) == "Equipo A")[[1]]
  cab_apl <- which(as.character(h$celdas[[2]]) == "Aplicador")[[1]]
  expect_true(.calax_con_bordes(h, fila_fac, 2L), info = "la fila de facultades perdió sus bordes")
  expect_true(.calax_con_bordes(h, fila_apl, 1L), info = "la fila de aplicadores no lleva bordes (columna 1)")
  expect_true(.calax_con_bordes(h, fila_apl, 2L), info = "la fila de aplicadores no lleva bordes (columna 2)")
  expect_true(.calax_con_bordes(h, cab_apl, 3L), info = "la cabecera de aplicadores no lleva bordes")
})

test_that("S12: la procedencia escribe sus conteos con separador de miles y la marca a la derecha", {
  # «1392» sin separador bajo un bloque que escribe «3,158»; y la marca a la
  # izquierda con las cifras a la derecha.
  h <- .calax_hoja(.calax_modelo_completo(), procedencia = .calax_procedencia())
  fila_aulas <- .calax_fila_de(h$celdas, "Aulas que traía esa lectura")
  expect_false(is.na(fila_aulas))
  expect_identical(.calax_formato_de(h, fila_aulas, 2L)$numFmt, "#,##0")
  fila_marca <- .calax_fila_de(h$celdas, "Última vez que la app leyó un libro lleno")
  expect_identical(.calax_formato_de(h, fila_marca, 2L)$halign, "right")
})

# --- S11: sin partes, el xlsx y el Sheets dicen lo mismo del bloque de aplicadores ---

test_that("S11: sin partes el xlsx escribe «Producción por aplicador» con su vacío declarado, igual que el Sheets", {
  # El Sheets ya lo hacía (C3: la sección no desaparece, dice por qué está
  # vacía) y el xlsx omitía el bloque entero: dos hojas del mismo modelo con
  # dos respuestas a «¿hay producción por aplicador?».
  h <- .calax_hoja(.calax_modelo_minimo())
  fila <- .calax_fila_de(h$celdas, "Producción por aplicador")
  expect_false(is.na(fila), info = "el xlsx omite el bloque de aplicadores sin partes")
  expect_identical(.calax_cols_de_banda(h$estilos, fila), seq_len(h$n_cols))
  nota <- as.character(h$celdas[fila + 1L, 1])
  expect_identical(nota, .cali_motivo_sin_aplicadores())
  expect_match(nota, "todavía no hay producción por aplicador")
  expect_true(.calax_fusionada_a_lo_ancho(h, fila + 1L))
})
