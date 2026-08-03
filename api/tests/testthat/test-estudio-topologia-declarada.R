# Topología declarada del estudio (`s$estudio$topology_declared`).
#
# Existe para desempatar "carga simple" de "estudio multibase con una sola base
# todavía": ambos son processing_mode="multibase", n_bases=1 y base "default", y
# el frontend desempataba por el NOMBRE de la base. Un estudio que empezó simple
# y creció se seguía leyendo como simple al reabrirlo, y la superficie de Fuentes
# no ofrecía camino a las bases siguientes.

test_that("un estudio recien creado no declara topologia", {
  sid <- session_create()
  on.exit(session_delete(sid))
  estudio_ensure(sid)

  expect_null(estudio_topology(sid))
})

test_that("estudio_topology guarda y devuelve cada valor del vocabulario", {
  sid <- session_create()
  on.exit(session_delete(sid))

  for (topology in c("single", "separate", "integrated", "independent")) {
    estudio_set_topology(sid, topology)
    expect_identical(estudio_topology(sid), topology)
  }
})

test_that("NULL borra la declaracion sin romper el estudio", {
  sid <- session_create()
  on.exit(session_delete(sid))
  estudio_set_topology(sid, "separate")
  expect_identical(estudio_topology(sid), "separate")

  estudio_set_topology(sid, NULL)
  expect_null(estudio_topology(sid))
  # El estudio sigue en pie: borrar la declaración no lo desarma.
  expect_false(is.null(session_get(sid)$estudio))
})

test_that("una topologia fuera del vocabulario es error del cliente", {
  sid <- session_create()
  on.exit(session_delete(sid))

  err <- tryCatch(estudio_set_topology(sid, "hermanas"), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_ESTUDIO_TOPOLOGIA")
  expect_equal(err$status, 400)
})

test_that("un valor guardado ilegible se lee como sin declarar", {
  # Un .pulso escrito por una versión futura (o corrupto) no debe volver
  # inabrible el proyecto: el getter degrada a NULL en vez de romper.
  sid <- session_create()
  on.exit(session_delete(sid))
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$topology_declared <- "trapecio"
  .session_env[[sid]] <- s

  expect_null(estudio_topology(sid))
})

test_that("declarar la topologia marca el proyecto como sucio", {
  # `.mark_project_dirty` solo marca cuando la sesión tiene un .pulso abierto:
  # sin `project_path` no hay nada que quede pendiente de guardar.
  sid <- session_create()
  on.exit(session_delete(sid))
  estudio_ensure(sid)
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s

  estudio_set_topology(sid, "separate")
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("la declaracion sobrevive al round-trip del .pulso", {
  # El punto entero del campo: reabrir el proyecto y que la app recuerde que el
  # usuario declaró varias bases, aunque solo haya cargado una y se llame
  # "default".
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) })
  estudio_ensure(sid)
  estudio_set_topology(sid, "separate")

  expect_true(build_pulso(sid, tmp)$ok)
  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)

  expect_identical(estudio_topology(res_load$session_id), "separate")
})

test_that("un .pulso sin el campo sigue abriendo como no declarado", {
  # Back-compat: los proyectos guardados antes de este campo no tienen la clave.
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) })
  estudio_ensure(sid)

  expect_true(build_pulso(sid, tmp)$ok)
  res_load <- load_pulso(tmp)
  on.exit(session_delete(res_load$session_id), add = TRUE)

  expect_null(estudio_topology(res_load$session_id))
})
