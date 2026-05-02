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
