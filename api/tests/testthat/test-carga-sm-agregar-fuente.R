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

test_that("agregar una fuente: importa ambas en una temporal, pasa los archivos a la base original y quita la temporal", {
  bases <- list(estudiantes = base_sm())
  pasos <- character()
  recibido <- list()
  local_mocked_bindings(
    estudio_list_bases = function(sid) bases,
    .connections_token_require = function(...) "tok",
    sm_multibase_import = function(sid, specs, token, canonical_file_id, base_name) {
      pasos <<- c(pasos, "importar")
      recibido$specs <<- specs
      recibido$canonical <<- canonical_file_id
      bases[[base_name]] <<- list(nombre = base_name, xlsform_file_id = "xls-nuevo", data_file_id = "data-nueva")
      list(base = list(nombre = base_name), n_filas = 350L, n_columnas = 99L, audit = list(ok = TRUE))
    },
    session_get = function(sid, ...) list(estudio = list(bases = bases), rp_data_sources = list(), rp_inst_sources = list()),
    estudio_replace_base_files = function(sid, nombre, xlsform_file_id, data_file_id, ...) {
      pasos <<- c(pasos, paste("reemplazar", nombre, xlsform_file_id, data_file_id))
    },
    estudio_remove_base = function(sid, nombre) { pasos <<- c(pasos, paste("quitar", nombre)); bases[[nombre]] <<- NULL },
    .carga_sm_guardar_fuentes = function(sid, base, fuentes) { pasos <<- c(pasos, paste("guardar", base, length(fuentes))) },
    .estudio_payload = function(sid) list(n_bases = length(bases))
  )
  r <- .carga_sm_agregar_fuente("s1", list(base_name = "estudiantes", survey_id = "222", title = "Arte - Estudiantes (correo)",
                                          source_channel = "correo"))
  expect_identical(pasos, c("importar", "reemplazar estudiantes xls-nuevo data-nueva",
                            "quitar estudiantes_fuentes_nuevas", "guardar estudiantes 2"))
  expect_identical(vapply(recibido$specs, `[[`, "", "survey_id"), c("111", "222"))
  expect_identical(recibido$canonical, "xls-orig") # el formulario de la base manda
  expect_identical(r$base_name, "estudiantes")
  expect_identical(r$n_filas, 350L)
  expect_identical(r$estudio$n_bases, 1L)
})

test_that("si la auditoría falla, la base original no se toca", {
  bases <- list(estudiantes = base_sm())
  tocada <- FALSE
  local_mocked_bindings(
    estudio_list_bases = function(sid) bases,
    .connections_token_require = function(...) "tok",
    sm_multibase_import = function(...) stop_api(409, "E_SM_MULTIBASE_BLOCKED", "Hay diferencias bloqueantes antes de importar."),
    estudio_replace_base_files = function(...) tocada <<- TRUE,
    estudio_remove_base = function(...) tocada <<- TRUE
  )
  expect_error(.carga_sm_agregar_fuente("s1", list(base_name = "estudiantes", survey_id = "222")), class = "api_error")
  expect_false(tocada)
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
