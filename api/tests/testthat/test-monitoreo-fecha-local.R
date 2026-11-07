# El día de una respuesta es el de la zona del estudio cuando el sello trae zona
# (monitoreo_fecha_local.R); un valor sin zona se deja como venía.

test_that("un sello UTC de la noche en Lima es del mismo día en Lima", {
  df <- data.frame(date_modified = c("2026-10-29T23:33:00+00:00", "2026-10-30T04:59:00+00:00", "2026-10-30T05:01:00Z"), stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df), c("2026-10-29", "2026-10-29", "2026-10-30"))
})

test_that("un sello con la zona de Lima conserva su día", {
  df <- data.frame(end = c("2026-10-29T22:10:00.000-05:00"), stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df), "2026-10-29")
})

test_that("una fecha u hora sin zona no se corre", {
  df <- data.frame(Fecha = c("2026-10-29", "2026-10-29 21:00:00"), stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df), c("2026-10-29", "2026-10-29"))
})

test_that("otra zona de campo se declara con la opción", {
  withr::local_options(list(prosecnur.tz_campo = "UTC"))
  df <- data.frame(date_modified = "2026-10-29T23:33:00+00:00", stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df), "2026-10-29")
  df2 <- data.frame(date_modified = "2026-10-30T01:00:00+00:00", stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df2), "2026-10-30")
})

test_that("el año de una fecha dd-mm-yyyy no se toma por zona, y lo vacío sigue sin fecha", {
  expect_identical(.monitoreo_dia_local(as.POSIXct("2026-10-29 00:00:00", tz = "UTC"), "29-10-2026"), "2026-10-29")
  df <- data.frame(Fecha = c("", NA, "abc"), stringsAsFactors = FALSE)
  expect_identical(.monitoreo_report_date_values(df), c("Sin fecha", "Sin fecha", "abc"))
})
