# H26: rehacer el plan conserva lo que es del usuario y CUENTA lo que descarta.
#
# `collection_state_reseed` armaba el estado nuevo solo con lo que siembra
# `.collection_seed_build()` (schema, revision, plan, deployment, migration) y se
# llevaba sin nombrarlos la plantilla de material, las fichas y los recibos. Su
# docstring prometia que la UI pudiera decir el descarte ANTES; no habia forma
# de preguntarlo sin ejecutarlo, y `descartado` no traia ni fichas ni recibos.

.rsc_filas <- function(run_id, n, prefijo = "CH") {
  lapply(seq_len(n), function(i) list(
    selection_run_id = run_id,
    classroom_id = sprintf("%s-%02d", prefijo, i),
    operational_code = sprintf("%s %d", prefijo, i),
    label = sprintf("Aula %d", i),
    wave = "M1",
    faculty = if (i %% 2L == 0L) "Derecho" else "Ingenieria",
    link = sprintf("https://kf.kobotoolbox.org/x/a?d%%5BcollectorID%%5D=%s-%02d", prefijo, i)
  ))
}

# Plan sembrado de 3 aulas con: plantilla propia, 2 instancias (que cubren 2
# unidades distintas, una repetida), 3 recibos, una prueba, carpeta de Drive y
# una publicacion. Despues se vuelve a sortear (5 aulas).
.rsc_fixture <- function() {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", .rsc_filas("sel-vieja", 3L, "AULA"))
  primero <- collection_state_seed(sid)
  estado <- session_get(sid)$collection_state
  unidades <- vapply(estado$plan$units, function(u) u$unit_id, character(1))
  plantilla <- collection_material_builtin_template()
  plantilla$template_id <- "plantilla-del-usuario"
  plantilla$revision <- 4L
  estado$material_template <- plantilla
  estado$material_instances <- list(
    list(instance_id = "material-1", unit_refs = as.list(unidades[1:2]), status = "ready"),
    list(instance_id = "material-2", unit_refs = list(unidades[[2]]), status = "ready")
  )
  estado$artifact_receipts <- lapply(1:3, function(i) list(
    receipt_id = sprintf("rec-%d", i), file_id = sprintf("file-%d", i), filename = sprintf("f%d.pdf", i)
  ))
  estado$pruebas <- list(list(codigo = "PRUEBA_2026", etiqueta = "PRUEBA_2026"))
  estado$drive_fichas <- list(folder_id = "carpeta-1", folder_name = "Fichas QR - X")
  estado$drive_publicaciones <- list(list(receipt_id = "rec-1", drive_file_id = "d-1"))
  s <- session_get(sid)
  s$collection_state <- estado
  s$project_path <- file.path(tempdir(), "rsc.pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  session_set(sid, "monitoreo_aulas_plan", .rsc_filas("sel-nueva", 5L, "CH"))
  s <- session_get(sid)
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  list(sid = sid, rev = primero$state_revision, plantilla = plantilla)
}

test_that("rehacer conserva la plantilla de material y lo que no depende del plan", {
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)

  re <- collection_state_reseed(fx$sid, fx$rev)
  guardado <- session_get(fx$sid)$collection_state

  expect_true(isTRUE(re$reseeded))
  expect_identical(guardado$material_template, fx$plantilla)
  expect_identical(guardado$pruebas[[1]]$codigo, "PRUEBA_2026")
  expect_identical(guardado$drive_fichas$folder_id, "carpeta-1")
  expect_setequal(unlist(re$descartado$conservado),
                  c("material_template", "pruebas", "drive_fichas"))
  # Y el plan si es el nuevo.
  expect_equal(guardado$plan$source_ref$run_id, "sel-nueva")
})

test_that("rehacer descarta fichas, recibos y publicaciones, y los cuenta", {
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)

  re <- collection_state_reseed(fx$sid, fx$rev)
  guardado <- session_get(fx$sid)$collection_state

  expect_null(guardado$material_instances)
  expect_null(guardado$artifact_receipts)
  expect_null(guardado$drive_publicaciones)
  expect_identical(re$descartado$fichas$instancias, 2L)
  # Dos instancias, tres refs, dos unidades distintas: se cuentan unidades.
  expect_identical(re$descartado$fichas$unidades_cubiertas, 2L)
  expect_identical(re$descartado$recibos, 3L)
  expect_identical(re$descartado$publicaciones_drive, 1L)
  expect_length(re$descartado$otros_campos, 0L)
  expect_identical(re$descartado$unidades, 3L)
  expect_identical(re$propuesto$unidades, 5L)
  expect_identical(re$propuesto$plan_run_id, "sel-nueva")
})

