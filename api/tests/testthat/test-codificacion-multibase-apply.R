.codif_multibase_write_instrument <- function(path, variable, label) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "text", name = variable, label = label,
    stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(), name = character(), label = character(),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.codif_multibase_write_template <- function(path, data, variable) {
  rows <- rbind(
    c("_uuid", "_index", variable, paste0(variable, "_recod"), "Control", NA, "nuevo_codigo", "nueva_etiqueta"),
    c("UUID", "Índice", "Respuesta", "Código", "Control / notas", NA, "Nuevo código", "Nueva etiqueta"),
    cbind(
      as.character(data[["_uuid"]]),
      as.character(data[["_index"]]),
      as.character(data[[variable]]),
      NA_character_, NA_character_, NA_character_, NA_character_, NA_character_
    )
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, variable)
  openxlsx::writeData(wb, variable, rows, colNames = FALSE)
  groups <- list(list(
    codigo = "901",
    etiqueta = "Categoría controlada",
    origen = "nuevo",
    respuestas = list(as.character(data[[variable]][1]))
  ))
  expect_true(.patch_text_sheet(
    wb, variable, paste0(variable, "_recod"), variable, groups, data
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.codif_multibase_adapt <- function(dir, data, variable, label) {
  inst_in <- .codif_multibase_write_instrument(
    file.path(dir, paste0(variable, "_instrumento.xlsx")), variable, label
  )
  data_in <- file.path(dir, paste0(variable, "_datos.xlsx"))
  openxlsx::write.xlsx(data, data_in, overwrite = TRUE)
  template <- .codif_multibase_write_template(
    file.path(dir, paste0(variable, "_plantilla.xlsx")), data, variable
  )
  families <- file.path(dir, paste0(variable, "_familias.xlsx"))
  openxlsx::write.xlsx(data.frame(
    use = TRUE, tipo = "text", parent = variable,
    parent_col = variable, text_col = variable,
    stringsAsFactors = FALSE
  ), families, overwrite = TRUE)
  data_out <- file.path(dir, paste0(variable, "_data_adaptada.xlsx"))
  inst_out <- file.path(dir, paste0(variable, "_instrumento_adaptado.xlsx"))
  .codif_apply_job_runner(
    xls_path = inst_in,
    data_path = data_in,
    codes_path = template,
    fam_path = families,
    data_out = data_out,
    inst_out = inst_out,
    sm_vars = character(),
    so_parent_vars = character(),
    so_child_vars = character(),
    text_vars = variable,
    int_vars = character()
  )
}

.codif_multibase_register_base <- function(sid, name, data, variable, label,
                                            parent_base = "") {
  sdir <- file.path(session_get(sid)$dir, "downloads")
  inst_path <- .codif_multibase_write_instrument(
    file.path(sdir, paste0(name, "_original_instrumento.xlsx")), variable, label
  )
  data_path <- file.path(sdir, paste0(name, "_original_data.xlsx"))
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)
  inst_meta <- save_upload(
    sid, "xlsform", basename(inst_path),
    readBin(inst_path, "raw", n = file.info(inst_path)$size)
  )
  data_meta <- save_upload(
    sid, "data", basename(data_path),
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  inst <- reporte_instrumento(path = inst_meta$path)
  estudio_add_base(
    sid = sid,
    nombre = name,
    xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id,
    data_ext = "xlsx",
    rp_data = reporte_data(data, instrumento = inst),
    rp_inst = inst,
    n_filas = nrow(data),
    n_columnas = ncol(data),
    extra_meta = list(
      source_kind = if (nzchar(parent_base)) "kobo_repeat" else "monitoreo_kobo",
      parent_base = parent_base
    )
  )
  codif_set(sid, "data", data, source = name)
  codif_set(sid, "inst", leer_instrumento_xlsform(inst_meta$path), source = name)
  invisible(list(inst = inst_meta, data = data_meta))
}

test_that("aplicación multibase codifica madre y repeat y completa solo al final", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  dir <- file.path(session_get(sid)$dir, "qa")
  dir.create(dir, recursive = TRUE)

  main <- data.frame(
    `_uuid` = c("m-1", "m-2"),
    `_index` = 1:2,
    recomendacion = c("Mejorar horarios", "Sin comentario"),
    check.names = FALSE
  )
  child <- data.frame(
    `_uuid` = c("", ""),
    `_index` = 1:2,
    `_parent_index` = c(1L, 2L),
    detalle = c("Más privacidad", "Mejor señalización"),
    check.names = FALSE
  )

  main_original <- .codif_multibase_register_base(
    sid, "principal", main, "recomendacion", "Recomendación"
  )
  child_original <- .codif_multibase_register_base(
    sid, "rep_servicios", child, "detalle", "Detalle", parent_base = "principal"
  )

  main_paths <- .codif_multibase_adapt(dir, main, "recomendacion", "Recomendación")
  child_paths <- .codif_multibase_adapt(dir, child, "detalle", "Detalle")

  child_adapted <- readxl::read_excel(child_paths$data_out)
  expect_true("detalle_recod" %in% names(child_adapted))
  expect_equal(as.character(child_adapted$detalle_recod), c("901", NA_character_))
  expect_equal(as.integer(child_adapted$`_index`), child$`_index`)
  expect_equal(as.integer(child_adapted$`_parent_index`), child$`_parent_index`)

  .codif_apply_complete(sid, "principal", main_paths)
  partial <- session_get(sid)
  expect_true(isTRUE(partial$codif_por_base$principal$aplicado))
  expect_false(isTRUE(partial$codif_por_base$rep_servicios$aplicado))
  expect_false(isTRUE(partial$codif_aplicado))
  expect_null(partial$codif_por_base$principal$data)
  expect_null(partial$codif_por_base$principal$inst)
  expect_equal(
    partial$estudio$bases$principal$original_data_file_id,
    main_original$data$file_id
  )

  # Compatibilidad con proyectos adaptados antes de que existiera el estado
  # scoped: el par de archivos es la evidencia para reconstruirlo.
  codif_set(sid, "aplicado", NULL, source = "principal")
  .codif_apply_complete(sid, "rep_servicios", child_paths)
  complete <- session_get(sid)
  expect_true(isTRUE(complete$codif_por_base$principal$aplicado))
  expect_true(isTRUE(complete$codif_por_base$rep_servicios$aplicado))
  expect_true(isTRUE(complete$codif_aplicado))
  expect_null(complete$codif_por_base$rep_servicios$data)
  expect_null(complete$codif_por_base$rep_servicios$inst)
  expect_equal(
    complete$estudio$bases$rep_servicios$original_data_file_id,
    child_original$data$file_id
  )
  expect_true(.codif_base_pair_is_adapted(complete, "principal"))
  expect_true(.codif_base_pair_is_adapted(complete, "rep_servicios"))
})
