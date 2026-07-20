test_that("puente select_multiple conserva textos asignados a varias categorias", {
  skip_if_not_installed("openxlsx")

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "services")
  rows <- rbind(
    c("_uuid", "services/70_recod", "services/1_recod", "Control", NA),
    c("UUID", "Otro", "Salud", "Control", NA),
    c("u-1", 1, NA, NA, NA),
    c("u-2", 1, NA, NA, NA)
  )
  openxlsx::writeData(wb, "services", rows, colNames = FALSE)

  data <- data.frame(
    `_uuid` = c("u-1", "u-2"),
    services = c("70", "70"),
    services_other = c("transporte y salud", "solo salud"),
    check.names = FALSE
  )
  grupos <- list(
    list(
      id = "ex_1",
      codigo = "1",
      etiqueta = "Salud",
      origen = "existente",
      respuestas = list("transporte y salud", "solo salud")
    ),
    list(
      id = "g_2",
      codigo = "2",
      etiqueta = "Transporte",
      origen = "nuevo",
      respuestas = list("transporte y salud")
    )
  )

  expect_true(.patch_sm_sheet(
    wb = wb,
    sheet = "services",
    parent_col = "services",
    text_col = "services_other",
    grupos = grupos,
    data_df = data,
    other_dummy_col = "services/70"
  ))

  tmp <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, tmp, overwrite = TRUE)
  out <- openxlsx::readWorkbook(tmp, sheet = "services", colNames = FALSE)
  headers <- as.character(out[1, , drop = TRUE])
  col_other <- which(headers == "services/70_recod")
  col_salud <- which(headers == "services/1_recod")
  col_transporte <- which(headers == "services/2_recod")

  expect_length(col_transporte, 1)
  expect_equal(as.integer(out[3:4, col_other, drop = TRUE]), c(0L, 0L))
  expect_equal(as.integer(out[3:4, col_salud, drop = TRUE]), c(1L, 1L))
  expect_equal(as.integer(out[3:4, col_transporte, drop = TRUE]), c(1L, NA_integer_))

  inst_path <- file.path(dirname(tmp), "instrumento.xlsx")
  data_path <- file.path(dirname(tmp), "data.xlsx")
  fam_path <- file.path(dirname(tmp), "familias.xlsx")

  inst <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(inst, "survey")
  openxlsx::writeData(inst, "survey", data.frame(
    type = "select_multiple lst_services",
    name = "services",
    label = "Servicios",
    stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(inst, "choices")
  openxlsx::writeData(inst, "choices", data.frame(
    list_name = "lst_services",
    name = c("1", "70"),
    label = c("Salud", "Otros"),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(inst, inst_path, overwrite = TRUE)
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)
  openxlsx::write.xlsx(
    data.frame(parent = "services", text_col = "services_other", stringsAsFactors = FALSE),
    fam_path,
    overwrite = TRUE
  )

  adapted <- ppra_adaptar_data(
    path_instrumento = inst_path,
    path_datos = data_path,
    path_plantilla = tmp,
    sm_vars = "services",
    path_familias = fam_path
  )

  expect_equal(as.character(adapted$services_recod), c("1 2", "1"))
})
