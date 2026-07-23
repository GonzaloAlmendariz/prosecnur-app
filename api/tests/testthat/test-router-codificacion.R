# Contrato de router_codificacion.R (unidad 5.7 — grandes sin test dedicado).
#
# router_codificacion.R (~3,100 líneas) solo estaba ejercitado de rebote por
# test-codificacion-aplicar-data.R y las suites de pipeline. Aquí se fija el
# contrato in-process de sus fronteras de mayor riesgo:
#
#   - .require_xlsform_path / .require_data_path: E_NO_XLSFORM / E_NO_DATA
#     y resolución del último upload
#   - .codif_prepare_data_for_adapt: inyección de `_index` solo cuando no hay
#     llave estable y limpieza de haven_labelled
#   - nomenclatura de exports (.export_slug / .export_label_for_kind /
#     .export_filename / .strip_internal_prefix / .register_output_file):
#     nunca UUIDs de cara al usuario
#   - .familias_suggest_tibble: puente sesión → escribir_plantilla_familias
#     (columnas canónicas del draft de familias, labels en español)
#   - .codif_normalize_legacy_select_one_modes: migración hijo→padre de
#     drafts legacy sin recodificación hija
#
# El flujo de sugerencia/confirmación/aplicación del engine vive en
# test-codificacion-flujo-hibrido.R; la aplicación real de plantillas en
# test-codificacion-aplicar-data.R.

source("setup-load-all.R")

