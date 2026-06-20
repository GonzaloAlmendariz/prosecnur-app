test_that("base panel genera wide, auditoria y frecuencias con select_multiple", {
  inst <- list(
    survey = data.frame(
      type = c("text", "select_one yesno", "select_multiple medios", "select_multiple medios", "select_one nse"),
      name = c("numero_encuesta", "p21", "p_multi", "canales", "nse_inei"),
      label = c("Numero de encuesta", "Aprueba", "Medios usados", "Canales usados", "NSE atribuido"),
      list_name = c("", "yesno", "medios", "medios", "nse"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno", "medios", "medios", "nse", "nse", "nse"),
      name = c("1", "2", "1", "2", "A", "B", "SIN DATA"),
      label = c("Si", "No", "TV", "Radio", "A", "B", "SIN DATA"),
      stringsAsFactors = FALSE
    )
  )

  ola1 <- data.frame(
    numero_encuesta = c("1", "2", "2", "3"),
    p21 = c("1", "2", "1", "1"),
    p_multi.1 = c(1, 0, 1, 1),
    p_multi.2 = c(0, 1, 0, 1),
    canales = c("1", "2", "1 2", ""),
    nse_inei = c("A", "SIN DATA", "B", "A"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  ola2 <- data.frame(
    numero_encuesta = c("1", "3", "4"),
    p21 = c("2", "1", "2"),
    p_multi.1 = c(0, 1, 1),
    p_multi.2 = c(1, 1, 0),
    canales = c("1 2", "2", "1"),
    nse_inei = c("A", "B", "SIN DATA"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  attr(ola1$p21, "label") <- "Aprueba"
  attr(ola2$p21, "label") <- "Aprueba"
  attr(ola1$p21, "labels") <- c(Si = "1", No = "2")
  attr(ola2$p21, "labels") <- c(Si = "1", No = "2")
  attr(ola1$p_multi.1, "label") <- "Medios usados = TV"
  attr(ola1$p_multi.2, "label") <- "Medios usados = Radio"
  attr(ola2$p_multi.1, "label") <- "Medios usados = TV"
  attr(ola2$p_multi.2, "label") <- "Medios usados = Radio"
  attr(ola1$canales, "label") <- "Canales usados"
  attr(ola2$canales, "label") <- "Canales usados"
  attr(ola1$canales, "labels") <- c(TV = "1", Radio = "2")
  attr(ola2$canales, "labels") <- c(TV = "1", Radio = "2")

  data_sources <- list(ola_1 = ola1, ola_2 = ola2)
  inst_sources <- list(ola_1 = inst, ola_2 = inst)

  info_cfg <- .panel_config_resolve(data_sources, list())
  expect_equal(info_cfg$key, "numero_encuesta")
  expect_equal(vapply(info_cfg$waves, `[[`, character(1), "suffix"), c("ola1", "ola2"))

  built <- .panel_wide_build(data_sources, inst_sources, list())

  expect_true(all(c("numero_encuesta", "p21_ola1", "p21_ola2", "p_multi.1_ola1", "p_multi.2_ola2") %in% names(built$base_wide)))
  expect_equal(built$summary$n_panel_keys, 4)
  expect_equal(built$summary$n_complete_keys, 2)
  expect_true(any(built$audit$tipo == "llave_duplicada"))
  expect_true(any(built$audit$tipo == "ola_faltante"))
  expect_true(any(built$frequencies$variable_original == "p_multi"))
  expect_true(any(grepl("SIN DATA", built$cobertura_nse$observacion, fixed = TRUE)))

  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  expect_true(file.exists(out))
  expect_true(all(c("base_wide", "libro_codigos", "frecuencias", "auditoria_panel", "cobertura_nse", "configuracion") %in% openxlsx::getSheetNames(out)))

  out_wide <- tempfile(fileext = ".xlsx")
  .panel_export_wide_xlsx(built, out_wide, valores = "ambos", multi_select = "dummy_01")
  expect_equal(openxlsx::getSheetNames(out_wide), c("codigos", "etiquetas"))
  wide_head <- openxlsx::readWorkbook(out_wide, sheet = "codigos", colNames = FALSE, rows = 1)
  expect_true(any(unlist(wide_head, use.names = FALSE) == "p21_ola1"))

  out_csv <- tempfile(fileext = ".csv")
  .panel_export_wide_csv(built, out_csv, valores = "etiquetas", multi_select = "dummy_01")
  expect_true(file.exists(out_csv))
  expect_true(grepl("p21_ola1", readLines(out_csv, n = 1, warn = FALSE)))

  old_writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = NA_character_)
  Sys.setenv(PROSECNUR_SAV_WRITER = "haven")
  on.exit({
    if (is.na(old_writer)) Sys.unsetenv("PROSECNUR_SAV_WRITER") else Sys.setenv(PROSECNUR_SAV_WRITER = old_writer)
  }, add = TRUE)
  out_sav <- tempfile(fileext = ".sav")
  .panel_export_wide_sav(built, out_sav)
  expect_true(file.exists(out_sav))
  sav_read <- haven::read_sav(out_sav)
  expect_true(all(c("numero_encuesta", "p21_ola1", "p21_ola2") %in% names(sav_read)))
  expect_false("canales_ola1" %in% names(sav_read))
  expect_true(all(c("canales_ola1___1", "canales_ola1___2") %in% names(sav_read)))
  expect_equal(attr(sav_read$canales_ola1___1, "label", exact = TRUE), "[Ola 1] Canales usados = TV")
  expect_equal(attr(sav_read$canales_ola1___1, "labels", exact = TRUE)[["Si"]], 1)
})

test_that("base panel respeta toggles de hojas auxiliares", {
  inst <- list(survey = data.frame(type = c("text", "text"), name = c("numero_encuesta", "p1"), label = c("Numero", "P1"), stringsAsFactors = FALSE))
  data_sources <- list(
    a = data.frame(numero_encuesta = c("1", "2"), p1 = c("x", "y"), stringsAsFactors = FALSE),
    b = data.frame(numero_encuesta = c("1", "2"), p1 = c("z", "w"), stringsAsFactors = FALSE)
  )
  built <- .panel_wide_build(
    data_sources,
    list(a = inst, b = inst),
    list(outputs = list(codebook = FALSE, frecuencias = FALSE, auditoria = FALSE, cobertura_nse = FALSE))
  )
  out <- tempfile(fileext = ".xlsx")
  .panel_write_xlsx(built, out)
  expect_equal(openxlsx::getSheetNames(out), c("base_wide", "configuracion"))
})
