# Lectura de bases de Excel con columnas dispersas.
#
# `readxl::read_excel` adivina el tipo de cada columna mirando sólo las
# primeras 1000 filas (`guess_max` por defecto). Una columna de texto «Otro»
# vacía en esas filas sale `logical` y los textos posteriores se convierten en
# NA (con un warning que los llamadores silencian); un número disperso (7) se
# vuelve TRUE. En una base real de 1500 encuestas eso borra los textos que la
# codificación existe para codificar, y el reparador del modo padre REESCRIBE
# el archivo de datos con los textos ya perdidos.
#
# Saltos cubiertos: `.read_data_any` (lector del flujo de codificación),
# plantilla de codificación sin grupos y con un grupo,
# `.pulso_repair_parent_recod_columns` (ida y vuelta sobre el archivo) y
# `leer_datos_generico` (motor de aplicar).

.disp_n <- 1500L
.disp_filas_otro <- c(1200L, 1400L)
.disp_textos_otro <- c("transporte publico", "salud mental")
.disp_fila_num <- 1300L

.disp_n_textos <- function(x) {
  x <- as.character(x)
  sum(!is.na(x) & nzchar(trimws(x)))
}

.disp_instrumento <- function() {
  survey <- data.frame(
    type = c("select_multiple lst_p11", "text", "select_one lst_p26", "text", "integer"),
    name = c("P11", "P11_otro", "P26", "P26_otro", "P30"),
    label = c("Medios", "Otro medio", "Area", "Otra area", "Hijos"),
    relevant = c("", "selected(${P11},'88')", "", "selected(${P26},'99')", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p11", 3), rep("lst_p26", 3)),
    name = c("1", "2", "88", "1", "2", "99"),
    label = c("Radio", "TV", "Otro", "A", "B", "Otro"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(survey = survey, choices = choices)
}

# 1500 filas. P11_otro vacía salvo 1200 y 1400 (88 marcado); P26_otro con
# texto en la fila 5 (control: cae dentro de las 1000 filas que readxl mira);
# P30 numérica vacía salvo un 7 en la fila 1300.
.disp_data <- function() {
  n <- .disp_n
  d <- data.frame(
    `_uuid` = sprintf("u-%04d", seq_len(n)),
    P11 = rep(c("1", "2"), length.out = n),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  d$P11[.disp_filas_otro] <- c("1 88", "88")
  d$`P11/1` <- as.integer(grepl("(^| )1( |$)", d$P11))
  d$`P11/2` <- as.integer(grepl("(^| )2( |$)", d$P11))
  d$`P11/88` <- as.integer(grepl("(^| )88( |$)", d$P11))
  d$P11_otro <- NA_character_
  d$P11_otro[.disp_filas_otro] <- .disp_textos_otro
  d$P26 <- rep(c("1", "2"), length.out = n)
  d$P26[5] <- "99"
  d$P26_otro <- NA_character_
  d$P26_otro[5] <- "logistica"
  d$P30 <- NA_real_
  d$P30[.disp_fila_num] <- 7
  d
}

# Escribe instrumento y data con openxlsx (las celdas NA quedan vacías, como
# en una exportación real de Kobo).
.disp_fixture <- function(dir = tempfile("disp_")) {
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  xls_path <- file.path(dir, "instrumento.xlsx")
  data_path <- file.path(dir, "data.xlsx")
  openxlsx::write.xlsx(.disp_instrumento(), xls_path, overwrite = TRUE)
  openxlsx::write.xlsx(list(data = .disp_data()), data_path, overwrite = TRUE)
  list(dir = dir, xls_path = xls_path, data_path = data_path)
}

.disp_draft <- function() {
  list(rows = list(
    list(
      use = TRUE, tipo = "select_multiple", parent = "P11", parent_col = "P11",
      other_dummy_col = "P11/88", text_col = "P11_otro",
      parent_label = "Medios", list_norm = "lst_p11"
    ),
    list(
      use = TRUE, tipo = "select_one", modo_so = "padre", parent = "P26",
      parent_col = "P26", text_col = "P26_otro",
      parent_label = "Area", list_norm = "lst_p26"
    )
  ))
}

# Mismo camino que `.codif_start_apply_job`: lector de datos → normalización
# contra el XLSForm → preparación → familias → plantilla exportada.
.disp_plantilla <- function(fx) {
  inst <- leer_instrumento_xlsform(fx$xls_path)
  data_df <- suppressWarnings(.read_data_any(list(ext = "xlsx", path = fx$data_path)))
  data_df <- normalize_data_for_xlsform(data_df, inst)
  data_df <- .codif_prepare_data_for_adapt(data_df)
  fam_path <- file.path(fx$dir, "familias.xlsx")
  .familias_draft_to_xlsx(.disp_draft(), fam_path)
  split <- leer_familias_clasificar(
    path = fam_path, inst = inst, dat = list(raw = data_df), verbose = FALSE
  )
  plantilla <- construir_plantilla_desde_familias(
    inst = inst, dat = list(raw = data_df), split = split
  )
  codes_path <- file.path(fx$dir, "plantilla_codificacion.xlsx")
  exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = codes_path, inst = inst)
  list(path = codes_path, data_df = data_df, inst = inst)
}

# Columna de una hoja de la plantilla por su encabezado de la fila 1 (las
# filas 1–2 son encabezado y etiqueta; los datos empiezan en la 3).
.disp_columna_plantilla <- function(path, sheet, header) {
  raw <- openxlsx::read.xlsx(path, sheet = sheet, colNames = FALSE, skipEmptyRows = FALSE)
  headers <- as.character(unlist(raw[1, , drop = TRUE]))
  j <- match(header, headers)
  if (is.na(j)) return(NULL)
  list(
    uuid = as.character(raw[-(1:2), 1]),
    valores = raw[-(1:2), j]
  )
}

test_that("(a) .read_data_any conserva los textos «Otro» posteriores a la fila 1000", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  df <- suppressWarnings(.read_data_any(list(ext = "xlsx", path = fx$data_path)))

  expect_type(df$P11_otro, "character")
  expect_identical(.disp_n_textos(df$P11_otro), 2L)
  expect_identical(as.character(df$P11_otro[.disp_filas_otro]), .disp_textos_otro)
  # Control: un texto dentro de las primeras 1000 filas siempre sobrevivió.
  expect_identical(.disp_n_textos(df$P26_otro), 1L)
})

test_that("(f) .read_data_any conserva el 7 disperso como número, no TRUE", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  df <- suppressWarnings(.read_data_any(list(ext = "xlsx", path = fx$data_path)))

  expect_true(is.numeric(df$P30))
  expect_identical(sum(!is.na(df$P30)), 1L)
  expect_equal(as.numeric(df$P30[.disp_fila_num]), 7)
})

test_that("(b) la plantilla de codificación sin grupos trae los dos textos de P11_otro", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  pl <- .disp_plantilla(fx)
  col <- .disp_columna_plantilla(pl$path, "P11", "P11_otro")

  expect_false(is.null(col))
  expect_identical(.disp_n_textos(col$valores), 2L)
  por_uuid <- stats::setNames(as.character(col$valores), col$uuid)
  expect_identical(
    unname(por_uuid[sprintf("u-%04d", .disp_filas_otro)]),
    .disp_textos_otro
  )
})

