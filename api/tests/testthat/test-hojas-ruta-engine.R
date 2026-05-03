test_that("hojas_ruta_detectar_campos valida columnas canonicas", {
  df <- data.frame(
    UMP = 1,
    IDMANZANA = "15011005900015A",
    ESTRATO = "Lima Norte",
    VIVIENDAS = 30,
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = 1,
    FE = 6,
    sexo = "H",
    edad = "18-29",
    stringsAsFactors = FALSE
  )
  out <- hojas_ruta_detectar_campos(df)
  expect_true(out$ok)
  expect_equal(out$missing, list())

  df$IDMANZANA <- "150"
  out_bad <- hojas_ruta_detectar_campos(df)
  expect_false(out_bad$ok)
  expect_equal(out_bad$invalid[[1]]$campo, "IDMANZANA")
})

test_that("hojas_ruta_preview arma codigos de mapa y cuotas", {
  df <- data.frame(
    UMP = c(1, 2),
    IDMANZANA = c("15011005900015A", "15013500200026"),
    ESTRATO = "Lima",
    VIVIENDAS = c(30, 28),
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = c(1, 7),
    FE = c(6, 12),
    sexo = c("H", "M"),
    edad = c("18-29", "30-44"),
    stringsAsFactors = FALSE
  )
  out <- hojas_ruta_preview(df, list(row_var = "sexo", col_var = "edad", cartografia_dir = tempdir()))
  expect_true(out$ok)
  expect_equal(out$n_umps, 2L)
  expect_equal(out$rows[[1]]$mapa, "15011005900")
  expect_equal(out$rows[[1]]$cuota$TOTAL[1], 1)
})

test_that("hojas_ruta_generar_zip produce PDFs y resumen", {
  tmp <- tempfile("mapas_")
  dir.create(tmp)
  img <- array(1, dim = c(12, 12, 3))
  png::writePNG(img, file.path(tmp, "15011005900.png"))

  df <- data.frame(
    UMP = c(1, 2),
    IDMANZANA = c("15011005900015A", "15013500200026"),
    ESTRATO = "Lima",
    VIVIENDAS = c(30, 28),
    NSE = "B",
    ESQUINA = 1,
    RECORRIDO = 2,
    ARRANQUE = 3,
    CONSTANTE = 4,
    IE = c(1, 7),
    FE = c(6, 12),
    sexo = c("H", "M"),
    edad = c("18-29", "30-44"),
    stringsAsFactors = FALSE
  )
  out_zip <- tempfile(fileext = ".zip")
  res <- hojas_ruta_generar_zip(
    df,
    list(row_var = "sexo", col_var = "edad", cartografia_dir = tmp),
    out_zip
  )
  expect_true(file.exists(out_zip))
  expect_equal(res$n_pdfs, 2L)
  expect_equal(res$mapas_faltantes, 1L)
  entries <- zip::zip_list(out_zip)$filename
  expect_true("resumen_generacion.xlsx" %in% entries)
  expect_true(any(grepl("[.]pdf$", entries)))
})
