# Control › Subsanaciones: el coordinador rechaza un paquete sugerido y el
# rechazo queda auditado (nota, autor, fecha) y persistido en la sesión. Sin
# red; paquetes sintéticos sin datos personales.

.rechazo_sugerencia <- function(...) {
  utils::modifyList(list(
    id = "oppkg_1", source_block_id = "m142", target_block_id = "m143",
    source_ump = "UMP 142", target_ump = "UMP 143", sex = "Hombre", age_group = "30-44", count = 1
  ), list(...))
}

test_that("la clave del paquete es lo que mueve, sin importar el orden ni las mayúsculas", {
  a <- monitoreo_territorial_rechazo_clave_paquete(.rechazo_sugerencia())
  b <- monitoreo_territorial_rechazo_clave_paquete(.rechazo_sugerencia(id = "otro", sex = "HOMBRE"))
  expect_equal(a, "m142|m143|hombre|30-44")
  expect_equal(a, b)
  paquete <- .rechazo_sugerencia(adjustments = list(
    list(source_block_id = "m142", target_block_id = "m143", sex = "Mujer", age_group = "60+"),
    list(source_block_id = "m140", target_block_id = "m143", sex = "Hombre", age_group = "18-29")
  ))
  expect_equal(monitoreo_territorial_rechazo_clave_paquete(paquete), "m140|m143|hombre|18-29;m142|m143|mujer|60+")
})

test_that("el rechazo lleva nota, autor, fecha y fase", {
  r <- monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(), nota = " Campo confirma que no hay hombre de 30-44 ", autor = "coordinacion", phase = "field", fecha = "2026-07-03T20:30:00")
  expect_match(r$id, "^rechazo_")
  expect_equal(r$nota, "Campo confirma que no hay hombre de 30-44")
  expect_equal(r$autor, "coordinacion")
  expect_equal(r$fecha, "2026-07-03T20:30:00")
  expect_equal(r$phase, "field")
  expect_equal(r$estado, "activo")
  expect_equal(r$target_ump, "UMP 143")
  expect_equal(monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(), fecha = "x")$autor, "local")
})

test_that("un paquete sin manzanas de origen y destino no se puede rechazar", {
  err <- tryCatch(monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(source_block_id = "")), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_MONITOREO_TERRITORIAL_RECHAZO_INVALIDO")
  expect_equal(err$status, 400)
  err <- tryCatch(monitoreo_territorial_rechazo_nuevo(NULL), api_error = function(e) e)
  expect_equal(err$code, "E_MONITOREO_TERRITORIAL_RECHAZO_INVALIDO")
})

test_that("rechazar de nuevo el mismo paquete actualiza la entrada en lugar de duplicarla", {
  primero <- monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(), nota = "uno", fecha = "2026-07-03T20:30:00")
  segundo <- monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(id = "oppkg_2"), nota = "dos", fecha = "2026-07-04T09:00:00")
  otro <- monitoreo_territorial_rechazo_nuevo(.rechazo_sugerencia(source_block_id = "m100"), fecha = "2026-07-04T09:00:00")
  rechazos <- monitoreo_territorial_rechazos_agregar(NULL, primero)
  rechazos <- monitoreo_territorial_rechazos_agregar(rechazos, segundo)
  rechazos <- monitoreo_territorial_rechazos_agregar(rechazos, otro)
  expect_length(rechazos$field, 2L)
  expect_equal(rechazos$field[[1]]$nota, "dos")
  expect_equal(rechazos$field[[1]]$id, primero$id)
  expect_length(rechazos$pilot, 0L)
})

test_that("lo guardado se normaliza y tolera un .pulso viejo sin la clave", {
  expect_equal(monitoreo_territorial_rechazos_normalizar(NULL), list(pilot = list(), field = list()))
  sucio <- list(field = list(list(id = "x", clave_paquete = "a|b||"), list(id = ""), "basura"))
  expect_length(monitoreo_territorial_rechazos_normalizar(sucio)$field, 1L)
})

test_that("el rechazo queda en la sesión y se lista por fase", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial"), territorial = list(active_route_phase = "field")))
  out <- .monitoreo_territorial_rechazar_from_session(sid, list(sugerencia = .rechazo_sugerencia(), nota = "No cuadra con el parte"))
  expect_true(out$ok)
  expect_length(out$rechazos, 1L)
  guardado <- session_get(sid)$monitoreo_territorial_rechazos
  expect_equal(guardado$field[[1]]$nota, "No cuadra con el parte")
  lista <- .monitoreo_territorial_rechazos_listar_from_session(sid)
  expect_equal(lista$phase, "field")
  expect_equal(lista$rechazos[[1]]$clave_paquete, "m142|m143|hombre|30-44")
})

test_that("fuera de un monitoreo territorial no se rechaza", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(.monitoreo_territorial_rechazar_from_session(sid, list(sugerencia = .rechazo_sugerencia())), api_error = function(e) e)
  expect_equal(err$code, "E_MONITOREO_TERRITORIAL_REQUIRED")
})
