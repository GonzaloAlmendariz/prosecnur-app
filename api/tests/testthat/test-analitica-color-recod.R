source("setup-load-all.R")

# ---------------------------------------------------------------------------
# Firma de color de recodificaciones (cfg$color_recodificaciones)
# Verifica leyendo el fill REAL del .xlsx (unzip + styles.xml + celdas), no un
# proxy. ON => filas/columnas/bloques `_recod` con relleno pastel POR TIPO
# (dummies SM en verde); OFF => limpio. Tono suave por diseño.
# ---------------------------------------------------------------------------

.NS_SS <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Devuelve fill_at(ref) -> RGB (sin alfa, mayusculas) o NA para la hoja
# `sheet_index` (1-based, orden de creacion) de un .xlsx openxlsx.
.xlsx_fill_reader <- function(path, sheet_index = 1L) {
  tmp <- tempfile("fillread_"); dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = tmp)
  styles <- xml2::read_xml(file.path(tmp, "xl", "styles.xml"))
  fills <- xml2::xml_find_all(styles, ".//a:fills/a:fill", .NS_SS)
  fill_rgb <- vapply(fills, function(f) {
    pf <- xml2::xml_find_first(f, "a:patternFill", .NS_SS)
    if (inherits(pf, "xml_missing")) return(NA_character_)
    pt <- xml2::xml_attr(pf, "patternType")
    if (is.na(pt) || identical(pt, "none")) return(NA_character_)
    fg <- xml2::xml_find_first(pf, "a:fgColor", .NS_SS)
    rgb <- xml2::xml_attr(fg, "rgb")
    if (is.na(rgb)) NA_character_ else toupper(sub("^FF", "", rgb))
  }, character(1))
  xfs <- xml2::xml_find_all(styles, ".//a:cellXfs/a:xf", .NS_SS)
  xf_fill <- vapply(xfs, function(x) {
    fid <- xml2::xml_attr(x, "fillId"); if (is.na(fid)) 0L else as.integer(fid)
  }, integer(1))

  sheet_files <- sort(list.files(file.path(tmp, "xl", "worksheets"), "^sheet\\d+\\.xml$"))
  sx <- xml2::read_xml(file.path(tmp, "xl", "worksheets", sheet_files[[sheet_index]]))
  cells <- xml2::xml_find_all(sx, ".//a:sheetData/a:row/a:c", .NS_SS)
  refs <- xml2::xml_attr(cells, "r")
  sidx <- xml2::xml_attr(cells, "s")
  ref_fill <- stats::setNames(rep(NA_character_, length(refs)), refs)
  for (i in seq_along(refs)) {
    s <- if (is.na(sidx[[i]])) 0L else as.integer(sidx[[i]])
    fid <- if (s + 1L <= length(xf_fill)) xf_fill[[s + 1L]] else 0L
    ref_fill[[refs[[i]]]] <- if (fid + 1L <= length(fill_rgb)) fill_rgb[[fid + 1L]] else NA_character_
  }
  function(ref) unname(ref_fill[ref])
}

.col_letter <- function(n) {
  out <- ""
  while (n > 0) { r <- (n - 1) %% 26; out <- paste0(LETTERS[r + 1], out); n <- (n - 1) %/% 26 }
  out
}
.ref <- function(row, col) paste0(.col_letter(col), row)
.hx <- function(x) toupper(sub("^#", "", x))

PAL <- pulso_recod_palette()
.all_fills <- vapply(unlist(PAL, use.names = FALSE), .hx, character(1))

# ============================ resolver de tipo (unit) ======================
test_that("pulso_recod_resolve_type resuelve dummies SM a su padre", {
  tm <- list(obstacle = "sm", obstacle_recod = "sm",
             transport = "so", transport_recod = "so",
             edad = "int", edad_recod = "int")
  expect_equal(pulso_recod_resolve_type("obstacle_recod.1", tm), "sm")
  expect_equal(pulso_recod_resolve_type("obstacle_recod.96", tm), "sm")
  expect_equal(pulso_recod_resolve_type("transport_recod", tm), "so")
  expect_equal(pulso_recod_resolve_type("edad_recod", tm), "int")
  expect_true(is.na(pulso_recod_resolve_type("otra_recod", tm)))
})

