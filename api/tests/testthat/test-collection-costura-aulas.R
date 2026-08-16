# Costura completa de un estudio de aulas: seleccion -> enlaces -> fichas -> handoff.
#
# Los tests de al lado cubren cada pieza por separado (engine, adapters,
# materials, render). Ninguno recorria la cadena, y ahi es donde vivian los
# defectos: el parametro duplicado nacia de que el adapter y el resolvedor
# escribian cada uno por su lado, y el desborde del grid solo aparecia cuando
# una plantilla real se encontraba con una geometria real.
#
# Es el test que pedia L9 del GOAL «el aula se recoge sola»; el guion de
# `api/scripts/sim_aulas_qr_campo.R` es su version narrada para inspeccion
# manual, con render de PDF y PNG.

.costura_aula <- function(i, role, wave, replacement_for = "") {
  list(
    operational_code = sprintf("AULA-%02d", i),
    classroom_id = sprintf("AULA-%02d", i),
    label = sprintf("Aula %02d", i),
    sample_role = role,
    wave = wave,
    replacement_for = replacement_for,
    facultad = if (i %% 2 == 0) "Ingenieria" else "Ciencias Sociales",
    nombre_del_curso = sprintf("Curso %02d", i),
    horario = sprintf("%02d:00-%02d:00", 7 + i, 9 + i),
    pabellon_aula = sprintf("Pabellon %s - %d0%d", LETTERS[i], i, i),
    nombre_de_docente = sprintf("Docente %02d", i),
    matriculados_poblacion = 28 + i
  )
}

# 4 titulares M1 + 3 reservas encadenadas R1. Sin `link`: la seleccion de
# Calculo de muestra no trae enlaces, que es el escenario real.
.costura_seleccion <- function() {
  c(
    lapply(1:4, function(i) .costura_aula(i, "titular", "M1")),
    lapply(5:7, function(i) .costura_aula(i, "chain_reserve", "R1", sprintf("AULA-%02d", i - 4)))
  )
}

.costura_target <- function() {
  list(
    provider = "kobo",
    base_access_url = "https://ee.example.test/x/aB3xY9kQ",
    prefill_field = "collectorID",
    asset_type = "survey",
    deployment_active = TRUE,
    asset_uid = "aCostura01"
  )
}

# Deja la sesion con plan, deployment preparado e instancia de material.
.costura_sesion <- function(sid) {
  session_set(sid, "project_name", "Costura aulas")
  session_set(sid, "estudio", list(nombre = "Costura aulas", periodo = "Agosto 2026"))
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .costura_seleccion()))
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)

  seeded <- collection_state_seed(sid)
  adapter <- collection_adapter_get("kobo_existing_v1")
  target <- .costura_target()
  preview <- adapter$preview_deployment(
    plan = seeded$plan, target = adapter$inspect_target(list(), target)
  )
  preview$capability_preflight <- NULL
  put <- collection_deployment_put(sid, preview, seeded$state_revision)
  prep <- collection_deployment_prepare(sid, put$state_revision)
  inst <- collection_material_instance_create(sid, prep$state_revision)
  list(seeded = seeded, preview = preview, prepared = prep, instance = inst)
}

.costura_compilado <- function(sid, instance_id) {
  snap <- collection_material_render_snapshot(sid, instance_id)
  collection_material_compile(
    template = snap$template, instance = snap$instance, project = snap$project,
    plan = snap$plan, deployment = snap$deployment, resolved_access = snap$resolved_access
  )
}

test_that("una seleccion sin enlaces produce plan pero todavia no deployment", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .costura_seleccion()))

  seeded <- collection_state_seed(sid)

  expect_length(seeded$plan$units, 7L)
  # Sin `link` en las filas no hay accesos que sembrar: es lo correcto, no un
  # bug. El deployment lo produce el adapter contra un formulario real.
  expect_null(seeded$deployment)
  roles <- table(vapply(seeded$plan$units, function(u) u$role, character(1)))
  expect_identical(as.integer(roles[["titular"]]), 4L)
  expect_identical(as.integer(roles[["chain_reserve"]]), 3L)
})

test_that("un solo formulario Kobo cubre las 7 unidades con enlace propio", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)

  expect_identical(fx$prepared$deployment$status, "prepared")
  expect_identical(fx$prepared$deployment$coverage$units_total, 7L)
  expect_identical(fx$prepared$deployment$coverage$units_missing_access, 0L)
  expect_length(fx$instance$instance$unit_refs, 7L)
  expect_length(fx$instance$instance$warnings, 0L)
})

test_that("cada ficha lleva un QR distinto y el parametro una sola vez", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  compiled <- .costura_compilado(sid, fx$instance$instance$instance_id)

  payloads <- vapply(compiled$pages, function(p) p$access$qr_payload %||% "", character(1))

  expect_length(compiled$pages, 7L)
  expect_length(unique(payloads), 7L)
  for (url in payloads) {
    expect_match(url, "^https://ee\\.example\\.test/x/aB3xY9kQ\\?")
    # El control de L1: con la duplicacion vieja esto valia 2 en cada pagina.
    expect_identical(
      lengths(regmatches(url, gregexpr("collectorID", url, fixed = TRUE)))[[1]], 1L
    )
  }
})

