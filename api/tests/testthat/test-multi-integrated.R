test_that("multi integrado audita y apila instrumentos hermanos manuales", {
  skip_if_not_installed("openxlsx")

  write_xls <- function(path, survey, choices) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "choices", choices)
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", data.frame(form_title = "test", stringsAsFactors = FALSE))
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  write_data <- function(path, df) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "datos")
    openxlsx::writeData(wb, "datos", df)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  upload_path <- function(sid, path, kind, name = basename(path)) {
    save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
  }

  sid <- session_create()
  dir <- tempdir()
  guide_xls <- file.path(dir, "guide_multi_integrated.xlsx")
  peer_xls <- file.path(dir, "peer_multi_integrated.xlsx")
  guide_data <- file.path(dir, "guide_multi_integrated_data.xlsx")
  peer_data <- file.path(dir, "peer_multi_integrated_data.xlsx")

  guide_survey <- data.frame(
    type = c("integer", "select_one yesno"),
    name = c("p1", "p2"),
    label = c("Edad", "Aprueba"),
    stringsAsFactors = FALSE
  )
  guide_choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )
  peer_survey <- data.frame(
    type = c("integer", "select_one yesno_peer", "text"),
    name = c("p1", "p2", "p3"),
    label = c("Edad del participante", "Aprueba el sello", "Pregunta solo Peru"),
    stringsAsFactors = FALSE
  )
  peer_choices <- data.frame(
    list_name = c("yesno_peer", "yesno_peer", "yesno_peer"),
    name = c("1", "2", "3"),
    label = c("Si", "No", "No sabe"),
    stringsAsFactors = FALSE
  )

  write_xls(guide_xls, guide_survey, guide_choices)
  write_xls(peer_xls, peer_survey, peer_choices)
  write_data(guide_data, data.frame(p1 = c(20, 30), p2 = c("1", "2"), stringsAsFactors = FALSE))
  write_data(peer_data, data.frame(p1 = c(40), p2 = c("3"), p3 = c("extra"), stringsAsFactors = FALSE))

  guide_meta <- upload_path(sid, guide_xls, "xlsform")
  peer_meta <- upload_path(sid, peer_xls, "xlsform")
  guide_data_meta <- upload_path(sid, guide_data, "data")
  peer_data_meta <- upload_path(sid, peer_data, "data")

  origins <- list(
    list(source_kind = "manual", key_value = "Chile", label = "Chile",
         xlsform_file_id = guide_meta$file_id, data_file_id = guide_data_meta$file_id),
    list(source_kind = "manual", key_value = "Peru", label = "Peru",
         xlsform_file_id = peer_meta$file_id, data_file_id = peer_data_meta$file_id)
  )

  audit <- .mi_audit(sid, guide_meta$file_id, origins, "pais")
  expect_equal(audit$origin_key_name, "pais")
  expect_true(audit$ok)
  expect_true(audit$n_pending >= 3)
  expect_true(any(vapply(audit$diffs, function(x) identical(x$kind, "wording"), logical(1))))
  expect_true(any(vapply(audit$diffs, function(x) identical(x$kind, "options_variant"), logical(1))))
  expect_true(any(vapply(audit$diffs, function(x) identical(x$kind, "extra_question"), logical(1))))

  result <- multi_integrated_import(
    sid = sid,
    guide_xlsform_file_id = guide_meta$file_id,
    origins = origins,
    origin_key_name = "pais",
    base_name = "integrada_test",
    decisions = list(
      resolved_ids = vapply(
        Filter(function(x) isTRUE(x$needs_decision), audit$diffs),
        `[[`, character(1), "id"
      ),
      label_overrides = list(p1 = "Edad estandar final")
    )
  )

  expect_true(result$ok)
  expect_equal(result$n_filas, 3)
  expect_true("integrada_test" %in% names(estudio_list_bases(sid)))
  data_meta <- get_file(sid, result$base$data_file_id)
  out <- readxl::read_excel(data_meta$path)
  expect_identical(names(out)[1], "pais")
  expect_true(any(grepl("^p2_peru", names(out))))
  expect_true(any(grepl("^p3_peru", names(out))))

  inst_meta <- get_file(sid, result$base$xlsform_file_id)
  inst_out <- reporte_instrumento(inst_meta$path)
  key_row <- inst_out$survey[as.character(inst_out$survey$name) == "pais", , drop = FALSE]
  expect_equal(key_row$type[[1]], "select_one")
  expect_true(nzchar(key_row$list_name[[1]]))
  expect_equal(unname(inst_out$dicc_code_to_label[[key_row$list_name[[1]]]]), c("Chile", "Peru"))
  expect_equal(result$base$multi_integrated$label_overrides_standard$p1, "Edad estandar final")
  expect_true(any(as.character(inst_out$survey$label) == "Edad estandar final"))
})