test_that("dry_run devuelve el mismo descartado sin mutar estado, revision ni dirty", {
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)
  antes <- session_get(fx$sid)

  vista <- collection_state_reseed(fx$sid, fx$rev, dry_run = TRUE)
  despues <- session_get(fx$sid)

  expect_true(isTRUE(vista$dry_run))
  expect_false(isTRUE(vista$reseeded))
  expect_identical(vista$state_revision, fx$rev)
  expect_identical(despues$collection_state, antes$collection_state)
  expect_false(isTRUE(despues$project_dirty))
  # El estado que devuelve es el vigente, no el propuesto.
  expect_equal(vista$state$plan$source_ref$run_id, "sel-vieja")

  # Y la escritura, con la MISMA revision, devuelve exactamente ese descartado.
  re <- collection_state_reseed(fx$sid, fx$rev)
  expect_identical(re$descartado, vista$descartado)
  expect_identical(re$propuesto, vista$propuesto)
  expect_identical(re$state_revision, fx$rev + 1L)
  expect_true(isTRUE(session_get(fx$sid)$project_dirty))
})

test_that("dry_run ilegible previsualiza: ante la duda no se muta", {
  expect_false(.collection_reseed_dry_run(NULL))
  expect_false(.collection_reseed_dry_run(FALSE))
  expect_false(.collection_reseed_dry_run("false"))
  expect_true(.collection_reseed_dry_run(TRUE))
  expect_true(.collection_reseed_dry_run("true"))
  expect_true(.collection_reseed_dry_run("quiza"))
})

test_that("dry_run tambien exige revision vigente y origen", {
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)
  err <- tryCatch(collection_state_reseed(fx$sid, fx$rev + 7L, dry_run = TRUE), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_STATE_STALE")
})

test_that("un campo sin clasificar se descarta pero se nombra", {
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)
  s <- session_get(fx$sid)
  s$collection_state$campo_futuro <- list(x = 1L)
  .session_env[[fx$sid]] <- s
  vista <- collection_state_reseed(fx$sid, fx$rev, dry_run = TRUE)
  expect_identical(unlist(vista$descartado$otros_campos), "campo_futuro")
})

test_that("todo campo que el modulo escribe en collection_state esta clasificado", {
  # Guarda contra la lista cerrada que traga en silencio: si alguien agrega un
  # campo hermano de `plan`, tiene que decidir aqui si sobrevive al reseed.
  dir_r <- test_path("..", "..", "R")
  archivos <- list.files(dir_r, pattern = "^collection_.*\\.R$", full.names = TRUE)
  texto <- unlist(lapply(archivos, readLines, warn = FALSE))
  hits <- regmatches(texto, regexpr("(next_state|siguiente|nuevo)\\$[a-z_]+ <-", texto))
  campos <- unique(sub("^[a-z_]+\\$([a-z_]+) <-$", "\\1", hits))
  expect_true(length(campos) >= 5L)
  sin_clase <- setdiff(campos, c(
    prosecnurapp:::.COLLECTION_RESEED_CAMPOS_SEMILLA,
    prosecnurapp:::.COLLECTION_RESEED_CONSERVA,
    prosecnurapp:::.COLLECTION_RESEED_DESCARTA
  ))
  expect_identical(sin_clase, character(0))
})

test_that("HTTP: POST /reseed con dry_run no muta y sin el si", {
  testthat::skip_if_not_installed("plumber")
  fx <- .rsc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))

  vista <- .cmail_fx_call(pr, fx$sid, "POST", "/api/recopiladores/reseed",
                          .cmail_fx_json(list(expected_revision = fx$rev, dry_run = TRUE)))
  expect_identical(vista$status, 200L, info = substr(vista$raw, 1, 600))
  expect_true(isTRUE(unlist(vista$body$dry_run)))
  expect_identical(unlist(vista$body$state_revision), fx$rev)
  expect_identical(unlist(vista$body$descartado$recibos), 3L)
  expect_identical(unlist(vista$body$descartado$fichas$instancias), 2L)
  expect_identical(session_get(fx$sid)$collection_state$state_revision, fx$rev)
  expect_false(isTRUE(session_get(fx$sid)$project_dirty))

  hecho <- .cmail_fx_call(pr, fx$sid, "POST", "/api/recopiladores/reseed",
                          .cmail_fx_json(list(expected_revision = fx$rev)))
  expect_identical(hecho$status, 200L, info = substr(hecho$raw, 1, 600))
  expect_false(isTRUE(unlist(hecho$body$dry_run)))
  expect_true(isTRUE(unlist(hecho$body$reseeded)))
  expect_identical(unlist(hecho$body$state_revision), fx$rev + 1L)
  expect_identical(hecho$body$descartado, vista$body$descartado)
})