test_that("la ficha distingue titular de reemplazo y dice de quien", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  compiled <- .costura_compilado(sid, fx$instance$instance$instance_id)

  roles <- vapply(compiled$pages, function(p) p$unit$role %||% "", character(1))

  expect_identical(sum(roles == "Titular"), 4L)
  expect_identical(sum(grepl("^Reemplazo de ", roles)), 3L)
  # El control de L3: en crudo esto valia "chain_reserve" y no distinguia nada.
  expect_false(any(grepl("_", roles, fixed = TRUE)))
  # Y el rol llega dibujado al grid, no solo al contexto.
  grid <- Filter(function(b) identical(b$type, "field_grid"), compiled$pages[[5]]$blocks)[[1]]
  impreso <- vapply(grid$rows, function(r) as.character(r$value %||% ""), character(1))
  expect_true(any(grepl("^Reemplazo de AULA-01$", impreso)))
})

test_that("ninguna plantilla de la casa desborda el grid en la costura real", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)

  # La plantilla CON CARETA es la que vive al limite: su cabecera baja, asi que
  # su banda de grid es mas corta, y ademas trae un campo mas ("Fecha" a mano).
  # Probar solo la built-in dejaba este aserto inerte: cabia en cualquier caso,
  # de modo que la unica plantilla que llego a desbordarse no la miraba nadie.
  marca <- collection_material_branded_sheet_template(assets = "logo-costura")
  puesto <- collection_material_template_put(sid, marca, fx$instance$state_revision)
  inst <- collection_material_instance_create(sid, puesto$state_revision)
  compiled <- .costura_compilado(sid, inst$instance$instance_id)

  path <- withr::local_tempfile(fileext = ".png")
  rendered <- collection_material_render_compiled(
    compiled, path, device = "png", page = 5L, dpi = 96, brand_assets = list()
  )

  codigos <- vapply(rendered$warnings %||% list(), function(w) as.character(w$code %||% ""), character(1))
  expect_false("field_grid_overflow" %in% codigos)
  expect_false("text_truncated" %in% codigos)
  # Y las seis filas con dato siguen en la hoja, no solo "sin warning".
  grid <- Filter(function(b) identical(b$type, "field_grid"), compiled$pages[[5]]$blocks)[[1]]
  expect_length(grid$rows, 7L)
  expect_true(any(grepl("^33$", vapply(grid$rows, function(r) as.character(r$value %||% ""), character(1)))))
})

test_that("el handoff deja a Monitoreo cada aula con su enlace, reservas incluidas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)

  ho <- collection_handoff(sid, fx$instance$state_revision)
  rows <- ho$monitoring_rows
  link <- function(r) as.character(r$link %||% "")
  role <- function(r) as.character(r$sample_role %||% "")

  expect_length(rows, 7L)
  expect_true(all(vapply(rows, function(r) nzchar(link(r)), logical(1))))
  expect_length(unique(vapply(rows, link, character(1))), 7L)
  reservas <- Filter(function(r) grepl("reserve", role(r)), rows)
  expect_length(reservas, 3L)
  expect_true(all(vapply(reservas, function(r) nzchar(link(r)), logical(1))))
})

test_that("cambiar la seleccion despues del handoff no deja enlaces mintiendo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)

  changed <- collection_state_get(sid)$plan
  changed$units[[1]]$label <- "Aula renombrada en pleno campo"
  updated <- collection_plan_put(sid, changed, ho$state_revision)

  expect_identical(updated$deployment$status, "stale")
  err <- tryCatch(collection_handoff(sid, updated$state_revision), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_HANDOFF_STALE")
})

# --- La vuelta: la data de Kobo reencuentra su aula -------------------------
# El eslabon que cerraba el circuito y estaba roto. Recopiladores cuelga
# `d[collectorID]=` (es el `prefill_field` por defecto), asi que Kobo devuelve
# una columna llamada `collectorID`. El cruce de Monitoreo la buscaba entre
# `collector_id`, `collector`, `link`... y `.monitoreo_text_key()` conserva el
# guion bajo, de modo que "collectorid" nunca casaba con "collector_id".
#
# El unico arreglo posible era `source_mapping$collector_var`, cuyo unico setter
# es `/api/monitoreo/aulas/config` — un endpoint con cero consumidores en la UI.
# Es decir: nuestro propio enlace generaba una columna que el sistema no sabia
# leer, y el ajuste manual no estaba al alcance de nadie.

test_that("el nombre de parametro que genera el QR es el que espera Monitoreo", {
  adapter <- collection_adapter_get("kobo_existing_v1")
  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-vuelta",
    units = list(list(unit_id = "unit-1", link_key = "CH 1"))
  )
  deployment <- adapter$preview_deployment(plan, adapter$inspect_target(list(), .costura_target()))
  campo <- names(deployment$bindings[[1]]$prefill)[[1]]

  expect_identical(campo, "collectorID")

  # La columna que Kobo devolveria con ese parametro tiene que ser encontrable
  # por el cruce, sin que nadie configure nada.
  respuestas <- data.frame(
    collectorID = c("CH 1", "CH 1", "CH 2"),
    otra = 1:3,
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_default_config()
  hallado <- .monitoreo_aulas_response_classroom(respuestas, cfg)

  # El control: antes esto devolvia character(0) y ninguna respuesta se
  # atribuia a su aula.
  expect_length(hallado, 3L)
  expect_identical(hallado, c("CH 1", "CH 1", "CH 2"))
})

test_that("un mapeo explicito sigue mandando sobre el fallback", {
  respuestas <- data.frame(
    collectorID = c("no-usar", "no-usar"),
    mi_columna = c("CH 7", "CH 8"),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_default_config()
  cfg$source_mapping$classroom_id_var <- "mi_columna"

  expect_identical(.monitoreo_aulas_response_classroom(respuestas, cfg), c("CH 7", "CH 8"))
})