.rc_write_xlsform <- function(path) {
  survey <- data.frame(
    type  = c("select_one lst_srv", "text", "text", "integer", "note"),
    name  = c("p1", "p1_other", "p3", "edad", "nota_intro"),
    label = c("Service", "Other", "Comment", "Age", "Intro"),
    `label::Spanish (es)` = c("Servicio usado", "Otro servicio",
                              "Comentario libre", "Edad", "Introducción"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_srv", "lst_srv"),
    name = c("1", "96"),
    label = c("Health", "Other"),
    `label::Spanish (es)` = c("Salud", "Otro"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.rc_data_df <- function() {
  data.frame(
    `_uuid` = c("u1", "u2", "u3"),
    p1 = c("1", "96", "96"),
    p1_other = c("", "farmacia móvil", "curandero"),
    p3 = c("todo bien", "", "más agua"),
    edad = c(23L, 41L, 35L),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.rc_session_with_uploads <- function() {
  td <- tempfile("router-codif-")
  dir.create(td)
  inst_path <- .rc_write_xlsform(file.path(td, "inst.xlsx"))
  data_path <- file.path(td, "data.xlsx")
  openxlsx::write.xlsx(.rc_data_df(), data_path, overwrite = TRUE)
  sid <- session_create()
  inst_meta <- save_upload(sid, "xlsform", "inst.xlsx",
    readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_meta <- save_upload(sid, "data", "data.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size))
  list(sid = sid, inst = inst_meta, data = data_meta)
}

test_that("require_*: sesión sin Fase 1 corta con E_NO_XLSFORM / E_NO_DATA; con uploads resuelve el último", {
  sid <- session_create()

  err_x <- tryCatch(.require_xlsform_path(sid), error = function(e) e)
  expect_s3_class(err_x, "api_error")
  expect_identical(err_x$code, "E_NO_XLSFORM")
  expect_identical(err_x$status, 409)

  err_d <- tryCatch(.require_data_path(sid), error = function(e) e)
  expect_s3_class(err_d, "api_error")
  expect_identical(err_d$code, "E_NO_DATA")
  expect_identical(err_d$status, 409)

  skip_if_not_installed("openxlsx")
  fx <- .rc_session_with_uploads()
  expect_identical(.require_xlsform_path(fx$sid)$file_id, fx$inst$file_id)
  expect_identical(.require_data_path(fx$sid)$file_id, fx$data$file_id)
})

test_that("prepare_data_for_adapt: inyecta `_index` primero solo cuando no hay llave estable", {
  sin_llave <- .codif_prepare_data_for_adapt(data.frame(x = c("a", "b")))
  expect_identical(names(sin_llave)[1], "_index")
  expect_identical(sin_llave[["_index"]], 1:2)

  con_llave <- .codif_prepare_data_for_adapt(
    data.frame(`_uuid` = c("u1", "u2"), x = 1:2, check.names = FALSE)
  )
  expect_false("_index" %in% names(con_llave))

  # Llave presente pero vacía NO cuenta como llave.
  llave_vacia <- .codif_prepare_data_for_adapt(
    data.frame(`_uuid` = c("", NA), x = 1:2, check.names = FALSE)
  )
  expect_true("_index" %in% names(llave_vacia))
})

test_that("nomenclatura de exports: slugs ASCII, mapeo por kind y fecha; jamás UUIDs internos", {
  expect_identical(.export_slug("Base Niñez 2026"), "Base_Ninez_2026")
  expect_identical(.export_slug(""), "Prosecnur")
  expect_identical(.export_label_for_kind("codebook"), "libro_de_codigos")
  expect_identical(.export_label_for_kind("data_adaptada"), "data_adaptada")

  sid <- session_create()
  fname <- .export_filename(sid, "codebook", "xlsx")
  fecha <- format(Sys.Date(), "%d_%m_%y")
  expect_identical(fname, paste0("Prosecnur_libro_de_codigos_", fecha, ".xlsx"))
  con_base <- .export_filename(sid, "frecuencias", "xlsx", base = "Base Niñez")
  expect_identical(con_base, paste0("Prosecnur_Base_Ninez_frecuencias_", fecha, ".xlsx"))

  uuid <- "9f2b7c1e-1111-2222-3333-444455556666"
  expect_identical(.strip_internal_prefix(paste0(uuid, "__resultado.xlsx")), "resultado.xlsx")
  expect_identical(.strip_internal_prefix(paste0(uuid, "_amigable.xlsx")), "amigable.xlsx")
  expect_identical(.strip_internal_prefix("normal.xlsx"), "normal.xlsx")
})

test_that("register_output_file: registra el artefacto en la sesión y limpia el prefijo interno", {
  sid <- session_create()
  s <- session_get(sid)
  out_path <- file.path(s$dir, "downloads",
    "9f2b7c1e-1111-2222-3333-444455556666__data_adaptada.xlsx")
  writeBin(as.raw(1:10), out_path)

  meta <- .register_output_file(sid, "data_adaptada", out_path)
  expect_identical(meta$kind, "data_adaptada")
  expect_identical(meta$original_name, "data_adaptada.xlsx")
  expect_false(grepl("[0-9a-fA-F-]{36}", meta$original_name))
  expect_identical(session_get(sid)$files[[meta$file_id]]$path, out_path)
})

test_that("familias_suggest_tibble: draft canónico desde la base del estudio con labels en español", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  fx <- .rc_session_with_uploads()
  sid <- fx$sid

  rp_inst <- reporte_instrumento(path = fx$inst$path)
  rp_data <- reporte_data(.rc_data_df(), instrumento = rp_inst)
  estudio_add_base(
    sid = sid, nombre = "principal",
    xlsform_file_id = fx$inst$file_id, data_file_id = fx$data$file_id,
    data_ext = "xlsx", rp_data = rp_data, rp_inst = rp_inst,
    n_filas = 3L, n_columnas = 5L
  )

  sug <- .familias_suggest_tibble(sid)
  expect_s3_class(sug, "data.frame")
  expect_identical(
    names(sug),
    c("use", "q_order", "tipo", "modo_so", "parent", "parent_label", "list_norm",
      "parent_col", "other_dummy_col", "text_col",
      "parent_col_cands", "other_dummy_cands", "text_col_cands", "dummy_cands")
  )
  # Solo variables codificables (select_one/text/integer); la note queda fuera.
  expect_setequal(sug$parent, c("p1", "p1_other", "p3", "edad"))
  expect_false("nota_intro" %in% sug$parent)
  expect_identical(sug$tipo[sug$parent == "p1"], "select_one")
  expect_identical(sug$tipo[sug$parent == "edad"], "integer")
  expect_identical(sug$parent_label[sug$parent == "p1"], "Servicio usado")
  expect_true(all(sug$use))
  expect_identical(sug$q_order, sort(sug$q_order))
})

test_that("normalize_legacy_select_one_modes: migra hijo→padre cuando no hay rastro de recodificación hija", {
  sid <- session_create()
  data_df <- .rc_data_df()

  draft <- list(rows = list(
    list(use = TRUE, tipo = "select_one", modo_so = "hijo",
         parent = "p1", parent_col = "", text_col = "p1_other"),
    list(use = TRUE, tipo = "select_one", modo_so = "hijo", modo_so_explicit = TRUE,
         parent = "p1b", parent_col = "", text_col = "p1_other")
  ))

  out <- .codif_normalize_legacy_select_one_modes(sid, draft, data_df = data_df)

  # Fila legacy sin <text_col>_recod ni grupos: se migra a padre con rastro.
  expect_identical(out$rows[[1]]$modo_so, "padre")
  expect_identical(out$rows[[1]]$parent_col, "p1")
  expect_identical(out$rows[[1]]$modo_so_migrated_from, "hijo")

  # Elección explícita del analista se respeta.
  expect_identical(out$rows[[2]]$modo_so, "hijo")

  # La migración se persiste en el draft de la sesión.
  persisted <- codif_get(sid, "familias_draft")
  expect_identical(persisted$rows[[1]]$modo_so, "padre")

  # Con la columna hija recodificada presente en data, NO migra.
  sid2 <- session_create()
  data_recod <- cbind(data_df, `p1_other_recod` = c("", "901", "902"))
  draft2 <- list(rows = list(
    list(use = TRUE, tipo = "select_one", modo_so = "hijo",
         parent = "p1", parent_col = "", text_col = "p1_other")
  ))
  out2 <- .codif_normalize_legacy_select_one_modes(sid2, draft2, data_df = data_recod)
  expect_identical(out2$rows[[1]]$modo_so, "hijo")
})
