# =============================================================================
# Tests para el formato .pulso (build_pulso / load_pulso / project_status)
# =============================================================================
# Cubre: round-trip de estado (mantiene tibbles, listas y nested), copia
# de files físicos al zip + restauración con paths reescritos al nuevo
# tempdir, dirty flag tracking, project_close, validaciones de error.

# ----- Helpers ---------------------------------------------------------------

.tiny_xlsx_bytes <- function() {
  # 7 bytes "ZIP header" — lo suficiente para que readBin/writeBin viajen
  # por el zip sin que importe que no es un xlsx real (los tests no lo
  # parsean, solo verifican que el archivo viaja byte-a-byte).
  as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00))
}

.xlsx_bytes_from_sheets <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (sheet_name in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, sheets[[sheet_name]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  on.exit(unlink(path, force = TRUE), add = TRUE)
  readBin(path, "raw", n = file.info(path)$size)
}

.fake_session_with_state <- function() {
  sid <- session_create()
  # Subir un input "referenciado" como instrumento de una base — solo
  # estos viajan en el .pulso (los outputs del pipeline son archivos
  # independientes al lado del .pulso).
  meta <- save_upload(sid, "xlsform", "demo_inst.xlsx", .tiny_xlsx_bytes())
  data_meta <- save_upload(sid, "data", "demo_data.xlsx", .tiny_xlsx_bytes())
  # Asociar a una base del estudio para que .pulso_collect_input_fids
  # los detecte.
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["default"]] <- list(
    nombre = "default",
    xlsform_file_id = meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx"
  )
  .session_env[[sid]] <- s
  session_set(sid, "instrumento", list(
    survey = data.frame(name = c("p1", "p2"), type = c("text", "integer"))
  ))
  session_set(sid, "plan_result", list(
    plan = tibble::tibble(ID = c("R1", "R2"), regla = c("x", "y"))
  ))
  session_set(sid, "reglas_custom", list(
    list(id = "rc1", nombre = "Rango edad", tipo = "rango_num", activa = TRUE)
  ))
  list(sid = sid, file_id = meta$file_id, data_file_id = data_meta$file_id)
}

