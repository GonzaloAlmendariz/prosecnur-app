# Regresión: los dos PATCH de una regla del formulario respondían 500 si el
# cuerpo traía `id_regla`.
#
# Plumber vuelca los campos del JSON como argumentos del handler. Con
# `id_regla = NULL` como argumento formal, un cuerpo con `id_regla` (el panel
# nuevo manda la regla entera) chocaba con el `<id_regla>` de la ruta: "formal
# argument id_regla matched by multiple actual arguments". Es el mismo error
# que tuvo el PUT de reglas propias (test-validacion-reglas-custom-put-id.R).

.pr_patch_call <- function(pr, sid, path, body) {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0),
                read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = "PATCH", PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.pr_patch_fixture <- function() {
  inst <- list(
    survey = data.frame(type = "integer", name = "edad", label = "Edad",
                        required = "yes", relevant = "", constraint = "",
                        stringsAsFactors = FALSE),
    choices = data.frame(stringsAsFactors = FALSE)
  )
  bundle <- build_validation_bundle(inst, incluir = list(required = TRUE, relevant = FALSE, constraint = FALSE))
  plan <- compile_rules_to_plan(bundle$rules)
  sid <- session_create()
  validacion_scope_set(sid, NULL, "plan_result", list(plan = plan, bundle = bundle))
  list(sid = sid, id = as.character(bundle$rules[[1]]$id))
}

.pr_router <- function() {
  mount_validacion(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

test_that("PATCH /activa acepta el id_regla también en el cuerpo", {
  fx <- .pr_patch_fixture()
  body <- jsonlite::toJSON(list(id_regla = fx$id, activa = FALSE, motivo = "No aplica en esta población"),
                           auto_unbox = TRUE)
  res <- .pr_patch_call(.pr_router(), fx$sid,
                        sprintf("/api/validacion/v2/instrumento/regla/%s/activa", fx$id),
                        as.character(body))
  expect_identical(res$status, 200L)
  expect_identical(session_get(fx$sid)$reglas_desactivadas, fx$id)
})

test_that("PATCH /activa: manda el id de la ruta aunque el cuerpo traiga otro", {
  fx <- .pr_patch_fixture()
  body <- jsonlite::toJSON(list(id_regla = "OTRA", activa = FALSE, motivo = "Duplica otro control"),
                           auto_unbox = TRUE)
  res <- .pr_patch_call(.pr_router(), fx$sid,
                        sprintf("/api/validacion/v2/instrumento/regla/%s/activa", fx$id),
                        as.character(body))
  expect_identical(res$status, 200L)
  expect_identical(res$body$id_regla, fx$id)
  expect_identical(session_get(fx$sid)$reglas_desactivadas, fx$id)
})

test_that("PATCH /atributos acepta el id_regla también en el cuerpo", {
  fx <- .pr_patch_fixture()
  body <- jsonlite::toJSON(list(id_regla = fx$id, nombre = "Edad sin responder"), auto_unbox = TRUE)
  res <- .pr_patch_call(.pr_router(), fx$sid,
                        sprintf("/api/validacion/v2/instrumento/regla/%s/atributos", fx$id),
                        as.character(body))
  expect_identical(res$status, 200L)
  expect_identical(res$body$id_regla, fx$id)
})

test_that("PATCH /atributos: un id de ruta que no está en el plan responde 404", {
  fx <- .pr_patch_fixture()
  body <- jsonlite::toJSON(list(id_regla = fx$id, nombre = "x"), auto_unbox = TRUE)
  res <- .pr_patch_call(.pr_router(), fx$sid,
                        "/api/validacion/v2/instrumento/regla/NO_EXISTE/atributos",
                        as.character(body))
  expect_identical(res$status, 404L)
  expect_identical(res$body$error$code %||% res$body$code, "E_REGLA_NOT_FOUND")
})
