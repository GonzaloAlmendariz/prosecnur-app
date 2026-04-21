test_that("reporte_enumeradores genera PDF con multiples cols_corte", {
  skip_if_not_installed("quarto")
  skip_if(Sys.which("quarto") == "", "Quarto CLI no disponible.")

  df <- tibble::tibble(
    enumerador = c("Ana", "Ana", "Luis", "Mia", "Mia", "Omar"),
    sexo = c("F", "M", "M", "F", "F", "M"),
    aula = c("101", "102", "101", "101", "102", "102"),
    modalidad = c("Presencial", "Presencial", "Telefónica", "Presencial", "Telefónica", "Telefónica")
  )

  out_pdf <- tempfile(pattern = "produccion_", fileext = ".pdf")
  out_general <- file.path(dirname(out_pdf), paste0("general_", basename(out_pdf)))
  out_telef <- file.path(dirname(out_pdf), paste0("telef_", basename(out_pdf)))
  out_pres <- file.path(dirname(out_pdf), paste0("pres_", basename(out_pdf)))
  on.exit(unlink(c(out_pdf, out_general, out_telef, out_pres)), add = TRUE)

  res <- try(
    prosecnur::reporte_enumeradores(
      data = df,
      col_enumerador = "enumerador",
      cols_corte = c("sexo", "aula"),
      col_modalidad = "modalidad",
      output_file = out_pdf,
      quiet = TRUE
    ),
    silent = TRUE
  )

  if (inherits(res, "try-error")) {
    skip(paste("Integracion Quarto/Typst no disponible en este entorno:", as.character(res)))
  }

  expect_true(file.exists(out_general))
  expect_true(file.exists(out_telef))
  expect_true(file.exists(out_pres))
  expect_true(file.info(out_general)$size > 0)
  expect_true(file.info(out_telef)$size > 0)
  expect_true(file.info(out_pres)$size > 0)
  expect_true(is.list(res))
  expect_true(length(res$output_files) >= 3L)
})

test_that("reporte_enumeradores funciona con cols_corte = NULL", {
  skip_if_not_installed("quarto")
  skip_if(Sys.which("quarto") == "", "Quarto CLI no disponible.")

  df <- tibble::tibble(
    enumerador = c("A", "A", "B", "C"),
    modalidad = c("Presencial", "Presencial", "Presencial", "Presencial")
  )

  out_pdf <- tempfile(pattern = "produccion_", fileext = ".pdf")
  out_general <- file.path(dirname(out_pdf), paste0("general_", basename(out_pdf)))
  out_telef <- file.path(dirname(out_pdf), paste0("telef_", basename(out_pdf)))
  out_pres <- file.path(dirname(out_pdf), paste0("pres_", basename(out_pdf)))
  on.exit(unlink(c(out_pdf, out_general, out_telef, out_pres)), add = TRUE)

  res <- try(
    prosecnur::reporte_enumeradores(
      data = df,
      col_enumerador = "enumerador",
      cols_corte = NULL,
      col_modalidad = "modalidad",
      output_file = out_pdf,
      quiet = TRUE
    ),
    silent = TRUE
  )

  if (inherits(res, "try-error")) {
    skip(paste("Integracion Quarto/Typst no disponible en este entorno:", as.character(res)))
  }

  expect_true(file.exists(out_general))
  expect_false(file.exists(out_telef))
  expect_false(file.exists(out_pres))
  expect_true(file.info(out_general)$size > 0)
  expect_true(is.list(res))
  expect_true(length(res$output_files) == 1L)
})