.multibase_variant_repair_session <- function() {
  sid <- session_create()

  survey <- data.frame(
    type = c("text", "text", "select_one lst_p10", "text", "text"),
    name = c("origen", "p1", "p10", "p10_other", "p11"),
    label = c("origen", "Pregunta 1", "Empresa", "Otra empresa", "Pregunta 11"),
    relevant = c("", "", "", "${p10} = '999'", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_p10", "lst_p10"),
    name = c("1", "999"),
    label = c("Empresa guía", "Otro"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_df <- data.frame(
    origen = c("México", "Perú"),
    p1 = c("a", "b"),
    p10_mexico = c("1", NA),
    p10_mexico_other = c(NA, NA),
    p10_peru = c(NA, "2"),
    p10_peru_other = c(NA, "Empresa P"),
    p11 = c("x", "y"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  template_choices <- data.frame(
    parent_col = c("p10_mexico", "p10_mexico", "p10_peru", "p10_peru"),
    list_name = c("p10_mexico_list", "p10_mexico_list", "p10_peru_list", "p10_peru_list"),
    code = c("1", "999", "2", "999"),
    label = c("Empresa M", "Otro", "Empresa P", "Otro"),
    variable_label = c("Empresa - México", "Empresa - México", "Empresa - Perú", "Empresa - Perú"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  xmeta <- save_upload(
    sid, "xlsform", "instrumento_viejo.xlsx",
    .xlsx_bytes_from_sheets(list(survey = survey, choices = choices))
  )
  dmeta <- save_upload(
    sid, "data", "data_integrada.xlsx",
    .xlsx_bytes_from_sheets(list(data = data_df))
  )
  tmeta <- save_upload(
    sid, "data", "plantilla_codificacion.xlsx",
    .xlsx_bytes_from_sheets(list(CHOICES = template_choices))
  )

  estudio_ensure(sid)
  bad_inst <- reporte_instrumento(path = xmeta$path)
  bad_compat <- structure(
    list(
      ok = FALSE,
      missing_variables = c("p10", "p10_other"),
      message = "La data normalizada no calza con el XLSForm: faltan p10, p10_other"
    ),
    class = "pulso_data_xlsform_compatibility"
  )
  attr(data_df, "xlsform_normalized") <- TRUE
  attr(data_df, "xlsform_compatibility") <- bad_compat

  s <- session_get(sid)
  s$estudio$base_activa <- "base_integrada"
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx",
    compatibilidad = bad_compat,
    multi_integrated = list(
      origin_key_name = "origen",
      variant_map = list(
        list(from = "p10", to = "p10_mexico", origin_key = "México", replace_source = TRUE),
        list(from = "p10", to = "p10_peru", origin_key = "Perú", replace_source = FALSE)
      )
    )
  )
  s$codif_por_base <- list(base_integrada = list(
    plantilla_codigos_file_id = tmeta$file_id
  ))
  s$rp_inst <- bad_inst
  s$rp_inst_sources <- list(base_integrada = bad_inst)
  s$rp_data <- data_df
  s$rp_data_sources <- list(base_integrada = data_df)
  s$data_xlsform_compatibility <- bad_compat
  .session_env[[sid]] <- s

  list(sid = sid)
}

.parent_recod_repair_session <- function() {
  sid <- session_create()

  survey <- data.frame(
    type = c("select_one lst_p_area", "text", "select_one lst_p_area_other_recod"),
    name = c("p_area", "p_area_other", "p_area_other_recod"),
    label = c("Area", "Otro area", "Otro area recodificada"),
    list_name = c("lst_p_area", "", "lst_p_area_other_recod"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(
      rep("lst_p_area", 4),
      rep("lst_p_area_other_recod", 2)
    ),
    name = c("1", "2", "6", "99", "6", "1"),
    label = c(
      "Operaciones", "Direccion", "Finanzas", "Otro",
      "Sistema de Gestion", "Sostenibilidad"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_df <- data.frame(
    p_area = c("1", "99", "2", "99", "99", "6"),
    p_area_other = c("", "Sistema", "", "Sostenibilidad", "Sin clasificar", ""),
    p_area_other_recod = c(NA, "6", NA, "1", NA, NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  xmeta <- save_upload(
    sid, "xlsform", "instrumento_parent_recod.xlsx",
    .xlsx_bytes_from_sheets(list(survey = survey, choices = choices))
  )
  dmeta <- save_upload(
    sid, "data", "data_parent_recod.xlsx",
    .xlsx_bytes_from_sheets(list(data = data_df))
  )

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$base_activa <- "base_integrada"
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx"
  )
  s$codif_por_base <- list(base_integrada = list(
    familias_draft = list(rows = list(list(
      use = TRUE,
      tipo = "select_one",
      modo_so = "padre",
      parent = "p_area",
      parent_col = "p_area",
      text_col = "p_area_other",
      parent_label = "Area",
      list_norm = "lst_p_area"
    )))
  ))
  .session_env[[sid]] <- s

  list(sid = sid, xls_path = xmeta$path, data_path = dmeta$path)
}

.parent_recod_groups_repair_session <- function() {
  sid <- session_create()

  survey <- data.frame(
    type = c("select_one lst_p_area", "select_one lst_p_area_recod", "text"),
    name = c("p_area", "p_area_recod", "p_area_other"),
    label = c("Area", "Area recodificada", "Otro area"),
    list_name = c("lst_p_area", "lst_p_area_recod", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(rep("lst_p_area", 3), rep("lst_p_area_recod", 3)),
    name = c("1", "2", "99", "1", "2", "99"),
    label = c("Operaciones", "Direccion", "Otro", "Operaciones", "Direccion", "Otro"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_df <- data.frame(
    p_area = c("99", "1", "99", "2"),
    p_area_recod = c("Sistema", "1", "Sostenibilidad", "2"),
    p_area_other = c("Sistema", "", "Sostenibilidad", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  xmeta <- save_upload(
    sid, "xlsform", "instrumento_parent_recod_groups.xlsx",
    .xlsx_bytes_from_sheets(list(survey = survey, choices = choices))
  )
  dmeta <- save_upload(
    sid, "data", "data_parent_recod_groups.xlsx",
    .xlsx_bytes_from_sheets(list(data = data_df))
  )

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$base_activa <- "base_integrada"
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx"
  )
  s$codif_por_base <- list(base_integrada = list(
    familias_draft = list(rows = list(list(
      use = TRUE,
      tipo = "select_one",
      modo_so = "padre",
      parent = "p_area",
      parent_col = "p_area",
      text_col = "p_area_other",
      parent_label = "Area",
      list_norm = "lst_p_area"
    ))),
    grupos_recod = list(
      p_area_other = list(
        list(
          codigo = "1",
          etiqueta = "Sistema de Gestion",
          origen = "nuevo",
          respuestas = list("Sistema")
        ),
        list(
          codigo = "2",
          etiqueta = "Sostenibilidad",
          origen = "nuevo",
          respuestas = list("Sostenibilidad")
        )
      )
    )
  ))
  .session_env[[sid]] <- s

  list(sid = sid, xls_path = xmeta$path, data_path = dmeta$path)
}

# ----- Round-trip básico ------------------------------------------------------

test_that("build_pulso + load_pulso preservan estado simple", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  res_save <- build_pulso(setup$sid, tmp, project_name = "Test Demo")
  expect_true(res_save$ok)
  expect_true(file.exists(tmp))
  expect_gt(res_save$size, 0L)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  expect_true(res_load$ok)
  expect_true(nzchar(res_load$session_id))

  s <- session_get(res_load$session_id)
  expect_equal(s$instrumento$survey$name[1], "p1")
  expect_equal(nrow(s$plan_result$plan), 2L)
  expect_equal(s$reglas_custom[[1]]$nombre, "Rango edad")
  # Proyectos previos a instrument_revision/v1 siguen abriendo sin migración.
  expect_null(s$instrument_revisions)
})

# ----- Files físicos ----------------------------------------------------------

test_that("load_pulso restaura los archivos físicos con paths correctos", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  build_pulso(setup$sid, tmp)
  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)

  s <- session_get(res_load$session_id)
  expect_equal(length(s$files), 2L)  # xlsform + data
  expect_true(setup$file_id %in% names(s$files))
  meta <- s$files[[setup$file_id]]
  expect_true(file.exists(meta$path))
  # Path apunta al nuevo tempdir, NO al de la sesión original
  expect_true(grepl(res_load$session_id, meta$path, fixed = TRUE))
  # Bytes preservados
  bytes <- readBin(meta$path, "raw", n = 100)
  expect_identical(bytes, .tiny_xlsx_bytes())
})

test_that("round-trip .pulso conserva identidades portables del consolidado y resuelve iconos", {
  skip_if_not_installed("png")
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  icon_path <- tempfile(fileext = ".png")
  on.exit({
    unlink(c(tmp, icon_path), force = TRUE)
    session_delete(sid)
  }, add = TRUE)

  png::writePNG(array(1, dim = c(2, 2, 4)), icon_path)
  icon_meta <- .register_output_file(
    sid,
    "graficos_icon",
    icon_path,
    original_name = "icono-portable.png"
  )
  portable_icon <- list(
    id = "ico-portable",
    nombre = "Icono portable",
    file_id = icon_meta$file_id,
    path = icon_meta$path
  )
  config <- list(
    plan = list(slides = list()),
    iconos = list(portable_icon),
    profile_id = "acreditacion"
  )
  s <- session_get(sid)
  s$graficos_consolidado_draft <- list(
    schema = "graficos_consolidado_draft/v1",
    revision = 3L,
    config = config
  )
  s$graficos_consolidado <- list(
    schema = "graficos_consolidado/v1",
    revision = 2L,
    config = config,
    icon_registry = list("ico-portable" = icon_meta$path)
  )
  .session_env[[sid]] <- s

  build_pulso(sid, tmp, project_name = "Consolidado portable")
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)
  draft_icon <- restored$graficos_consolidado_draft$config$iconos[[1]]
  recipe_icon <- restored$graficos_consolidado$config$iconos[[1]]

  expect_equal(draft_icon$file_id, icon_meta$file_id)
  expect_equal(recipe_icon$file_id, icon_meta$file_id)
  expect_null(draft_icon$path)
  expect_null(recipe_icon$path)
  expect_null(restored$graficos_consolidado$icon_registry)
  expect_true(icon_meta$file_id %in% names(restored$files))
  expect_true(file.exists(restored$files[[icon_meta$file_id]]$path))

  registry <- .graficos_icon_registry(
    loaded$session_id,
    restored$graficos_consolidado_draft$config
  )
  expect_equal(registry[["ico-portable"]], restored$files[[icon_meta$file_id]]$path)
  expect_equal(registry[[icon_meta$file_id]], restored$files[[icon_meta$file_id]]$path)
})

test_that("round-trip .pulso conserva todas las revisiones XLSForm publicadas", {
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)

  workbook <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("text", "q1", "Pregunta uno"))
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list()
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Instrumento", "instrumento", "1", "es"))
    )
  )
  entry <- .xlsform_forms_as_entry(
    list(workbook = workbook, source = list(kind = "xlsform")),
    id = "form-roundtrip"
  )
  s <- session_get(sid)
  s <- .xlsform_forms_upsert(s, entry)
  .session_env[[sid]] <- s

  v1 <- xlsform_revision_publish(
    sid,
    "form-roundtrip",
    .xlsform_revision_hash(workbook)
  )$revision
  s <- session_get(sid)
  edited <- s$xlsform_forms[["form-roundtrip"]]
  edited$workbook$survey$rows[[1]][3] <- "Pregunta dos"
  s <- .xlsform_forms_upsert(s, edited)
  .session_env[[sid]] <- s
  v2 <- xlsform_revision_publish(
    sid,
    "form-roundtrip",
    .xlsform_revision_hash(edited$workbook)
  )$revision

  expected_ids <- c(v1$xlsform_file_id, v2$xlsform_file_id)
  expect_setequal(.pulso_collect_input_fids(session_get(sid)), expected_ids)
  original_bytes <- lapply(expected_ids, function(fid) {
    meta <- get_file(sid, fid)
    readBin(meta$path, "raw", n = file.info(meta$path)$size)
  })

  build_pulso(sid, tmp, project_name = "Revisiones")
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)

  expect_length(restored$instrument_revisions, 2L)
  expect_equal(
    vapply(unname(restored$instrument_revisions), `[[`, character(1), "content_sha256"),
    c(v1$content_sha256, v2$content_sha256)
  )
  expect_setequal(names(restored$files), expected_ids)
  for (i in seq_along(expected_ids)) {
    meta <- restored$files[[expected_ids[[i]]]]
    expect_true(file.exists(meta$path))
    expect_identical(
      readBin(meta$path, "raw", n = file.info(meta$path)$size),
      original_bytes[[i]]
    )
  }
})

test_that("build_pulso incluye bases declaradas en calculo de muestra", {
  sid <- session_create()
  meta <- save_upload(sid, "data", "base_calc_muestra.xlsx", .tiny_xlsx_bytes())
  tmp <- tempfile(fileext = ".pulso")
  stage <- tempfile("pulso_check_")
  on.exit({
    unlink(tmp, force = TRUE)
    unlink(stage, recursive = TRUE, force = TRUE)
    session_delete(sid)
  }, add = TRUE)

  session_set(sid, "calc_muestra_estudio", list(
    macro_familia = "encuesta_estudiantes",
    titulo = "Encuesta a estudiantes",
    workspace = list(
      frame_mode = "opinion_universitaria",
      source_mode = "base_madre",
      source_bindings = list(list(
        id = "src-base-madre",
        role = "base_madre",
        label = "Base institucional madre",
        file_id = meta$file_id,
        file_name = meta$original_name,
        sheet_name = "MATRICULADO",
        status = "cargada"
      )),
      variable_mappings = list(list(
        role = "student_id",
        label = "Codigo interno de estudiante",
        required = TRUE,
        column = "Codigo PUCP"
      )),
      aulas_config = list(
        schema = "calc_muestra_workspace_aulas_v1",
        min_elegibles_aula = 12L,
        accepted_conditions = list("regular", "habilitado"),
        require_undergraduate = TRUE,
        require_adult = FALSE,
        min_age = 0L,
        require_in_person = TRUE
      )
    )
  ))

  build_pulso(sid, tmp, project_name = "Calculo de muestra")

  dir.create(stage, recursive = TRUE)
  utils::unzip(tmp, exdir = stage)
  copied <- list.files(file.path(stage, "files"), full.names = FALSE)
  expect_true(any(startsWith(copied, paste0(meta$file_id, "__"))))

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  loaded_s <- session_get(loaded$session_id)
  loaded_meta <- loaded_s$files[[meta$file_id]]
  expect_false(is.null(loaded_meta))
  expect_true(file.exists(loaded_meta$path))
  expect_equal(
    loaded_s$calc_muestra_estudio$workspace$source_bindings[[1]]$file_id,
    meta$file_id
  )
  expect_equal(loaded_s$calc_muestra_estudio$workspace$aulas_config$min_elegibles_aula, 12L)
  expect_equal(unlist(loaded_s$calc_muestra_estudio$workspace$aulas_config$accepted_conditions), c("regular", "habilitado"))
  expect_false(loaded_s$calc_muestra_estudio$workspace$aulas_config$require_adult)
})

test_that("calculo de muestra configurado cuenta como contenido del proyecto", {
  expect_true(.pulso_state_has_project_content(list(
    calc_muestra_estudio = list(
      macro_familia = "encuesta_estudiantes",
      workspace = list(frame_mode = "opinion_universitaria")
    )
  )))
})

test_that("load_pulso repara XLSForm multibase viejo con variantes ya integradas", {
  setup <- .multibase_variant_repair_session()
  on.exit(session_delete(setup$sid))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)
  inst <- s$rp_inst_sources$base_integrada %||% s$rp_inst
  names_after <- as.character(inst$survey$name)

  expect_false("p10" %in% names_after)
  expect_false("p10_other" %in% names_after)
  expect_true(all(c(
    "p10_mexico", "p10_mexico_other",
    "p10_peru", "p10_peru_other"
  ) %in% names_after))
  expect_match(
    paste(
      as.character(inst$survey$type[names_after == "origen"][1]),
      as.character(inst$survey$list_name[names_after == "origen"][1])
    ),
    "^select_one\\s+origen_list$"
  )
  compat <- s$estudio$bases$base_integrada$compatibilidad
  expect_true(isTRUE(compat$ok))
  expect_false(any(c("p10", "p10_other") %in% (compat$missing_variables %||% character(0))))
})

test_that("load_pulso reconstruye caches runtime por base integrada", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid))

  survey <- data.frame(
    type = c("select_one lista_p1", "integer"),
    name = c("p1", "p2"),
    label = c("Pregunta uno", "Pregunta dos"),
    list_name = c("lista_p1", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lista_p1", "lista_p1"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_df <- data.frame(
    p1 = c("1", "2"),
    p2 = c(10, 20),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  xmeta <- save_upload(
    sid, "xlsform", "instrumento_integrado.xlsx",
    .xlsx_bytes_from_sheets(list(survey = survey, choices = choices))
  )
  dmeta <- save_upload(
    sid, "data", "data_integrada.xlsx",
    .xlsx_bytes_from_sheets(list(data = data_df))
  )
  inst <- reporte_instrumento(path = xmeta$path)

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx",
    n_filas = 2L,
    n_columnas = 2L,
    added_at = "2026-05-31T10:00:00Z",
    multi_integrated = list(origin_key_name = "origen")
  )
  # Simula proyectos integrados viejos: archivos canónicos presentes, pero
  # los maps por base que consume Validación quedaron vacíos o malformados.
  s$rp_data_sources <- list()
  s$rp_inst_sources <- list()
  s$rp_data <- list()
  s$rp_inst <- list(base_integrada = inst)
  .session_env[[sid]] <- s

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp)

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  data_sources <- estudio_data_sources(loaded$session_id)
  inst_sources <- estudio_inst_sources(loaded$session_id)
  expect_true("base_integrada" %in% names(data_sources))
  expect_true("base_integrada" %in% names(inst_sources))
  expect_s3_class(data_sources$base_integrada, "data.frame")
  expect_true(.pulso_valid_inst_cache(inst_sources$base_integrada))

  resolved <- .resolve_explorar_data(loaded$session_id, "base_integrada", "raw")
  expect_equal(resolved$effective_base, "base_integrada")
  expect_s3_class(resolved$data, "data.frame")
  expect_true(.pulso_valid_inst_cache(resolved$instrumento))
})

test_that("load_pulso prefiere archivos canonicos sobre caches runtime viejos", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid))

  survey <- data.frame(
    type = c("select_one lista_p1", "integer"),
    name = c("p1", "p2"),
    label = c("Pregunta uno", "Pregunta dos"),
    list_name = c("lista_p1", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lista_p1", "lista_p1"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_df <- data.frame(
    p1 = c("1", "2"),
    p2 = c(10, 20),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  stale_survey <- survey[1, , drop = FALSE]
  stale_inst <- reporte_instrumento(path = save_upload(
    sid, "xlsform", "instrumento_viejo.xlsx",
    .xlsx_bytes_from_sheets(list(survey = stale_survey, choices = choices))
  )$path)

  xmeta <- save_upload(
    sid, "xlsform", "instrumento_canonico.xlsx",
    .xlsx_bytes_from_sheets(list(survey = survey, choices = choices))
  )
  dmeta <- save_upload(
    sid, "data", "data_canonica.xlsx",
    .xlsx_bytes_from_sheets(list(data = data_df))
  )

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx",
    multi_integrated = list(origin_key_name = "origen")
  )
  s$rp_inst <- stale_inst
  s$rp_data <- data.frame(p1 = c("1", "2"), stringsAsFactors = FALSE, check.names = FALSE)
  s$rp_inst_sources <- list(base_integrada = stale_inst)
  s$rp_data_sources <- list(base_integrada = s$rp_data)
  .session_env[[sid]] <- s

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp)

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  data_sources <- estudio_data_sources(loaded$session_id)
  inst_sources <- estudio_inst_sources(loaded$session_id)
  expect_true("p2" %in% names(data_sources$base_integrada))
  expect_true("p2" %in% as.character(inst_sources$base_integrada$survey$name))
  compat <- attr(data_sources$base_integrada, "xlsform_compatibility", exact = TRUE)
  expect_true(isTRUE(compat$ok))
})

