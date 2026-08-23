# Rehacer el plan tiene que rehacerlo.
#
# `collection_state_reseed` existe justamente porque `seed` no sirve para
# regenerar: no hace nada si el plan ya existe. Pero sembraba llamando a
# `.collection_seed_from_legacy_state`, cuya PRIMERA linea es esa misma guarda
# —«si ya hay `collection_state`, devuelve el que hay»—, asi que rehacer
# devolvia intacto el plan que pretendia reemplazar.
#
# Lo peor no era que no hiciera nada, sino que declaraba haberlo hecho: HTTP
# 200, `reseeded = TRUE`, `state_revision` incrementada y `descartado` con el
# recuento de lo supuestamente descartado. Medido en HSVG2026 el 2026-08-23:
# Monitoreo al dia con el sorteo del 22 (700 unidades, 193 titulares) y
# Recopiladores clavado en el del 1 de agosto (2.468 unidades, 175 titulares),
# con el aviso de desfase y su boton visibles y sin efecto ninguno.

.reseed_filas <- function(run_id, n, prefijo = "CH") {
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

test_that("rehacer reemplaza el plan por el del sorteo vigente", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  # Primera corrida: el plan se siembra y queda congelado.
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-vieja", 2L, "AULA"))
  primero <- collection_state_seed(sid)
  expect_equal(primero$state$plan$source_ref$run_id, "sel-vieja")
  expect_length(primero$state$plan$units, 2L)

  # Se vuelve a sortear: la fuente vigente es otra y trae otras unidades.
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-nueva", 5L, "CH"))

  rehecho <- collection_state_reseed(sid, primero$state_revision)

  # El corazon del defecto: esto devolvia "sel-vieja" con dos unidades.
  expect_equal(rehecho$state$plan$source_ref$run_id, "sel-nueva")
  expect_length(rehecho$state$plan$units, 5L)
  expect_true(rehecho$reseeded)
  # Y el plan nuevo ya no esta desfasado respecto de la fuente.
  expect_equal(rehecho$state$plan$source_ref$fingerprint,
               prosecnurapp:::collection_fingerprint(rehecho$state$plan$units))
})

test_that("rehacer declara lo que descarto con las cifras del plan que se fue", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-vieja", 3L, "AULA"))
  primero <- collection_state_seed(sid)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-nueva", 7L, "CH"))

  rehecho <- collection_state_reseed(sid, primero$state_revision)

  # `descartado` describe lo que YA NO esta: si el reseed no rehace nada, estas
  # cifras coinciden con las del plan devuelto y el engano pasa desapercibido.
  expect_equal(rehecho$descartado$plan_run_id, "sel-vieja")
  expect_equal(rehecho$descartado$unidades, 3L)
  expect_false(identical(rehecho$descartado$plan_run_id, rehecho$state$plan$source_ref$run_id))
  expect_false(identical(rehecho$descartado$unidades, length(rehecho$state$plan$units)))
})

test_that("la revision crece para que los clientes detecten la escritura", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-vieja", 2L, "AULA"))
  primero <- collection_state_seed(sid)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-nueva", 4L, "CH"))

  rehecho <- collection_state_reseed(sid, primero$state_revision)
  expect_equal(rehecho$state_revision, primero$state_revision + 1L)

  # Y con una revision vieja rebota, como cualquier otra escritura.
  expect_error(collection_state_reseed(sid, primero$state_revision), class = "api_error")
})

test_that("sembrar sigue sin pisar el plan congelado", {
  # La guarda que causaba el defecto es CORRECTA para `seed`: el plan es lo que
  # fue a imprenta y una siembra no lo reemplaza. Reparar el reseed no puede
  # llevarse por delante esa proteccion.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-vieja", 2L, "AULA"))
  primero <- collection_state_seed(sid)
  session_set(sid, "monitoreo_aulas_plan", .reseed_filas("sel-nueva", 9L, "CH"))

  otra <- collection_state_seed(sid)
  expect_false(isTRUE(otra$seeded))
  expect_equal(otra$state$plan$source_ref$run_id, "sel-vieja")
  expect_length(otra$state$plan$units, 2L)
})
