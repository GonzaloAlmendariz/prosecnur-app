# El lector del editor ante columnas sin encabezado (ítem 47 del checklist de
# exportación del formulario). Tres instrumentos reales del corpus —un
# consolidado y dos adaptaciones— traían una columna con contenido y la celda
# de encabezado vacía; `out[[""]]` hacía caer la importación entera con
# «replacement has 0 rows». Una columna sin encabezado no es una columna de
# XLSForm: se ignora, y el resto de la hoja se lee igual.

.xlsx_con_columna_sin_encabezado <- function() {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  survey <- data.frame(
    type = c("text", "integer"),
    name = c("nombre", "edad"),
    label = c("Nombre", "Edad"),
    x = c("nota suelta", "otra nota"),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "survey", survey)
  # Borra el encabezado de la 4.ª columna: la celda queda vacía y su
  # contenido debajo se conserva, como en los archivos reales.
  openxlsx::writeData(wb, "survey", data.frame(x = NA), startCol = 4, startRow = 1, colNames = FALSE)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(list_name = "sn", name = "1", label = "Sí"))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

test_that("una columna sin encabezado con contenido no tumba la lectura de la hoja", {
  path <- .xlsx_con_columna_sin_encabezado()
  on.exit(unlink(path), add = TRUE)
  df <- .xlsform_editor_read_sheet(path, "survey")
  expect_s3_class(df, "data.frame")
  expect_identical(names(df), c("type", "name", "label"))
  expect_identical(df$name, c("nombre", "edad"))
  expect_identical(df$label, c("Nombre", "Edad"))
})

test_that("las columnas con nombre repetido se leen por posición sin pisarse", {
  df <- data.frame(a = c("1", NA), b = c(NA, "2"), stringsAsFactors = FALSE)
  names(df) <- c("label", "label")
  out <- .xlsform_editor_df_to_char(df)
  expect_identical(ncol(out), 2L)
  expect_identical(unname(out[[1]]), c("1", ""))
  expect_identical(unname(out[[2]]), c("", "2"))
})
