# Cada respuesta del caso completo dice qué es (M4, cambio 7;
# validacion_caso_respuestas.R) y el contexto de los casos sale solo de
# columnas declaradas (validacion_contexto_casos.R).

.cr_survey <- function() {
  data.frame(
    type = c("start", "end", "text", "integer", "select_one p4", "integer", "calculate"),
    name = c("start", "end", "caso", "edad", "p4", "p21", "doble"),
    label = c("", "", "Código del caso", "Edad", "P4. Situación", "P21. Frecuencia", ""),
    required = "",
    relevant = c("", "", "", "", "", "${p4} = '1'", ""),
    constraint = "",
    calculation = c("", "", "", "", "", "", "${edad} * 2"),
    stringsAsFactors = FALSE
  )
}

.cr_datos <- function() {
  data.frame(
    respondent_id = sprintf("u%02d", 1:4),
    start = c("2026-11-03T14:00:00.000-05:00", "2026-11-03T15:00:00.000-05:00",
              "2026-11-04T09:00:00.000-05:00", "2026-11-04T10:00:00.000-05:00"),
    end = c("2026-11-03T14:14:30.000-05:00", "2026-11-03T15:20:00.000-05:00",
            "2026-11-04T09:10:00.000-05:00", "2026-11-04T09:00:00.000-05:00"),
    caso = c("Ana", "Beto", "Ana", "Beto"),
    edad = c(15, 99, 20, 30),
    p4 = c(1, 2, 7, 1),
    p21 = c(NA, NA, 3, NA),
    doble = c(30, 198, 40, 60),
    stringsAsFactors = FALSE
  )
}

.cr_sesion <- function(dir, especiales = list(99), roles = TRUE) {
  sid <- session_create()
  f <- .m1_archivos(dir, survey = .cr_survey(), datos = .cr_datos())
  xm <- save_upload(sid, "xlsform", basename(f$xlsform), readBin(f$xlsform, "raw", n = file.info(f$xlsform)$size))
  dm <- save_upload(sid, "data", basename(f$data), readBin(f$data, "raw", n = file.info(f$data)$size))
  inst <- reporte_instrumento(path = xm$path)
  for (nombre in c("Hogares", "Personas")) {
    estudio_add_base(sid = sid, nombre = nombre, xlsform_file_id = xm$file_id, data_file_id = dm$file_id,
                     data_ext = "csv", rp_data = reporte_data(f$datos, instrumento = inst), rp_inst = inst,
                     n_filas = nrow(f$datos), n_columnas = ncol(f$datos))
  }
  s <- session_get(sid)
  s$estudio$active_base <- "Hogares"
  # Códigos especiales declarados solo en la base Personas (la que se lee).
  s$analitica_config_por_base <- list(Personas = list(codebook = list(codigos_solo_si_presentes = especiales)))
  .session_env[[sid]] <- s
  if (roles) {
    validacion_scope_set(sid, "Personas", "operational_config", normalize_validation_operational_config(list(
      version = 2L, field_period = list(enabled = FALSE, variable = "end"),
      identity = list(enabled = FALSE, agent_variable = "caso"))))
  }
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sid
}

.cr_vars <- function(b) {
  vs <- unlist(lapply(b$secciones, `[[`, "variables"), recursive = FALSE)
  stats::setNames(vs, vapply(vs, `[[`, "", "variable"))
}

test_that("el caso distingue respuesta, cálculo y metadato, y vacía por salto de vacía", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  b1 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  v1 <- .cr_vars(b1)
  expect_identical(v1$edad$origen, "respuesta")
  expect_identical(v1$doble$origen, "calculada")
  expect_identical(v1$start$origen, "metadato")
  expect_identical(v1$edad$estado, "respondida")
  # u01: P4 = 1, así que P21 le correspondía y está vacía.
  expect_identical(v1$p21$estado, "vacia")
  b2 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u02&base_nombre=Personas")$body
  v2 <- .cr_vars(b2)
  # u02: P4 = 2, P21 no le correspondía.
  expect_identical(v2$p21$estado, "vacia_por_salto")
  sec <- b2$secciones[[1]]
  expect_identical(sec$n_vacias_por_salto, 1L)
  expect_identical(sec$n_preguntas, 4L)
  expect_identical(sec$n_respondidas, 3L)
})

