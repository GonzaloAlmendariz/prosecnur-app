# Etapa 3: la entrega de aulas de solo lectura para Monitoreo y las plantillas del equipo
# de aulas desde Material (collection_aulas_material.R).

.mau_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

# El mismo plan legado que usa test-collection-engine.R.
.mau_legacy <- function() list(
  list(selection_run_id = "sel-1", classroom_id = "A-01", operational_code = "OP-01", label = "Aula 1", wave = "M1",
       faculty = "Ingeniería", link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=OP-01"),
  list(selection_run_id = "sel-1", classroom_id = "A-02", operational_code = "OP-02", label = "Aula 2", wave = "M1",
       faculty = "Derecho", link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=OP-02")
)

test_that("sin entrega: el GET lo dice, el libro es 409 y la disponibilidad sale igual", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_aulas_entrega_get(sid)
  expect_false(g$entregada)
  expect_length(g$unidades, 0L)
  expect_identical(.mau_code(collection_aulas_plantilla(sid, "libro")), "E_COLLECTION_HANDOFF_NOT_READY")
  d <- collection_aulas_plantilla(sid, "disponibilidad")
  expect_true(file.exists(session_get(sid)$files[[d$file_id]]$path))
  expect_identical(.mau_code(collection_aulas_plantilla(sid, "otra")), "E_COLLECTION_CAMPAIGN_INVALID")
})

test_that("con entrega: el GET trae el recibo sellado y las unidades, y el libro sale de ellas sin tocar a Monitoreo", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .mau_legacy())
  seeded <- collection_state_seed(sid)
  collection_handoff(sid, seeded$state_revision)
  plan_monitoreo <- session_get(sid)$monitoreo_aulas_plan
  antes <- session_get(sid)
  g <- collection_aulas_entrega_get(sid)
  expect_identical(session_get(sid), antes)  # lectura pura
  expect_true(g$entregada)
  expect_true(g$vigente)
  expect_identical(g$handoff$schema, "collection_handoff/v1")
  expect_identical(g$deployment_fingerprint, g$handoff$deployment_fingerprint)
  expect_true(length(g$unidades) > 0L)
  expect_identical(g$unidades[[1]]$collection_deployment_fingerprint, g$deployment_fingerprint)
  l <- collection_aulas_plantilla(sid, "libro")
  path <- session_get(sid)$files[[l$file_id]]$path
  expect_true(file.exists(path))
  expect_true(any(grepl("Aulas", openxlsx::getSheetNames(path))))
  expect_identical(l$deployment_fingerprint, g$deployment_fingerprint)
  expect_identical(session_get(sid)$monitoreo_aulas_plan, plan_monitoreo)
})

test_that("HTTP: GET de la entrega y POST de la plantilla", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "GET", "/api/recopiladores/campaigns/aulas/entrega")
  expect_identical(r$status, 200L)
  expect_false(isTRUE(r$body$entregada))
  r2 <- .hre_call(pr, sid, "POST", "/api/recopiladores/campaigns/aulas/plantilla", body = .hre_json(list(pieza = "disponibilidad")))
  expect_identical(r2$status, 200L)
})
