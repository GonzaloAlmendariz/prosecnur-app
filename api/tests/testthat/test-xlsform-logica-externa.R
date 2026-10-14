# Lógica y limpieza hechas fuera de Prosecnur (xlsform_logica_externa.R): declararlo permite publicar sin
# confirmar la lógica en la app, queda trazado y se puede retirar.

form_sm_pendiente <- function() {
  sid <- session_create()
  s <- session_get(sid)
  entry <- .xlsform_forms_as_entry(list(
    workbook = list(
      survey = list(columns = list("type", "name", "label::es"),
                    rows = list(list("select_one lst_si", "p1", "¿Desea continuar?"),
                                list("integer", "p2", "Edad"))),
      choices = list(columns = list("list_name", "name", "label::es"),
                     rows = list(list("lst_si", "1", "Sí"), list("lst_si", "2", "No"))),
      settings = list(columns = list("form_title", "form_id"), rows = list(list("Arte", "arte")))
    ),
    source = list(kind = "surveymonkey", survey_id = "111", logic_status = "pending_manual_confirmation")
  ), id = "form-x")
  s <- .xlsform_forms_upsert(s, entry)
  .session_env[[sid]] <- s
  sid
}

test_that("declarar la lógica hecha fuera deja publicar sin confirmarla en la app", {
  sid <- form_sm_pendiente()
  antes <- .xlsform_revision_publication(session_get(sid), session_get(sid)$xlsform_forms[["form-x"]])
  expect_true("logic_pending_manual_confirmation" %in% vapply(antes$blockers, `[[`, "", "id"))

  r <- xlsform_logica_externa_declarar(sid, "form-x", herramienta = "SPSS")
  expect_identical(r$source$logic_status, "external_declared")
  expect_identical(r$source$logic_external$herramienta, "SPSS")
  expect_false(any(grepl("^logic_", vapply(r$publication$blockers, `[[`, "", "id"))))
  expect_true(r$publication$can_publish)
})

test_that("retirar la declaración vuelve a pedir la confirmación; retirar sin declarar es un error", {
  sid <- form_sm_pendiente()
  err <- tryCatch(xlsform_logica_externa_declarar(sid, "form-x", declarada = FALSE), api_error = function(e) e)
  expect_identical(err$code, "E_LOGICA_EXTERNA_NO_DECLARADA")
  xlsform_logica_externa_declarar(sid, "form-x")
  r <- xlsform_logica_externa_declarar(sid, "form-x", declarada = FALSE)
  expect_identical(r$source$logic_status, "pending_manual_confirmation")
  expect_length(r$source$logic_external %||% list(), 0L)
  expect_false(r$publication$can_publish)
})
