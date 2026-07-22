source("setup-load-all.R")

# Fuente POR BASE en estudios multibase (relaja el invariante "fuente única por
# corrida"). Cada base resuelve adaptada/original según su propio par; la hija
# repeat sin codificar HEREDA la caracterización de la madre en la fuente de la
# MADRE (adaptada si la madre está codificada). Ver router_analitica.R
# (.analitica_effective_source / .analitica_pair_for_base) y ADR 0030.

.fpb_write_instrument <- function(path, variable, label) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "text", name = variable, label = label, stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(), name = character(), label = character(),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.fpb_write_template <- function(path, data, variable) {
  rows <- rbind(
    c("_uuid", "_index", variable, paste0(variable, "_recod"), "Control", NA, "nuevo_codigo", "nueva_etiqueta"),
    c("UUID", "Índice", "Respuesta", "Código", "Control / notas", NA, "Nuevo código", "Nueva etiqueta"),
    cbind(
      as.character(data[["_uuid"]]), as.character(data[["_index"]]),
      as.character(data[[variable]]), NA_character_, NA_character_,
      NA_character_, NA_character_, NA_character_
    )
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, variable)
  openxlsx::writeData(wb, variable, rows, colNames = FALSE)
  groups <- list(list(
    codigo = "901", etiqueta = "Categoría controlada", origen = "nuevo",
    respuestas = list(as.character(data[[variable]][1]))
  ))
  .patch_text_sheet(wb, variable, paste0(variable, "_recod"), variable, groups, data)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.fpb_adapt <- function(dir, data, variable, label) {
  inst_in <- .fpb_write_instrument(
    file.path(dir, paste0(variable, "_instrumento.xlsx")), variable, label)
  data_in <- file.path(dir, paste0(variable, "_datos.xlsx"))
  openxlsx::write.xlsx(data, data_in, overwrite = TRUE)
  template <- .fpb_write_template(
    file.path(dir, paste0(variable, "_plantilla.xlsx")), data, variable)
  families <- file.path(dir, paste0(variable, "_familias.xlsx"))
  openxlsx::write.xlsx(data.frame(
    use = TRUE, tipo = "text", parent = variable, parent_col = variable,
    text_col = variable, stringsAsFactors = FALSE
  ), families, overwrite = TRUE)
  .codif_apply_job_runner(
    xls_path = inst_in, data_path = data_in, codes_path = template,
    fam_path = families,
    data_out = file.path(dir, paste0(variable, "_data_adaptada.xlsx")),
    inst_out = file.path(dir, paste0(variable, "_instrumento_adaptado.xlsx")),
    sm_vars = character(), so_parent_vars = character(),
    so_child_vars = character(), text_vars = variable, int_vars = character()
  )
}

.fpb_register_base <- function(sid, name, data, variable, label, parent_base = "") {
  sdir <- file.path(session_get(sid)$dir, "downloads")
  inst_path <- .fpb_write_instrument(
    file.path(sdir, paste0(name, "_orig_inst.xlsx")), variable, label)
  data_path <- file.path(sdir, paste0(name, "_orig_data.xlsx"))
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)
  inst_meta <- save_upload(sid, "xlsform", basename(inst_path),
    readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_meta <- save_upload(sid, "data", basename(data_path),
    readBin(data_path, "raw", n = file.info(data_path)$size))
  inst <- reporte_instrumento(path = inst_meta$path)
  estudio_add_base(
    sid = sid, nombre = name, xlsform_file_id = inst_meta$file_id,
    data_file_id = data_meta$file_id, data_ext = "xlsx",
    rp_data = reporte_data(data, instrumento = inst), rp_inst = inst,
    n_filas = nrow(data), n_columnas = ncol(data),
    extra_meta = list(
      source_kind = if (nzchar(parent_base)) "kobo_repeat" else "monitoreo_kobo",
      parent_base = parent_base
    )
  )
  invisible(list(inst = inst_meta, data = data_meta))
}

.fpb_build <- function(sid, dir) {
  main <- data.frame(
    `_uuid` = c("m-1", "m-2"), `_index` = 1:2,
    recomendacion = c("Mejorar horarios", "Sin comentario"), check.names = FALSE)
  child <- data.frame(
    `_uuid` = c("", ""), `_index` = 1:2, `_parent_index` = c(1L, 2L),
    detalle = c("Más privacidad", "Mejor señalización"), check.names = FALSE)
  .fpb_register_base(sid, "principal", main, "recomendacion", "Recomendación")
  .fpb_register_base(sid, "rep_servicios", child, "detalle", "Detalle",
    parent_base = "principal")
  list(
    main = main, child = child,
    main_paths = .fpb_adapt(dir, main, "recomendacion", "Recomendación"),
    child_paths = .fpb_adapt(dir, child, "detalle", "Detalle")
  )
}

.fpb_setup <- function() {
  sid <- session_create()
  dir <- file.path(session_get(sid)$dir, "qa-fpb")
  dir.create(dir, recursive = TRUE)
  list(sid = sid, art = .fpb_build(sid, dir))
}

test_that("(a) madre codif sola: madre adaptada, hija su original, hija hereda de la madre adaptada", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .fpb_setup()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  .codif_apply_complete(sid, "principal", fx$art$main_paths)
  s <- session_get(sid)
  cfg <- list(fuente_preferida = "adaptados")

  # El estudio prefiere adaptados aunque la hija no esté codificada.
  expect_equal(.analitica_effective_source(s, cfg), "adaptados")

  madre <- .analitica_pair_for_base(s, s$estudio$bases$principal, "adaptados", "principal")
  expect_equal(madre$xls$kind, "instrumento_adaptado")
  expect_equal(madre$data$kind, "data_adaptada")

  hija <- .analitica_pair_for_base(s, s$estudio$bases$rep_servicios, "adaptados", "rep_servicios")
  expect_equal(hija$xls$kind, "xlsform")
  expect_equal(hija$data$kind, "data")

  # SUTILEZA CRÍTICA: el enriquecimiento resuelve la madre en SU fuente (adaptada)
  # y por eso trae la columna recodificada de la madre para heredar a la hija.
  parent <- .analitica_repeat_parent_pair(sid, "principal", cfg = cfg)
  expect_false(is.null(parent))
  expect_true("recomendacion_recod" %in% names(parent$data))
})

