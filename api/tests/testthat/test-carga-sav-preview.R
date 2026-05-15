test_that("uploads SPSS con sufijo Finder .sav 2 se leen como .sav", {
  skip_if_not_installed("haven")

  tmp <- tempfile(fileext = ".sav")
  haven::write_sav(
    data.frame(
      q0001 = haven::labelled(c(1, 2), labels = c(Si = 1, No = 2)),
      q0002 = c("a", "b")
    ),
    tmp
  )
  bytes <- readBin(tmp, "raw", n = file.info(tmp)$size)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  meta <- save_upload(sid, "data", "encuesta.sav 2", bytes)
  expect_equal(meta$ext, "sav")

  preview <- read_data_preview(meta$path, meta$ext, n_preview = 2)
  expect_equal(preview$n_filas, 2L)
  expect_equal(preview$n_columnas, 2L)
  expect_equal(length(preview$preview_filas), 2L)
})

test_that("preview de .sav se alinea al contrato pN del XLSForm", {
  skip_if_not_installed("haven")

  tmp <- tempfile(fileext = ".sav")
  on.exit(unlink(tmp), add = TRUE)
  haven::write_sav(
    data.frame(
      respondent_id = c("r1", "r2"),
      p0001 = c(10, 11),
      q0001 = haven::labelled(c(1, 2), labels = c(Si = 1, No = 2)),
      q0007_0001 = haven::labelled(c(1, NA), labels = c(A = 1)),
      q0007_0002 = haven::labelled(c(NA, 1), labels = c(B = 1)),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    tmp
  )
  instrumento <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p1", "select_multiple lst_p7"),
      name = c("p1", "p7"),
      list_name = c("lst_p1", "lst_p7"),
      label = c("P1", "P7")
    ),
    choices = tibble::tibble(
      list_name = c("lst_p1", "lst_p1", "lst_p7", "lst_p7"),
      name = c("1", "2", "1", "2"),
      label = c("Si", "No", "A", "B")
    )
  )

  preview <- read_data_preview(tmp, "sav", n_preview = 2, instrumento = instrumento)

  expect_true(preview$normalizacion$applied)
  col_names <- vapply(preview$columnas, `[[`, character(1), "nombre")
  expect_equal(col_names[1:2], c("p1", "p7"))
  expect_equal(col_names[3:4], c("respondent_id", "p0001"))
  expect_equal(vapply(preview$columnas[1:2], `[[`, character(1), "origen"), c("xlsform", "xlsform"))
  expect_equal(vapply(preview$columnas[3:4], `[[`, character(1), "origen"), c("extra", "extra"))
  expect_equal(preview$n_columnas, 4L)
  expect_equal(preview$normalizacion$extra_columns, 2L)
  expect_true(isTRUE(preview$compatibilidad$ok))
  expect_equal(preview$compatibilidad$n_missing, 0L)
  expect_false(any(grepl("^q0007_", vapply(preview$columnas, `[[`, character(1), "nombre"))))
})

