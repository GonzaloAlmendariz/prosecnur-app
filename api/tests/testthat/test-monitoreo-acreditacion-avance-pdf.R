# PDF de avance de campo del perfil de acreditación
# (`monitoreo_acreditacion_avance_pdf.R`; checklist-pdf-avance-acreditacion-2026-10-30).

.acav_modelo_prueba <- function(synced_at = "2026-10-30T12:20:14Z") {
  list(
    actors = list(
      list(Actor = "Profesores", Universo = 2665, Efectivas = 61, Parciales = 8, Meta = 843),
      list(Actor = "Estudiantes de pregrado", Universo = 22820, Efectivas = 709, Parciales = 139, Meta = 4542)
    ),
    daily_general = list(
      list(Fecha = "2026-10-29", Efectivas = 717),
      list(Fecha = "2026-10-30", Efectivas = 53)
    ),
    daily_actor = list(
      list(Actor = "Profesores", Fecha = "2026-10-29", Efectivas = 56),
      list(Actor = "Profesores", Fecha = "2026-10-30", Efectivas = 5),
      list(Actor = "Estudiantes de pregrado", Fecha = "2026-10-29", Efectivas = 661),
      list(Actor = "Estudiantes de pregrado", Fecha = "2026-10-30", Efectivas = 48)
    ),
    sources = list(
      list(Actor = "Profesores", Fuente = "Acreditación Institucional PUCP 2026 - Profesores"),
      list(Actor = "Estudiantes de pregrado", Fuente = "Acreditación Institucional PUCP 2026 - Estudiantes Pregrado")
    ),
    synced_at = synced_at
  )
}

test_that("las cifras van con punto decimal, sin separador de miles y con su frecuencia", {
  expect_equal(.acav_n(45120), "45120")
  expect_equal(.acav_pct(1148, 8507), "13.5%")
  expect_equal(.acav_pct_frec(709, 4542), "15.6% (709 de 4542)")
  expect_equal(.acav_pct(1, 0), "-")
})

test_that("el corte es la sincronización en hora de Lima, no la hora de generar", {
  corte <- .acav_corte(list(synced_at = "2026-10-30T04:20:00Z", generated_at = "2026-10-30T15:00:00Z"))
  # 04:20 UTC es todavía el 29 en Lima.
  expect_equal(as.character(corte$fecha), "2026-10-29")
  expect_equal(corte$hora, "23:20")
  expect_match(corte$texto, "29 de octubre de 2026, 23:20 \\(hora de Lima\\)")
})

test_that("el nombre del estudio sale del prefijo común de las encuestas", {
  m <- .acav_modelo_prueba()
  expect_equal(.acav_nombre_estudio(m, .acav_df(m$sources)), "Acreditación Institucional PUCP 2026")
  expect_equal(.acav_nombre_estudio(list(), data.frame()), "")
})

test_that("el PDF publica el avance sobre el total, el mínimo esperado y ningún texto interno", {
  testthat::skip_if_not(nzchar(Sys.which("pdftotext")), "sin pdftotext")
  pdf <- tempfile(fileext = ".pdf")
  on.exit(unlink(pdf), add = TRUE)
  monitoreo_acreditacion_client_report_pdf(.acav_modelo_prueba(), pdf, include_targets = TRUE)
  txt <- paste(system2("pdftotext", c("-layout", pdf, "-"), stdout = TRUE), collapse = "\n")
  expect_match(txt, "trabajo de campo")
  expect_match(txt, "Acreditación Institucional PUCP 2026")
  expect_match(txt, "30 de octubre de 2026, 07:20")
  # El porcentaje que manda es sobre los invitados (770 de 25485) y el mínimo
  # esperado va al lado con su propio porcentaje (770 de 5385).
  expect_match(txt, "3.0%")
  expect_match(txt, "770 de 25485")
  expect_match(txt, "M[ií]nimo esperado|MÍNIMO ESPERADO")
  expect_match(txt, "770 de 5385")
  # En acreditación la cifra de referencia no es una «meta» (Gonzalo, 2026-10-30).
  expect_false(grepl("\\bmeta\\b", txt, ignore.case = TRUE))
  # Universo, no «invitados»: no todo estudio de acreditación va por correo. Y la
  # hora de Lima se dice una vez, en el corte, no en cada título.
  expect_false(grepl("invitad", txt, ignore.case = TRUE))
  expect_equal(lengths(regmatches(txt, gregexpr("hora de Lima", txt, fixed = TRUE))), 1L)
  expect_match(txt, "Avance diario por p")
  # Informa, no explica: las aclaraciones van sólo como asterisco.
  expect_false(grepl("se cuentan|enlace personal|Cada persona cuenta", txt))
  expect_match(txt, "hasta las 07:20")
  expect_false(grepl("[0-9],[0-9]{3}", txt))
  expect_false(grepl("Apps Script|can[oó]nico|Ver detalle|Rechazo|actor", txt, ignore.case = FALSE))
})

test_that("sin «Incluir metas» el documento no publica el mínimo esperado", {
  testthat::skip_if_not(nzchar(Sys.which("pdftotext")), "sin pdftotext")
  pdf <- tempfile(fileext = ".pdf")
  on.exit(unlink(pdf), add = TRUE)
  monitoreo_acreditacion_client_report_pdf(.acav_modelo_prueba(), pdf, include_targets = FALSE)
  txt <- paste(system2("pdftotext", c("-layout", pdf, "-"), stdout = TRUE), collapse = "\n")
  expect_false(grepl("5385|m[ií]nimo", txt, ignore.case = TRUE))
  expect_match(txt, "770 de 25485")
})

test_that("los públicos de un mismo padrón salen por pares: Campus y luego CENTRUM", {
  actors <- data.frame(
    Actor = c("Estudiantes de pregrado", "Docentes Campus", "Administrativos", "Docentes CENTRUM", "Egresados de posgrado CENTRUM", "Egresados de posgrado Campus"),
    Universo = c(22820, 2599, 2194, 66, 417, 849), Efectivas = c(324, 29, 187, 1, 5, 16), Parciales = 0, Meta = 1,
    stringsAsFactors = FALSE
  )
  orden <- .acav_publicos(actors, TRUE)$publico
  expect_identical(orden, c("Estudiantes de pregrado", "Docentes Campus", "Docentes CENTRUM", "Administrativos", "Egresados de posgrado Campus", "Egresados de posgrado CENTRUM"))
})
