# Campañas complementarias de un instrumento (ADR 0101, xlsform_campanas.R): otra encuesta SurveyMonkey del mismo
# instrumento se declara dentro del formulario principal, emparejada por pregunta (ADR 0099). Sin red: la definición
# de la campaña y su XLSForm generado se sustituyen.

wb_sheet <- function(columns, rows) list(columns = as.list(columns), rows = lapply(rows, as.list))

# El instrumento principal: consentimiento, edad, código institucional y una satisfacción.
wb_principal <- function(extra_label = NULL) list(
  survey = wb_sheet(c("type", "name", "label::es"), list(
    c("select_one lst_si", "p1", "¿Desea continuar con la encuesta?"),
    c("integer", "p2", "¿Cuántos años tiene?"),
    c("text", "p3", "¿Cuál es su código PUCP?"),
    c("select_one lst_sat", "p4", extra_label %||% "¿Qué tan satisfecho está con la Facultad?"),
    c("select_one lst_sat", "p5_1", "Servicio de salud"),
    c("select_one lst_sat", "p5_2", "Servicio de bienestar psicológico"),
    c("select_one lst_sat", "p5_3", "Actividades culturales")
  )),
  choices = wb_sheet(c("list_name", "name", "label::es"), list(
    c("lst_si", "1", "Sí"), c("lst_si", "2", "No"),
    c("lst_sat", "1", "Insatisfecho"), c("lst_sat", "2", "Satisfecho"), c("lst_sat", "3", "SIN INF")
  )),
  settings = wb_sheet(c("form_title"), list(c("Arte - Estudiantes")))
)

modelo_campana <- function(sin_codigo = TRUE) {
  sv <- if (sin_codigo) {
    data.frame(type = c("select_one lst_si", "integer", rep("select_one lst_sat", 4)),
               name = c("p1", "p2", "p3", "p4_1", "p4_2", "p4_3"),
               `label::es` = c("¿Desea continuar con la encuesta?", "¿Cuántos años tiene?",
                               "¿Qué tan satisfecho está con la Facultad?", "Servicio de salud",
                               "Servicio de bienestar psicológico", "Actividades culturales"), check.names = FALSE)
  } else {
    data.frame(type = c("text", "text"), name = c("p1", "p2"), `label::es` = c("Sede", "Turno"), check.names = FALSE)
  }
  list(
    survey = sv,
    choices = data.frame(list_name = c("lst_si", "lst_si", "lst_sat", "lst_sat", "lst_sat"),
                         name = c("1", "2", "1", "2", "3"),
                         `label::es` = c("Sí", "No", "Insatisfecho", "Satisfecho", "SIN INF"), check.names = FALSE),
    settings = data.frame(form_title = "Arte - Estudiantes (correo)")
  )
}

sesion_con_formulario <- function(survey_id = "111") {
  sid <- session_create()
  s <- session_get(sid)
  entry <- .xlsform_forms_as_entry(list(
    workbook = wb_principal(),
    source = list(kind = "surveymonkey", survey_id = survey_id, survey_title = "Arte - Estudiantes")
  ), id = "form-est")
  s <- .xlsform_forms_upsert(s, entry)
  .session_env[[sid]] <- s
  sid
}

mock_campana <- function(env = parent.frame(), sin_codigo = TRUE) {
  local_mocked_bindings(
    .connections_token_require = function(...) "tok",
    sm_api_fetch_survey_details = function(id, token, ...) list(id = id, title = "Arte - Estudiantes (correo)"),
    .sm_mb_inst_generado = function(details, ...) {
      p <- tempfile(fileext = ".xlsx")
      .sm_mb_write_xlsform_model(modelo_campana(sin_codigo), p)
      reporte_instrumento(path = p)
    },
    .xlsform_editor_sm_definition = function(details, survey_id, ...) list(survey_id = survey_id, sha256 = "def-sha"),
    .env = env
  )
}

test_that("la vista previa empareja por pregunta y dice qué quedará vacío para la campaña", {
  sid <- sesion_con_formulario()
  mock_campana()
  previa <- xlsform_campana_vista_previa(sid, "form-est", "222")
  expect_identical(previa$n_emparejadas, 6L)
  expect_identical(previa$n_preguntas_base, 7L)
  expect_identical(previa$cobertura_texto, "85.7 %")
  expect_false(previa$instrumento_distinto)
  expect_identical(vapply(previa$faltan, `[[`, "", "variable"), "p3")
  expect_length(previa$extra, 0L)
  # La vista previa no escribe nada.
  expect_length(session_get(sid)$xlsform_forms[["form-est"]]$source$variants %||% list(), 0L)
})

test_that("declarar guarda la campaña como variante confirmada, con el mapa por pregunta madre", {
  sid <- sesion_con_formulario()
  mock_campana()
  r <- xlsform_campana_declarar(sid, "form-est", "222")
  variants <- session_get(sid)$xlsform_forms[["form-est"]]$source$variants
  expect_length(variants, 1L)
  v <- variants[[1]]
  expect_identical(v$rol, "campana_complementaria")
  expect_identical(v$survey_id, "222")
  expect_identical(v$review_status, "confirmed")
  # La satisfacción es p3 en la campaña y p4 en el instrumento: la posición no decide.
  madres <- stats::setNames(vapply(v$variant_map_draft, `[[`, "", "to"), vapply(v$variant_map_draft, `[[`, "", "from"))
  expect_identical(madres[["p3"]], "p4")
  expect_identical(madres[["p2"]], "p2")
  # Las filas de la matriz siguen a su madre: p4_* de la campaña son p5_* del instrumento.
  expect_identical(madres[["p4"]], "p5")
  expect_length(v$madres_en_conflicto, 0L)
  expect_identical(vapply(v$sin_par_base, `[[`, "", "variable"), "p3")
  expect_identical(v$logic_review$content_sha256,
                   .xlsform_revision_hash(session_get(sid)$xlsform_forms[["form-est"]]$workbook))
  expect_identical(r$campana$survey_id, "222")
  expect_true(isTRUE(session_get(sid)$project_dirty) || is.null(session_get(sid)$project_path))
})

