# La base nace del formulario publicado (ADR 0102). Sin red: SurveyMonkey se
# simula reemplazando el transporte en el namespace; el SAV y el Excel son
# sintéticos y no traen ningún dato de un estudio real.

library(testthat)

# --- Utilidades ----------------------------------------------------------------

.cfpt_mock <- function(name, value, env = parent.frame()) {
  ns <- asNamespace("prosecnurapp")
  previo <- get(name, envir = ns)
  bloqueado <- bindingIsLocked(name, ns)
  if (bloqueado) unlockBinding(name, ns)
  assign(name, value, envir = ns)
  if (bloqueado) lockBinding(name, ns)
  withr::defer({
    if (bindingIsLocked(name, ns)) unlockBinding(name, ns)
    assign(name, previo, envir = ns)
    if (bloqueado) lockBinding(name, ns)
  }, envir = env)
}

.cfpt_error <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)

.cfpt_sesion <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  sid
}

.cfpt_registrar_archivo <- function(sid, kind, ext, path, original_name = basename(path)) {
  up <- save_upload(sid, kind, original_name, readBin(path, "raw", n = file.info(path)$size))
  up$file_id
}

# Publica una revisión a partir de un modelo XLSForm (survey/choices/settings).
.cfpt_publicar <- function(sid, model, revision_id = "rev-1", form_id = "form-1", revision_no = 1L,
                           source = list(kind = "xlsform"), form_name = "Encuesta de Prueba") {
  path <- tempfile(fileext = ".xlsx")
  .sm_mb_write_xlsform_model(model, path)
  file_id <- .cfpt_registrar_archivo(sid, "xlsform", "xlsx", path, paste0(revision_id, ".xlsx"))
  s <- session_get(sid)
  s$xlsform_forms <- s$xlsform_forms %||% list()
  s$xlsform_forms[[form_id]] <- list(id = form_id, name = form_name, source = source)
  s$instrument_revisions <- s$instrument_revisions %||% list()
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = form_id,
    revision_no = as.integer(revision_no),
    content_sha256 = digest::digest(revision_id, algo = "sha256"),
    xlsform_file_id = file_id,
    source = source,
    published_at = sprintf("2026-10-%02dT12:00:00Z", as.integer(revision_no))
  )
  .session_env[[sid]] <- s
  invisible(file_id)
}

.cfpt_df <- function(...) data.frame(..., stringsAsFactors = FALSE, check.names = FALSE)

# Instrumento editado en Formularios: «SIN INF» quedó en 99 (en SurveyMonkey es
# la quinta opción).
.cfpt_modelo <- function() {
  list(
    survey = .cfpt_df(
      type = c("select_one si_no", "select_one acuerdo", "text"),
      name = c("p1", "p2_1", "p3"),
      `label::es` = c("¿Desea continuar?", "Los propósitos están claros", "Comentario")
    ),
    choices = .cfpt_df(
      list_name = c("si_no", "si_no", rep("acuerdo", 5)),
      name = c("1", "2", "1", "2", "3", "4", "99"),
      `label::es` = c("Sí", "No", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
                      "Totalmente de acuerdo", "SIN INF")
    ),
    settings = .cfpt_df(form_title = "Encuesta de Prueba", form_id = "prueba", default_language = "es")
  )
}

.cfpt_lab <- function(x, labels, label) haven::labelled(x, labels = labels, label = label)

# Export SPSS de SurveyMonkey: nombres q####, «SIN INF» = 5 por posición.
.cfpt_sav <- function(sid, completo = TRUE) {
  acuerdo <- c("Totalmente en desacuerdo" = 1, "En desacuerdo" = 2, "De acuerdo" = 3,
               "Totalmente de acuerdo" = 4, "SIN INF" = 5)
  df <- data.frame(respondent_id = c("r1", "r2", "r3", "r4"), stringsAsFactors = FALSE)
  df$q0001 <- .cfpt_lab(c(1, 1, 1, 1), c("Sí" = 1, "No" = 2), "¿Desea continuar?")
  if (completo) {
    df$q0002_0001 <- .cfpt_lab(c(5, 3, 1, 5), acuerdo, "Los propósitos están claros")
    df$q0003 <- c("bien", "", "regular", "sin comentario")
  }
  df$q0099 <- .cfpt_lab(c(1, 2, 1, 2), c("A" = 1, "B" = 2), "Pregunta que no está en el formulario")
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  .cfpt_registrar_archivo(sid, "sav", "sav", path, "export_sm.sav")
}

