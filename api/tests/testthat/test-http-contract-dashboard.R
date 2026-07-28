# =============================================================================
# Contrato HTTP real — Dashboard sobre un proyecto de referencia.
# =============================================================================
#
# Por que por el wire y no in-process: el sintoma que se reportaba era un 500
# sin codigo `E_*` en `POST /api/dashboard/resumen/kpis`. El status y el shape
# del error los produce `wrap_endpoint`/`handle_api_error`, no el engine, asi
# que la unica prueba que cubre la regresion completa es la del wire.
#
# Causa raiz: `.dashboard_ctx()` proyectaba `rp_data <- NULL`, lo que BORRA la
# clave y deja que `$` haga partial matching contra `rp_data_sources` — el mapa
# multibase de Procesamiento. En `acnur_pdm` (base padre + repeat `rep_servicios`)
# el modulo terminaba calculando sobre esa lista y moria en `!nrow(list)`.

.dashboard_http_fixture_o_skip <- function(slug = "acnur_pdm") {
  path <- reference_project_path(slug)
  testthat::skip_if_not(
    file.exists(path),
    sprintf("fixture '%s' no instalado (necesita el .pulso original)", slug)
  )
  normalizePath(path)
}

test_that("los payloads del Dashboard responden 200 sobre un proyecto multibase", {
  .http_contract_skip_if_unavailable()
  pulso <- .dashboard_http_fixture_o_skip("acnur_pdm")
  srv <- http_contract_server()

  op <- http_post_json(srv, "/api/project/open", body = list(path = pulso))
  expect_identical(op$status, 200L)
  sid <- op$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  # El endpoint de la regresion. Sin fuente propia del Dashboard el payload
  # viaja vacio, pero viaja: nunca un 500.
  kpis <- http_post_json(srv, "/api/dashboard/resumen/kpis",
                         body = list(filtros = list()), sid = sid)
  expect_identical(kpis$status, 200L)
  expect_true(isTRUE(kpis$json$ok))
  expect_null(kpis$json$error)

  # Los vecinos que comparten `.dashboard_ctx()` tampoco deben romper.
  sec <- http_post_json(srv, "/api/dashboard/resumen/seccion",
                        body = list(seccion = "cualquiera", filtros = list()), sid = sid)
  expect_identical(sec$status, 200L)
  expect_identical(http_get(srv, "/api/dashboard/manifest", sid = sid)$status, 200L)
  expect_identical(http_get(srv, "/api/dashboard/secciones", sid = sid)$status, 200L)
})
