# H21 — Accesos no rehidrata Kobo al reabrir.
#
# Un estudio de aulas nace con plan `aulas_v1` (el adapter de compatibilidad que
# siembra Calculo de muestra). Quien configura Accesos elige Kobo y escribe la
# URL base y el Asset UID; el deployment que se guarda tiene que poder decir
# despues QUE adapter lo armo y CON QUE target, porque Accesos rehidrata el
# formulario desde ahi (AccessSection.tsx lee `deployment.adapter_id` y
# `deployment.target.*`).
#
# Hoy `.ca_preview_deployment` (collection_adapters.R) arma el deployment sin
# `adapter_id` y con un target que solo conserva provider, remote_ref y
# return_url: la URL base, el tipo de asset, `deployment_active` y el campo de
# personalizacion se pierden. Al reabrir, el selector cae en «Aulas
# (compatibilidad)» y los campos salen vacios aunque los enlaces sigan bien.
#
# Lo que sigue fija el contrato: el deployment declara su adapter y conserva los
# campos NO secretos del target, tanto en la vista previa como despues de
# guardarlo y prepararlo.

.rehidrata_aula <- function(i) {
  list(
    operational_code = sprintf("AULA-%02d", i),
    classroom_id = sprintf("AULA-%02d", i),
    label = sprintf("Aula %02d", i),
    sample_role = "titular",
    wave = "M1",
    replacement_for = "",
    facultad = "Ingenieria",
    nombre_del_curso = sprintf("Curso %02d", i),
    horario = sprintf("%02d:00-%02d:00", 7 + i, 9 + i),
    pabellon_aula = sprintf("Pabellon %s - %d0%d", LETTERS[i], i, i),
    nombre_de_docente = sprintf("Docente %02d", i),
    matriculados_poblacion = 28 + i
  )
}

# Plan real sembrado desde la seleccion de Calculo de muestra: sale con
# adapter `aulas_v1`, que es la forma que el backend produce para un estudio
# de aulas (no un plan `kobo_existing_v1` armado a mano).
.rehidrata_sesion <- function() {
  sid <- session_create()
  session_set(sid, "project_name", "Rehidrata accesos")
  session_set(sid, "calc_muestra_aulas_selection", list(selection = lapply(1:3, .rehidrata_aula)))
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)
  list(sid = sid, seeded = collection_state_seed(sid))
}

.rehidrata_asset_uid <- function(target) {
  target$asset_uid %||% target$remote_ref$asset_uid
}

test_that("la vista previa Kobo sobre un plan aulas_v1 declara su adapter y conserva el target", {
  fx <- .rehidrata_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  # Precondicion: el plan es el de compatibilidad, no uno Kobo hecho a mano.
  expect_identical(fx$seeded$plan$adapter$id, "aulas_v1")

  adapter <- collection_adapter_get("kobo_existing_v1")
  preview <- adapter$preview_deployment(
    fx$seeded$plan,
    list(provider = "kobo", base_access_url = "https://kobo.example.org/single/x", asset_uid = "aX")
  )

  expect_identical(preview$adapter_id, "kobo_existing_v1")
  expect_identical(preview$target$provider, "kobo")
  expect_identical(preview$target$base_access_url, "https://kobo.example.org/single/x")
  expect_identical(.rehidrata_asset_uid(preview$target), "aX")
})

test_that("tras guardar y preparar, el deployment persistido sigue diciendo Kobo y su target", {
  fx <- .rehidrata_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  expect_identical(fx$seeded$plan$adapter$id, "aulas_v1")

  target <- list(
    provider = "kobo",
    base_access_url = "https://ee.example.test/x/aB3xY9kQ",
    prefill_field = "collectorID",
    asset_type = "survey",
    deployment_active = TRUE,
    asset_uid = "aRehidrata01",
    # Un campo que NO debe viajar: conservar el target no es copiarlo entero.
    api_token = "token-que-no-se-persiste"
  )
  adapter <- collection_adapter_get("kobo_existing_v1")
  preview <- adapter$preview_deployment(
    plan = fx$seeded$plan, target = adapter$inspect_target(list(), target)
  )
  preview$capability_preflight <- NULL
  put <- collection_deployment_put(fx$sid, preview, fx$seeded$state_revision)
  prep <- collection_deployment_prepare(fx$sid, put$state_revision)
  expect_identical(prep$deployment$status, "prepared")

  # Lo que Accesos lee al reabrir es el estado persistido, no la respuesta del
  # prepare: se comprueban los dos.
  reread <- collection_state_get(fx$sid)$state$deployment
  for (dep in list(prepare = prep$deployment, persistido = reread)) {
    expect_identical(dep$adapter_id, "kobo_existing_v1")
    expect_identical(dep$target$provider, "kobo")
    expect_identical(dep$target$base_access_url, "https://ee.example.test/x/aB3xY9kQ")
    expect_identical(.rehidrata_asset_uid(dep$target), "aRehidrata01")
    expect_identical(dep$target$asset_type, "survey")
    expect_identical(dep$target$deployment_active, TRUE)
    expect_identical(dep$target$prefill_field, "collectorID")
    expect_null(dep$target$api_token)
  }
  state_text <- paste(capture.output(str(session_get(fx$sid)$collection_state)), collapse = "\n")
  expect_false(grepl("token-que-no-se-persiste", state_text, fixed = TRUE))
})