.cfpt_leer_base <- function(sid, base) {
  s <- session_get(sid)
  meta <- s$estudio$bases[[base]]
  as.data.frame(readxl::read_excel(s$files[[meta$data_file_id]]$path, col_types = "text"))
}

# --- (a) SAV de SurveyMonkey ---------------------------------------------------

test_that("(a) un .sav del export SM entra con los nombres p y «SIN INF» 5 se escribe 99, recodificación listada", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo(), source = list(kind = "surveymonkey", survey_id = "111"))
  fid <- .cfpt_sav(sid)
  prev <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_null(prev$bloqueo)
  expect_identical(prev$n_filas, 4L)
  expect_identical(prev$n_emparejadas, 3L)
  expect_identical(prev$n_variables_instrumento, 3L)
  expect_identical(prev$cobertura_texto, "100.0")
  recod <- Filter(function(r) identical(r$variable, "p2_1"), prev$recodificaciones)
  expect_length(recod, 1L)
  expect_identical(recod[[1]][c("etiqueta", "desde", "hacia")],
                   list(etiqueta = "SIN INF", desde = "5", hacia = "99"))
  expect_identical(vapply(prev$sin_par_fuente, `[[`, "", "variable"), "q0099")
  expect_length(prev$sin_par_instrumento, 0L)

  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_identical(imp$base_name, "encuesta_de_prueba")
  datos <- .cfpt_leer_base(sid, imp$base_name)
  expect_true(all(c("p1", "p2_1", "p3", "respondent_id") %in% names(datos)))
  expect_false(any(c("q0001", "q0002_0001", "q0099") %in% names(datos)))
  expect_identical(datos$p2_1, c("99", "3", "1", "99"))
  expect_identical(datos$p1, rep("1", 4))
})

test_that("(a) una etiqueta del .sav que no existe en la lista queda vacía y se cuenta, nunca conserva su código", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo(), source = list(kind = "surveymonkey", survey_id = "111"))
  df <- data.frame(respondent_id = c("r1", "r2"), stringsAsFactors = FALSE)
  # «No binario» = 2 en la fuente: el 2 del instrumento es «No». Nunca se copia.
  df$q0001 <- .cfpt_lab(c(1, 2), c("Sí" = 1, "No binario" = 2), "¿Desea continuar?")
  df$q0002_0001 <- .cfpt_lab(c(1, 2), c("Totalmente en desacuerdo" = 1, "En desacuerdo" = 2), "x")
  df$q0003 <- c("a", "b")
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  fid <- .cfpt_registrar_archivo(sid, "sav", "sav", path)
  prev <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_identical(prev$opciones_sin_par, list(list(variable = "p1", n = 1L,
    etiquetas = list(list(etiqueta = "No binario", n = 1L)))))
  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_identical(.cfpt_leer_base(sid, imp$base_name)$p1, c("1", NA))
})

test_that("(a) una columna creada en la limpieza entra con su nombre y declarada; una pregunta SM sin par no entra", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo(), source = list(kind = "surveymonkey", survey_id = "111"))
  df <- data.frame(respondent_id = c("r1", "r2"), stringsAsFactors = FALSE)
  df$q0001 <- .cfpt_lab(c(1, 1), c("Sí" = 1, "No" = 2), "¿Desea continuar?")
  df$q0002_0001 <- .cfpt_lab(c(1, 2), c("Totalmente en desacuerdo" = 1, "En desacuerdo" = 2), "x")
  df$q0003 <- c("a", "b")
  df$q0099 <- c("x", "y")              # pregunta de la encuesta que el formulario no tiene
  df$anio_ingreso <- c(3, 7)           # derivada en SPSS
  attr(df$anio_ingreso, "label") <- "Años desde el ingreso"
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  fid <- .cfpt_registrar_archivo(sid, "sav", "sav", path)
  prev <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_identical(vapply(prev$sin_par_fuente, `[[`, "", "variable"), "q0099")
  expect_identical(prev$agregadas_fuente, list(list(variable = "anio_ingreso", etiqueta = "Años desde el ingreso")))
  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  datos <- .cfpt_leer_base(sid, imp$base_name)
  expect_true("anio_ingreso" %in% names(datos))
  expect_false("q0099" %in% names(datos))
  expect_equal(as.numeric(datos$anio_ingreso), c(3, 7))
})

