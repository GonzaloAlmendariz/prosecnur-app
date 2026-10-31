# Códigos de resultado del estudio y formato de las hojas de campo (D1).

.mtf_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mtf_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  s <- session_get(sid); s$project_dirty <- FALSE; s$project_dirty_reasons <- NULL; .session_env[[sid]] <- s
  sid
}

test_that("GET: lectura pura con el núcleo fijo, los editables por defecto y el 99", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  antes <- session_get(sid)
  r <- collection_territorial_formatos_get(sid)
  expect_identical(session_get(sid), antes)
  expect_identical(vapply(r$codigos, `[[`, "", "codigo"), c("1", "2", "3", "4", "5", "6", "7", "8", "99"))
  expect_identical(r$codigos[[8]]$grupo, "efectiva")
  expect_false(r$codigos[[1]]$editable)
  expect_true(r$codigos[[2]]$editable)
  expect_identical(r$codigos[[2]]$rotulo, "Vivienda desocupada")
  expect_identical(r$caras_ruteo, 2L)
  expect_identical(r$columna_criterio, "")
  expect_identical(r$revision, 0L)
})

test_that("PUT: cambia rótulos editables, quita el 99, fija criterio y caras; marca el proyecto", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_territorial_formatos_put(sid, rotulos = list(`3` = "Miembros del hogar migrantes o refugiados"),
                                           con_99 = FALSE, columna_criterio = "Cursa estudios", caras_ruteo = 1L,
                                           expected_revision = 0L)
  expect_identical(r$revision, 1L)
  expect_identical(vapply(r$codigos, `[[`, "", "codigo"), c("1", "2", "3", "4", "5", "6", "7", "8"))
  expect_identical(r$rotulos[["99"]], "Manzana no elegible (terreno, parque)")
  expect_identical(r$codigos[[3]]$rotulo, "Miembros del hogar migrantes o refugiados")
  expect_identical(r$columna_criterio, "Cursa estudios")
  expect_identical(r$caras_ruteo, 1L)
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("PUT: el núcleo no se edita, los rótulos tienen tope y la revisión se respeta", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, rotulos = list(`8` = "Otra cosa"))),
                   "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, rotulos = list(`2` = strrep("x", 61)))),
                   "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, caras_ruteo = 3L)), "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_null(session_get(sid)$material_territorial_formatos)
  collection_territorial_formatos_put(sid, rotulos = list(`5` = "No hay persona de 18 a 25 años"))
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, con_99 = FALSE, expected_revision = 0L)),
                   "E_COLLECTION_TERRITORIAL_FORMATOS_STALE")
  expect_identical(.mtf_code(collection_territorial_formatos_get(sid, "territorial.otra")), "E_COLLECTION_CAMPAIGN_NOT_FOUND")
})

test_that("lo guardado de otra campaña o sin schema se lee con los valores por defecto", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$material_territorial_formatos <- list(schema = "material_territorial_formatos/v1", campaign_id = "otra", rotulos = list(`2` = "X"))
  .session_env[[sid]] <- s
  expect_identical(collection_territorial_formatos_get(sid)$codigos[[2]]$rotulo, "Vivienda desocupada")
})

test_that("HTTP: GET y PUT de los formatos", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  g <- .hre_call(pr, sid, "GET", "/api/recopiladores/campaigns/territorial/formatos", query = "id=territorial.principal")
  expect_identical(g$status, 200L)
  expect_length(g$body$codigos, 9L)
  p <- .hre_call(pr, sid, "PUT", "/api/recopiladores/campaigns/territorial/formatos",
                 body = .hre_json(list(id = "territorial.principal", rotulos = list(`2` = "Casa vacía"), expected_revision = 0L)))
  expect_identical(p$status, 200L)
  expect_identical(p$body$codigos[[2]]$rotulo, "Casa vacía")
})
