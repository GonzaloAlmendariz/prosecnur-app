# «Ya existe collection_state» no significa «ya hay plan».
#
# Crear una campaña de correo sobre una sesión sin plan deja `collection_state`
# no-NULL con `plan = NULL`. Sembrar (y migrar al abrir) usaban la existencia
# del estado como guarda del plan congelado, así que la siembra hacía noop, el
# payload decía `seed_available = FALSE` y el usuario quedaba sin forma de
# sembrar el plan de aulas. Sembrar tiene que respetar a los hermanos del plan
# (las campañas) y avanzar la revisión, no reiniciarla a 1.

.stc_filas <- function(n = 3L) {
  lapply(seq_len(n), function(i) list(
    selection_run_id = "sel-correo",
    classroom_id = sprintf("AULA-%02d", i),
    operational_code = sprintf("AULA %d", i),
    label = sprintf("Aula %d", i),
    wave = "M1",
    faculty = "Ingenieria",
    link = sprintf("https://kf.kobotoolbox.org/x/a?d%%5BcollectorID%%5D=AULA-%02d", i)
  ))
}

# Sesión con fuente de aulas disponible y una campaña creada ANTES de sembrar.
.stc_fixture <- function() {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", .stc_filas())
  previo <- collection_state_get(sid)
  creada <- collection_mail_campaign_create(sid, previo$state_revision, name = "Invitación docentes")
  list(sid = sid, previo = previo, creada = creada,
       campanas = session_get(sid)$collection_state$mail_campaigns)
}

test_that("crear una campaña de correo no impide sembrar el plan de aulas", {
  fx <- .stc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)

  # Premisa: antes de la campaña la sesión era sembrable y no había plan.
  expect_true(isTRUE(fx$previo$seed_available))
  estado <- session_get(fx$sid)$collection_state
  expect_null(estado$plan)
  expect_length(fx$campanas$campaigns %||% fx$campanas, 1L)

  # Tras la campaña sigue sin plan, así que sigue siendo sembrable.
  expect_true(isTRUE(collection_state_get(fx$sid)$seed_available))

  sembrado <- collection_state_seed(fx$sid)
  guardado <- session_get(fx$sid)$collection_state

  expect_true(isTRUE(sembrado$seeded))
  expect_false(is.null(guardado$plan))
  expect_equal(guardado$plan$source_ref$run_id, "sel-correo")
  expect_identical(guardado$mail_campaigns, fx$campanas)
  expect_gt(as.integer(guardado$state_revision), as.integer(fx$creada$state_revision))
})

test_that("la migración legacy al abrir siembra aunque ya haya campañas de correo", {
  fx <- .stc_fixture()
  on.exit(session_delete(fx$sid), add = TRUE)

  migrado <- collection_state_migrate_legacy(session_get(fx$sid))$collection_state

  expect_false(is.null(migrado$plan))
  expect_identical(migrado$mail_campaigns, fx$campanas)
  expect_gte(as.integer(migrado$state_revision), as.integer(fx$creada$state_revision))
})
