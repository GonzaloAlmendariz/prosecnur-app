# Un código con cero inicial es un código, no un número (ítem 14 del checklist
# de Validación usada por un practicante, 2026-11-12).
#
# Caso medido: un ubigeo bien escrito ("080105") llegaba a Validación como
# 80105 y una regla de rango lo marcaba igual que a los mal digitados: 98
# falsos positivos. Los datos de este test son inventados.

.cci_csv <- function() {
  path <- tempfile(fileext = ".csv")
  writeLines(c(
    "nro,ubigeo,edad,dni,ingreso,nota",
    "1,080105,20,07654321,1500.5,",
    "2,150133,35,12345678,0,sin dato",
    "3,040101,41,40123456,2300,"
  ), path, useBytes = TRUE)
  path
}

test_that("un CSV conserva como texto las columnas con cero inicial", {
  path <- .cci_csv()
  on.exit(unlink(path), add = TRUE)
  lectores <- list(
    desde_ruta = .read_data_from_path(path, "csv"),
    cualquier_ruta = .read_data_any_path(path, "csv"),
    vista_previa = NULL
  )
  prev <- read_data_preview(path, "csv")
  tipos_prev <- vapply(prev$columnas, function(c) c$tipo, character(1))
  names(tipos_prev) <- vapply(prev$columnas, function(c) c$nombre, character(1))
  expect_identical(unname(tipos_prev[c("ubigeo", "dni")]), c("character", "character"))
  expect_identical(prev$preview_filas[[1]]$ubigeo, "080105")

  for (df in Filter(Negate(is.null), lectores)) {
    expect_identical(df$ubigeo, c("080105", "150133", "040101"))
    expect_identical(df$dni, c("07654321", "12345678", "40123456"))
    # Lo que no lleva cero inicial sigue siendo número, como antes.
    expect_true(is.numeric(df$nro))
    expect_true(is.numeric(df$edad))
    expect_equal(df$ingreso, c(1500.5, 0, 2300))
    expect_identical(df$nota, c("", "sin dato", ""))
  }
})

test_that("una pregunta declarada texto llega como texto aunque la celda sea número", {
  inst <- list(
    survey = data.frame(type = c("text", "integer", "text"),
                        name = c("telefono", "edad", "ubigeo"),
                        label = c("Teléfono", "Edad", "Ubigeo"), stringsAsFactors = FALSE),
    choices = data.frame()
  )
  datos <- data.frame(telefono = c(987654321, NA, 912345678), edad = c(20, 35, 41),
                      ubigeo = c("080105", "150133", NA), stringsAsFactors = FALSE)
  out <- normalize_data_for_xlsform(datos, inst)
  expect_identical(out$telefono, c("987654321", NA, "912345678"))
  expect_identical(out$ubigeo, c("080105", "150133", NA))
  expect_true(is.numeric(out$edad))
})

# Guarda (pasó en verde desde el inicio): en un libro de Excel con el ubigeo en
# celdas de texto, la lectura ya lo conserva. El cero se pierde después, en una
# regla que compara el código como número.
test_that("un libro de Excel con el código en celdas de texto lo conserva", {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  openxlsx::write.xlsx(list(Base = data.frame(nro = c("1", "2"), ubigeo = c("080105", "80105"),
                                              stringsAsFactors = FALSE)), path)
  inst <- list(survey = data.frame(type = c("integer", "integer"), name = c("nro", "ubigeo"),
                                   label = c("N", "Ubigeo"), stringsAsFactors = FALSE),
               choices = data.frame())
  df <- normalize_data_for_xlsform(.read_data_any_path(path, "xlsx"), inst)
  expect_identical(df$ubigeo, c("080105", "80105"))
})
