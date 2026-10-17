# El SAV no se cae con una columna etiquetada cuyos datos son texto.

test_that("una columna haven_labelled de texto se escribe como numérica con sus etiquetas", {
  skip_if_not_installed("haven")
  x <- haven::labelled(c("1", "2", "1", NA), labels = c("Sí" = "1", "No" = "2"), label = "¿Algo?")
  df <- data.frame(id = 1:4)
  df$p1 <- x
  p <- tempfile(fileext = ".sav")
  on.exit(unlink(p), add = TRUE)
  withr::local_envvar(PROSECNUR_SAV_WRITER = "haven")
  .bases_export_sav(df, NULL, p, NULL)
  leida <- haven::read_sav(p)
  expect_identical(as.numeric(leida$p1), c(1, 2, 1, NA))
  expect_identical(unname(attr(leida$p1, "labels")), c(1, 2))
})

test_that("una columna de texto con formato de fecha se escribe como fecha y el .sav se relee", {
  skip_if_not_installed("haven")
  df <- data.frame(id = 1:3, date = c("2025-09-08", "2025-09-09", NA), raro = c("ayer", "hoy", NA),
                   stringsAsFactors = FALSE)
  attr(df$date, "format.spss") <- "DATE11"
  attr(df$raro, "format.spss") <- "DATE11"
  p <- tempfile(fileext = ".sav")
  on.exit(unlink(p), add = TRUE)
  withr::local_envvar(PROSECNUR_SAV_WRITER = "haven")
  .bases_export_sav(df, NULL, p, NULL)
  leida <- haven::read_sav(p)
  expect_s3_class(leida$date, "Date")
  expect_identical(format(leida$date[1]), "2025-09-08")
  expect_identical(leida$raro[1], "ayer")
})