test_that("repair parent recod rebuilds integrated SO recod without code collisions", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  setup <- .parent_recod_repair_session()
  on.exit(session_delete(setup$sid))

  expect_true(.pulso_repair_parent_recod_columns(setup$sid))

  fixed_data <- as.data.frame(readxl::read_excel(setup$data_path, sheet = "data"),
                              stringsAsFactors = FALSE, check.names = FALSE)
  expect_true("p_area_recod" %in% names(fixed_data))
  expect_equal(as.character(fixed_data$p_area_recod), c("1", "100", "2", "101", NA, "6"))

  fixed_survey <- as.data.frame(readxl::read_excel(setup$xls_path, sheet = "survey"),
                                stringsAsFactors = FALSE, check.names = FALSE)
  expect_true("p_area_recod" %in% as.character(fixed_survey$name))
  recod_row <- fixed_survey[as.character(fixed_survey$name) == "p_area_recod", , drop = FALSE]
  expect_equal(as.character(recod_row$type[[1]]), "select_one lst_p_area_recod")

  fixed_choices <- as.data.frame(readxl::read_excel(setup$xls_path, sheet = "choices"),
                                 stringsAsFactors = FALSE, check.names = FALSE)
  recod_choices <- fixed_choices[as.character(fixed_choices$list_name) == "lst_p_area_recod", , drop = FALSE]
  expect_true(all(c("1", "2", "6", "99", "100", "101") %in% as.character(recod_choices$name)))
  labels <- stats::setNames(as.character(recod_choices$label), as.character(recod_choices$name))
  expect_equal(labels[["100"]], "Sistema de Gestion")
  expect_equal(labels[["101"]], "Sostenibilidad")
})

