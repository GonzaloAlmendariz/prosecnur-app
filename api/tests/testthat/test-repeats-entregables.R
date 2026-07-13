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
  expect_match(nota, "3 filas")
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
  expect_match(detalle_muestra, "fila repetida")
  expect_match(detalle_muestra, "2 personas")

  # Sin grano (base normal): la ficha no menciona instancias.
  inst_normal <- .re_child_inst()
  rows_n <- .ficha_tecnica_rows(data = df, instrumento = inst_normal, reporte = "Base de datos")
  detalle_normal <- rows_n$Detalle[rows_n$Campo == "Tamano de la muestra"]
  expect_false(grepl("fila repetida", detalle_normal))
})

# --- (E) Univariados de la HIJA: sin heredadas + desglose por servicio ---------
# ADR 0030 Fase 4, PARTES A (filtro recíproco) y B (condicionamiento por servicio).

# HIJA rica: 5 instancias, 2 servicios. `srv_claridad` es universal; `srv_legal`
# sólo aplica a "Legal" (NA en Salud) y `srv_salud` sólo a "Salud" (NA en Legal).
# `sexo` es HEREDADA de la madre (repeat_inherited = TRUE) -> grano persona.
.re_child_svc_df <- function() {
  df <- data.frame(
    `_index`        = 1:5,
    `_parent_index` = c(10L, 11L, 12L, 12L, 13L),
    srv_claridad    = c("4", "5", "4", "5", "5"),
    srv_legal       = c("1", "1", NA, NA, NA),
    srv_salud       = c(NA, NA, "1", "1", "1"),
    sexo            = c("1", "2", "1", "2", "1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  attr(df$sexo, "repeat_inherited") <- TRUE
  attr(df, "instrumento_reporte") <- .re_child_svc_inst()
  attr(df, "repeat_grain") <- list(kind = "instancia", n_instancias = 5L,
                                   n_personas = 4L, repeat_group = "rep_serv",
                                   parent_base = "madre")
  df
}

.re_child_svc_inst <- function() {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_lik", "select_one lst_si", "select_one lst_si",
               "select_one lst_sexo"),
      name = c("srv_claridad", "srv_legal", "srv_salud", "sexo"),
      label = c("Claridad", "Resolvio legal", "Escucha salud", "Sexo"),
      parent_inherited = c(NA, NA, NA, TRUE),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_lik", "lst_lik", "lst_si", "lst_si", "lst_sexo", "lst_sexo"),
      name      = c("4", "5", "1", "2", "1", "2"),
      label     = c("Muy claro", "Totalmente claro", "Si", "No", "Hombre", "Mujer"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    settings = data.frame(form_title = "rep_serv", stringsAsFactors = FALSE)
  )
  attr(inst, "repeat_grain") <- list(kind = "instancia", n_instancias = 5L,
                                     n_personas = 4L, repeat_group = "rep_serv",
                                     parent_base = "madre")
  inst
}

test_that("(E) detecta base hija a grano instancia y nombra las heredadas", {
  inst <- .re_child_svc_inst()
  expect_false(is.null(.repeat_child_instancia_grain(inst)))
  # Un instrumento normal (sin grano) no dispara el desglose.
  expect_null(.repeat_child_instancia_grain(.re_madre_inst()))

  df <- .re_child_svc_df()
  inh <- .repeat_inherited_var_names(df, inst)
  expect_true("sexo" %in% inh)
  expect_false("srv_claridad" %in% inh)
})

test_that("(E/A) el univariado de la hija excluye las variables heredadas de la madre", {
  df <- .re_child_svc_df()
  inst <- .re_child_svc_inst()
  out <- .repeat_strip_inherited(df, inst)
  # PARTE A: la heredada `sexo` sale de data y de survey.
  expect_false("sexo" %in% names(out$data))
  expect_false("sexo" %in% as.character(out$inst$survey$name))
  # Las nativas se conservan.
  expect_true(all(c("srv_claridad", "srv_legal", "srv_salud") %in% names(out$data)))
  # No muta el input (la fuente compartida sigue con `sexo` para CRUCES).
  expect_true("sexo" %in% names(df))
  # Preserva atributos a nivel de data.frame (grano, instrumento).
  expect_false(is.null(attr(out$data, "repeat_grain", exact = TRUE)))
})

test_that("(E/B) las srv_* se reportan por servicio con los subconjuntos correctos", {
  df <- .re_child_svc_df()
  inst <- .re_child_svc_inst()
  svc <- c("Legal", "Legal", "Salud", "Salud", "Salud")
  native <- .repeat_native_tabulable_vars(
    .repeat_strip_inherited(df, inst)$data,
    .repeat_strip_inherited(df, inst)$inst,
    exclude = c("current_label", "current_code"))
  # `sexo` (heredada) no entra a las nativas tabulables; las srv_ sí.
  expect_setequal(native, c("srv_claridad", "srv_legal", "srv_salud"))

  plan <- .repeat_build_service_sections(
    .repeat_strip_inherited(df, inst)$data,
    .repeat_strip_inherited(df, inst)$inst,
    svc, native)

  # Sección de composición del roster + una sección por servicio.
  expect_true("Servicios evaluados" %in% names(plan$secciones))
  expect_true(all(c("Salud", "Legal") %in% names(plan$secciones)))

  # Nombres de columna sintética esperados por índice de servicio (Salud=1 por ser
  # el más frecuente; Legal=2).
  salud_i <- match("Salud", names(sort(table(svc), decreasing = TRUE)))
  legal_i <- match("Legal", names(sort(table(svc), decreasing = TRUE)))
  claridad_salud <- .repeat_service_syn_name("srv_claridad", salud_i)
  salud_salud    <- .repeat_service_syn_name("srv_salud", salud_i)
  legal_legal    <- .repeat_service_syn_name("srv_legal", legal_i)

  # Salud: claridad (universal) + salud, NO legal.
  expect_true(all(c(claridad_salud, salud_salud) %in% plan$secciones[["Salud"]]))
  expect_false(.repeat_service_syn_name("srv_legal", salud_i) %in% plan$secciones[["Salud"]])
  # Legal: claridad + legal, NO salud.
  expect_true(legal_legal %in% plan$secciones[["Legal"]])
  expect_false(.repeat_service_syn_name("srv_salud", legal_i) %in% plan$secciones[["Legal"]])

  # La columna sintética restringe a las filas del servicio (grano correcto, sin
  # doble-conteo): claridad@Salud tiene 3 respuestas (filas de Salud), NA en Legal.
  expect_equal(sum(!is.na(plan$data[[claridad_salud]])), 3L)
  expect_equal(sum(!is.na(plan$data[[legal_legal]])), 2L)
  # El total de la srv_ universal por servicio suma las filas de ese servicio.
  expect_equal(sum(!is.na(plan$data[[claridad_salud]])) +
               sum(!is.na(plan$data[[.repeat_service_syn_name("srv_claridad", legal_i)]])),
               nrow(df))
})

test_that("(E/B) el plan por servicio corre end-to-end en reporte_frecuencias", {
  skip_if_not_installed("openxlsx")
  df <- .re_child_svc_df()
  inst <- .re_child_svc_inst()
  svc <- c("Legal", "Legal", "Salud", "Salud", "Salud")
  stripped <- .repeat_strip_inherited(df, inst)
  native <- .repeat_native_tabulable_vars(stripped$data, stripped$inst,
                                          exclude = c("current_label", "current_code"))
  plan <- .repeat_build_service_sections(stripped$data, stripped$inst, svc, native)

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  expect_no_error(reporte_frecuencias(
    data = plan$data, instrumento = plan$inst, secciones = plan$secciones,
    path_xlsx = path, orden = "desc"))
  expect_true(file.exists(path))
  # La composición del roster totaliza las 5 instancias.
  fr <- openxlsx::read.xlsx(path, sheet = "Frecuencias", colNames = FALSE)
  totales <- suppressWarnings(as.numeric(fr[[2]][as.character(fr[[1]]) == "Total"]))
  totales <- totales[!is.na(totales)]
  expect_true(5 %in% totales)   # sección "Servicios evaluados" (5 filas)
  expect_true(3 %in% totales)   # algún srv_ de Salud (3 filas)
  expect_true(2 %in% totales)   # algún srv_ de Legal (2 filas)
})

test_that("(E/C) el filtro NO altera una base sin heredadas ni grano (madre)", {
  # La MADRE nunca dispara el desglose: grano NULL -> branch omitido.
  expect_null(.repeat_child_instancia_grain(.re_madre_inst()))
  # Y el strip es un no-op sobre una base sin heredadas.
  madre <- .re_madre_df()
  out <- .repeat_strip_inherited(madre, .re_madre_inst())
  expect_equal(names(out$data), names(madre))
  expect_equal(out$data, madre)
})

# --- (F) Escala completa (mostrar_todo) + default TRUE ------------------------
# El desglose por servicio (Parte B) debe listar TODAS las categorías del catálogo
# de cada `srv_*` en CADA servicio, con 0 donde nadie marcó, cuando
# `mostrar_todo = TRUE`. El default de `mostrar_todo` es TRUE (metodológico).

# HIJA con una escala de 3 niveles (3/4/5) donde un servicio ("Uno") sólo observa
# el nivel 5 -> los niveles 3 y 4 deben aparecer con 0 bajo ese servicio.
.re_scale_df <- function() {
  df <- data.frame(
    `_index`     = 1:5,
    srv_claridad = c("5", "5", "4", "5", "3"),  # svc Uno: 5,5 ; svc Dos: 4,5,3
    stringsAsFactors = FALSE, check.names = FALSE
  )
  attr(df, "instrumento_reporte") <- .re_scale_inst()
  attr(df, "repeat_grain") <- list(kind = "instancia", n_instancias = 5L,
                                   n_personas = 4L, repeat_group = "rep_serv",
                                   parent_base = "madre")
  df
}
.re_scale_inst <- function() {
  inst <- list(
    survey = data.frame(
      type = "select_one lst_lik", name = "srv_claridad", label = "Claridad",
      parent_inherited = NA, stringsAsFactors = FALSE, check.names = FALSE),
    choices = data.frame(
      list_name = c("lst_lik", "lst_lik", "lst_lik"),
      name  = c("3", "4", "5"),
      label = c("Poco claro", "Muy claro", "Totalmente claro"),
      stringsAsFactors = FALSE, check.names = FALSE),
    settings = data.frame(form_title = "rep_serv", stringsAsFactors = FALSE)
  )
  attr(inst, "repeat_grain") <- list(kind = "instancia", n_instancias = 5L,
                                     n_personas = 4L, repeat_group = "rep_serv",
                                     parent_base = "madre")
  inst
}

test_that("(F/1) el desglose por servicio 0-rellena la escala completa con mostrar_todo=TRUE", {
  skip_if_not_installed("openxlsx")
  df <- .re_scale_df(); inst <- .re_scale_inst()
  svc <- c("Uno", "Uno", "Dos", "Dos", "Dos")
  native <- .repeat_native_tabulable_vars(df, inst)
  plan <- .repeat_build_service_sections(df, inst, svc, native)

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  reporte_frecuencias(data = plan$data, instrumento = plan$inst,
                      secciones = plan$secciones, path_xlsx = path,
                      orden = "original", mostrar_todo = TRUE)
  fr <- openxlsx::read.xlsx(path, sheet = "Frecuencias", colNames = FALSE)
  lab <- as.character(fr[[1]]); n <- suppressWarnings(as.numeric(fr[[2]]))

  # Servicio "Uno" (2 filas, ambas nivel 5): la escala completa debe salir con
  # "Poco claro" = 0, "Muy claro" = 0, "Totalmente claro" = 2, Total = 2. El
  # motor MAYUSCULIZA el encabezado de sección ("UNO"); la fila del roster
  # ("Uno") es otra cosa. Acotamos al bloque de la sección hasta su "Total".
  uno_hdr <- which(lab == "UNO")
  expect_length(uno_hdr, 1L)
  fin <- uno_hdr - 1 + which(lab[uno_hdr:length(lab)] == "Total")[1]
  bloque <- lab[uno_hdr:fin]; vals <- n[uno_hdr:fin]
  # Las 3 categorías del catálogo presentes bajo "Uno".
  expect_true(all(c("Poco claro", "Muy claro", "Totalmente claro") %in% bloque))
  expect_equal(vals[match("Poco claro", bloque)], 0)
  expect_equal(vals[match("Muy claro", bloque)], 0)
  expect_equal(vals[match("Totalmente claro", bloque)], 2)
  expect_equal(vals[match("Total", bloque)], 2)
  # Orden del instrumento (Poco < Muy < Totalmente), no por frecuencia.
  idx <- match(c("Poco claro", "Muy claro", "Totalmente claro"), bloque)
  expect_false(is.unsorted(idx))
})

test_that("(F/2) el default de mostrar_todo es TRUE cuando no hay config", {
  # (i) Default config del backend.
  expect_true(isTRUE(.analitica_default_config()$frecuencias$mostrar_todo))

  # (ii) El render fn 0-rellena con cfg SIN mostrar_todo (default TRUE)...
  skip_if_not_installed("openxlsx")
  df <- data.frame(q1 = c("1", "1", "1"), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(type = "select_one lst", name = "q1", label = "Pregunta 1",
                        stringsAsFactors = FALSE, check.names = FALSE),
    choices = data.frame(list_name = c("lst", "lst"), name = c("1", "2"),
                         label = c("Opcion A", "Opcion B"),
                         stringsAsFactors = FALSE, check.names = FALSE),
    settings = data.frame(form_title = "t", stringsAsFactors = FALSE))
  run <- function(cfg) {
    p <- tempfile(fileext = ".xlsx"); on.exit(unlink(p), add = TRUE)
    .analitica_frecuencias_render_fn("sid-dummy", cfg)(df, inst, p)
    as.character(openxlsx::read.xlsx(p, sheet = "Frecuencias", colNames = FALSE)[[1]])
  }
  # Sin config -> muestra la categoría no observada (Opcion B con 0).
  expect_true(any(grepl("Opcion B", run(list()))))
  # (iii) ...pero un FALSE explícito se respeta.
  expect_false(any(grepl("Opcion B", run(list(frecuencias = list(mostrar_todo = FALSE))))))
})
