# «Agregar otra fuente a esta base» (carga_sm_agregar_fuente.R): el mismo actor por dos vías queda en UNA base, que
# conserva su nombre y su configuración. Sin red: las piezas pesadas se sustituyen.

base_sm <- function(...) utils::modifyList(list(
  nombre = "estudiantes", source_kind = "surveymonkey", survey_id = "111", source_title = "Arte - Estudiantes",
  source_alias = "Arte - Estudiantes", source_channel = "QR en aula", xlsform_file_id = "xls-orig"
), list(...))

test_that("las fuentes de una base: su lista guardada o la encuesta única con la que se importó", {
  expect_equal(.carga_sm_fuentes_de_base(base_sm())[[1]][c("survey_id", "channel")], list(survey_id = "111", channel = "QR en aula"))
  lista <- list(list(survey_id = "111", channel = "QR en aula"), list(survey_id = "222", channel = "correo"))
  expect_identical(.carga_sm_fuentes_de_base(base_sm(surveymonkey_source_spec = list(survey_id = "111", sources = lista))), lista)
  expect_error(.carga_sm_fuentes_de_base(base_sm(source_kind = "manual", survey_id = "")), class = "api_error")
})

test_that("la misma encuesta por el mismo canal no se suma dos veces; por otro canal sí", {
  previas <- list(list(survey_id = "111", channel = "QR en aula"))
  expect_error(.carga_sm_fuentes_con_nueva(previas, list(survey_id = "111", channel = "QR en aula")), class = "api_error")
  expect_length(.carga_sm_fuentes_con_nueva(previas, list(survey_id = "111", channel = "correo")), 2L)
  expect_length(.carga_sm_fuentes_con_nueva(previas, list(survey_id = "222", channel = "")), 2L)
})

sv_af <- function(type, name, label) data.frame(type = type, name = name, `label::es` = label, check.names = FALSE,
                                                 stringsAsFactors = FALSE)
modelo_af <- function(survey) list(survey = survey, choices = data.frame(list_name = character(), name = character(),
                                   `label::es` = character(), check.names = FALSE), settings = data.frame(form_title = "x"))

# Sesión real con la base «estudiantes» (formulario p1 Edad, p2 Comentario; 2 respuestas por QR).
sesion_con_base_af <- function() {
  sid <- session_create()
  xls <- tempfile(fileext = ".xlsx"); dat <- tempfile(fileext = ".xlsx")
  .sm_mb_write_xlsform_model(modelo_af(sv_af(c("integer", "text"), c("p1", "p2"), c("Edad", "Comentario"))), xls)
  openxlsx::write.xlsx(data.frame(p1 = c("20", "22"), p2 = c("a", "b")), dat)
  xm <- save_upload(sid, "xlsform", "f.xlsx", readBin(xls, "raw", n = file.info(xls)$size))
  dm <- save_upload(sid, "data", "d.xlsx", readBin(dat, "raw", n = file.info(dat)$size))
  inst <- reporte_instrumento(xm$path)
  estudio_add_base(sid, "estudiantes", xm$file_id, dm$file_id, "xlsx",
                   reporte_data(data.frame(p1 = c("20", "22"), p2 = c("a", "b")), instrumento = inst), inst, 2L, 2L,
                   extra_meta = list(source_kind = "surveymonkey", survey_id = "111", source_channel = "QR en aula"))
  sid
}

test_that("agregar por correo una encuesta con una pregunta de más: la base la suma y conserva sus filas", {
  sid <- sesion_con_base_af()
  # La encuesta por correo agrega «Código de estudiante» (p3) y pone Edad en otro orden.
  fuente <- modelo_af(sv_af(c("text", "integer", "text"), c("p1", "p2", "p3"), c("Comentario", "Edad", "Código de estudiante")))
  local_mocked_bindings(
    .connections_token_require = function(...) "tok",
    sm_api_fetch_survey_details = function(id, token, ...) list(id = id, title = "Arte - Estudiantes (correo)"),
    .sm_mb_inst_generado = function(details, ...) { p <- tempfile(fileext = ".xlsx"); .sm_mb_write_xlsform_model(fuente, p); reporte_instrumento(path = p) },
    sm_api_xlsform = function(details, ...) fuente,
    .carga_platform_fetch_sm_bulk = function(...) list(data = list()),
    # Lo que devuelve la codificación alineada: columnas ya en el espacio de la base.
    .sm_mb_codificar_fuente = function(...) data.frame(p1 = c("30", "31", "32"), p2 = c("x", "y", "z"), p3 = c("A1", "A2", "A3"))
  )
  previa <- .carga_sm_vista_previa_fuente(sid, list(base_name = "estudiantes", survey_id = "222", source_channel = "correo"))
  expect_identical(vapply(previa$extra, `[[`, "", "etiqueta"), "Código de estudiante")
  expect_identical(previa$n_emparejadas, 2L)

  r <- .carga_sm_agregar_fuente(sid, list(base_name = "estudiantes", survey_id = "222", source_channel = "correo"))
  expect_identical(r$base_name, "estudiantes")
  expect_identical(r$n_filas, 5L)
  expect_identical(r$n_nuevas, 3L)
  expect_identical(r$agregadas[[1]]$etiqueta, "Código de estudiante")
  base <- estudio_list_bases(sid)$estudiantes
  datos <- .sm_mb_read_base_original_data(sid, base)
  expect_identical(as.character(datos$p3), c(NA, NA, "A1", "A2", "A3")) # vacía en las filas del QR
  expect_true("p3" %in% reporte_instrumento(get_file(sid, base$xlsform_file_id)$path)$survey$name)
  expect_length(base$surveymonkey_source_spec$sources, 2L)
  expect_identical(names(estudio_list_bases(sid)), "estudiantes") # sin bases temporales
})

test_that("una encuesta que casi no comparte preguntas no se une: es otro cuestionario", {
  sid <- sesion_con_base_af()
  otra <- modelo_af(sv_af(c("text", "text"), c("p1", "p2"), c("Sede", "Turno")))
  local_mocked_bindings(
    .connections_token_require = function(...) "tok",
    sm_api_fetch_survey_details = function(id, token, ...) list(id = id, title = "Otra"),
    .sm_mb_inst_generado = function(details, ...) { p <- tempfile(fileext = ".xlsx"); .sm_mb_write_xlsform_model(otra, p); reporte_instrumento(path = p) }
  )
  expect_error(.carga_sm_vista_previa_fuente(sid, list(base_name = "estudiantes", survey_id = "333")), class = "api_error")
  expect_length(estudio_list_bases(sid)$estudiantes$surveymonkey_source_spec$sources, 0L)
})

test_that("las fuentes guardadas se leen en el resumen que publica la base (surveymonkey_sources)", {
  meta <- base_sm(surveymonkey_source_spec = list(sources = list(
    list(survey_id = "111", source_title = "Arte - Estudiantes", channel = "QR en aula"),
    list(survey_id = "222", source_title = "Arte - Estudiantes (correo)", channel = "correo")
  )))
  resumen <- .estudio_sm_source_summary(meta)
  expect_identical(vapply(resumen$sources, function(x) as.character(x$survey_id), ""), c("111", "222"))
  expect_identical(vapply(resumen$sources, function(x) as.character(x$channel), ""), c("Ficha QR", "Correo")) # el resumen normaliza el canal a su vocabulario
})