# --- (b) SurveyMonkey por API: principal + campaña -----------------------------

.cfpt_op <- function(id, text, pos) list(id = id, text = text, position = pos)
.cfpt_single <- function(id, heading, labels) {
  list(id = id, family = "single_choice", subtype = "vertical",
       headings = list(list(heading = heading)),
       answers = list(choices = lapply(seq_along(labels), function(i) .cfpt_op(paste0(id, "c", i), labels[[i]], i))))
}
.cfpt_open <- function(id, heading) list(id = id, family = "open_ended", subtype = "single",
                                          headings = list(list(heading = heading)))
.cfpt_details <- function(survey_id, title, questions) {
  list(id = survey_id, title = title, pages = list(list(id = "pg1", questions = questions)))
}
.cfpt_acuerdo <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")

# Principal: consentimiento, código PUCP, satisfacción y cuatro preguntas Sí/No.
# Campaña: lo mismo sin el código (calza 7 de 8 variables, sobre el 80 %).
.cfpt_si_no <- function(prefijo) lapply(1:4, function(i) {
  .cfpt_single(paste0(prefijo, "s", i), paste("¿Conoce el servicio", i, "?"), c("Sí", "No"))
})
.cfpt_principal <- function() .cfpt_details("528", "Estudiantes", c(list(
  .cfpt_single("a1", "¿Desea continuar?", c("Sí", "No")),
  .cfpt_open("a2", "¿Cuál es su código PUCP?"),
  .cfpt_single("a3", "Los propósitos están claros", .cfpt_acuerdo)
), .cfpt_si_no("a")))
.cfpt_campana <- function() .cfpt_details("423", "Estudiantes por correo", c(list(
  .cfpt_single("b1", "¿Desea continuar?", c("Sí", "No")),
  .cfpt_single("b2", "Los propósitos están claros", .cfpt_acuerdo)
), .cfpt_si_no("b")))

.cfpt_response <- function(details, id, answers) {
  qs <- details$pages[[1]]$questions
  by_id <- stats::setNames(qs, vapply(qs, `[[`, "", "id"))
  questions <- lapply(names(answers), function(qid) {
    val <- answers[[qid]]
    if (is.list(val)) return(list(id = qid, answers = list(list(text = val$text))))
    ch <- by_id[[qid]]$answers$choices
    labs <- vapply(ch, `[[`, "", "text")
    list(id = qid, answers = list(list(choice_id = ch[[match(val, labs)]]$id)))
  })
  list(id = id, response_status = "completed", collector_id = "col1",
       date_created = "2026-10-01T10:00:00+00:00", date_modified = "2026-10-01T10:00:00+00:00",
       pages = list(list(id = "pg1", questions = questions)))
}

# Instrumento publicado = el que el traductor genera para la principal, con
# «SIN INF» llevado a 99 en el editor.
.cfpt_modelo_sm <- function() {
  model <- sm_api_xlsform(.cfpt_principal(), style = .sm_api_default_style(), lang = "es")
  lab <- grep("^label", names(model$choices), value = TRUE)[1]
  model$choices$name[model$choices[[lab]] == "SIN INF"] <- "99"
  model
}

.cfpt_mock_sm <- function(respuestas, env = parent.frame(), fallo = NULL) {
  .cfpt_mock(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) "tok-sintetico", env)
  .cfpt_mock("sm_api_fetch_survey_details", function(survey_id, token, base_url = NULL) {
    if (identical(fallo$en, "details")) fallo$hacer()
    switch(survey_id, "528" = .cfpt_principal(), "423" = .cfpt_campana(), stop("encuesta desconocida"))
  }, env)
  .cfpt_mock(".carga_platform_fetch_sm_bulk", function(survey_id, token, base_url = NULL) {
    if (identical(fallo$en, "bulk")) fallo$hacer()
    list(data = respuestas[[survey_id]] %||% list())
  }, env)
}

.cfpt_respuestas_sm <- function() {
  p <- .cfpt_principal()
  cam <- .cfpt_campana()
  list(
    "528" = list(
      .cfpt_response(p, "rp1", list(a1 = "Sí", a2 = list(text = "20201234"), a3 = "SIN INF")),
      .cfpt_response(p, "rp2", list(a1 = "Sí", a2 = list(text = "20205678"), a3 = "De acuerdo"))
    ),
    "423" = list(
      .cfpt_response(cam, "rc1", list(b1 = "Sí", b2 = "Totalmente de acuerdo")),
      .cfpt_response(cam, "rc2", list(b1 = "Sí", b2 = "SIN INF")),
      .cfpt_response(cam, "rc3", list(b1 = "Sí", b2 = "En desacuerdo"))
    )
  )
}

