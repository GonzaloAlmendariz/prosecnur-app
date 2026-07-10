# Repeat groups de KoboToolbox: exclusión de la base ancha + expansión a base
# hija vinculada con las llaves canónicas ODK/Kobo (ADR 0030 Fase 1). Reproduce
# el contrato real del asset PDM (ACNUR) con fixtures sintéticos: un
# begin_repeat/end_repeat (rep_servicios) con su gate `relevant`, calculates de
# identidad del roster (current_code/current_label con jr:choice-name), y un grupo
# field-list con header appearance="label" (SPACE_nolabel).

# Instrumento sintético que imita la salida de reporte_instrumento():
#   `type` ya viene sin la list (separada a `list_name`), `appearance` presente,
#   con columnas `relevant`/`calculation` como en un XLSForm Kobo real.
.kobo_repeat_test_inst <- function() {
  survey <- data.frame(
    type = c(
      "text",          # p_nombre           top-level, esperado
      "begin_repeat",  # rep_servicios      (con gate relevant)
      "calculate",     # current_code       identidad del roster (jr:choice-name)
      "calculate",     # current_label      identidad del roster (jr:choice-name)
      "select_one",    # srv_claridad       dentro repeat -> base hija
      "text",          # srv_seguridad_why  dentro repeat -> base hija
      "end_repeat",    # cierre del repeat
      "begin_group",   # Spaces (field-list)
      "select_one",    # SPACE_nolabel      header de matriz (appearance=label)
      "select_one",    # SPACE_a            fila de dato (list-nolabel), esperado
      "end_group",
      "integer"        # p_edad             top-level, esperado (sin respuestas)
    ),
    name = c(
      "p_nombre", "rep_servicios", "current_code", "current_label",
      "srv_claridad", "srv_seguridad_why", "rep_servicios",
      "Spaces", "SPACE_nolabel", "SPACE_a", "Spaces", "p_edad"
    ),
    list_name = c(
      NA, NA, NA, NA, "lst_claridad", NA, NA, NA, "lst_space", "lst_space", NA, NA
    ),
    appearance = c(
      "", "", "", "", "", "", "", "field-list", "label", "list-nolabel", "", ""
    ),
    label = c(
      "Nombre", "Servicios", "", "", "Claridad de ${current_label}", "Por qué",
      "", "Espacios", "Encabezado", "Espacio A", "", "Edad"
    ),
    relevant = c(
      "", "${p_nombre} != ''", "", "", "", "", "", "", "", "", "", ""
    ),
    calculation = c(
      "", "", "jr:choice-name(${srv_claridad}, 'srv_claridad')",
      "jr:choice-name(${srv_claridad}, 'srv_claridad')", "", "", "", "", "", "", "", ""
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_claridad", "lst_claridad", "lst_space", "lst_space"),
    name = c("1", "2", "1", "2"),
    label = c("Sí", "No", "Bajo", "Alto"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(survey = survey, choices = choices)
}

.kobo_repeat_test_data <- function() {
  blob0 <- "[]"
  blob1 <- paste0(
    '[{"Assistance/rep_servicios/current_code":"legal",',
    '"Assistance/rep_servicios/current_label":"Asistencia legal",',
    '"Assistance/rep_servicios/srv_claridad":"1"}]'
  )
  blob2 <- paste0(
    '[',
    '{"Assistance/rep_servicios/current_code":"salud",',
    '"Assistance/rep_servicios/current_label":"Salud",',
    '"Assistance/rep_servicios/srv_claridad":"2",',
    '"Assistance/rep_servicios/srv_seguridad_why":"texto libre"},',
    '{"Assistance/rep_servicios/current_code":"educacion",',
    '"Assistance/rep_servicios/current_label":"Educación",',
    '"Assistance/rep_servicios/srv_claridad":"1"}',
    ']'
  )
  data.frame(
    `_id` = c(10, 20, 30),
    p_nombre = c("Ana", "Luis", "Rosa"),
    SPACE_a = c("1", "2", "1"),
    `Assistance/rep_servicios` = c(blob0, blob1, blob2),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

test_that(".dn_expected_data_names excluye preguntas del repeat, calculates y el header de matriz", {
  inst <- .kobo_repeat_test_inst()
  expected <- .dn_expected_data_names(inst)

  # Top-level y filas de dato de la matriz sí se esperan.
  expect_true(all(c("p_nombre", "SPACE_a", "p_edad") %in% expected))
  # Preguntas anidadas en el repeat, los calculates del roster, el marcador del
  # repeat, el grupo y el header de matriz NO se esperan en la base ancha.
  expect_false(any(c(
    "srv_claridad", "srv_seguridad_why", "current_code", "current_label",
    "rep_servicios", "Spaces", "SPACE_nolabel"
  ) %in% expected))
})

test_that("la base ancha valida contra el XLSForm tras excluir repeat y header", {
  inst <- .kobo_repeat_test_inst()
  wide <- data.frame(
    p_nombre = c("Ana", "Luis"),
    SPACE_a = c("1", "2"),
    # p_edad ausente a propósito (pregunta sin respuestas en el asset).
    `Assistance/rep_servicios` = c('[{"x":"1"}]', "[]"),
    `_id` = c(1, 2),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # Sin backfill, p_edad falta -> incompatible.
  raw <- validate_data_xlsform_compatibility(wide, inst)
  expect_false(raw$ok)
  expect_true("p_edad" %in% raw$missing_columns)

  # Con backfill benigno, p_edad se agrega como NA -> compatible.
  filled <- .carga_backfill_missing_expected(wide, inst)
  ok <- validate_data_xlsform_compatibility(filled, inst)
  expect_true(ok$ok)
  # El blob y _id se toleran como columnas extra.
  expect_true("Assistance/rep_servicios" %in% ok$extra_columns)
  expect_true("_id" %in% ok$extra_columns)
})

test_that(".dn_backfill_missing_columns es el helper compartido de backfill", {
  df <- data.frame(a = 1:2, b = c("x", "y"), stringsAsFactors = FALSE, check.names = FALSE)
  out <- .dn_backfill_missing_columns(df, c("a", "b", "c", "d"))
  expect_true(all(c("a", "b", "c", "d") %in% names(out)))
  expect_true(all(is.na(out$c)) && all(is.na(out$d)))
  expect_type(out$c, "character")
  # NULL -> data.frame vacío con las columnas esperadas.
  empty <- .dn_backfill_missing_columns(NULL, c("x"))
  expect_true("x" %in% names(empty))
  expect_equal(nrow(empty), 0L)
})

test_that(".kobo_repeat_specs incluye los calculates del roster y el gate del grupo", {
  inst <- .kobo_repeat_test_inst()
  specs <- .kobo_repeat_specs(inst)
  expect_length(specs, 1L)
  spec <- specs[[1]]
  expect_equal(spec$name, "rep_servicios")
  # calculate ya NO se salta: current_code/current_label son la identidad del roster.
  expect_setequal(
    spec$leaf_vars,
    c("current_code", "current_label", "srv_claridad", "srv_seguridad_why")
  )
  expect_true("lst_claridad" %in% spec$list_names)
  # El `relevant` del begin_repeat se conserva como gate del grupo.
  expect_equal(spec$group_relevant, "${p_nombre} != ''")
})

test_that(".kobo_expand_repeat emite las llaves canónicas ODK/Kobo y el roster", {
  inst <- .kobo_repeat_test_inst()
  spec <- .kobo_repeat_specs(inst)[[1]]
  data_df <- .kobo_repeat_test_data()

  blob_col <- .kobo_repeat_blob_column(data_df, "rep_servicios")
  expect_equal(blob_col, "Assistance/rep_servicios")

  pid <- .kobo_parent_ids(data_df)
  expect_equal(pid, c("10", "20", "30"))

  long <- .kobo_expand_repeat(
    data_df, spec, blob_col,
    parent_index = seq_len(nrow(data_df)),
    parent_ids = pid,
    parent_table_name = "PDM ACNUR"
  )

  # Instancias totales: 0 + 1 + 2 = 3 filas.
  expect_equal(nrow(long), 3L)
  # Llaves canónicas nuevas presentes; las interinas ya NO.
  expect_true(all(c("_index", "_parent_index", "_parent_table_name", "_submission__id") %in% names(long)))
  expect_false(any(c("_parent_id", "_repeat_index") %in% names(long)))
  # Índice global 1..N y enlace al padre (posición de fila madre).
  expect_equal(long$`_index`, c(1L, 2L, 3L))
  expect_equal(long$`_parent_index`, c(2L, 3L, 3L))
  expect_equal(long$`_submission__id`, c("20", "30", "30"))
  expect_equal(unique(long$`_parent_table_name`), "PDM ACNUR")
  # Identidad del roster preservada (current_code/current_label del blob).
  expect_true(all(c("current_code", "current_label") %in% names(long)))
  expect_equal(long$current_code, c("legal", "salud", "educacion"))
  expect_equal(long$current_label, c("Asistencia legal", "Salud", "Educación"))
  # Dato de las preguntas del repeat.
  expect_equal(long$srv_claridad, c("1", "2", "1"))
  expect_equal(long$srv_seguridad_why, c(NA_character_, "texto libre", NA_character_))
})

test_that(".kobo_expand_repeat captura keys del blob no descritas por el survey (unión)", {
  inst <- .kobo_repeat_test_inst()
  spec <- .kobo_repeat_specs(inst)[[1]]
  data_df <- data.frame(
    `_id` = c(1),
    `Assistance/rep_servicios` = paste0(
      '[{"Assistance/rep_servicios/srv_claridad":"1",',
      '"Assistance/rep_servicios/srv_extra_libre":"valor inesperado"}]'
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  long <- .kobo_expand_repeat(
    data_df, spec, .kobo_repeat_blob_column(data_df, "rep_servicios"),
    parent_index = 1L, parent_ids = "1", parent_table_name = "default"
  )
  expect_equal(nrow(long), 1L)
  # La key inesperada del blob entra igual como columna de dato.
  expect_true("srv_extra_libre" %in% names(long))
  expect_equal(long$srv_extra_libre, "valor inesperado")
  expect_true("srv_extra_libre" %in% attr(long, "data_cols"))
})

test_that(".kobo_expand_repeat es robusto ante celdas vacías/NA/malformadas", {
  inst <- .kobo_repeat_test_inst()
  spec <- .kobo_repeat_specs(inst)[[1]]
  data_df <- data.frame(
    `_id` = c(1, 2, 3, 4),
    `Assistance/rep_servicios` = c(
      NA_character_,          # NA -> sin instancias
      "",                     # vacío -> sin instancias
      "{no json",             # malformado -> sin instancias (no aborta)
      '[{"Assistance/rep_servicios/srv_claridad":"2"}]'
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  pid <- .kobo_parent_ids(data_df)
  long <- .kobo_expand_repeat(
    data_df, spec, .kobo_repeat_blob_column(data_df, "rep_servicios"),
    parent_index = seq_len(nrow(data_df)), parent_ids = pid, parent_table_name = "default"
  )
  expect_equal(nrow(long), 1L)
  expect_equal(long$`_index`, 1L)
  expect_equal(long$`_parent_index`, 4L)
  expect_equal(long$`_submission__id`, "4")
  expect_equal(long$srv_claridad, "2")
})

test_that(".kobo_ensure_wide_index agrega _index = 1..N si falta y respeta el existente", {
  df <- data.frame(a = c("x", "y", "z"), stringsAsFactors = FALSE, check.names = FALSE)
  out <- .kobo_ensure_wide_index(df)
  expect_equal(out$`_index`, 1:3)
  # No sobreescribe un _index existente.
  df2 <- data.frame(`_index` = c(10L, 20L), a = c("x", "y"),
                    stringsAsFactors = FALSE, check.names = FALSE)
  out2 <- .kobo_ensure_wide_index(df2)
  expect_equal(out2$`_index`, c(10L, 20L))
})

test_that(".kobo_build_repeat_instrument preserva el gate begin_group y los calculates", {
  inst <- .kobo_repeat_test_inst()
  spec <- .kobo_repeat_specs(inst)[[1]]
  child <- .kobo_build_repeat_instrument(inst, spec, extra_cols = spec$leaf_vars)
  survey <- child$survey

  # El instrumento hijo envuelve las preguntas en un begin_group que conserva el
  # `relevant` del begin_repeat original (gate del grupo).
  bg <- survey[survey$type == "begin_group", , drop = FALSE]
  expect_equal(nrow(bg), 1L)
  expect_equal(bg$name, "rep_servicios")
  expect_equal(bg$relevant, "${p_nombre} != ''")
  expect_true(any(survey$type == "end_group"))

  # Los calculates del roster se conservan con su `calculation` (jr:choice-name).
  cc <- survey[survey$name == "current_code", , drop = FALSE]
  expect_equal(nrow(cc), 1L)
  expect_equal(cc$type, "calculate")
  expect_true(grepl("jr:choice-name", cc$calculation, fixed = TRUE))

  # El piping ${current_label} en el label de una pregunta se copia verbatim.
  claridad <- survey[survey$name == "srv_claridad", , drop = FALSE]
  expect_true(grepl("${current_label}", claridad$label, fixed = TRUE))
  # La select recompone su tipo canónico con la list para resolver opciones.
  expect_equal(claridad$type, "select_one lst_claridad")
})

test_that(".carga_kobo_register_repeat_bases registra la hija con llaves canónicas y roster", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  inst <- .kobo_repeat_test_inst()
  data_df <- .kobo_ensure_wide_index(.kobo_repeat_test_data())

  created <- .carga_kobo_register_repeat_bases(
    sid,
    data_df = data_df,
    rp_inst = inst,
    parent_base_name = "default",
    title = "PDM ACNUR",
    downloads_dir = downloads_dir
  )

  expect_length(created, 1L)
  expect_equal(created[[1]]$base, "rep_servicios")
  expect_equal(created[[1]]$repeat_group, "rep_servicios")
  expect_equal(created[[1]]$n_filas, 3L)
  expect_equal(created[[1]]$link_key, "_parent_index")

  bases <- estudio_list_bases(sid)
  expect_true("rep_servicios" %in% names(bases))
  meta <- bases[["rep_servicios"]]
  expect_equal(meta$source_kind, "kobo_repeat")
  expect_equal(meta$parent_base, "default")
  expect_equal(meta$repeat_group, "rep_servicios")
  expect_equal(meta$link_key, "_parent_index")
  expect_equal(meta$link_key_fallback, "_submission__id")
  expect_true(nzchar(meta$imported_at))
  # La convención interina ya NO se persiste.
  expect_false(identical(meta$link_key, "_parent_id"))

  # La data hija persistida conserva las llaves canónicas y el roster.
  child_data <- suppressWarnings(readxl::read_excel(
    (session_get(sid)$files %||% list())[[meta$data_file_id]]$path
  ))
  child_names <- names(child_data)
  expect_true(all(c("_index", "_parent_index", "_parent_table_name", "_submission__id") %in% child_names))
  expect_false(any(c("_parent_id", "_repeat_index") %in% child_names))
  expect_true(all(c("current_code", "current_label", "srv_claridad") %in% child_names))
  expect_setequal(as.character(child_data$current_label), c("Asistencia legal", "Salud", "Educación"))
  expect_setequal(as.character(child_data$`_parent_table_name`), "default")
})

test_that(".carga_kobo_register_repeat_bases enlaza la hija a una hermana independiente", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  # Simula una hermana independiente ya registrada (base ancha) previa.
  sibling_inst <- .kobo_repeat_test_inst()
  sib_path <- file.path(downloads_dir, "sibling_xlsform.xlsx")
  .carga_write_xlsform_model(
    list(survey = sibling_inst$survey, choices = sibling_inst$choices,
         settings = data.frame(form_title = "Hermana A", form_id = "hermana_a",
                               stringsAsFactors = FALSE, check.names = FALSE)),
    sib_path
  )
  sib_inst_meta <- save_upload(sid, "xlsform", "sibling_xlsform.xlsx",
                               readBin(sib_path, "raw", n = file.info(sib_path)$size))
  sib_rp_inst <- reporte_instrumento(path = sib_inst_meta$path)
  sib_wide <- .kobo_ensure_wide_index(data.frame(
    p_nombre = c("Ana"), SPACE_a = c("1"), p_edad = c("30"),
    `_id` = c(500), stringsAsFactors = FALSE, check.names = FALSE
  ))
  sib_data_path <- file.path(downloads_dir, "sibling_data.xlsx")
  .carga_write_xlsx_sheet(sib_wide, sib_data_path, "datos")
  sib_data_meta <- save_upload(sid, "data", "sibling_data.xlsx",
                               readBin(sib_data_path, "raw", n = file.info(sib_data_path)$size))
  estudio_add_base(
    sid, nombre = "kobo_hermana_a",
    xlsform_file_id = sib_inst_meta$file_id, data_file_id = sib_data_meta$file_id,
    data_ext = "xlsx", rp_data = reporte_data(sib_wide, instrumento = sib_rp_inst),
    rp_inst = sib_rp_inst, n_filas = 1L, n_columnas = ncol(sib_wide),
    extra_meta = list(source_kind = "kobo_api")
  )

  # La hermana trae su propio repeat: expandimos y vinculamos a ELLA.
  data_df <- .kobo_ensure_wide_index(.kobo_repeat_test_data())
  created <- .carga_kobo_register_repeat_bases(
    sid, data_df = data_df, rp_inst = .kobo_repeat_test_inst(),
    parent_base_name = "kobo_hermana_a", title = "Hermana A", downloads_dir = downloads_dir
  )
  expect_length(created, 1L)
  expect_equal(created[[1]]$parent_base, "kobo_hermana_a")

  bases <- estudio_list_bases(sid)
  # La hermana original queda intacta y la hija apunta a ella.
  expect_true("kobo_hermana_a" %in% names(bases))
  expect_equal(bases[["kobo_hermana_a"]]$source_kind, "kobo_api")
  child_name <- created[[1]]$base
  expect_equal(bases[[child_name]]$parent_base, "kobo_hermana_a")
})
