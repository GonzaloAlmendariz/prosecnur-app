# Regresión: editar un criterio propio respondía 500.
#
# El editor manda la regla entera en el cuerpo del PUT, `id` incluido. Plumber
# vuelca los campos del JSON como argumentos del handler y el `id` del cuerpo
# chocaba con el `<id>` de la ruta: "formal argument id matched by multiple
# actual arguments". Sólo el interruptor de activar/omitir funcionaba, porque
# su cuerpo no trae `id`.

.rc_put_call <- function(pr, sid, path, body) {
  raw_body <- charToRaw(enc2utf8(body))
  input <- list(read = function(...) raw_body, rewind = function() invisible(0),
                read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = "PUT", PATH_INFO = path, QUERY_STRING = "",
    CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

.rc_put_fixture <- function() {
  sid <- session_create()
  validacion_scope_set(sid, NULL, "reglas_custom", list(list(
    id = "RC_001", activa = TRUE, nombre = "Edad fuera de rango",
    tipo = "rango_num", variables = list("edad"),
    params = list(min = "16", max = "25"), mensaje = "Edad fuera de rango",
    severidad = "advertencia", hallazgo_kind = "caso_validar"
  )))
  sid
}

test_that("PUT de un criterio acepta el id también en el cuerpo", {
  pr <- mount_validacion(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  sid <- .rc_put_fixture()
  body <- jsonlite::toJSON(list(
    id = "RC_001",
    hallazgo_kind = "inconsistencia_usuario",
    severidad = "error"
  ), auto_unbox = TRUE)

  res <- .rc_put_call(pr, sid, "/api/validacion/v2/reglas_custom/RC_001", as.character(body))

  expect_identical(res$status, 200L)
  guardada <- validacion_scope_get(sid, NULL)$reglas_custom[[1]]
  expect_identical(guardada$hallazgo_kind, "inconsistencia_usuario")
  expect_identical(guardada$severidad, "error")
})

test_that("el id de la ruta manda aunque el cuerpo traiga otro", {
  pr <- mount_validacion(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  sid <- .rc_put_fixture()
  body <- jsonlite::toJSON(list(id = "RC_999", nombre = "Renombrada"), auto_unbox = TRUE)

  res <- .rc_put_call(pr, sid, "/api/validacion/v2/reglas_custom/RC_001", as.character(body))

  expect_identical(res$status, 200L)
  reglas <- validacion_scope_get(sid, NULL)$reglas_custom
  expect_length(reglas, 1L)
  expect_identical(reglas[[1]]$id, "RC_001")
  expect_identical(reglas[[1]]$nombre, "Renombrada")
})
