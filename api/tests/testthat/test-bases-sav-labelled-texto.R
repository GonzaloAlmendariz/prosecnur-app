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
