# Usar en Carga el formulario del editor del mismo proyecto
# (carga_formulario_del_editor.R). Ítem 23 del checklist de validación del
# practicante: antes había que exportarlo de Formularios y volver a subirlo.

.cfde_hoja <- function(columnas, filas) {
  list(columns = as.list(columnas), rows = lapply(filas, as.list))
}

.cfde_workbook <- function() {
  list(
    survey = .cfde_hoja(
      c("type", "name", "label", "paper_nota"),
      list(c("integer", "edad", "Edad", "solo papel"),
           c("select_one sn", "trabaja", "¿Trabaja?", ""),
           c("text", "distrito", "Distrito", ""))
    ),
    choices = .cfde_hoja(c("list_name", "name", "label"),
                         list(c("sn", "1", "Sí"), c("sn", "2", "No"))),
    settings = .cfde_hoja(c("form_title"), list(c("Encuesta de prueba")))
  )
}

.cfde_sesion_con_formulario <- function(env = parent.frame(), workbook = .cfde_workbook()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  s <- session_get(sid)
  s$xlsform_forms <- list(`form-1` = list(id = "form-1", name = "Encuesta Hogares 2026",
                                          workbook = workbook, source = list(kind = "editor"),
                                          saved_at = "2026-11-12T10:00:00Z"))
  s$xlsform_active_form_id <- "form-1"
  .session_env[[sid]] <- s
  sid
}

.cfde_post <- function(sid, form_id) {
  ep <- .bv_endpoint(mount_carga, "POST", "/api/carga/instrumento/desde-editor")
  res <- plumber:::PlumberResponse$new()
  out <- tryCatch(ep$getFunc()(req = .bv_req(sid), res = res, form_id = form_id),
                  api_error = function(e) list(error = list(code = e$code, message = conditionMessage(e)),
                                               status = e$status))
  list(status = out$status %||% res$status, body = out)
}

test_that("el formulario del editor queda como el formulario de la base, sin subir un archivo", {
  sid <- .cfde_sesion_con_formulario()
  r <- .cfde_post(sid, "form-1")
  expect_equal(r$status, 200)
  expect_true(isTRUE(r$body$ok))
  expect_identical(r$body$resumen$n_preguntas, 3L)
  expect_identical(r$body$original_name, "encuesta_hogares_2026.xlsx")

  s <- session_get(sid)
  expect_false(is.null(s$instrumento))
  expect_setequal(intersect(c("edad", "trabaja", "distrito"), s$instrumento$survey$name),
                  c("edad", "trabaja", "distrito"))
  # Las columnas de edición (`paper_*`) no pasan al formulario de la base.
  expect_false("paper_nota" %in% names(s$instrumento$survey))
  meta <- s$files[[r$body$file_id]]
  expect_identical(meta$kind, "xlsform")
  expect_true(file.exists(meta$path))
})

test_that("un formulario que no existe o sin preguntas falla con su causa", {
  sid <- .cfde_sesion_con_formulario()
  r <- .cfde_post(sid, "otro")
  expect_identical(r$body$error$code, "E_FORM_NOT_FOUND")
  expect_match(r$body$error$message, "\"otro\"", fixed = TRUE)
  r0 <- .cfde_post(sid, "")
  expect_identical(r0$body$error$code, "E_FORM_NOT_FOUND")
  expect_null(session_get(sid)$instrumento)

  vacio <- .cfde_workbook()
  vacio$survey$rows <- list(list("note", "intro", "Bienvenida", ""))
  sid2 <- .cfde_sesion_con_formulario(workbook = vacio)
  r2 <- .cfde_post(sid2, "form-1")
  expect_identical(r2$body$error$code, "E_FORM_MISSING_WORKBOOK")
  expect_match(r2$body$error$message, "Encuesta Hogares 2026", fixed = TRUE)
  expect_length(session_get(sid2)$files %||% list(), 0L)
})

test_that("la subida de un archivo sigue registrando el formulario por el mismo camino", {
  sid <- .cfde_sesion_con_formulario()
  meta <- .carga_subir_formulario_del_editor(sid, "form-1")
  ep <- .bv_endpoint(mount_carga, "POST", "/api/carga/instrumento")
  res <- plumber:::PlumberResponse$new()
  out <- ep$getFunc()(req = .bv_req(sid), res = res, file_id = meta$file_id)
  expect_true(isTRUE(out$ok))
  expect_identical(out$resumen$n_preguntas, 3L)
})
