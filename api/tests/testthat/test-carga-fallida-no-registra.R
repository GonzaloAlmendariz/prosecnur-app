# Una carga que falla no deja nada registrado (ítem 3 del checklist de
# Validación usada por un practicante, 2026-11-12).
#
# Caso medido: el practicante subió una base que no calzaba con el formulario
# (la lectura tomó otra hoja del libro). La API respondió 400, pero la sesión
# ya había anotado ese archivo como las respuestas cargadas: la carga buena
# siguiente decía "Pasó de 1,434 a 1,000 respuestas" contra la hoja equivocada.

.cfnr_xlsx_bytes <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  openxlsx::write.xlsx(sheets, path)
  readBin(path, "raw", n = file.info(path)$size)
}

.cfnr_formulario <- function() {
  .cfnr_xlsx_bytes(list(
    survey = data.frame(
      type = c("integer", "text", "integer", "select_one sn"),
      name = c("nro", "distrito", "edad", "trabaja"),
      label = c("Número de encuesta", "Distrito", "Edad", "¿Trabaja?"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(list_name = "sn", name = c("1", "2"), label = c("Sí", "No"),
                         stringsAsFactors = FALSE)
  ))
}

.cfnr_respuestas <- function(n) {
  .cfnr_xlsx_bytes(list(Base = data.frame(
    nro = seq_len(n), distrito = rep(c("Lima", "Ate"), length.out = n),
    edad = rep(c(20, 35, 41), length.out = n), trabaja = rep(c(1, 2), length.out = n),
    stringsAsFactors = FALSE
  )))
}

# La base digitada trae primero la hoja de códigos (otra tabla, sin las
# preguntas) y después la hoja con las respuestas.
.cfnr_hoja_equivocada <- function() {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  respuestas <- readxl::read_excel(.cfnr_tmp(.cfnr_respuestas(6L)))
  openxlsx::write.xlsx(list(
    Codigo = data.frame(`1` = 1:12, `Nro. De Encuesta` = rep(c("Sí", "No"), 6), check.names = FALSE),
    Base = as.data.frame(respuestas)
  ), path)
  readBin(path, "raw", n = file.info(path)$size)
}

.cfnr_tmp <- function(bytes) {
  path <- tempfile(fileext = ".xlsx")
  writeBin(bytes, path)
  path
}

.cfnr_post <- function(ruta, sid, file_id) {
  ep <- .bv_endpoint(mount_carga, "POST", ruta)
  res <- plumber:::PlumberResponse$new()
  out <- ep$getFunc()(req = .bv_req(sid), res = res, file_id = file_id)
  list(status = res$status, body = out)
}

test_that("respuestas que no calzan con el formulario no quedan registradas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  form <- save_upload(sid, "xlsform", "formulario.xlsx", .cfnr_formulario())
  r_form <- .cfnr_post("/api/carga/instrumento", sid, form$file_id)
  expect_equal(r_form$status, 200)

  mala <- save_upload(sid, "data", "base_digitada.xlsx", .cfnr_hoja_equivocada())
  r_mala <- .cfnr_post("/api/carga/data", sid, mala$file_id)
  expect_equal(r_mala$status, 400)
  expect_identical(r_mala$body$error$code, "E_DATA_XLSFORM_INCOMPATIBLE")
  # El aviso dice la causa: qué hoja se leyó y qué otras trae el libro.
  aviso <- r_mala$body$error$message
  expect_match(aviso, "de 4 preguntas, 4 no aparecen", fixed = TRUE)
  expect_match(aviso, "hoja \"Codigo\", la primera del libro", fixed = TRUE)
  expect_match(aviso, "\"Base\"", fixed = TRUE)

  s <- session_get(sid)
  expect_null(s$data_raw_meta)
  expect_null(s$files[[mala$file_id]])
  expect_null(s$choice_code_maps_pending)
  expect_null((s$estudio %||% list())$bases$default)

  # La carga buena siguiente es la primera: no se compara con la fallida.
  buena <- save_upload(sid, "data", "respuestas.xlsx", .cfnr_respuestas(6L))
  r_buena <- .cfnr_post("/api/carga/data", sid, buena$file_id)
  expect_equal(r_buena$status, 200)
  expect_null(r_buena$body$cambios)
  expect_identical(session_get(sid)$data_raw_meta$file_id, buena$file_id)
  expect_identical(session_get(sid)$estudio$bases$default$data_file_id, buena$file_id)
})

test_that("un formulario que no se pudo leer no queda como el último subido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  form <- save_upload(sid, "xlsform", "formulario.xlsx", .cfnr_formulario())
  expect_equal(.cfnr_post("/api/carga/instrumento", sid, form$file_id)$status, 200)

  # Subir la base en el lugar del formulario: no tiene hoja survey.
  malo <- save_upload(sid, "xlsform", "base_digitada.xlsx", .cfnr_respuestas(4L))
  r_malo <- .cfnr_post("/api/carga/instrumento", sid, malo$file_id)
  expect_equal(r_malo$status, 400)
  expect_null(session_get(sid)$files[[malo$file_id]])

  # Las respuestas se cargan contra el formulario que sí se leyó.
  datos <- save_upload(sid, "data", "respuestas.xlsx", .cfnr_respuestas(6L))
  r_datos <- .cfnr_post("/api/carga/data", sid, datos$file_id)
  expect_equal(r_datos$status, 200)
  expect_identical(session_get(sid)$estudio$bases$default$xlsform_file_id, form$file_id)
})