test_that("repair parent recod creates parent copy when child recod is absent", {
  df <- data.frame(
    p_area = c("1", "99", "2", NA),
    p_area_other = c("", "Sistema", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  fixed <- .pulso_repair_parent_recod_df(df, "p_area", "p_area_other")

  expect_true(fixed$changed)
  expect_true("p_area_recod" %in% names(fixed$data))
  expect_equal(as.character(fixed$data$p_area_recod), c("1", "99", "2", NA))
  expect_equal(names(fixed$data)[match("p_area", names(fixed$data)) + 1L], "p_area_recod")
})

test_that("repair parent recod uses saved groups keyed by adopted text column", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  setup <- .parent_recod_groups_repair_session()
  on.exit(session_delete(setup$sid))

  expect_true(.pulso_repair_parent_recod_columns(setup$sid))

  fixed_data <- as.data.frame(readxl::read_excel(setup$data_path, sheet = "data"),
                              stringsAsFactors = FALSE, check.names = FALSE)
  expect_equal(as.character(fixed_data$p_area_recod), c("100", "1", "101", "2"))

  fixed_choices <- as.data.frame(readxl::read_excel(setup$xls_path, sheet = "choices"),
                                 stringsAsFactors = FALSE, check.names = FALSE)
  recod_choices <- fixed_choices[as.character(fixed_choices$list_name) == "lst_p_area_recod", , drop = FALSE]
  labels <- stats::setNames(as.character(recod_choices$label), as.character(recod_choices$name))
  expect_equal(labels[["100"]], "Sistema de Gestion")
  expect_equal(labels[["101"]], "Sostenibilidad")
})

test_that("repair parent recod matches saved groups accent-insensitively", {
  df <- data.frame(
    p_area = c("99", "99"),
    p_area_other = c(
      "Centrum PUCP y Pontificia Universidad Católica de Chile",
      "Salcantay Mining Diseño de minas subterraneos, !costos y presupuestos y gestio) INARQ"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  groups <- list(
    list(
      codigo = "100",
      etiqueta = "CENTRUM",
      respuestas = list("centrum pucp y pontificia universidad catolica de chile")
    ),
    list(
      codigo = "101",
      etiqueta = "Otros",
      respuestas = list("salcantay mining diseno de minas subterraneos, !costos y presupuestos y gestio) inarq")
    )
  )

  fixed <- .pulso_repair_parent_recod_df(df, "p_area", "p_area_other", groups = groups)

  expect_true(fixed$changed)
  expect_equal(as.character(fixed$data$p_area_recod), c("100", "101"))
})

test_that("estudio payload exposes integrated-instruments history", {
  sid <- session_create()
  on.exit(session_delete(sid))

  guide <- save_upload(sid, "xlsform", "guia_canonica.xlsx", .tiny_xlsx_bytes())
  xmeta <- save_upload(sid, "xlsform", "instrumento_integrado.xlsx", .tiny_xlsx_bytes())
  dmeta <- save_upload(sid, "data", "base_integrada.xlsx", .tiny_xlsx_bytes())
  o_x <- save_upload(sid, "xlsform", "origen_mexico.xlsx", .tiny_xlsx_bytes())
  o_d <- save_upload(sid, "data", "origen_mexico_data.xlsx", .tiny_xlsx_bytes())

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["base_integrada"]] <- list(
    nombre = "base_integrada",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx",
    n_filas = 10L,
    n_columnas = 5L,
    added_at = "2026-05-31T10:00:00Z",
    multi_integrated = list(
      version = 1L,
      kind = "integrated_instruments",
      origin_key_name = "pais",
      guide_xlsform_file_id = guide$file_id,
      origins = list(mx = list(
        id = "mx",
        source_kind = "manual",
        key_value = "México",
        label = "México",
        xlsform_file_id = o_x$file_id,
        data_file_id = o_d$file_id
      )),
      variant_map = list(`mx::p10` = list(from = "p10", to = "p10_mexico", origin_key = "México")),
      label_overrides_standard = list(p1 = "Fraseo final común"),
      label_overrides_by_key = list(p1 = "Fraseo estándar"),
      imported_at = "2026-05-31T11:00:00Z"
    )
  )
  .session_env[[sid]] <- s

  payload <- .estudio_payload(sid)
  base <- payload$bases$base_integrada
  expect_equal(base$xlsform_file_name, "instrumento_integrado.xlsx")
  expect_equal(base$data_file_name, "base_integrada.xlsx")
  expect_equal(base$multi_integrated$origin_key_name, "pais")
  expect_equal(base$multi_integrated$guide$filename, "guia_canonica.xlsx")
  expect_equal(base$multi_integrated$origins[[1]]$xlsform_file_name, "origen_mexico.xlsx")
  expect_equal(base$multi_integrated$origins[[1]]$data_file_name, "origen_mexico_data.xlsx")
  expect_equal(base$multi_integrated$label_overrides_standard$p1, "Fraseo final común")
  expect_equal(base$multi_integrated$label_overrides_by_key$p1, "Fraseo estándar")
  expect_equal(base$multi_integrated$variant_map[[1]]$to, "p10_mexico")
  expect_null(names(base$multi_integrated$origins))
  expect_null(names(base$multi_integrated$variant_map))

  encoded <- jsonlite::toJSON(
    base$multi_integrated[c("origins", "variant_map")],
    auto_unbox = TRUE
  )
  expect_match(encoded, '"origins":\\[')
  expect_match(encoded, '"variant_map":\\[')
})

# ----- Dirty flag -------------------------------------------------------------

test_that("project_dirty se marca al mutar y se limpia al guardar", {
  setup <- .fake_session_with_state()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(setup$sid) })

  # Sin .pulso aún → mutaciones no marcan dirty (modo efímero).
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))

  # Save → ahora hay project_path; dirty queda FALSE.
  build_pulso(setup$sid, tmp)
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))
  expect_equal(session_get(setup$sid)$project_path, tmp)

  # Mutación → dirty TRUE
  session_set(setup$sid, "extra_key", "valor")
  expect_true(isTRUE(session_get(setup$sid)$project_dirty))

  # Save de nuevo → dirty FALSE
  build_pulso(setup$sid, tmp)
  expect_false(isTRUE(session_get(setup$sid)$project_dirty))
})

