# Analítica consciente de grupos repeat (ADR 0030, Fase 3). Fixtures sintéticos
# que imitan el contrato PDM (ACNUR): una base MADRE ancha con caracterización
# (sexo/edad) + un begin_repeat rep_servicios (batería por servicio) que la Fase 1
# expande a una base HIJA long con las llaves canónicas ODK/Kobo. Se verifica:
#   (a) el filtro de variables fantasma (repeat_depth>0) en la MADRE, y su
#       ausencia de efecto en la HIJA (donde el repeat es top-level),
#   (b) el enriquecimiento hija×madre por link_key (many-to-one, sin duplicar),
#   (c) el instrumento de la hija enriquecida lista sexo/edad como seleccionables,
#   (d) el meta de grano (instancias vs personas).

# XLSForm de la MADRE: caracterización top-level + begin_repeat con su gate y sus
# calculates de identidad del roster (current_code/current_label).
.ar_madre_xlsform_model <- function() {
  survey <- data.frame(
    type = c(
      "text",
      "select_one lst_sexo",
      "integer",
      "begin_repeat",
      "calculate",
      "calculate",
      "select_one lst_claridad",
      "end_repeat"
    ),
    name = c(
      "p_nombre", "sexo", "edad", "rep_servicios",
      "current_code", "current_label", "srv_claridad", "rep_servicios"
    ),
    label = c(
      "Nombre", "Sexo", "Edad", "Servicios",
      "", "", "Claridad de ${current_label}", ""
    ),
    relevant = c("", "", "", "${p_nombre} != ''", "", "", "", ""),
    calculation = c(
      "", "", "", "",
      "jr:choice-name(${srv_claridad}, 'srv_claridad')",
      "jr:choice-name(${srv_claridad}, 'srv_claridad')", "", ""
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_sexo", "lst_sexo", "lst_claridad", "lst_claridad"),
    name = c("1", "2", "1", "2"),
    label = c("Mujer", "Hombre", "Sí", "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  settings <- data.frame(
    form_title = "PDM ACNUR", form_id = "pdm_acnur",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  list(survey = survey, choices = choices, settings = settings)
}

# Data ancha (con blob del repeat) alineada por _index para .carga_kobo_register.
# Ana (idx1): 0 instancias; Luis (idx2): 2; Rosa (idx3): 1  ->  3 instancias,
# 2 personas con al menos una instancia.
.ar_madre_wide_full <- function() {
  blob0 <- "[]"
  blob2 <- paste0(
    '[',
    '{"current_code":"salud","current_label":"Salud","srv_claridad":"2"},',
    '{"current_code":"educacion","current_label":"Educación","srv_claridad":"1"}',
    ']'
  )
  blob3 <- '[{"current_code":"legal","current_label":"Asistencia legal","srv_claridad":"1"}]'
  data.frame(
    `_id` = c(10, 20, 30),
    `_index` = c(1L, 2L, 3L),
    p_nombre = c("Ana", "Luis", "Rosa"),
    sexo = c("1", "2", "1"),
    edad = c("30", "40", "25"),
    rep_servicios = c(blob0, blob2, blob3),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# Registra madre + hija repeat en una sesión y devuelve todo lo necesario.
.ar_setup_study <- function() {
  sid <- session_create()
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  model <- .ar_madre_xlsform_model()
  xls_path <- file.path(downloads_dir, "madre_xlsform.xlsx")
  .carga_write_xlsform_model(model, xls_path)
  xls_meta <- save_upload(sid, "xlsform", "madre_xlsform.xlsx",
                          readBin(xls_path, "raw", n = file.info(xls_path)$size))
  madre_inst <- reporte_instrumento(path = xls_meta$path)

  wide_full <- .ar_madre_wide_full()
  # La base ancha registrada NO lleva el blob (se expande a la hija).
  wide_clean <- wide_full[, setdiff(names(wide_full), "rep_servicios"), drop = FALSE]
  data_path <- file.path(downloads_dir, "madre_data.xlsx")
  .carga_write_xlsx_sheet(wide_clean, data_path, "datos")
  data_meta <- save_upload(sid, "data", "madre_data.xlsx",
                           readBin(data_path, "raw", n = file.info(data_path)$size))

  estudio_add_base(
    sid, nombre = "madre",
    xlsform_file_id = xls_meta$file_id, data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(wide_clean, instrumento = madre_inst),
    rp_inst = madre_inst, n_filas = nrow(wide_clean), n_columnas = ncol(wide_clean),
    extra_meta = list(source_kind = "kobo_api")
  )

  created <- .carga_kobo_register_repeat_bases(
    sid, data_df = wide_full, rp_inst = madre_inst,
    parent_base_name = "madre", title = "PDM ACNUR", downloads_dir = downloads_dir
  )

  list(sid = sid, madre_inst = madre_inst, created = created)
}

test_that("(a) el filtro de fantasmas excluye repeat en la MADRE pero no en la HIJA", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  madre_inst <- st$madre_inst

  # Variables de la MADRE: sexo/edad sí, srv_claridad (repeat_depth>0) NO.
  vars_madre <- .variables_desde_instrumento(madre_inst)
  names_madre <- vapply(vars_madre, function(v) as.character(v$name %||% ""), character(1))
  expect_true(all(c("sexo", "edad", "p_nombre") %in% names_madre))
  expect_false("srv_claridad" %in% names_madre)
  expect_false(any(c("current_code", "current_label") %in% names_madre))

  # Secciones de la MADRE: ninguna sección incluye la pregunta fantasma.
  secs_madre <- .detect_secciones_analitica(madre_inst)
  all_vars_secs <- unlist(lapply(secs_madre, function(s) as.character(s$variables)), use.names = FALSE)
  expect_false("srv_claridad" %in% all_vars_secs)
  expect_true("sexo" %in% all_vars_secs)

  # Instrumento de la HIJA: srv_claridad ES top-level (bajo begin_group) -> sí.
  child_name <- st$created[[1]]$base
  child_inst <- session_get(st$sid)$rp_inst_sources[[child_name]]
  vars_hija <- .variables_desde_instrumento(child_inst)
  names_hija <- vapply(vars_hija, function(v) as.character(v$name %||% ""), character(1))
  expect_true("srv_claridad" %in% names_hija)
})

test_that("(b) el enriquecimiento trae sexo/edad a la hija por link_key sin duplicar filas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base
  child_data <- s$rp_data_sources[[child_name]]
  child_inst <- s$rp_inst_sources[[child_name]]

  # La hija trae la llave de enlace y las 3 instancias esperadas.
  expect_true("_parent_index" %in% names(child_data))
  expect_equal(nrow(child_data), 3L)
  expect_equal(as.integer(child_data[["_parent_index"]]), c(2L, 2L, 3L))

  res <- .analitica_enrich_child_pair(st$sid, child_name, child_data, child_inst)
  expect_true(isTRUE(res$enriched))
  # No se duplican filas de la hija (many-to-one).
  expect_equal(nrow(res$data), nrow(child_data))
  # Caracterización de la madre presente en la hija.
  expect_true(all(c("sexo", "edad") %in% names(res$data)))
  # Los valores casan por _parent_index -> _index de la madre (sexo: idx2=2, idx3=1).
  expect_equal(as.character(res$data$sexo), c("2", "2", "1"))
  expect_equal(as.character(res$data$edad), c("40", "40", "25"))
  # Marcadas como heredadas del padre.
  expect_true(isTRUE(attr(res$data$sexo, "repeat_inherited")))
  expect_equal(attr(res$data$sexo, "repeat_parent_base"), "madre")

  # Un cruce srv_claridad × sexo es posible sobre la hija enriquecida.
  tab <- table(as.character(res$data$srv_claridad), as.character(res$data$sexo))
  expect_true(sum(tab) == 3L)
})

test_that("(c) el instrumento de la hija enriquecida lista sexo/edad como seleccionables", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base

  res <- .analitica_enrich_child_pair(
    st$sid, child_name, s$rp_data_sources[[child_name]], s$rp_inst_sources[[child_name]])
  vars <- .variables_desde_instrumento(res$inst)
  names_vars <- vapply(vars, function(v) as.character(v$name %||% ""), character(1))
  # Propias de la hija + heredadas de la madre.
  expect_true("srv_claridad" %in% names_vars)
  expect_true(all(c("sexo", "edad") %in% names_vars))
  # sexo conserva su list_name (para etiquetar el cruce).
  sexo_entry <- vars[[which(names_vars == "sexo")[1]]]
  expect_equal(sexo_entry$list_name, "lst_sexo")
  expect_true(isTRUE(sexo_entry$categorica))
})

test_that("(d) el meta de grano reporta instancias vs personas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  child_name <- st$created[[1]]$base

  res <- .analitica_enrich_child_pair(
    st$sid, child_name, s$rp_data_sources[[child_name]], s$rp_inst_sources[[child_name]])
  grain <- res$grain
  expect_false(is.null(grain))
  expect_equal(grain$kind, "instancia")
  expect_equal(grain$n_instancias, 3L)   # 0 + 2 + 1 instancias
  expect_equal(grain$n_personas, 2L)     # solo Luis y Rosa tienen instancias
  expect_equal(grain$repeat_group, "rep_servicios")
  expect_equal(grain$parent_base, "madre")
  expect_true(nzchar(grain$nota))
})

test_that("el caso normal (base sin repeat) no se enriquece ni reporta grano", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  st <- .ar_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)
  s <- session_get(st$sid)
  madre_data <- s$rp_data_sources[["madre"]]

  res <- .analitica_enrich_child_pair(
    st$sid, "madre", madre_data, s$rp_inst_sources[["madre"]])
  expect_false(isTRUE(res$enriched))
  expect_null(res$grain)
  expect_equal(names(res$data), names(madre_data))
})

test_that(".dn_repeat_parent_row_positions enlaza many-to-one con fallback", {
  parent <- data.frame(
    `_index` = c(1L, 2L, 3L), `_id` = c("A", "B", "C"),
    sexo = c("F", "M", "F"), stringsAsFactors = FALSE, check.names = FALSE
  )
  child <- data.frame(
    `_parent_index` = c(3L, 3L, NA, 2L),
    `_submission__id` = c("C", "C", "A", "B"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  pos <- .dn_repeat_parent_row_positions(
    child, parent,
    link_key = "_parent_index", parent_index_key = "_index",
    fallback_child_key = "_submission__id", fallback_parent_key = "_id")
  # Primario resuelve filas 1,2,4; la fila 3 (NA en primario) cae al fallback (A -> 1).
  expect_equal(pos, c(3L, 3L, 1L, 2L))
  # Many-to-one: no crece el número de filas del hijo.
  expect_equal(length(pos), nrow(child))
})