test_that("el .pulso conserva insumos del borrador multi integrado", {
  sid <- session_create()
  s <- session_get(sid)
  s$multi_integrated_draft <- list(
    guide_xlsform_file_id = "guide-file",
    guide_options = list(list(file_id = "guide-option")),
    rows = list(
      list(xlsform_file_id = "xls-a", data_file_id = "data-a"),
      list(xlsformFileId = "xls-b", dataFileId = "data-b")
    )
  )
  .session_env[[sid]] <- s

  fids <- .pulso_collect_input_fids(session_get(sid))
  expect_true(all(c("guide-file", "guide-option", "xls-a", "data-a", "xls-b", "data-b") %in% fids))
})

test_that("alineador multi ignora nombres vacios del XLSForm", {
  rp_inst <- list(survey = data.frame(
    type = c("text", "note", "text", "text"),
    name = c("p1", NA, "", "p2"),
    stringsAsFactors = FALSE
  ))
  cols <- .mi_data_cols(rp_inst, "pais")
  expect_equal(cols, c("pais", "p1", "p2"))
  out <- .mi_align_data(data.frame(p1 = "a", stringsAsFactors = FALSE), cols)
  expect_equal(names(out), c("pais", "p1", "p2"))
})

test_that("alineador multi tolera origenes sin filas importadas", {
  cols <- c("pais", "p1", "p2")
  empty <- data.frame(stringsAsFactors = FALSE)
  out <- .mi_align_data(empty, cols)
  expect_equal(nrow(out), 0L)
  expect_equal(names(out), cols)
})

test_that("variantes multi quedan en la posicion y seccion de la pregunta guia", {
  skip_if_not_installed("openxlsx")

  write_xls <- function(path, survey, choices) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "choices", choices)
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", data.frame(form_title = "test", stringsAsFactors = FALSE))
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  write_data <- function(path, df) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "datos")
    openxlsx::writeData(wb, "datos", df)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  upload_path <- function(sid, path, kind, name = basename(path)) {
    save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
  }

  sid <- session_create()
  dir <- tempdir()
  guide_xls <- file.path(dir, "guide_variant_order.xlsx")
  peer_xls <- file.path(dir, "peer_variant_order.xlsx")
  guide_data <- file.path(dir, "guide_variant_order_data.xlsx")
  peer_data <- file.path(dir, "peer_variant_order_data.xlsx")
  guide_survey <- data.frame(
    type = c("begin_group", "select_one lst_p9", "select_one lst_p10_mx", "text", "select_one lst_p11", "end_group"),
    name = c("Pag4", "p9", "p10", "p10_other", "p11", NA),
    label = c("Pag4", "Pregunta previa", "Empresa", "Otro", "Pregunta posterior", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  guide_choices <- data.frame(
    list_name = c("lst_p9", "lst_p10_mx", "lst_p11"),
    name = c("1", "1", "1"),
    label = c("Si", "Empresa Mexico", "Si"),
    stringsAsFactors = FALSE
  )
  peer_survey <- guide_survey
  peer_survey$type[3] <- "select_one lst_p10_pe"
  peer_survey$label[3] <- "Empresa Peru"
  peer_choices <- guide_choices
  peer_choices$list_name[2] <- "lst_p10_pe"
  peer_choices$label[2] <- "Empresa Peru"

  write_xls(guide_xls, guide_survey, guide_choices)
  write_xls(peer_xls, peer_survey, peer_choices)
  write_data(guide_data, data.frame(p9 = "1", p10 = "1", p10_other = NA_character_, p11 = "1", stringsAsFactors = FALSE))
  write_data(peer_data, data.frame(p9 = "1", p10 = "1", p10_other = NA_character_, p11 = "1", stringsAsFactors = FALSE))
  guide_meta <- upload_path(sid, guide_xls, "xlsform")
  peer_meta <- upload_path(sid, peer_xls, "xlsform")
  guide_data_meta <- upload_path(sid, guide_data, "data")
  peer_data_meta <- upload_path(sid, peer_data, "data")

  origins <- list(
    list(id = "o_mexico", source_kind = "manual", key_value = "Mexico", label = "Mexico",
         xlsform_file_id = guide_meta$file_id, data_file_id = guide_data_meta$file_id),
    list(id = "o_peru", source_kind = "manual", key_value = "Peru", label = "Peru",
         xlsform_file_id = peer_meta$file_id, data_file_id = peer_data_meta$file_id)
  )
  origin_specs <- .mi_origin_specs(origins)
  audit <- list(
    origin_key_name = "pais",
    company_variables = list(),
    diffs = list(
      list(id = "mexico::p10::options_variant", origin_id = origin_specs[[1]]$id, origin_key = "Mexico",
           source_kind = "manual", kind = "options_variant", variable = "p10",
           suggested_name = "p10_mexico", suggested_label = "Empresa - Mexico",
           replace_source = TRUE, pos = 2L),
      list(id = "peru::p10::options_variant", origin_id = origin_specs[[2]]$id, origin_key = "Peru",
           source_kind = "manual", kind = "options_variant", variable = "p10",
           suggested_name = "p10_peru", suggested_label = "Empresa - Peru",
           replace_source = FALSE, pos = 2L)
    )
  )

  built <- .mi_build_instrument(
    sid = sid,
    guide_file_id = guide_meta$file_id,
    origins = origins,
    audit = audit,
    decisions = list(resolved_ids = c("mexico::p10::options_variant", "peru::p10::options_variant"))
  )
  names_out <- as.character(built$survey$name)
  names_out <- names_out[!is.na(names_out)]

  expect_true(all(c("Pag4", "p9", "p10_mexico", "p10_mexico_other", "p10_peru", "p10_peru_other", "p11") %in% names_out))
  expect_false("p10" %in% names_out)
  expect_false("p10_other" %in% names_out)
  expect_lt(match("p9", names_out), match("p10_mexico", names_out))
  expect_lt(match("p10_peru_other", names_out), match("p11", names_out))
})