test_that("build_pulso rechaza sobrescribir un proyecto con contenido desde una sesion vacia", {
  testthat::skip_if_not_installed("zip")
  testthat::skip_if_not_installed("jsonlite")

  setup <- .fake_session_with_state()
  empty_sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(tmp, force = TRUE)
    session_delete(setup$sid)
    session_delete(empty_sid)
  }, add = TRUE)

  build_pulso(setup$sid, tmp, project_name = "Proyecto con datos")
  before_size <- file.info(tmp)$size

  err <- tryCatch(
    build_pulso(empty_sid, tmp, project_name = "Sesion vacia"),
    error = function(e) e
  )

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_REFUSE_EMPTY_PROJECT_OVERWRITE")
  expect_equal(file.info(tmp)$size, before_size)

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  expect_true(length(session_get(loaded$session_id)$files) > 0L)
})

test_that("build_pulso permite crear un proyecto vacio nuevo", {
  testthat::skip_if_not_installed("zip")
  testthat::skip_if_not_installed("jsonlite")

  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  unlink(tmp, force = TRUE)
  on.exit({
    unlink(tmp, force = TRUE)
    session_delete(sid)
  }, add = TRUE)

  saved <- build_pulso(sid, tmp, project_name = "Proyecto vacio")

  expect_true(file.exists(tmp))
  expect_true(saved$size > 0L)
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  expect_equal(length(session_get(loaded$session_id)$files %||% list()), 0L)
})

