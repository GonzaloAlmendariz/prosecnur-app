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

test_that("GET: lectura pura con el núcleo, los rótulos por defecto y el 99", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  antes <- session_get(sid)
  r <- collection_territorial_formatos_get(sid)
  expect_identical(session_get(sid), antes)
  expect_identical(vapply(r$codigos, `[[`, "", "codigo"), c("1", "2", "3", "4", "5", "6", "7", "8", "99"))
  expect_identical(r$codigos[[8]]$grupo, "efectiva")
  expect_true(all(vapply(r$codigos, `[[`, TRUE, "editable")))  # K1: todos los rótulos se editan
  expect_identical(r$codigos[[4]]$rotulo, "Nadie en casa")
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
  # K1: el rótulo del núcleo se ajusta al papel del estudio; el número y el grupo no cambian.
  r <- collection_territorial_formatos_put(sid, rotulos = list(`4` = "Miembros del hogar ausentes"))
  expect_identical(r$codigos[[4]]$rotulo, "Miembros del hogar ausentes")
  expect_identical(r$codigos[[8]]$grupo, "efectiva")
})

test_that("PUT: un código inexistente es 422, los rótulos tienen tope y la revisión se respeta", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, rotulos = list(`9` = "Otra cosa"))),
                   "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, rotulos = list(`2` = strrep("x", 61)))),
                   "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, caras_ruteo = 3L)), "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
  expect_identical(.mtf_code(collection_territorial_formatos_put(sid, extras_consolidado = list("otra"))), "E_COLLECTION_TERRITORIAL_FORMATOS_INVALIDOS")
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

test_that("Material es el dueño de los códigos; lo declarado en el Planner sólo es respaldo (ADR 0123, Q3)", {
  sid <- .mtf_sesion(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(collection_territorial_formatos_get(sid)$origen_codigos, "material")
  declarar <- function(rotulo4) .planner_sembrar_legado(sid, "codigos", list(version = 1L, resultado = list(
    list(codigo = "1", rotulo = "No quería participar", grupo = "no_aplicada"),
    list(codigo = "4", rotulo = rotulo4, grupo = "no_aplicada"),
    list(codigo = "8", rotulo = "Encuesta efectiva", grupo = "efectiva"),
    list(codigo = "99", rotulo = "Manzana no elegible", grupo = "manzana")), status_barrido = list()))
  declarar("Miembros del hogar ausentes")
  # Sin catálogo guardado en Material, el del Planner es el respaldo, y se puede editar aquí.
  r <- collection_territorial_formatos_get(sid)
  expect_identical(r$origen_codigos, "planner")
  expect_identical(vapply(r$codigos, `[[`, "", "codigo"), c("1", "4", "8", "99"))
  expect_identical(r$codigos[[2]]$rotulo, "Miembros del hogar ausentes")
  expect_true(all(vapply(r$codigos, `[[`, TRUE, "editable")))
  # El primer guardado parte de los rótulos del Planner: editar el 2 no borra el 4.
  g <- collection_territorial_formatos_put(sid, rotulos = list(`2` = "Vivienda abandonada"))
  expect_identical(g$origen_codigos, "material")
  rot <- stats::setNames(vapply(g$codigos, `[[`, "", "rotulo"), vapply(g$codigos, `[[`, "", "codigo"))
  expect_identical(unname(rot[c("2", "4", "99")]), c("Vivienda abandonada", "Miembros del hogar ausentes", "Manzana no elegible"))
  # Guardado en Material, lo que cambie en el Planner ya no manda.
  declarar("Nadie en casa (Planner)")
  r2 <- collection_territorial_formatos_get(sid)
  expect_identical(r2$origen_codigos, "material")
  expect_identical(r2$codigos[[4]]$rotulo, "Miembros del hogar ausentes")
  expect_identical(collection_territorial_formatos_put(sid, caras_ruteo = 1L)$caras_ruteo, 1L)
})
