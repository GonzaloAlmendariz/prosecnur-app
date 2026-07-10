# Entregables / Dashboard / PDF conscientes de grupos repeat (ADR 0030, Fase 4).
# Verifica:
#   (a) el export/preview de una base HIJA no fuga las llaves técnicas de repeat
#       (`_index`/`_parent_index`/`_parent_table_name`/`_submission__id`) pero SÍ
#       conserva las columnas heredadas de la madre (attr repeat_inherited),
#   (b) las secciones del dashboard sobre la MADRE excluyen las preguntas del
#       repeat (fantasmas) y una base HIJA no rompe el dashboard,
#   (c) el PDF de formulario marca la sección `begin_repeat` como repetible,
#   (d) la ficha técnica refleja el grano de instancia (N=instancias) de la hija.

source("setup-load-all.R")

# --- Fixtures ---------------------------------------------------------------

# Base HIJA long tal como la deja la Fase 1 + el enriquecimiento de la Fase 3:
# llaves técnicas de enlace + una pregunta propia del roster (srv_claridad) + una
# columna heredada de la madre (sexo, attr repeat_inherited = TRUE).
.re_child_df <- function() {
  df <- data.frame(
    `_index`             = c(1L, 2L, 3L),
    `_parent_index`      = c(2L, 2L, 3L),
    `_parent_table_name` = c("madre", "madre", "madre"),
    `_submission__id`    = c("20", "20", "30"),
    srv_claridad         = c("2", "1", "1"),
    sexo                 = c("2", "2", "1"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(df$sexo, "label") <- "Sexo"
  attr(df$sexo, "repeat_inherited") <- TRUE
  attr(df$sexo, "repeat_parent_base") <- "madre"
  attr(df$srv_claridad, "label") <- "Claridad del servicio"
  df
}

.re_child_inst <- function() {
  list(
    survey = data.frame(
      type = c("text", "text"),
      name = c("srv_claridad", "sexo"),
      label = c("Claridad del servicio", "Sexo"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = character(0), name = character(0), label = character(0),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    settings = data.frame(form_title = "rep_servicios", stringsAsFactors = FALSE)
  )
}

# --- (a) Export/preview de la hija: sin llaves técnicas, con heredadas --------

test_that("(a) el drop de llaves técnicas conserva heredadas y de análisis", {
  df <- .re_child_df()
  out <- .repeat_drop_technical_cols(df)
  tecnicas <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")
  expect_false(any(tecnicas %in% names(out)))
  expect_true(all(c("srv_claridad", "sexo") %in% names(out)))
  # La columna heredada preserva su marca de linaje (sigue siendo analizable).
  expect_true(isTRUE(attr(out$sexo, "repeat_inherited")))
  expect_equal(attr(out$sexo, "repeat_parent_base"), "madre")
  # Idempotente y benigno sobre una base sin llaves técnicas.
  again <- .repeat_drop_technical_cols(out)
  expect_equal(names(again), names(out))
})

test_that("(a) el preview de metadata Bases no lista las llaves técnicas", {
  df <- .re_child_df()
  prev <- .bases_metadata_preview(df, .re_child_inst())
  nms <- vapply(prev, function(x) as.character(x$name), character(1))
  tecnicas <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")
  expect_false(any(tecnicas %in% nms))
  expect_true(all(c("srv_claridad", "sexo") %in% nms))
})

test_that("(a) el export CSV de la hija no fuga llaves técnicas pero sí las heredadas", {
  df <- .re_child_df()
  path <- tempfile(fileext = ".csv")
  on.exit(unlink(path), add = TRUE)
  .bases_write_csv(df, path)
  header <- readLines(path, n = 1L, encoding = "UTF-8")
  header <- sub("^﻿", "", header)
  cols <- gsub("\"", "", strsplit(header, ",", fixed = TRUE)[[1]])
  tecnicas <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")
  expect_false(any(tecnicas %in% cols))
  expect_true(all(c("srv_claridad", "sexo") %in% cols))
})

test_that("(a) el export XLSX de la hija no fuga llaves técnicas pero sí las heredadas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  df <- .re_child_df()
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .bases_write_xlsx(df, df, path, valores = "codigos", ficha_tecnica = FALSE)
  header <- as.character(unlist(
    readxl::read_excel(path, sheet = "datos", col_names = FALSE, n_max = 1L),
    use.names = FALSE
  ))
  tecnicas <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")
  expect_false(any(tecnicas %in% header))
  expect_true(all(c("srv_claridad", "sexo") %in% header))
})

test_that("(a) el export SAV de la hija no fuga llaves técnicas pero sí las heredadas", {
  skip_if_not_installed("haven")
  old_writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = NA)
  Sys.setenv(PROSECNUR_SAV_WRITER = "haven")  # forzar writer determinista
  on.exit({
    if (is.na(old_writer)) Sys.unsetenv("PROSECNUR_SAV_WRITER")
    else Sys.setenv(PROSECNUR_SAV_WRITER = old_writer)
  }, add = TRUE)

  df <- .re_child_df()
  path <- tempfile(fileext = ".sav")
  on.exit(unlink(path), add = TRUE)
  res <- .bases_export_sav(df, .re_child_inst(), path)
  tecnicas <- c("_index", "_parent_index", "_parent_table_name", "_submission__id")
  # Ni las llaves técnicas crudas ni su versión renombrada (sin "_") deben fugar.
  renombradas <- sub("^_", "", tecnicas)
  expect_false(any(tecnicas %in% names(res)))
  expect_false(any(renombradas %in% names(res)))
  expect_true("sexo" %in% names(res))
  sav <- haven::read_sav(path)
  expect_false(any(c(tecnicas, renombradas) %in% names(sav)))
  expect_true("sexo" %in% names(sav))
})

# --- (b) Dashboard: fantasmas fuera de la madre, hija no rompe ----------------

# MADRE: caracterización top-level + begin_repeat con la pregunta del roster.
.re_madre_inst <- function() {
  list(survey = data.frame(
    type = c("select_one lst_sexo", "integer",
             "begin_repeat", "text", "end_repeat"),
    name = c("sexo", "edad", "rep_servicios", "srv_claridad", "rep_servicios"),
    label = c("Sexo", "Edad", "Servicios", "Claridad del servicio", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
}

# Data ANCHA de la madre: NO trae srv_claridad (vive en la base hija).
.re_madre_df <- function() {
  data.frame(sexo = c("1", "2", "1"), edad = c("30", "40", "25"),
             stringsAsFactors = FALSE, check.names = FALSE)
}

test_that("(b) las secciones del dashboard de la MADRE excluyen la pregunta del repeat", {
  secs <- .dashboard_build_secciones(.re_madre_inst(), .re_madre_df())
  all_vars <- unlist(secs, use.names = FALSE)
  expect_false("srv_claridad" %in% all_vars)  # fantasma: no debe aparecer
  expect_true("sexo" %in% all_vars)
  expect_true("edad" %in% all_vars)
})

test_that("(b) una base HIJA repeat no rompe el dashboard y lista sus preguntas top-level", {
  # El instrumento hijo envuelve las preguntas en begin_group (no begin_repeat):
  # repeat_depth = 0, así que NO son fantasmas y sí deben listarse.
  child_inst <- list(survey = data.frame(
    type = c("begin_group", "text", "text", "end_group"),
    name = c("rep_servicios", "srv_claridad", "sexo", "rep_servicios"),
    label = c("Servicios", "Claridad del servicio", "Sexo", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  child_df <- .re_child_df()
  # No debe romper sobre una base hija (degradación con gracia).
  secs <- .dashboard_build_secciones(child_inst, child_df)
  all_vars <- unlist(secs, use.names = FALSE)
  expect_true("srv_claridad" %in% all_vars)
  expect_true("sexo" %in% all_vars)
  # Las llaves técnicas nunca entran a las secciones (no son preguntas).
  expect_false(any(c("_index", "_parent_index") %in% all_vars))
})

# --- (c) PDF de formulario: sección repeat marcada como repetible -------------

test_that("(c) formulario_pdf_build_model distingue begin_repeat y anota cardinalidad", {
  survey <- data.frame(
    type = c("begin_group", "text", "end_group",
             "begin_repeat", "text", "end_repeat"),
    name = c("grp_perfil", "p_nombre", "grp_perfil",
             "rep_serv", "srv_claridad", "rep_serv"),
    label = c("Perfil", "Nombre", "",
              "Servicios recibidos", "Claridad del servicio", ""),
    repeat_count = c("", "", "", "5", "", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(list_name = character(0), name = character(0),
                        label = character(0), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "Test repeat"))

  sec_repeat <- Filter(function(b) identical(b$kind, "section") && identical(b$name, "rep_serv"),
                       model$blocks)[[1]]
  sec_group <- Filter(function(b) identical(b$kind, "section") && identical(b$name, "grp_perfil"),
                      model$blocks)[[1]]
  expect_true(isTRUE(sec_repeat$repeatable))
  expect_equal(sec_repeat$repeat_count, "5")
  expect_false(isTRUE(sec_group$repeatable))
})

test_that("(c) el sufijo textual de sección repetible es correcto", {
  expect_equal(.repeat_pdf_section_suffix(TRUE, "5"), " (repetible, hasta 5)")
  expect_equal(.repeat_pdf_section_suffix(TRUE, ""), " (repetible)")
  expect_equal(.repeat_pdf_section_suffix(TRUE, "${n_hijos}"), " (repetible)")
  expect_equal(.repeat_pdf_section_suffix(FALSE, "5"), "")
})

test_that("(c) el PDF de formulario con repeat renderiza sin romper", {
  skip_if_not_installed("qpdf")
  survey <- data.frame(
    type = c("begin_repeat", "text", "end_repeat"),
    name = c("rep_serv", "srv_claridad", "rep_serv"),
    label = c("Servicios recibidos", "Claridad del servicio", ""),
    repeat_count = c("3", "", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(list_name = character(0), name = character(0),
                        label = character(0), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  on.exit(unlink(tmp), add = TRUE)
  suppressWarnings(reporte_formulario_pdf(
    survey, choices, settings = data.frame(form_title = "Repeat PDF"), output_file = tmp))
  expect_true(file.exists(tmp))
  expect_gt(file.info(tmp)$size, 1000)

  pdftotext <- Sys.which("pdftotext")
  if (nzchar(pdftotext)) {
    txt <- system2(pdftotext, c(tmp, "-"), stdout = TRUE)
    expect_true(any(grepl("repetible", txt, ignore.case = TRUE)))
  }
})

# --- (d) Ficha técnica: grano de instancia -----------------------------------

test_that("(d) la nota de grano formatea instancias vs personas y es vacía sin repeat", {
  grain <- list(kind = "instancia", n_instancias = 3L, n_personas = 2L,
                repeat_group = "rep_servicios", parent_base = "madre")
  nota <- .repeat_grain_ficha_nota(grain)
  expect_match(nota, "N=3 instancias")
  expect_match(nota, "rep_servicios")
  expect_match(nota, "2 personas")
  # Bases normales: sin nota.
  expect_equal(.repeat_grain_ficha_nota(NULL), "")
  expect_equal(.repeat_grain_ficha_nota(list(kind = "persona")), "")
})

test_that("(d) la ficha técnica de una base hija refleja el grano de instancia", {
  df <- .re_child_df()
  inst <- .re_child_inst()
  attr(inst, "repeat_grain") <- list(
    kind = "instancia", n_instancias = 3L, n_personas = 2L,
    repeat_group = "rep_servicios", parent_base = "madre")
  rows <- .ficha_tecnica_rows(data = df, instrumento = inst, reporte = "Base de datos")
  detalle_muestra <- rows$Detalle[rows$Campo == "Tamano de la muestra"]
  expect_length(detalle_muestra, 1L)
  expect_match(detalle_muestra, "instancias")
  expect_match(detalle_muestra, "2 personas")

  # Sin grano (base normal): la ficha no menciona instancias.
  inst_normal <- .re_child_inst()
  rows_n <- .ficha_tecnica_rows(data = df, instrumento = inst_normal, reporte = "Base de datos")
  detalle_normal <- rows_n$Detalle[rows_n$Campo == "Tamano de la muestra"]
  expect_false(grepl("instancias", detalle_normal))
})