test_that("build_pulso preserva estado de monitoreo con fuentes, snapshot, cache y archivos", {
  testthat::skip_if_not_installed("zip")
  testthat::skip_if_not_installed("jsonlite")

  sid <- session_create()
  roster <- save_upload(sid, "data", "encuestadores.xlsx", .tiny_xlsx_bytes())
  occurrences <- save_upload(sid, "xlsform", "ocurrencias.xlsx", .tiny_xlsx_bytes())
  s <- session_get(sid)
  s$monitoreo_sources <- list(
    list(id = "main", label = "Encuesta principal", type = "kobo"),
    list(id = "field", label = "Campo", type = "kobo"),
    list(id = "occurrences", label = "Ocurrencias", type = "sheets")
  )
  s$monitoreo_config <- list(
    territorial = list(
      enumerator_roster = list(source_file_id = roster$file_id),
      field_occurrences = list(xlsform_file_id = occurrences$file_id)
    )
  )
  s$monitoreo_snapshot <- list(
    synced_at = "2026-06-18T20:00:00Z",
    data = data.frame(id = 1:3, estado = c("ok", "ok", "revision"), check.names = FALSE),
    variables = list(id = list(label = "ID"), estado = list(label = "Estado")),
    dashboard = list(kpis = list(total = 3L)),
    errors = list(),
    territorial_report_cache = list(campo = list(scope = "full"))
  )
  s$monitoreo_territorial_map_cache <- list(campo = list(points = list(list(id = "p1"))))
  .session_env[[sid]] <- s

  tmp <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(tmp, force = TRUE)
    session_delete(sid)
  }, add = TRUE)

  build_pulso(sid, tmp, project_name = "Monitoreo preservado")
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)

  expect_equal(length(restored$monitoreo_sources), 3L)
  expect_equal(nrow(restored$monitoreo_snapshot$data), 3L)
  expect_true(length(restored$monitoreo_territorial_map_cache) > 0L)
  expect_equal(length(restored$files), 2L)
})

