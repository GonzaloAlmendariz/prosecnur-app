.collection_roundtrip_legacy <- function() {
  list(
    list(
      classroom_id = "A-01", operational_code = "OP-01", label = "Aula 1",
      wave = "M1", link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=OP-01"
    )
  )
}

test_that("collection_state sobrevive build/load .pulso sin secretos ni binarios", {
  skip_if_not_installed("zip")
  skip_if_not_installed("jsonlite")
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(tmp, force = TRUE)
    session_delete(sid)
  }, add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_roundtrip_legacy())
  seeded <- collection_state_seed(sid)
  build_pulso(sid, tmp, project_name = "Recopiladores")

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)
  expect_identical(restored$collection_state, seeded$state)
  expect_false(isTRUE(restored$project_dirty))

  state_json <- jsonlite::toJSON(restored$collection_state, auto_unbox = TRUE, null = "null")
  expect_false(grepl("data:image|api_key|access_token|password|secret", state_json, ignore.case = TRUE))
})

test_that("load legacy siembra una vez, conserva Monitoreo y queda limpio", {
  skip_if_not_installed("zip")
  skip_if_not_installed("jsonlite")
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(tmp, force = TRUE)
    session_delete(sid)
  }, add = TRUE)
  legacy <- .collection_roundtrip_legacy()
  session_set(sid, "monitoreo_aulas_plan", legacy)
  build_pulso(sid, tmp, project_name = "Legacy")

  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  first <- session_get(loaded$session_id)
  expect_identical(first$collection_state$schema, "collection_state/v1")
  expect_identical(first$monitoreo_aulas_plan, legacy)
  expect_false(isTRUE(first$project_dirty))

  migrated <- first$collection_state
  build_pulso(loaded$session_id, tmp, project_name = "Migrado")
  reopened <- load_pulso(tmp)
  on.exit(session_delete(reopened$session_id), add = TRUE)
  second <- session_get(reopened$session_id)
  expect_identical(second$collection_state, migrated)
  expect_identical(second$monitoreo_aulas_plan, legacy)
  expect_false(isTRUE(second$project_dirty))
})
