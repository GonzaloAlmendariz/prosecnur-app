# Opciones de Impreso en el .pulso (xlsform_impreso.R, L36 · DOC.4): se guardan por formulario, sobreviven al
# autosave del workbook, viajan en el estado persistible y llevan versiones con nombre.

form_para_impreso <- function(project_path = "/tmp/estudio.pulso") {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- project_path
  entry <- .xlsform_forms_as_entry(list(
    workbook = list(
      survey = list(columns = list("type", "name", "label"), rows = list(list("text", "p1", "Nombre"))),
      choices = list(columns = list("list_name", "name", "label"), rows = list()),
      settings = list(columns = list("form_title", "form_id"), rows = list(list("Docentes", "doc")))
    ),
    source = list(kind = "xlsform")
  ), id = "form-i")
  s <- .xlsform_forms_upsert(s, entry)
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  sid
}

test_that("un formulario sin opciones guardadas devuelve la forma vacía, no NULL", {
  sid <- form_para_impreso()
  r <- xlsform_impreso_leer(sid, "form-i")
  expect_identical(r$impreso$opciones, "")
  expect_identical(r$impreso$guardado_en, "")
  expect_length(r$impreso$versiones, 0L)
})

test_that("guardar opciones las deja en la entrada y marca el proyecto sin guardar", {
  sid <- form_para_impreso()
  opciones <- '{"columns":1,"documentTitle":"Encuesta a docentes"}'
  r <- xlsform_impreso_guardar(sid, "form-i", opciones)
  expect_identical(r$impreso$opciones, opciones)
  expect_true(nzchar(r$impreso$guardado_en))
  s <- session_get(sid)
  expect_identical(s$xlsform_forms[["form-i"]]$impreso$opciones, opciones)
  expect_true(isTRUE(s$project_dirty))
  expect_identical(xlsform_impreso_leer(sid, "form-i")$impreso$opciones, opciones)
})

test_that("el autosave del workbook conserva las opciones de Impreso", {
  sid <- form_para_impreso()
  xlsform_impreso_guardar(sid, "form-i", '{"columns":2}')
  s <- session_get(sid)
  # El POST /forms rearma la entrada desde el cuerpo, que no trae `impreso`.
  nueva <- .xlsform_forms_as_entry(list(
    workbook = s$xlsform_forms[["form-i"]]$workbook,
    source = list(kind = "xlsform")
  ), id = "form-i")
  s <- .xlsform_forms_upsert(s, nueva, cliente = TRUE)
  expect_identical(s$xlsform_forms[["form-i"]]$impreso$opciones, '{"columns":2}')
})

test_that("las opciones viajan en el estado que se guarda en el .pulso", {
  sid <- form_para_impreso()
  xlsform_impreso_guardar(sid, "form-i", '{"columns":"auto"}')
  persistido <- session_get(sid)$xlsform_forms
  rds <- tempfile(fileext = ".rds")
  saveRDS(persistido, rds)
  expect_identical(readRDS(rds)[["form-i"]]$impreso$opciones, '{"columns":"auto"}')
})

test_that("opciones que no son un objeto JSON se rechazan", {
  sid <- form_para_impreso()
  for (malo in list("no es json", "[1,2]", "", NULL, paste(rep("x", 200001), collapse = ""))) {
    err <- tryCatch(xlsform_impreso_guardar(sid, "form-i", malo), api_error = function(e) e)
    expect_identical(err$code, "E_IMPRESO_OPCIONES_INVALIDAS")
  }
  expect_identical(xlsform_impreso_guardar(sid, "form-i", "{}")$impreso$opciones, "{}")
})

test_that("un formulario que no existe responde E_FORM_NOT_FOUND", {
  sid <- form_para_impreso()
  err <- tryCatch(xlsform_impreso_leer(sid, "otro"), api_error = function(e) e)
  expect_identical(err$code, "E_FORM_NOT_FOUND")
})

test_that("las versiones van con nombre, la más nueva primero, sin duplicar nombres y hasta 10", {
  sid <- form_para_impreso()
  err <- tryCatch(xlsform_impreso_guardar_version(sid, "form-i", "  ", "{}"), api_error = function(e) e)
  expect_identical(err$code, "E_IMPRESO_VERSION_SIN_NOMBRE")

  xlsform_impreso_guardar_version(sid, "form-i", "Piloto", '{"columns":1}')
  r <- xlsform_impreso_guardar_version(sid, "form-i", "Campo", '{"columns":2}')
  expect_identical(vapply(r$impreso$versiones, `[[`, "", "nombre"), c("Campo", "Piloto"))
  # Lo que se guarda como versión es también lo actual.
  expect_identical(r$impreso$opciones, '{"columns":2}')

  r <- xlsform_impreso_guardar_version(sid, "form-i", "Piloto", '{"columns":"auto"}')
  expect_identical(vapply(r$impreso$versiones, `[[`, "", "nombre"), c("Piloto", "Campo"))
  expect_identical(r$impreso$versiones[[1]]$opciones, '{"columns":"auto"}')

  for (k in 1:12) xlsform_impreso_guardar_version(sid, "form-i", paste("V", k), "{}")
  r <- xlsform_impreso_leer(sid, "form-i")
  expect_length(r$impreso$versiones, 10L)
  expect_identical(r$impreso$versiones[[1]]$nombre, "V 12")
})

test_that("guardar las opciones actuales no borra las versiones", {
  sid <- form_para_impreso()
  xlsform_impreso_guardar_version(sid, "form-i", "Piloto", '{"columns":1}')
  r <- xlsform_impreso_guardar(sid, "form-i", '{"columns":2}')
  expect_identical(r$impreso$versiones[[1]]$nombre, "Piloto")
  expect_identical(r$impreso$opciones, '{"columns":2}')
})