test_that("session_set en keys internas de project NO entra en bucle de dirty", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Forzamos manualmente — no debería disparar mark_dirty (caería en bucle
  # si no estuviera la guarda).
  session_set(setup$sid, "project_path", "/tmp/foo.pulso")
  s <- session_get(setup$sid)
  expect_false(isTRUE(s$project_dirty))
  expect_equal(s$project_path, "/tmp/foo.pulso")
})

test_that("build_pulso preserva configuracion ligera de hojas de ruta", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  frame <- hojas_ruta_inei_frame()
  ubigeos <- head(unique(frame$ubigeo), 2)
  first_zone <- frame$zona[frame$ubigeo == ubigeos[[1]]][[1]]
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = as.list(ubigeos),
    n_objetivo = 240L,
    subquota_var = "ninguna",
    sampling_method = "sistematico",
    seed = 777L,
    entrevistas_por_manzana = 8L,
    route_start_corner = "2",
    route_jump_mode = "manual",
    route_jump_manual = 5L,
    age_range_mode = "manual",
    zone_allocation = "proportional",
    age_ranges = list(
      list(id = "18_39", label = "18-39", min = 18L, max = 39L),
      list(id = "40_plus", label = "40+", min = 40L, max = NA)
    )
  ))
  ui_state <- .hojas_ruta_ui_state_normalize(list(
    active_stage = "poblacion",
    draft_territories = as.list(rev(ubigeos)),
    map_ubigeo = ubigeos[[1]],
    map_zona = first_zone,
    map_level = "manzanas",
    map_selection_mode = TRUE
  ), cfg)
  session_set(setup$sid, "hojas_ruta_config", cfg)
  session_set(setup$sid, "hojas_ruta_ui_state", ui_state)
  session_set(setup$sid, "hojas_ruta_ok", TRUE)

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  loaded <- session_get(res_load$session_id)

  expect_equal(unlist(loaded$hojas_ruta_config$territorios, use.names = FALSE), ubigeos)
  expect_equal(loaded$hojas_ruta_config$n_objetivo, 240L)
  expect_equal(loaded$hojas_ruta_config$sampling_method, "sistematico")
  expect_equal(loaded$hojas_ruta_config$entrevistas_por_manzana, 8L)
  expect_equal(loaded$hojas_ruta_config$route_start_corner, "2")
  expect_equal(loaded$hojas_ruta_config$route_jump_mode, "manual")
  expect_equal(loaded$hojas_ruta_config$route_jump_manual, 5L)
  expect_equal(loaded$hojas_ruta_config$age_range_mode, "manual")
  expect_equal(loaded$hojas_ruta_config$zone_allocation, "proportional")
  expect_equal(loaded$hojas_ruta_config$age_ranges[[2]]$label, "40+")
  expect_equal(loaded$hojas_ruta_ui_state$active_stage, "poblacion")
  expect_equal(unlist(loaded$hojas_ruta_ui_state$draft_territories, use.names = FALSE), rev(ubigeos))
  expect_equal(loaded$hojas_ruta_ui_state$map_ubigeo, ubigeos[[1]])
  expect_equal(loaded$hojas_ruta_ui_state$map_zona, first_zone)
  expect_equal(loaded$hojas_ruta_ui_state$map_level, "manzanas")
  expect_true(isTRUE(loaded$hojas_ruta_ui_state$map_selection_mode))
  expect_null(loaded$hojas_ruta_ok)
})

# ----- project_status --------------------------------------------------------

test_that("project_status refleja correctamente los estados", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))

  st1 <- project_status(setup$sid)
  expect_false(st1$has_project)
  expect_true(is.na(st1$path))

  tmp <- tempfile(fileext = ".pulso")
  build_pulso(setup$sid, tmp, project_name = "Mi Proyecto X")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)

  st2 <- project_status(setup$sid)
  expect_true(st2$has_project)
  expect_equal(st2$path, tmp)
  expect_false(st2$dirty)
  expect_true(nzchar(st2$last_saved_at))
})

# ----- project_close ---------------------------------------------------------

test_that("project_close limpia path/dirty pero mantiene la sesión y datos", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)

  build_pulso(setup$sid, tmp)
  expect_true(project_status(setup$sid)$has_project)

  project_close(setup$sid)
  st <- project_status(setup$sid)
  expect_false(st$has_project)
  # La sesión sigue viva con datos
  s <- session_get(setup$sid)
  expect_equal(nrow(s$plan_result$plan), 2L)
})

# ----- Excluye caches transient ---------------------------------------------

test_that("build_pulso excluye codif_por_base[*]$inst y $data del state", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Inyectar caches "gordos" simulados.
  codif_set(setup$sid, "inst", list(survey = data.frame(name = "x")), source = "default")
  codif_set(setup$sid, "data", data.frame(a = 1:1000), source = "default")

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)
  expect_null(s$codif_por_base$default$inst)
  expect_null(s$codif_por_base$default$data)
})