test_that("(b) repeat codif solo: hija adaptada (su _recod existe), madre su original", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .fpb_setup()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  .codif_apply_complete(sid, "rep_servicios", fx$art$child_paths)
  s <- session_get(sid)
  cfg <- list(fuente_preferida = "adaptados")

  expect_equal(.analitica_effective_source(s, cfg), "adaptados")

  hija <- .analitica_pair_for_base(s, s$estudio$bases$rep_servicios, "adaptados", "rep_servicios")
  expect_equal(hija$xls$kind, "instrumento_adaptado")
  expect_equal(hija$data$kind, "data_adaptada")
  hija_data <- readxl::read_excel(hija$data$path)
  expect_true("detalle_recod" %in% names(hija_data))

  madre <- .analitica_pair_for_base(s, s$estudio$bases$principal, "adaptados", "principal")
  expect_equal(madre$xls$kind, "xlsform")
  expect_equal(madre$data$kind, "data")
})

test_that("(c) ambas codif: ambas adaptadas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .fpb_setup()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  .codif_apply_complete(sid, "principal", fx$art$main_paths)
  .codif_apply_complete(sid, "rep_servicios", fx$art$child_paths)
  s <- session_get(sid)
  cfg <- list(fuente_preferida = "adaptados")

  expect_equal(.analitica_effective_source(s, cfg), "adaptados")
  madre <- .analitica_pair_for_base(s, s$estudio$bases$principal, "adaptados", "principal")
  hija <- .analitica_pair_for_base(s, s$estudio$bases$rep_servicios, "adaptados", "rep_servicios")
  expect_equal(madre$xls$kind, "instrumento_adaptado")
  expect_equal(hija$xls$kind, "instrumento_adaptado")
})

test_that("(d) ninguna codif: ambas originales", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .fpb_setup()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  cfg <- list(fuente_preferida = "adaptados")
  expect_equal(.analitica_effective_source(s, cfg), "originales")
  madre <- .analitica_pair_for_base(s, s$estudio$bases$principal, "originales", "principal")
  hija <- .analitica_pair_for_base(s, s$estudio$bases$rep_servicios, "originales", "rep_servicios")
  expect_equal(madre$xls$kind, "xlsform")
  expect_equal(hija$xls$kind, "xlsform")
})

test_that("(e) fuente_preferida=originales explícito fuerza original aunque haya par adaptado", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .fpb_setup()
  sid <- fx$sid
  on.exit(session_delete(sid), add = TRUE)

  .codif_apply_complete(sid, "principal", fx$art$main_paths)
  s <- session_get(sid)
  cfg <- list(fuente_preferida = "originales")

  expect_equal(.analitica_effective_source(s, cfg), "originales")
  madre <- .analitica_pair_for_base(s, s$estudio$bases$principal, "originales", "principal")
  expect_equal(madre$xls$kind, "xlsform")
  expect_equal(madre$data$kind, "data")
})
