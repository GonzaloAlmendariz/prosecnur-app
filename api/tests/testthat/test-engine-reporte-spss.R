test_that("reporte_spss genera un .sps complementario cuando se solicita", {
  skip_if_not_installed("haven")
  skip_if_not_installed("hms")

  path_sav <- tempfile(fileext = ".sav")
  path_sps <- tempfile(fileext = ".sps")
  on.exit(unlink(c(path_sav, path_sps)), add = TRUE)

  df <- data.frame(
    q1 = c("1", "2", NA),
    score = c(10.25, 8.50, NA),
    `_uuid` = c("a", "b", "c"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  labs_q1 <- c("Muy satisfecho", "Insatisfecho")
  names(labs_q1) <- c("1", "2")

  attr(df$q1, "labels") <- labs_q1
  attr(df$q1, "label") <- "Nivel de satisfaccion"
  attr(df$q1, "measure") <- "ordinal"
  attr(df$score, "label") <- "Puntaje"
  attr(df$score, "measure") <- "scale"

  out <- NULL
  expect_message({
    out <- prosecnur::reporte_spss(
      data = df,
      path_sav = path_sav,
      path_sps = path_sps,
      decimales_2 = "score"
    )
  }, "Archivo SPSS guardado en:")

  expect_true(is.data.frame(out))
  expect_true("uuid" %in% names(out))
  expect_true(file.exists(path_sav))
  expect_true(file.exists(path_sps))

  sav <- haven::read_sav(path_sav)
  expect_true("uuid" %in% names(sav))
  expect_false("_uuid" %in% names(sav))

  sps <- readLines(path_sps, warn = FALSE)
  expect_true(any(grepl("^VARIABLE LEVEL q1 \\(ORDINAL\\)\\.$", sps)))
  expect_true(any(grepl("^VARIABLE LEVEL score \\(SCALE\\)\\.$", sps)))
  expect_true(any(grepl("^FORMATS ALL \\(F8\\.0\\)\\.$", sps)))
  expect_true(any(grepl("^FORMATS score \\(F8\\.2\\)\\.$", sps)))
})

test_that("reporte_spss valida path_sps vacio", {
  df <- data.frame(q1 = 1, stringsAsFactors = FALSE)

  expect_error(
    prosecnur::reporte_spss(df, path_sav = tempfile(fileext = ".sav"), path_sps = ""),
    "ruta no vacia"
  )
})