.cfpt_sm_fuente <- function(campanas = TRUE) {
  variants <- if (campanas) list(list(schema = "survey_campaign/v1", rol = "campana_complementaria",
                                      survey_id = "423", survey_title = "Estudiantes por correo")) else list()
  list(kind = "surveymonkey", survey_id = "528", survey_title = "Estudiantes", logic_status = "confirmed",
       variants = variants)
}

test_that("(b) principal + campaña: las filas se suman y la pregunta que la campaña no trae queda vacía para ella", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo_sm(), source = .cfpt_sm_fuente())
  .cfpt_mock_sm(.cfpt_respuestas_sm())
  body <- list(revision_id = "rev-1", fuente = "surveymonkey", incluir_campanas = TRUE)
  prev <- carga_formulario_publicado_vista_previa(sid, body)
  expect_null(prev$bloqueo)
  expect_identical(prev$n_filas, 5L)
  expect_identical(vapply(prev$fuentes, `[[`, 0L, "n_filas"), c(2L, 3L))
  expect_identical(vapply(prev$fuentes, `[[`, "", "survey_id"), c("528", "423"))
  expect_identical(prev$cobertura_texto, "100.0")
  expect_true(any(vapply(prev$recodificaciones, function(r) identical(r$desde, "5") && identical(r$hacia, "99"),
                         logical(1))))

  imp <- carga_formulario_publicado_importar(sid, body)
  expect_identical(imp$n_filas, 5L)
  datos <- .cfpt_leer_base(sid, imp$base_name)
  campana <- datos$survey_id == "423"
  expect_identical(sum(campana), 3L)
  expect_true(all(is.na(datos$p2[campana])))          # el código PUCP no existe en la campaña
  expect_identical(datos$p2[!campana], c("20201234", "20205678"))
  expect_identical(datos$p3[!campana], c("99", "3"))
  expect_identical(datos$p3[campana], c("4", "99", "2"))
  meta <- session_get(sid)$estudio$bases[[imp$base_name]]
  expect_identical(meta$source_kind, "formulario_publicado_surveymonkey")
  expect_identical(vapply(meta$sources, `[[`, "", "canal"), c("principal", "campana_complementaria"))
  expect_identical(meta$sm_alineacion_fuentes[[1]]$survey_id, "423")
})

test_that("(b) sin marcar campañas sólo entra la principal; una campaña sin respuestas aporta 0 filas sin error", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo_sm(), source = .cfpt_sm_fuente())
  respuestas <- .cfpt_respuestas_sm()
  .cfpt_mock_sm(respuestas)
  sola <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "surveymonkey"))
  expect_identical(sola$n_filas, 2L)
  expect_length(sola$fuentes, 1L)

  respuestas[["423"]] <- list()
  .cfpt_mock_sm(respuestas)
  vacia <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "surveymonkey",
                                                             incluir_campanas = TRUE))
  expect_null(vacia$bloqueo)
  expect_identical(vapply(vacia$fuentes, `[[`, 0L, "n_filas"), c(2L, 0L))
})

test_that("(b) transporte: credencial rechazada y timeout dan E_SM_API_FAILED sin el token; el rate limit conserva su código", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo_sm(), source = .cfpt_sm_fuente())
  body <- list(revision_id = "rev-1", fuente = "surveymonkey")

  .cfpt_mock_sm(list(), fallo = list(en = "details", hacer = function() stop("Token rechazado por SurveyMonkey (HTTP 401).")))
  e <- .cfpt_error(carga_formulario_publicado_vista_previa(sid, body))
  expect_identical(e$code, "E_SM_API_FAILED")
  expect_false(grepl("tok-sintetico", conditionMessage(e), fixed = TRUE))

  .cfpt_mock_sm(list(), fallo = list(en = "bulk", hacer = function() stop("Timeout was reached: [api.surveymonkey.com]")))
  expect_identical(.cfpt_error(carga_formulario_publicado_vista_previa(sid, body))$code, "E_SM_API_FAILED")

  .cfpt_mock_sm(list(), fallo = list(en = "bulk", hacer = function() stop_api(429, "E_SM_RATE_LIMIT", "límite")))
  expect_identical(.cfpt_error(carga_formulario_publicado_vista_previa(sid, body))$code, "E_SM_RATE_LIMIT")

  .cfpt_mock(".connections_token_require", function(...) stop_api(400, "E_SM_TOKEN", "Falta token SurveyMonkey guardado."))
  expect_identical(.cfpt_error(carga_formulario_publicado_vista_previa(sid, body))$code, "E_SM_TOKEN")
})