test_that("caso local ACRD ING colapsa p17/p32 y queda compatible", {
  skip_if_not_installed("haven")
  pulso <- "/Users/gonzaloalmendariz/Documents/Pulso/ACRD ING/Ingenieria.pulso"
  skip_if_not(file.exists(pulso))

  td <- tempfile("pulso-acrd-ing-")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(pulso, exdir = td)

  files <- list.files(td, recursive = TRUE, full.names = TRUE)
  xlsx <- files[grepl("\\.xlsx$", files, ignore.case = TRUE) &
                  !grepl("__MACOSX", files, fixed = TRUE)][1]
  sav <- files[grepl("\\.sav$", files, ignore.case = TRUE) &
                 !grepl("__MACOSX", files, fixed = TRUE)][1]
  skip_if(is.na(xlsx) || is.na(sav), "El .pulso local no trae XLSForm y .sav extraibles")

  inst <- reporte_instrumento(path = xlsx)
  out <- normalize_data_for_xlsform(haven::read_sav(sav), inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_true(isTRUE(compat$ok))
  expect_equal(compat$n_missing, 0L)
  expect_true(all(c("p17", "p32") %in% names(out)))
  expect_false(any(c("p17_1", "p32_1") %in% names(out)))
})

test_that("gate de carga bloquea bases incompatibles con codigo explicito", {
  inst <- list(
    survey = tibble::tibble(
      type = c("text", "integer"),
      name = c("p1", "p2")
    ),
    choices = tibble::tibble()
  )
  data <- data.frame(p1 = "ok", check.names = FALSE)

  err <- tryCatch(
    .carga_assert_data_xlsform_compatible(data, inst),
    error = function(e) e
  )

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_DATA_XLSFORM_INCOMPATIBLE")
})

test_that("cache de codificacion lee .sav adaptado al XLSForm normalizado", {
  skip_if_not_installed("haven")
  skip_if_not_installed("openxlsx")

  xlsx <- tempfile(fileext = ".xlsx")
  sav <- tempfile(fileext = ".sav")
  on.exit(unlink(c(xlsx, sav)), add = TRUE)

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "survey", data.frame(
    type = c("select_one lst_p1", "select_multiple lst_p7"),
    name = c("p1", "p7"),
    label = c("P1", "P7"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = c("lst_p1", "lst_p1", "lst_p7", "lst_p7"),
    name = c("1", "2", "1", "2"),
    label = c("Si", "No", "A", "B"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, xlsx, overwrite = TRUE)

  haven::write_sav(
    data.frame(
      q0001 = c(1, 2),
      q0007_0001 = haven::labelled(c(1, NA), labels = c(A = 1)),
      q0007_0002 = haven::labelled(c(NA, 1), labels = c(B = 1)),
      check.names = FALSE
    ),
    sav
  )

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  xmeta <- save_upload(sid, "xlsform", "form.xlsx", readBin(xlsx, "raw", n = file.info(xlsx)$size))
  dmeta <- save_upload(sid, "sav", "data.sav", readBin(sav, "raw", n = file.info(sav)$size))
  inst <- reporte_instrumento(xmeta$path)
  raw <- normalize_data_for_xlsform(haven::read_sav(dmeta$path), inst)
  rp_data <- reporte_data(raw, inst)
  estudio_add_base(
    sid,
    nombre = "default",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "sav",
    rp_data = rp_data,
    rp_inst = inst,
    n_filas = nrow(rp_data),
    n_columnas = ncol(rp_data)
  )

  data_cached <- codif_data_cached(sid, "default")

  expect_true(all(c("p1", "p7") %in% names(data_cached)))
  expect_false(any(grepl("^q[0-9]", names(data_cached))))
  expect_equal(as.character(data_cached$p7), c("1", "2"))
})

test_that("explorador grafica select_multiple en columna madre y dummies", {
  inst <- list(
    survey = tibble::tibble(
      type = "select_multiple lst_p19",
      name = "p19",
      list_name = "lst_p19",
      label = "IA usada"
    ),
    choices = tibble::tibble(
      list_name = c("lst_p19", "lst_p19"),
      name = c("3", "4"),
      label = c("Analítica avanzada", "Automatización")
    )
  )
  data_madre <- data.frame(p19 = c("3 4", "3", NA, ""), check.names = FALSE)
  data_dummies <- data.frame(`p19.3` = c(1, 1, NA, NA), `p19.4` = c(1, NA, NA, NA), check.names = FALSE)

  tab_madre <- .explorar_tab_frec_sm(data_madre, "p19", inst)
  tab_dummies <- .explorar_tab_frec_sm(data_dummies, "p19", inst)
  view_madre <- build_view_univariado(data_madre, "p19", inst)

  expect_equal(tab_madre$n[match(c("3", "4"), tab_madre$code)], c(2L, 1L))
  expect_equal(tab_dummies$n[match(c("3", "4"), tab_dummies$code)], c(2L, 1L))
  expect_true(isTRUE(view_madre$ok))
  expect_null(view_madre$chart$meta$empty_hint)
  expect_equal(view_madre$kpis[[2]]$meta$value, 2L)
})

test_that("explorador inventaria columnas haven_labelled sin choque de tipos", {
  data <- data.frame(
    q0001 = haven::labelled(c(1, 2, NA), labels = c(Si = 1, No = 2)),
    q0002 = c(10, NA, 30)
  )
  instrumento <- list(
    survey = tibble::tibble(
      type = c("select_one lst_q0001", "integer"),
      name = c("q0001", "q0002"),
      label = c("Pregunta etiquetada", "Número")
    ),
    choices = tibble::tibble(
      list_name = c("lst_q0001", "lst_q0001"),
      name = c("1", "2"),
      label = c("Si", "No")
    ),
    meta = list(section_map = NULL)
  )

  inv <- .explorar_inventario(data, instrumento)
  expect_equal(inv$n_variables, 2L)
  vars <- inv$secciones[[1]]$variables
  expect_equal(vars[[1]]$n_validos, 2L)
  expect_equal(vars[[1]]$n_nulos, 1L)
})

test_that("reemplazar archivos de una base invalida artefactos de procesamiento", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  bytes <- as.raw(c(0x50, 0x4B, 0x03, 0x04))
  x1 <- save_upload(sid, "xlsform", "a.xlsx", bytes)
  d1 <- save_upload(sid, "data", "a.xlsx", bytes)
  x2 <- save_upload(sid, "xlsform", "b.xlsx", bytes)
  d2 <- save_upload(sid, "data", "b.xlsx", bytes)

  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["default"]] <- list(
    nombre = "default",
    xlsform_file_id = x1$file_id,
    data_file_id = d1$file_id,
    data_ext = "xlsx",
    validacion = list(
      plan_result = list(plan = "viejo"),
      evaluacion = list(resumen = "viejo"),
      reglas_custom = list(list(id = "r1")),
      explorador_cache = list(k = "viejo"),
      limpieza_draft = list(list(id = "d1")),
      limpieza_preview = list(ok = TRUE),
      limpieza_artifacts = list(finalized_at = "ayer")
    )
  )
  s$plan_result <- list(plan = "viejo")
  s$evaluacion <- list(resumen = "viejo")
  .session_env[[sid]] <- s

  estudio_replace_base_files(
    sid,
    "default",
    xlsform_file_id = x2$file_id,
    data_file_id = d2$file_id,
    data_ext = "xlsx",
    rp_data = data.frame(x = 1),
    rp_inst = list(survey = data.frame())
  )

  s2 <- session_get(sid)
  expect_null(s2$plan_result)
  expect_null(s2$evaluacion)
  expect_null(s2$estudio$bases$default$validacion$plan_result)
  expect_null(s2$estudio$bases$default$validacion$evaluacion)
  expect_equal(s2$estudio$bases$default$validacion$reglas_custom, list())
  expect_equal(s2$estudio$bases$default$validacion$limpieza_artifacts, list())
})
