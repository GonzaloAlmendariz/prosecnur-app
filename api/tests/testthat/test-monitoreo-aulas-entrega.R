# X8 (ADR 0122 §11): Monitoreo trae la entrega de Material a su plan con la
# misma regla que tenía la escritura vieja: lo operativo de una fila existente
# se conserva; sólo se actualizan los campos de la entrega y del acceso.

test_that("una fila existente conserva lo operativo y recibe el acceso nuevo", {
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", sample_status = "APLICADA",
         scheduled_date = "2026-09-21", link = "viejo"),
    list(operational_code = "EXTRA 3", sample_role = "extra_reserve_pool")
  )
  unidades <- list(
    list(collection_unit_id = "u1", operational_code = "CH 1", sample_role = "titular",
         operational_status = "planificada", link = "nuevo", access_id = "a1",
         collection_deployment_fingerprint = "fp1"),
    list(collection_unit_id = "u2", operational_code = "CH 2", sample_role = "titular",
         operational_status = "planificada", link = "otro", collection_deployment_fingerprint = "fp1")
  )
  r <- .monitoreo_aulas_aplicar_entrega(plan, unidades)
  expect_identical(c(r$actualizadas, r$agregadas, r$conservadas), c(1L, 1L, 1L))
  ch1 <- r$plan[[1]]
  expect_identical(ch1$sample_status, "APLICADA")
  expect_identical(ch1$scheduled_date, "2026-09-21")
  expect_identical(ch1$link, "nuevo")
  expect_identical(ch1$collection_deployment_fingerprint, "fp1")
  # El banco no viene en la entrega y se queda.
  expect_identical(r$plan[[2]]$operational_code, "EXTRA 3")
  expect_identical(r$plan[[3]]$operational_code, "CH 2")
})

test_that("aplicar dos veces la misma entrega no duplica filas", {
  unidades <- list(list(collection_unit_id = "u1", operational_code = "CH 1", link = "l"))
  una <- .monitoreo_aulas_aplicar_entrega(list(), unidades)$plan
  dos <- .monitoreo_aulas_aplicar_entrega(una, unidades)
  expect_length(dos$plan, 1L)
  expect_identical(dos$actualizadas, 1L)
})

test_that("el estado dice si la entrega falta, está por traer o ya se aplicó", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  s <- session_get(sid); s$project_path <- "/tmp/entrega-test.pulso"; s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  local_mocked_bindings(collection_aulas_entrega_get = function(sid) list(
    entregada = TRUE, vigente = TRUE, deployment_fingerprint = "fp1",
    handoff = list(handed_off_at = "2026-10-31T20:00:00Z"),
    unidades = list(list(collection_unit_id = "u1", operational_code = "CH 1", collection_deployment_fingerprint = "fp1"))
  ))
  expect_identical(monitoreo_aulas_entrega_estado(sid)$estado, "por_traer")
  r <- monitoreo_aulas_traer_entrega(sid)
  expect_identical(r$agregadas, 1L)
  expect_identical(monitoreo_aulas_entrega_estado(sid)$estado, "aplicada")
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("una entrega no vigente no se trae", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  local_mocked_bindings(collection_aulas_entrega_get = function(sid) list(entregada = TRUE, vigente = FALSE, unidades = list()))
  expect_identical(monitoreo_aulas_entrega_estado(sid)$estado, "desactualizada")
  err <- tryCatch(monitoreo_aulas_traer_entrega(sid), error = identity)
  expect_equal(err$code, "E_COLLECTION_HANDOFF_STALE")
})
