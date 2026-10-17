# H9 (checklist-material-de-campo-2026-10-16): el sembrador de QA arma, sobre el
# proyecto de referencia hsvg2026, un plan de recolección que el motor acepta.
# El sembrador vive en scripts/qa/ porque es tooling de QA, no runtime de la
# app; se carga aquí contra el namespace para usar los mismos engines que los
# routers.

.mcqa_script <- function() {
  normalizePath(
    file.path(testthat::test_path(), "..", "..", "..", "scripts", "qa", "material_campo_sembrar_plan.R"),
    mustWork = FALSE
  )
}

.mcqa_env <- function() {
  env <- new.env(parent = asNamespace("prosecnurapp"))
  sys.source(.mcqa_script(), envir = env)
  env
}

.mcqa_skip_sin_insumos <- function() {
  testthat::skip_if_not(file.exists(.mcqa_script()), "scripts/qa no está en este árbol")
  fixture <- reference_project_path("hsvg2026")
  testthat::skip_if_not(file.exists(fixture), "fixture hsvg2026 no instalado")
  fixture
}

test_that("el sembrador deja un plan de material de campo válido con accesos, plantilla y paquete", {
  fixture <- .mcqa_skip_sin_insumos()
  env <- .mcqa_env()
  destino <- file.path(withr::local_tempdir(), "hsvg2026_con_plan.pulso")

  resumen <- env$material_campo_qa_sembrar(fixture, destino, render = "none")

  expect_true(file.exists(destino))
  expect_gte(resumen$plan$unidades, 1L)
  expect_gte(resumen$accesos$ready, 1L)
  expect_identical(resumen$accesos$ready, resumen$plan$unidades)
  expect_identical(resumen$accesos$status, "prepared")
  expect_identical(resumen$plantilla$activa, "ficha_aplicacion_a4_v1")
  expect_identical(resumen$paquete$instancias, 1L)
  expect_identical(resumen$selection_run_id, "sel_aulas_qa_4fda3cad")

  # El .pulso derivado reabre con el estado sembrado y ese estado valida.
  handle <- load_pulso(destino)
  on.exit(session_delete(handle$session_id), add = TRUE)
  estado <- session_get(handle$session_id)$collection_state
  expect_true(isTRUE(collection_state_validate(estado)$ok))
  expect_identical(length(estado$plan$units), resumen$plan$unidades)
  expect_identical(estado$plan$input_fingerprint, resumen$plan$input_fingerprint)
  expect_gte(length(Filter(function(b) identical(b$status, "ready"), estado$deployment$bindings)), 1L)
  catalogo <- collection_material_catalog_get(handle$session_id)
  activos <- vapply(Filter(function(p) isTRUE(p$active), catalogo$presets), function(p) p$preset_id, "")
  expect_identical(activos, "ficha_aplicacion_a4_v1")

  # Sin credenciales ni hosts reales: los accesos apuntan al dominio reservado.
  refs <- unique(vapply(estado$deployment$bindings, function(b) as.character(b$access_ref), ""))
  expect_true(all(startsWith(refs, "https://kobo.example.org/")))
  expect_length(collection_state_validate(estado)$problems, 0L)

  # Determinismo: la misma semilla vuelve a sembrar el mismo plan.
  otra <- load_pulso(fixture)
  on.exit(session_delete(otra$session_id), add = TRUE)
  env$.mcqa_seleccionar(otra$session_id)
  plan_bis <- collection_state_seed(otra$session_id)$state$plan
  expect_identical(plan_bis$input_fingerprint, resumen$plan$input_fingerprint)
  expect_identical(plan_bis$plan_id, resumen$plan$plan_id)
})