test_that("(c) la plantilla con un grupo aplicado sigue trayendo los dos textos y codifica el suyo", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  pl <- .disp_plantilla(fx)
  grupos <- list(list(
    id = "g_3", codigo = "3", etiqueta = "Transporte", origen = "nuevo",
    respuestas = list(.disp_textos_otro[[1]])
  ))
  wb <- openxlsx::loadWorkbook(pl$path)
  expect_true(.patch_sm_sheet(
    wb = wb, sheet = "P11", parent_col = "P11", text_col = "P11_otro",
    grupos = grupos, data_df = pl$data_df, other_dummy_col = "P11/88"
  ))
  openxlsx::saveWorkbook(wb, pl$path, overwrite = TRUE)

  textos <- .disp_columna_plantilla(pl$path, "P11", "P11_otro")
  expect_identical(.disp_n_textos(textos$valores), 2L)

  nuevo <- .disp_columna_plantilla(pl$path, "P11", "P11/3_recod")
  expect_false(is.null(nuevo))
  por_uuid <- stats::setNames(suppressWarnings(as.integer(nuevo$valores)), nuevo$uuid)
  expect_identical(unname(por_uuid[sprintf("u-%04d", .disp_filas_otro[[1]])]), 1L)
})

test_that("(d) el reparador del modo padre reescribe la data sin perder textos ni el 7", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  read_bytes <- function(p) readBin(p, "raw", n = file.info(p)$size)
  xmeta <- save_upload(sid, "xlsform", "instrumento.xlsx", read_bytes(fx$xls_path))
  dmeta <- save_upload(sid, "data", "data.xlsx", read_bytes(fx$data_path))

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$base_activa <- "base_integrada"
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx"
  )
  s$codif_por_base <- list(base_integrada = list(familias_draft = .disp_draft()))
  .session_env[[sid]] <- s

  expect_true(suppressWarnings(.pulso_repair_parent_recod_columns(sid)))

  # Se lee con openxlsx (sin adivinanza por primeras filas) para ver lo que
  # el reparador dejó escrito en el archivo, no lo que otro lector adivina.
  escrito <- openxlsx::read.xlsx(dmeta$path, sheet = "data", check.names = FALSE,
                                 sep.names = " ", skipEmptyRows = FALSE)
  expect_true("P26_recod" %in% names(escrito))
  expect_identical(.disp_n_textos(escrito$P11_otro), 2L)
  por_uuid <- stats::setNames(as.character(escrito$P11_otro), escrito[["_uuid"]])
  expect_identical(
    unname(por_uuid[sprintf("u-%04d", .disp_filas_otro)]),
    .disp_textos_otro
  )
  num <- stats::setNames(as.character(escrito$P30), escrito[["_uuid"]])
  expect_identical(unname(num[sprintf("u-%04d", .disp_fila_num)]), "7")
  expect_identical(.disp_n_textos(escrito$P26_otro), 1L)
})

test_that("(e) leer_datos_generico conserva textos y el 7 de una data escrita con openxlsx", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .disp_fixture()
  on.exit(unlink(fx$dir, recursive = TRUE, force = TRUE), add = TRUE)

  df <- suppressWarnings(leer_datos_generico(fx$data_path))

  expect_type(df$P11_otro, "character")
  expect_identical(.disp_n_textos(df$P11_otro), 2L)
  expect_identical(as.character(df$P11_otro[.disp_filas_otro]), .disp_textos_otro)
  expect_true(is.numeric(df$P30))
  expect_equal(as.numeric(df$P30[.disp_fila_num]), 7)
})