# ----- Outputs son independientes (no van en el .pulso) ---------------------

test_that("build_pulso excluye outputs/entregables del zip — solo inputs viajan", {
  setup <- .fake_session_with_state()
  on.exit(session_delete(setup$sid))
  # Subir un "output" simulado (kind raro) que NO está referenciado por
  # ninguna base ni por codif_por_base. NO debería viajar al .pulso.
  output_meta <- save_upload(setup$sid, "data", "codebook_generated.xlsx",
                              .tiny_xlsx_bytes())
  # Notar: este file_id existe en s$files pero ninguna base lo referencia
  # como xlsform_file_id ni data_file_id ni familias_file_id.

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  # Verificar zip contents: solo deben estar los 2 inputs referenciados,
  # NO el "output" no referenciado.
  entries <- zip::zip_list(tmp)$filename
  files_entries <- entries[startsWith(entries, "files/")]
  expect_length(files_entries, 2L)
  expect_true(any(grepl(setup$file_id, files_entries, fixed = TRUE)))
  expect_true(any(grepl(setup$data_file_id, files_entries, fixed = TRUE)))
  expect_false(any(grepl(output_meta$file_id, files_entries, fixed = TRUE)))
})

# ----- Persistencia del estado del dashboard --------------------------------

test_that("build_pulso preserva dashboard_source, dashboard_config y dashboard_curacion", {
  setup <- .fake_session_with_state()
  on.exit({ session_delete(setup$sid) })

  # Simular estado del dashboard: source con file_ids, config estético,
  # curaduría confirmada.
  session_set(setup$sid, "dashboard_source", list(
    ready = TRUE,
    source_kind = "session",
    xlsform_file_id = setup$file_id,
    data_file_id = setup$data_file_id,
    xlsform_name = "demo_inst.xlsx",
    data_name = "demo_data.xlsx",
    n_filas = 100L,
    n_columnas = 10L,
    loaded_at = "2026-04-26T00:00:00Z"
  ))
  session_set(setup$sid, "dashboard_config", list(
    titulo = "Mi Tablero",
    subtitulo = "Demo",
    paleta_id = "tableau10",
    paletas_listas = list(likert = list("Sí" = "#1f77b4", "No" = "#d62728")),
    color_primario_override = "#FF6600",
    notas = "Notas de prueba"
  ))
  session_set(setup$sid, "dashboard_curacion", list(
    confirmed = TRUE,
    exclude_sections = c("metadatos"),
    exclude_vars = c("fecha_inicio", "device_id")
  ))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)

  expect_equal(s$dashboard_source$xlsform_file_id, setup$file_id)
  expect_equal(s$dashboard_source$xlsform_name, "demo_inst.xlsx")
  expect_equal(s$dashboard_config$titulo, "Mi Tablero")
  expect_equal(s$dashboard_config$paleta_id, "tableau10")
  expect_equal(s$dashboard_config$color_primario_override, "#FF6600")
  expect_true(isTRUE(s$dashboard_curacion$confirmed))
  expect_equal(s$dashboard_curacion$exclude_vars,
               c("fecha_inicio", "device_id"))
})

test_that("load_pulso preserva la curaduría confirmada (rebuild no la pisa)", {
  setup <- .fake_session_with_state()
  on.exit({ session_delete(setup$sid) })

  # Source válido + curaduría confirmada antes de guardar.
  session_set(setup$sid, "dashboard_source", list(
    ready = TRUE,
    xlsform_file_id = setup$file_id,
    data_file_id = setup$data_file_id
  ))
  session_set(setup$sid, "dashboard_curacion", list(
    confirmed = TRUE,
    exclude_sections = list(),
    exclude_vars = list("var_excluida")
  ))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)

  # El rebuild post-load NO debe resetear la curaduría — usa keep_curacion=TRUE.
  expect_true(isTRUE(s$dashboard_curacion$confirmed))
  expect_equal(as.character(unlist(s$dashboard_curacion$exclude_vars)),
               "var_excluida")
})

test_that("build_pulso excluye dashboard_rp_inst y dashboard_rp_data del state", {
  setup <- .fake_session_with_state()
  on.exit({ session_delete(setup$sid) })

  # Inyectar caches gordos simulados (NO van por byte-a-byte: son
  # derivables del par xlsform/data referenciado en dashboard_source).
  session_set(setup$sid, "dashboard_rp_inst", list(
    survey = data.frame(name = paste0("v", 1:50), type = "text"),
    choices = data.frame(list_name = "lista", name = letters, label = letters)
  ))
  session_set(setup$sid, "dashboard_rp_data", data.frame(a = 1:1000, b = 1:1000))
  # Source mínimo para que el rebuild encuentre algo (file_ids reales del
  # setup); si reporte_instrumento falla con el xlsx falso, el tryCatch lo
  # absorbe y los caches quedan NULL.
  session_set(setup$sid, "dashboard_source", list(
    ready = TRUE,
    xlsform_file_id = setup$file_id,
    data_file_id = setup$data_file_id
  ))

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(setup$sid, tmp)

  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)
  s <- session_get(res_load$session_id)
  # rp_inst/data nunca viajan en el state.rds — quedan NULL si el rebuild
  # falla (xlsform demo no es parseable). El strip evita que el .pulso se
  # infle con tibbles regenerables.
  expect_null(s$dashboard_rp_inst)
  expect_null(s$dashboard_rp_data)
})

# ----- Errores ---------------------------------------------------------------

test_that("load_pulso falla con mensaje claro si el archivo no existe", {
  expect_error(load_pulso("/tmp/noexiste.pulso"), class = "api_error")
})