# ============================ XLSForm ======================================
.xlsform_sheets <- function() {
  list(
    survey = data.frame(
      type = c("select_multiple obstacle_recod", "select_one transport_recod",
               "integer", "select_one sexo"),
      name = c("obstacle_recod", "transport_recod", "edad_recod", "sexo"),
      label = c("Obstaculo", "Transporte", "Edad rec", "Sexo"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("obstacle_recod", "obstacle_recod", "transport_recod", "sexo"),
      name = c("1", "2", "1", "1"),
      label = c("A", "B", "Bus", "Mujer"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    settings = data.frame(form_title = "T", form_id = "id", stringsAsFactors = FALSE)
  )
}

test_that("XLSForm: color_recod=TRUE pinta filas _recod por tipo y sus listas", {
  sheets <- .xlsform_sheets()
  path <- tempfile(fileext = ".xlsx")
  .analitica_write_xlsform_sheets(sheets, path, color_recod = TRUE)

  fill <- .xlsx_fill_reader(path, sheet_index = 1L)  # survey (+1 encabezado)
  expect_equal(fill(.ref(2, 1)), .hx(PAL$sm_row))   # obstacle_recod SM
  expect_equal(fill(.ref(3, 1)), .hx(PAL$so_row))   # transport_recod SO
  expect_equal(fill(.ref(4, 1)), .hx(PAL$int_row))  # edad_recod INT
  expect_false(isTRUE(fill(.ref(5, 1)) %in% .all_fills))  # sexo limpio
  fillc <- .xlsx_fill_reader(path, sheet_index = 2L)  # choices
  expect_equal(fillc(.ref(2, 1)), .hx(PAL$sm))       # obstacle_recod list
  expect_equal(fillc(.ref(4, 1)), .hx(PAL$so))       # transport_recod list
  expect_false(isTRUE(fillc(.ref(5, 1)) %in% .all_fills))  # sexo limpio
})

test_that("XLSForm: type 'stripped' resuelve por nombre (listas == var recod) y cae a generico si no mapea", {
  sheets <- list(
    survey = data.frame(
      type = c("select_multiple", "select_one", "select_one sexo"),
      name = c("obstacle_recod", "transport_recod", "sexo"),
      label = c("Obstaculo", "Transporte", "Sexo"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      # obstacle_recod / transport_recod == nombre de la var recod (mapea por
      # nombre). lst_otra_recod no corresponde a ninguna var -> generico.
      list_name = c("obstacle_recod", "transport_recod", "lst_otra_recod", "sexo"),
      name = c("1", "1", "1", "1"),
      label = c("A", "Bus", "Z", "Mujer"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    settings = data.frame(form_title = "T", form_id = "id", stringsAsFactors = FALSE)
  )
  path <- tempfile(fileext = ".xlsx")
  expect_error(.analitica_write_xlsform_sheets(sheets, path, color_recod = TRUE), NA)
  fill <- .xlsx_fill_reader(path, sheet_index = 1L)
  expect_equal(fill(.ref(2, 1)), .hx(PAL$sm_row))
  expect_equal(fill(.ref(3, 1)), .hx(PAL$so_row))
  fillc <- .xlsx_fill_reader(path, sheet_index = 2L)
  expect_equal(fillc(.ref(2, 1)), .hx(PAL$sm))       # obstacle_recod -> SM por nombre
  expect_equal(fillc(.ref(3, 1)), .hx(PAL$so))       # transport_recod -> SO por nombre
  expect_equal(fillc(.ref(4, 1)), .hx(PAL$generic))  # lst_otra_recod -> generico
  expect_false(isTRUE(fillc(.ref(5, 1)) %in% .all_fills))  # sexo limpio
})

test_that("XLSForm: color_recod=FALSE deja el instrumento limpio", {
  sheets <- .xlsform_sheets()
  path <- tempfile(fileext = ".xlsx")
  .analitica_write_xlsform_sheets(sheets, path, color_recod = FALSE)
  fill <- .xlsx_fill_reader(path, sheet_index = 1L)
  for (r in 2:5) expect_false(isTRUE(fill(.ref(r, 1)) %in% .all_fills))
  fillc <- .xlsx_fill_reader(path, sheet_index = 2L)
  for (r in 2:5) expect_false(isTRUE(fillc(.ref(r, 1)) %in% .all_fills))
})

# ============================ BBDD .bases_write_xlsx ========================
test_that("BBDD xlsx: dummies SM en VERDE por type_map (ON) y limpio (OFF)", {
  df <- data.frame(
    id = c("a", "b"),
    sexo = c("1", "2"),
    obstacle_recod.1 = c("1", "0"),
    obstacle_recod.96 = c("0", "1"),
    transport_recod = c("1", "2"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  tm <- list(sexo = "so", obstacle = "sm", obstacle_recod = "sm",
             transport = "so", transport_recod = "so")

  path_on <- tempfile(fileext = ".xlsx")
  .bases_write_xlsx(df, df, path_on, valores = "codigos", ficha_tecnica = FALSE,
                    color_recod = TRUE, type_map = tm)
  fon <- .xlsx_fill_reader(path_on, sheet_index = 1L)
  # cols: 1 id, 2 sexo, 3 obstacle_recod.1 (SM verde), 4 obstacle_recod.96 (SM),
  #       5 transport_recod (SO azul).
  expect_equal(fon(.ref(1, 3)), .hx(PAL$sm))   # dummy SM -> verde (no lavanda)
  expect_equal(fon(.ref(2, 3)), .hx(PAL$sm))
  expect_equal(fon(.ref(1, 4)), .hx(PAL$sm))
  expect_equal(fon(.ref(1, 5)), .hx(PAL$so))   # SO -> azul
  expect_false(isTRUE(fon(.ref(1, 2)) %in% .all_fills))  # sexo (no recod) limpio

  path_off <- tempfile(fileext = ".xlsx")
  .bases_write_xlsx(df, df, path_off, valores = "codigos", ficha_tecnica = FALSE,
                    color_recod = FALSE, type_map = tm)
  foff <- .xlsx_fill_reader(path_off, sheet_index = 1L)
  expect_false(isTRUE(foff(.ref(1, 3)) %in% .all_fills))
  expect_false(isTRUE(foff(.ref(2, 3)) %in% .all_fills))
})

# ============================ Codebook XLSX =================================
.codebook_df <- function() {
  df <- data.frame(
    sexo = c(1L, 2L, 1L),
    obstacle_recod.1 = c(1L, 0L, 1L),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  attr(df$sexo, "label") <- "Sexo"
  attr(df$sexo, "labels") <- stats::setNames(c(1, 2), c("Mujer", "Hombre"))
  attr(df[["obstacle_recod.1"]], "label") <- "Obstaculo A"
  attr(df[["obstacle_recod.1"]], "labels") <- stats::setNames(c(0, 1), c("No", "Si"))
  attr(df, "instrumento_reporte") <- list(
    survey = data.frame(
      type = c("select_one sexo", "select_multiple obstacle_recod"),
      name = c("sexo", "obstacle_recod"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )
  df
}

test_that("Codebook xlsx: SOLO la tabla Codigo|Etiqueta tintada (dummy SM verde faint); nombre/etiqueta sin color", {
  df <- .codebook_df()
  path_on <- tempfile(fileext = ".xlsx")
  reporte_codebook(df, path_xlsx = path_on, ficha_tecnica = FALSE, color_recod = TRUE)
  grid <- openxlsx::read.xlsx(path_on, sheet = "Codebook", colNames = FALSE, skipEmptyRows = FALSE)
  recod_row <- which(vapply(grid[[1]], function(x) isTRUE(pulso_recod_is_name(x)), logical(1)))
  sexo_row <- which(vapply(grid[[1]], function(x) identical(as.character(x), "sexo"), logical(1)))
  expect_true(length(recod_row) >= 1L)
  fon <- .xlsx_fill_reader(path_on, sheet_index = 1L)
  br <- recod_row[[1]]
  # nombre de la variable (fila del nombre) SIN color.
  expect_false(isTRUE(fon(.ref(br, 1)) %in% .all_fills))
  # fila de etiqueta de la variable (br+2, col C = varlabel) SIN color.
  expect_false(isTRUE(fon(.ref(br + 2L, 3)) %in% .all_fills))
  # ENCABEZADO (fila "Valor", br+1) col C con el tono un paso mas oscuro (SM head).
  expect_equal(fon(.ref(br + 1L, 3)), .hx(PAL$sm_head))
  # celdas de la tabla de valores (vals_start = br+3): codigo (col B) y etiqueta
  # (col C) con el tinte tenue del CUERPO (dummy SM -> padre).
  expect_equal(fon(.ref(br + 3L, 2)), .hx(PAL$sm_faint))
  expect_equal(fon(.ref(br + 3L, 3)), .hx(PAL$sm_faint))
  # header mas oscuro que el cuerpo (distinguible).
  expect_false(identical(.hx(PAL$sm_head), .hx(PAL$sm_faint)))
  # columna A ("Valores validos") NO tintada.
  expect_false(isTRUE(fon(.ref(br + 3L, 1)) %in% .all_fills))
  # variable no recod (sexo) sin color en su tabla.
  expect_false(isTRUE(fon(.ref(sexo_row[[1]] + 3L, 2)) %in% .all_fills))

  path_off <- tempfile(fileext = ".xlsx")
  reporte_codebook(df, path_xlsx = path_off, ficha_tecnica = FALSE, color_recod = FALSE)
  foff <- .xlsx_fill_reader(path_off, sheet_index = 1L)
  expect_false(isTRUE(foff(.ref(br + 3L, 2)) %in% .all_fills))
})

# ============================ Config flag ==================================
test_that(".analitica_color_recod_enabled default TRUE, respeta FALSE explicito", {
  expect_true(.analitica_color_recod_enabled(NULL))
  expect_true(.analitica_color_recod_enabled(list()))
  expect_true(.analitica_color_recod_enabled(list(color_recodificaciones = TRUE)))
  expect_false(.analitica_color_recod_enabled(list(color_recodificaciones = FALSE)))
})

test_that("default config trae color_recodificaciones = TRUE", {
  cfg <- .analitica_default_config()
  expect_true(isTRUE(cfg$color_recodificaciones))
})