test_that("(b) importar desde SurveyMonkey corre como job con kind propio y el runner deja la base", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo_sm(), source = .cfpt_sm_fuente())
  capturado <- new.env(parent = emptyenv())
  .cfpt_mock("job_submit", function(sid, kind, func, args = list(), result_filename = NULL, on_complete = NULL,
                                    libpath = NULL, on_cleanup = NULL) {
    capturado$kind <- kind
    capturado$args <- args
    capturado$on_complete <- on_complete
    "job-cfp"
  })
  body <- list(revision_id = "rev-1", fuente = "surveymonkey", incluir_campanas = TRUE)
  handle <- carga_formulario_publicado_importar_endpoint(sid, body)
  expect_identical(handle$job_id, "job-cfp")
  expect_identical(capturado$kind, "carga.formulario_publicado_sm")
  # El body que viaja al worker no lleva secretos.
  expect_false("token" %in% names(readRDS(capturado$args$parsed_path)))

  .cfpt_mock_sm(.cfpt_respuestas_sm())
  resultado <- carga_platform_job_runner(sid, capturado$args$action, capturado$args$state_path,
                                         capturado$args$parsed_path, capturado$args$secrets_path)
  expect_true(isTRUE(resultado$ok))
  publico <- capturado$on_complete(list(sid = sid, result_data = resultado))
  expect_identical(publico$n_filas, 5L)
  expect_identical(publico$instrument_revision_id, "rev-1")
  expect_false(is.null(session_get(sid)$estudio$bases[[publico$base_name]]))
})

# --- (c) Excel -----------------------------------------------------------------

test_that("(c) un Excel con columnas del instrumento se normaliza; una etiqueta escrita se lleva a su código", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo())
  path <- tempfile(fileext = ".xlsx")
  writexl_df <- .cfpt_df(p1 = c("1", "2", "1"), p2_1 = c("SIN INF", "99", "Algo raro"),
                         p3 = c("x", "y", "z"), extra = c("a", "b", "c"))
  .carga_write_xlsx_sheet(writexl_df, path)
  fid <- .cfpt_registrar_archivo(sid, "data", "xlsx", path, "base.xlsx")
  prev <- carga_formulario_publicado_vista_previa(sid, list(revision_id = "rev-1", fuente = "excel", file_id = fid))
  expect_null(prev$bloqueo)
  expect_identical(prev$n_emparejadas, 3L)
  # Una columna del Excel que no es pregunta del formulario la agregó el analista: entra declarada.
  expect_identical(prev$sin_par_fuente, list())
  expect_identical(vapply(prev$agregadas_fuente, `[[`, "", "variable"), "extra")
  expect_identical(prev$opciones_sin_par, list(list(variable = "p2_1", n = 1L,
    etiquetas = list(list(etiqueta = "Algo raro", n = 1L)))))
  expect_true(any(vapply(prev$recodificaciones, function(r) identical(r$desde, "SIN INF") && identical(r$hacia, "99"),
                         logical(1))))
  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "excel", file_id = fid,
                                                       base_name = "mi_base"))
  expect_identical(imp$base_name, "mi_base")
  expect_identical(.cfpt_leer_base(sid, "mi_base")$p2_1, c("99", "99", NA))
})

# --- (d) cobertura -------------------------------------------------------------

test_that("(d) con menos del 80 % de las variables la vista previa bloquea y la importación falla con E_FUENTE_NO_CALZA", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo(), source = list(kind = "surveymonkey", survey_id = "111"))
  fid <- .cfpt_sav(sid, completo = FALSE)  # sólo p1 de 3
  body <- list(revision_id = "rev-1", fuente = "sav", file_id = fid)
  prev <- carga_formulario_publicado_vista_previa(sid, body)
  expect_identical(prev$bloqueo$codigo, "E_FUENTE_NO_CALZA")
  expect_identical(prev$cobertura_texto, "33.3")
  expect_setequal(vapply(prev$sin_par_instrumento, `[[`, "", "variable"), c("p2_1", "p3"))
  e <- .cfpt_error(carga_formulario_publicado_importar(sid, body))
  expect_identical(e$code, "E_FUENTE_NO_CALZA")
  expect_equal(e$status, 409)
  expect_length(session_get(sid)$estudio$bases %||% list(), 0L)
})

