# =============================================================================
# R1 (contrato E4-E7): una base .sav sin XLSForm entra al estudio con un
# instrumento sintetizado desde sus etiquetas, convive con otra base y sobrevive
# a guardar y reabrir el .pulso.
# =============================================================================

.sav_fixture_df <- function() {
  data.frame(
    p1 = haven::labelled(
      c(1, 2, 1, 98, 2, 99),
      labels = c("Sí" = 1, "No" = 2, "No sabe" = 98, "No responde" = 99),
      label = "¿Ha presenciado hostigamiento?"
    ),
    edad = haven::labelled(
      c(19, 22, 25, 99, 31, 20),
      labels = c("No responde" = 99),
      label = "Edad"
    ),
    horas = c(1.5, 2, 3.25, 0, 4, 2),
    comentario = c("a", "b", "", "c", "d", "e"),
    factor_ponderacion = c(0.8, 1.2, 1, 1.5, 0.5, 1),
    stringsAsFactors = FALSE
  )
}

.sav_fixture_bytes <- function(df = .sav_fixture_df()) {
  path <- tempfile(fileext = ".sav")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  haven::write_sav(df, path)
  readBin(path, "raw", n = file.info(path)$size)
}

.sav_xlsx_bytes <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  wb <- openxlsx::createWorkbook()
  for (nm in names(sheets)) {
    openxlsx::addWorksheet(wb, nm)
    openxlsx::writeData(wb, nm, sheets[[nm]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  readBin(path, "raw", n = file.info(path)$size)
}

# Primera base "2026" por la vía normal (XLSForm + data).
.sav_estudio_con_base_2026 <- function(sid) {
  survey <- data.frame(type = c("select_one sn", "integer"), name = c("q1", "q2"),
                       label = c("Q1", "Q2"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c("sn", "sn"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)
  data_df <- data.frame(q1 = c("1", "2", "1"), q2 = c(3, 4, 5), stringsAsFactors = FALSE)
  xmeta <- save_upload(sid, "xlsform", "inst_2026.xlsx",
                       .sav_xlsx_bytes(list(survey = survey, choices = choices)))
  dmeta <- save_upload(sid, "data", "data_2026.xlsx", .sav_xlsx_bytes(list(data = data_df)))
  inst <- reporte_instrumento(path = xmeta$path)
  df <- normalize_data_for_xlsform(.read_data_from_path(dmeta$path, "xlsx"), inst)
  estudio_add_base(sid, "2026", xmeta$file_id, dmeta$file_id, "xlsx",
                   reporte_data(df, instrumento = inst), inst,
                   n_filas = nrow(df), n_columnas = ncol(df))
}

test_that("sintetiza survey/choices desde las etiquetas del .sav", {
  skip_if_not_installed("haven")
  path <- tempfile(fileext = ".sav")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  writeBin(.sav_fixture_bytes(), path)
  df <- haven::read_sav(path)

  out <- carga_sav_sintetizar_xlsform(df, titulo = "2024")
  sv <- out$survey
  expect_equal(sv$name, c("p1", "edad", "horas", "comentario", "factor_ponderacion"))
  expect_equal(sv$type[sv$name == "p1"], "select_one l_p1")
  expect_equal(sv$label[sv$name == "p1"], "¿Ha presenciado hostigamiento?")
  # Solo especiales etiquetados + valores reales sin etiqueta => numérica.
  expect_equal(sv$type[sv$name == "edad"], "integer")
  expect_equal(sv$type[sv$name == "horas"], "decimal")
  expect_equal(sv$type[sv$name == "comentario"], "text")
  expect_equal(sv$type[sv$name == "factor_ponderacion"], "decimal")

  ch <- out$choices
  expect_equal(ch$name[ch$list_name == "l_p1"], c("1", "2", "98", "99"))
  expect_equal(ch$label[ch$list_name == "l_p1"], c("Sí", "No", "No sabe", "No responde"))
  expect_equal(out$resumen$n_select_one, 1L)
  expect_equal(out$settings$form_id, "2024")
})

test_that("sintetizar sin variables falla con E_BASE_SAV_SIN_VARIABLES", {
  err <- tryCatch(carga_sav_sintetizar_xlsform(data.frame()), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BASE_SAV_SIN_VARIABLES")
})

test_that("un .sav entra como segunda base y sobrevive al .pulso", {
  skip_if_not_installed("haven")
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .sav_estudio_con_base_2026(sid)

  sav <- save_upload(sid, "sav", "hsyvbg_2024.sav", .sav_fixture_bytes())
  out <- carga_sav_registrar_base(sid, sav$file_id, "2024")

  s <- session_get(sid)
  expect_setequal(names(s$estudio$bases), c("2026", "2024"))
  meta <- s$estudio$bases[["2024"]]
  expect_equal(meta$data_file_id, sav$file_id)
  expect_equal(meta$data_ext, "sav")
  expect_equal(meta$instrumento_origen, "sintetizado_sav")
  expect_equal(s$files[[meta$xlsform_file_id]]$kind, "xlsform")
  # La base activa sigue siendo la primera: registrar no la cambia.
  expect_equal(estudio_active_base(sid), "2026")

  inst <- s$rp_inst_sources[["2024"]]
  expect_equal(inst$survey$list_name[inst$survey$name == "p1"], "l_p1")
  expect_equal(inst$choices$name[inst$choices$list_name == "l_p1"], c("1", "2", "98", "99"))
  data_24 <- s$rp_data_sources[["2024"]]
  expect_equal(nrow(data_24), 6L)
  expect_true(all(c("p1", "edad", "factor_ponderacion") %in% names(data_24)))
  expect_equal(as.numeric(data_24$factor_ponderacion), c(0.8, 1.2, 1, 1.5, 0.5, 1))
  expect_setequal(as.character(stats::na.omit(unclass(data_24$p1))), c("1", "2", "98", "99"))
  # La hermana no se tocó.
  expect_equal(nrow(s$rp_data_sources[["2026"]]), 3L)

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp)
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  # Se borran los caches para probar que la base se RE-DERIVA de los archivos.
  s2 <- session_get(loaded$session_id)
  s2$rp_data_sources <- list()
  s2$rp_inst_sources <- list()
  .session_env[[loaded$session_id]] <- s2
  .pulso_rebuild_estudio_runtime_sources(loaded$session_id)

  data_sources <- estudio_data_sources(loaded$session_id)
  inst_sources <- estudio_inst_sources(loaded$session_id)
  expect_true(all(c("2024", "2026") %in% names(data_sources)))
  expect_equal(nrow(data_sources[["2024"]]), 6L)
  expect_true("factor_ponderacion" %in% names(data_sources[["2024"]]))
  sv24 <- inst_sources[["2024"]]$survey
  expect_equal(sv24$type[sv24$name == "p1"], "select_one")
  expect_equal(sv24$list_name[sv24$name == "p1"], "l_p1")
  expect_equal(sv24$type[sv24$name == "factor_ponderacion"], "decimal")
})

test_that("un archivo que no es .sav falla con E_BASE_SAV_NO_SAV", {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  meta <- save_upload(sid, "data", "data.xlsx",
                      .sav_xlsx_bytes(list(data = data.frame(a = 1))))
  err <- tryCatch(carga_sav_registrar_base(sid, meta$file_id, "x"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_BASE_SAV_NO_SAV")
  expect_equal(err$status, 400)
})

test_that("contrato HTTP de POST /api/estudio/base-sav", {
  skip_if_not_installed("haven")
  .http_contract_skip_if_unavailable()
  srv <- http_contract_server()

  r <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_equal(r$status, 200L)
  sid <- r$json$session_id

  sav_path <- tempfile(fileext = ".sav")
  on.exit(unlink(sav_path, force = TRUE), add = TRUE)
  writeBin(.sav_fixture_bytes(), sav_path)
  up <- http_post_multipart(srv, "/api/files/upload?kind=sav",
                            fields = list(file = curl::form_file(sav_path)), sid = sid)
  expect_equal(up$status, 201L)

  r2 <- http_post_json(srv, "/api/estudio/base-sav",
                       body = list(data_file_id = up$json$file_id, nombre = "2024"), sid = sid)
  expect_equal(r2$status, 200L)
  expect_true(isTRUE(r2$json$ok))
  expect_equal(r2$json$base$nombre, "2024")
  expect_true(nzchar(r2$json$xlsform_file_id))
  expect_equal(r2$json$sintesis$n_variables, 5L)
  expect_equal(r2$json$n_bases, 1L)

  bad <- http_post_json(srv, "/api/estudio/base-sav",
                        body = list(data_file_id = "no-existe", nombre = "x"), sid = sid)
  expect_equal(bad$status, 404L)
  expect_equal(bad$json$code %||% bad$json$error$code, "E_NO_FILE")
})
