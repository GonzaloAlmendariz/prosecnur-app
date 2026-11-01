# ADR 0122 P2: Material abre sólo las campañas que el Planner declara (collection_campaigns_planner.R).

.mcp_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

test_that("sin perfiles declarados se ofrecen todos los tipos, como antes", {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE)
  sid <- .hre_session(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_campaigns_get(sid)
  expect_null(g$tipos_del_estudio)
  expect_true(all(vapply(g$tipos, `[[`, TRUE, "del_estudio")))
})

test_that("con perfiles declarados, sólo esos tipos; lo existente fuera del estudio se marca, no se borra", {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE)
  sid <- .hre_session(); on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "telefonica", "Barrido")   # antes de declarar: se puede
  .planner_declarar(sid, "perfiles", list(list(tipo = "territorial")), 0L)
  g <- collection_campaigns_get(sid)
  expect_identical(unlist(g$tipos_del_estudio), "territorial")
  del <- stats::setNames(vapply(g$tipos, `[[`, TRUE, "del_estudio"), vapply(g$tipos, `[[`, "", "tipo"))
  expect_true(del[["territorial"]])
  expect_false(any(del[c("aulas", "correo", "telefonica")]))
  tel <- Filter(function(c) identical(c$tipo, "telefonica"), g$campaigns)[[1]]
  expect_true(tel$fuera_del_estudio)
  expect_identical(.mcp_code(collection_campaign_create(sid, "correo", "Invitación", actor = "PULSO")),
                   "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE")
  r <- collection_campaign_create(sid, "territorial", "UMP Lima")
  expect_identical(r$campaign$tipo, "territorial")
  expect_false(r$campaign$fuera_del_estudio)
})