# --- (e) enlace con la revisión --------------------------------------------------

test_that("(e) la base queda ligada a la revisión elegida y el contrato de Validación la encuentra", {
  sid <- .cfpt_sesion()
  fuente <- list(kind = "surveymonkey", survey_id = "111", provenance = list(degree_year_rule = list(
    enforcement = "validation_coherence_rule_after_materialization",
    title_year_not_before_graduation = TRUE, title_has_year_if = "${p7} = '1'")))
  file_id <- .cfpt_publicar(sid, .cfpt_modelo(), source = fuente)
  fid <- .cfpt_sav(sid)
  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  s <- session_get(sid)
  meta <- s$estudio$bases[[imp$base_name]]
  expect_identical(imp$instrument_revision_id, "rev-1")
  expect_identical(meta$instrument_revision_id, "rev-1")
  expect_identical(meta$instrument_revision_binding, "matched")
  expect_identical(meta$xlsform_file_id, file_id)
  expect_identical(meta$formulario_publicado$revision_id, "rev-1")
  contrato <- instrument_validation_contract(s, meta$instrument_revision_id)
  expect_true(isTRUE(contrato$configured))
  expect_length(contrato$rules, 1L)

  # Otra importación con el mismo nombre choca; una revisión inexistente es 404.
  expect_identical(.cfpt_error(carga_formulario_publicado_importar(
    sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid)))$code, "E_BASE_EXISTE")
  e <- .cfpt_error(carga_formulario_publicado_vista_previa(sid, list(revision_id = "nada", fuente = "sav", file_id = fid)))
  expect_identical(e$code, "E_REVISION_NOT_FOUND")
  expect_equal(e$status, 404)
})

test_that("el listado trae la última revisión publicada de cada formulario, con campañas y campos", {
  sid <- .cfpt_sesion()
  .cfpt_publicar(sid, .cfpt_modelo_sm(), revision_id = "rev-1", revision_no = 1L, source = .cfpt_sm_fuente())
  .cfpt_publicar(sid, .cfpt_modelo_sm(), revision_id = "rev-2", revision_no = 2L, source = .cfpt_sm_fuente())
  out <- carga_formularios_publicados(sid)
  expect_length(out$formularios, 1L)
  f <- out$formularios[[1]]
  expect_identical(f$revision_id, "rev-2")
  expect_identical(f$revision_no, 2L)
  expect_identical(f$survey_id, "528")
  expect_identical(f$campanas, list(list(survey_id = "423", titulo = "Estudiantes por correo")))
  expect_identical(f$logic_status, "confirmed")
  expect_false(f$logic_external)
  expect_identical(f$n_campos, 7L)
})

# --- (f) lógica declarada fuera -------------------------------------------------

test_that("(f) un formulario con la lógica declarada fuera crea una base de partida declarada", {
  sid <- .cfpt_sesion()
  fuente <- list(kind = "surveymonkey", survey_id = "111", logic_status = "external_declared",
                 logic_external = list(herramienta = "SPSS", nota = "Limpieza en sintaxis", declarada_en = "2026-10-14"))
  .cfpt_publicar(sid, .cfpt_modelo(), source = fuente)
  fid <- .cfpt_sav(sid)
  imp <- carga_formulario_publicado_importar(sid, list(revision_id = "rev-1", fuente = "sav", file_id = fid))
  expect_true(isTRUE(imp$origen_declarado))
  meta <- session_get(sid)$estudio$bases[[imp$base_name]]
  bloque <- meta$origen_externo
  expect_true(isTRUE(bloque$enabled))
  expect_identical(bloque$herramienta, "SPSS")
  expect_true(isTRUE(bloque$logica_y_limpieza_fuera))
  expect_identical(bloque$instrument_revision_id, "rev-1")
  expect_identical(bloque$n_entregadas, 4L)
  expect_identical(origen_externo_consultar(sid, imp$base_name)$estado, "vigente")
  listado <- carga_formularios_publicados(sid)$formularios[[1]]
  expect_true(isTRUE(listado$logic_external))
  expect_identical(listado$logic_external_herramienta, "SPSS")
})