test_that("la campaña declarada no bloquea la publicación hasta que el borrador cambia", {
  sid <- sesion_con_formulario()
  mock_campana()
  # Las variantes se revisan cuando la lógica del formulario ya está confirmada.
  s <- session_get(sid)
  s$xlsform_forms[["form-est"]]$source$logic_status <- "confirmed"
  s$xlsform_forms[["form-est"]]$source$logic_review <- list(content_sha256 = .xlsform_revision_hash(wb_principal()))
  .session_env[[sid]] <- s
  xlsform_campana_declarar(sid, "form-est", "222")
  entry <- session_get(sid)$xlsform_forms[["form-est"]]
  ids <- function(wb) vapply(.xlsform_revision_logic_blockers(entry$source, .xlsform_revision_hash(wb), wb),
                             function(b) b$id, "")
  expect_false(any(grepl("^logic_variant", ids(entry$workbook))))
  cambiado <- wb_principal(extra_label = "¿Qué tan satisfecho está con la Universidad?")
  expect_true("logic_variant_confirmation_stale" %in% ids(cambiado))
})

test_that("una encuesta que casi no comparte preguntas no se declara: es otro cuestionario", {
  sid <- sesion_con_formulario()
  mock_campana(sin_codigo = FALSE)
  expect_true(xlsform_campana_vista_previa(sid, "form-est", "333")$instrumento_distinto)
  err <- tryCatch(xlsform_campana_declarar(sid, "form-est", "333"), api_error = function(e) e)
  expect_identical(err$code, "E_CAMPANA_OTRO_INSTRUMENTO")
  expect_length(session_get(sid)$xlsform_forms[["form-est"]]$source$variants %||% list(), 0L)
})

test_that("la principal, una repetida o un formulario que no viene de SurveyMonkey no se declaran", {
  sid <- sesion_con_formulario()
  mock_campana()
  code <- function(expr) tryCatch({ force(expr); "" }, api_error = function(e) e$code)
  expect_identical(code(xlsform_campana_declarar(sid, "form-est", "111")), "E_CAMPANA_ES_PRINCIPAL")
  xlsform_campana_declarar(sid, "form-est", "222")
  expect_identical(code(xlsform_campana_declarar(sid, "form-est", "222")), "E_CAMPANA_REPETIDA")
  expect_identical(code(xlsform_campana_declarar(sid, "no-existe", "222")), "E_FORM_NOT_FOUND")

  sid2 <- sesion_con_formulario(survey_id = "")
  expect_identical(code(xlsform_campana_vista_previa(sid2, "form-est", "222")), "E_CAMPANA_SIN_PRINCIPAL")
})

test_that("quitar una campaña la saca de la procedencia", {
  sid <- sesion_con_formulario()
  mock_campana()
  xlsform_campana_declarar(sid, "form-est", "222")
  xlsform_campana_quitar(sid, "form-est", "222")
  expect_length(session_get(sid)$xlsform_forms[["form-est"]]$source$variants %||% list(), 0L)
  err <- tryCatch(xlsform_campana_quitar(sid, "form-est", "222"), api_error = function(e) e)
  expect_identical(err$code, "E_CAMPANA_NO_ENCONTRADA")
})

test_that("el autosave del editor no borra una campaña declarada con la copia vieja de la procedencia", {
  sid <- sesion_con_formulario()
  mock_campana()
  xlsform_campana_declarar(sid, "form-est", "222")
  s <- session_get(sid)
  # El cliente cargó el formulario antes de declarar: manda `variants` vacío.
  autosave <- .xlsform_forms_as_entry(list(
    workbook = wb_principal(),
    source = list(kind = "surveymonkey", survey_id = "111", variants = list())
  ), id = "form-est")
  s <- .xlsform_forms_upsert(s, autosave, cliente = TRUE)
  variants <- s$xlsform_forms[["form-est"]]$source$variants
  expect_length(variants, 1L)
  expect_identical(variants[[1]]$survey_id, "222")
})

test_that("al importar, una encuesta que calza con un formulario existente se sugiere como su campaña", {
  sid <- sesion_con_formulario()
  mock_campana()
  sug <- xlsform_campana_sugerir(sid, "222")$sugerencia
  expect_identical(sug$form_id, "form-est")
  expect_identical(sug$n_emparejadas, 6L)
  # La encuesta principal de un formulario no se sugiere como campaña de sí mismo.
  expect_null(xlsform_campana_sugerir(sid, "111")$sugerencia)
  # Ya declarada, deja de sugerirse.
  xlsform_campana_declarar(sid, "form-est", "222")
  expect_null(xlsform_campana_sugerir(sid, "222")$sugerencia)
})

test_that("sin par: otra encuesta no se sugiere", {
  sid <- sesion_con_formulario()
  mock_campana(sin_codigo = FALSE)
  expect_null(xlsform_campana_sugerir(sid, "333")$sugerencia)
})