test_that("word de fraseos conserva referencias completas y bloques juntos", {
  skip_if_not_installed("officer")

  ref <- paste(
    "Existen suficientes incentivos para postular a la Norma Mexicana en",
    "Igualdad Laboral y No Discriminacion y se espera que la pregunta",
    "completa aparezca sin cortes en el documento."
  )
  audit <- list(
    n_origins = 4,
    origin_key_name = "pais",
    origins = list(
      list(key_value = "Mexico"),
      list(key_value = "Peru"),
      list(key_value = "Chile"),
      list(key_value = "Colombia")
    ),
    diffs = list(
      list(
        id = "peru::p14_4::wording",
        kind = "surveymonkey_wording",
        variable = "p14_4",
        suggested_name = "p14_4",
        ref_origin_key = "Mexico",
        ref = ref,
        origin_key = "Peru",
        current = paste(
          "Existen suficientes incentivos para postular a la Marca de Certificacion",
          "Empresa Segura, Libre de Violencia y Discriminacion contra la Mujer y se",
          "espera que la pregunta completa aparezca sin cortes en el documento."
        )
      ),
      list(
        id = "chile::p14_4::wording",
        kind = "surveymonkey_wording",
        variable = "p14_4",
        suggested_name = "p14_4",
        ref_origin_key = "Mexico",
        ref = ref,
        origin_key = "Chile",
        current = paste(
          "Existen suficientes incentivos para postular al Sello Iguala Conciliacion",
          "/ NCh3262 y se espera que la pregunta completa aparezca sin cortes en el documento."
        )
      ),
      list(
        id = "colombia::p14_4::wording",
        kind = "surveymonkey_wording",
        variable = "p14_4",
        suggested_name = "p14_4",
        ref_origin_key = "Mexico",
        ref = ref,
        origin_key = "Colombia",
        current = paste(
          "Existen suficientes incentivos para postular al Sello En igualdad y se",
          "espera que la pregunta completa aparezca sin cortes en el documento."
        )
      )
    )
  )

  out <- tempfile(fileext = ".docx")
  .mi_decisions_docx(audit, list(), out)
  xml <- paste(readLines(unz(out, "word/document.xml"), warn = FALSE), collapse = "\n")

  expect_true(all(vapply(
    c("Mexico", "Peru", "Chile", "Colombia"),
    function(key) grepl(key, xml, fixed = TRUE),
    logical(1)
  )))
  expect_true(grepl("pregunta completa aparezca sin cortes", xml, fixed = TRUE))
  expect_true(grepl("w:fill=\"FFF2A8\"", xml, fixed = TRUE))
  expect_true(length(gregexpr("<w:keepNext/>", xml, fixed = TRUE)[[1]]) >= 4L)
})

test_that("multi integrado conserva profile_id desde las rutas hasta SurveyMonkey", {
  expect_true("profile_id" %in% names(formals(.mi_audit)))
  expect_true("profile_id" %in% names(formals(multi_integrated_import)))

  audit_src <- paste(deparse(body(.mi_audit), width.cutoff = 500L), collapse = "\n")
  import_src <- paste(deparse(body(multi_integrated_import), width.cutoff = 500L), collapse = "\n")
  expect_match(
    audit_src,
    '.connections_token_require("surveymonkey", sid, profile_id = profile_id)',
    fixed = TRUE
  )
  expect_match(import_src, "profile_id = profile_id", fixed = TRUE)
  expect_match(
    import_src,
    '.connections_token_require("surveymonkey", sid, profile_id = profile_id)',
    fixed = TRUE
  )

  routes <- paste(deparse(body(mount_multi_integrated), width.cutoff = 500L), collapse = "\n")
  expect_match(routes, "parsed$connection_profile_id", fixed = TRUE)
  expect_match(routes, "parsed$connectionProfileId", fixed = TRUE)
  expect_match(routes, "parsed$profile_id", fixed = TRUE)
  expect_match(routes, "parsed$profileId", fixed = TRUE)
  expect_match(routes, "profile_id = profile_id", fixed = TRUE)
})