test_that("un código especial declarado y un código fuera de las opciones se marcan", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  b2 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u02&base_nombre=Personas")$body
  v2 <- .cr_vars(b2)
  expect_true(v2$edad$especial)
  expect_false(v2$p4$especial)
  expect_false(v2$p4$fuera_de_opciones)
  expect_null(v2$edad$fuera_de_opciones)
  expect_identical(unlist(lapply(b2$codigos_especiales_declarados, `[[`, "codigo")), "99")
  h <- Filter(function(x) identical(x$id_regla, "RC_001"), b2$hallazgos)[[1]]
  expect_match(h$esperado$texto, "u02: respondió \"99\" en Edad, un código especial que la regla de rango no admite.",
               fixed = TRUE)
  b3 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u03&base_nombre=Personas")$body
  expect_true(.cr_vars(b3)$p4$fuera_de_opciones)
})

test_that("sin códigos especiales declarados en la base leída, ninguno se marca", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir, especiales = list())
  withr::defer(session_delete(sid))
  # La base activa (Hogares) declara el 99; la leída (Personas) no: no se mezclan.
  s <- session_get(sid)
  s$analitica_config_por_base$Hogares <- list(codebook = list(codigos_solo_si_presentes = list(99)))
  .session_env[[sid]] <- s
  b2 <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "id=u02&base_nombre=Personas")$body
  expect_false(.cr_vars(b2)$edad$especial)
  expect_length(b2$codigos_especiales_declarados, 0L)
})

test_that("el contexto del caso y del detalle sale de las columnas declaradas", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  b1 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  expect_identical(b1$contexto$fecha_respuesta$variable, "end")
  expect_identical(b1$contexto$recopilador$variable, "caso")
  expect_identical(b1$contexto$fecha_envio$fuente, "formulario")
  expect_identical(b1$metadatos$recopilador, "Ana")
  expect_equal(b1$metadatos$duracion_min, 14.5)
  expect_identical(b1$metadatos$n_preguntas, 4L)
  expect_identical(b1$metadatos$n_respondidas, 3L)
  det <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                  body = '{"id_regla":"RC_001","base_nombre":"Personas"}')$body
  expect_length(det$contexto_por_caso, length(det$casos))
  k <- match("u04", unlist(det$case_ids))
  # u04 terminó antes de empezar: la duración no se publica.
  expect_null(det$contexto_por_caso[[k]]$duracion_min)
  expect_identical(det$contexto_por_caso[[k]]$recopilador, "Beto")
})

test_that("sin roles declarados no hay fecha de respuesta ni recopilador", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir, roles = FALSE)
  withr::defer(session_delete(sid))
  b1 <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  expect_null(b1$contexto$fecha_respuesta)
  expect_null(b1$contexto$recopilador)
  expect_null(b1$metadatos$recopilador)
  # La fecha de envío sí: la declara el formulario (pregunta de tipo end).
  expect_identical(b1$contexto$fecha_envio$variable, "end")
})

test_that("O8: si los rótulos de los códigos especiales no se leen, se marcan igual y se avisa", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  local_mocked_bindings(analitica_codigos_especiales = function(...) stop("lista ilegible"))
  b2 <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "id=u02&base_nombre=Personas")$body
  expect_true(.cr_vars(b2)$edad$especial)
  expect_identical(vapply(b2$avisos, `[[`, "", "codigo"), "rotulos_especiales_ilegibles")
})

test_that("el número de encuesta y el digitador declarados salen como contexto del caso", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  cfg <- normalize_validation_operational_config(list(
    version = 2L, identity = list(enabled = FALSE, agent_variable = "caso",
                                  survey_number_variable = "respondent_id", typist_variable = "caso")),
    available_variables = names(.cr_datos()))
  expect_identical(cfg$identity$survey_number_variable, "respondent_id")
  expect_identical(cfg$identity$typist_variable, "caso")
  expect_error(normalize_validation_operational_config(list(identity = list(typist_variable = "no_existe")),
                                                       available_variables = names(.cr_datos())),
               class = "api_error")
  validacion_scope_set(sid, "Personas", "operational_config", cfg)
  pr <- .m1_router()
  b1 <- .m1_http(pr, sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  expect_identical(b1$contexto$numero_encuesta$variable, "respondent_id")
  expect_identical(b1$contexto$digitador$variable, "caso")
  expect_identical(b1$metadatos$numero_encuesta, "u01")
  expect_identical(b1$metadatos$digitador, "Ana")
  det <- .m1_http(pr, sid, "POST", "/api/validacion/v2/instrumento/regla",
                  body = '{"id_regla":"RC_001","base_nombre":"Personas"}')$body
  k <- match("u04", unlist(det$case_ids))
  expect_identical(det$contexto_por_caso[[k]]$numero_encuesta, "u04")
  expect_identical(det$contexto_por_caso[[k]]$digitador, "Beto")
})

test_that("sin declararlos, el número de encuesta y el digitador no salen", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  b1 <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso", query = "id=u01&base_nombre=Personas")$body
  expect_null(b1$contexto$numero_encuesta)
  expect_null(b1$metadatos$digitador)
})
