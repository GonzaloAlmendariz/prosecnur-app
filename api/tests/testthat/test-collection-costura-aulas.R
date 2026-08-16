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

# --- Que cuenta como respuesta valida (comportamiento ACTUAL, fijado) --------
# Estos asertos NO declaran lo correcto: fijan lo que hoy ocurre, para que
# cambiarlo sea una decision visible y no un efecto colateral. Ver L12 del GOAL.
#
# Kobo nombra su columna `_validation_status` —con guion bajo delante— y la
# llena con `validation_status_approved` / `..._not_approved`. La lista de
# candidatos no incluye ese nombre y la de estados validos no incluye esos
# valores, asi que hoy pasan dos cosas encadenadas.

test_that("sin columna de estado reconocible, TODA respuesta cuenta como valida", {
  respuestas <- data.frame(
    collectorID = c("CH 1", "CH 1"),
    `_validation_status` = c("validation_status_approved", "validation_status_not_approved"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_default_config()

  # `_validation_status` no esta entre los candidatos, asi que no se encuentra
  # columna de estado y el filtro abre: fail-open, no fail-closed.
  expect_identical(.monitoreo_aulas_valid_response(respuestas, cfg), c(TRUE, TRUE))
})

test_that("apuntar al campo de Kobo a mano hoy invalidaria TODO", {
  respuestas <- data.frame(
    collectorID = c("CH 1", "CH 2"),
    `_validation_status` = c("validation_status_approved", "validation_status_approved"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_aulas_default_config()
  cfg$source_mapping$status_var <- "_validation_status"

  # Ninguno de los valores de Kobo esta en `valid_statuses`
  # (completed/complete/valid/aprobado/aplicada), asi que quien configurara el
  # mapeo "bien" se quedaria con cero respuestas validas y sin aviso.
  expect_identical(.monitoreo_aulas_valid_response(respuestas, cfg), c(FALSE, FALSE))
})

# --- Monitoreo abre despues del handoff --------------------------------------
# El handoff creaba filas con `operational_status = "pendiente"`, palabra que no
# esta en `monitoreo_aulas_estados()`. Y el normalizador resolvia el alias con
# `aliases[[key]]`, que LANZA "subscript out of bounds" con una clave
# desconocida en vez de devolver NULL: el `%||%` que hacia de red nunca llegaba
# a actuar. Resultado: entregar el material a campo y abrir Monitoreo reventaba.

test_that("el plan que deja el handoff se puede normalizar", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)

  # El control: antes esto tiraba "subscript out of bounds".
  # Devuelve una LISTA de registros, no un data.frame — `.monitoreo_aulas_records()`.
  plan <- monitoreo_aulas_normalize_plan(ho$monitoring_rows)
  campo <- function(f) vapply(plan, function(r) as.character(r[[f]] %||% ""), character(1))

  expect_length(plan, 7L)
  expect_true(all(campo("operational_status") %in% monitoreo_aulas_estados()))
  expect_true(all(nzchar(campo("link"))))
})

test_that("el handoff escribe una palabra del vocabulario de Monitoreo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)

  estados <- unique(vapply(ho$monitoring_rows, function(r) as.character(r$operational_status %||% ""), character(1)))
  expect_true(all(estados %in% monitoreo_aulas_estados()))
})

test_that("un estado o motivo desconocido cae al default en vez de tumbar la vista", {
  # La red que el `%||%` pretendia ser. Cualquier plan importado de fuera puede
  # traer vocabulario ajeno; eso degrada, no rompe.
  expect_identical(.monitoreo_aulas_status("un_estado_que_nadie_previo"), "planificada")
  expect_identical(.monitoreo_aulas_status(""), "planificada")
  expect_identical(.monitoreo_aulas_reason("un_motivo_inventado"), "otro")
  # Y los alias legitimos siguen funcionando.
  expect_identical(.monitoreo_aulas_status("pendiente"), "planificada")
  expect_identical(.monitoreo_aulas_status("completed"), "aplicada")
  expect_identical(.monitoreo_aulas_reason("profesor_no_autoriza"), "docente_no_autoriza")
})

test_that("un plan sin columna `orden` no se multiplica al normalizarse", {
  # `orden = getn(c("orden","order"), seq_len(n))` pasa un default VECTORIAL, y
  # el helper hacia `rep(default, nrow(df))`: n^2 valores. Al asignar esa
  # columna larga el data.frame reciclaba todas las demas y el plan se
  # multiplicaba. Las filas que crea el handoff no traen `orden`, asi que 7
  # aulas entregadas a campo aparecian como 49 en Monitoreo.
  fila <- function(i) list(
    classroom_id = sprintf("A-%02d", i), operational_code = sprintf("A-%02d", i),
    label = sprintf("Aula %02d", i), sample_role = "titular", wave = "M1",
    operational_status = "planificada"
  )
  for (n in c(1L, 2L, 3L, 7L, 20L)) {
    # El control: antes esto valia n^2 en cada caso.
    expect_length(monitoreo_aulas_normalize_plan(lapply(seq_len(n), fila)), n)
  }
})

test_that("un default vectorial se ajusta a las filas en vez de repetirse", {
  df <- data.frame(a = c("x", "y", "z"), stringsAsFactors = FALSE)
  expect_length(.monitoreo_aulas_num_values(df, "ausente", seq_len(3)), 3L)
  # `expect_equal` y no `expect_identical`: el default entero se conserva
  # entero, igual que antes del arreglo.
  expect_equal(.monitoreo_aulas_num_values(df, "ausente", seq_len(3)), 1:3)
  expect_length(.monitoreo_aulas_values(df, "ausente", c("p", "q", "r")), 3L)
  # Y un default escalar sigue rellenando todas las filas.
  expect_identical(.monitoreo_aulas_values(df, "ausente", "-"), rep("-", 3L))
})

# --- La vuelta completa: de la respuesta al avance de SU aula ----------------

.costura_respuestas <- function(unit_ids, reparto = c(5L, 4L, 3L)) {
  data.frame(
    collectorID = unlist(mapply(rep, unit_ids[seq_along(reparto)], reparto, SIMPLIFY = FALSE)),
    stringsAsFactors = FALSE
  )
}

test_that("cada respuesta suma al avance del aula cuyo QR se escaneo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  plan <- ho$monitoring_rows

  unit_ids <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))
  respuestas <- .costura_respuestas(unit_ids)
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan = plan))
  d <- monitoreo_aulas_dashboard(plan, respuestas, cfg)

  validas <- vapply(d$course_status, function(r) as.integer(r$respuestas_validas %||% 0L), integer(1))
  codigos <- vapply(d$course_status, function(r) as.character(r$operational_code %||% ""), character(1))
  por_aula <- stats::setNames(validas, codigos)

  # El control: emparejando solo por `classroom_id` esto valia 0 en TODAS las
  # aulas mientras el KPI global si contaba las 12 respuestas.
  expect_identical(sum(validas), 12L)
  expect_identical(unname(por_aula[["AULA-01"]]), 5L)
  expect_identical(unname(por_aula[["AULA-02"]]), 4L)
  expect_identical(unname(por_aula[["AULA-03"]]), 3L)
  expect_identical(sum(validas > 0L), 3L)
})

test_that("el handoff deja la meta del aula, no solo su enlace", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)

  metas <- vapply(ho$monitoring_rows, function(r) as.numeric(r$eligible_n %||% 0), numeric(1))
  # Sin meta, la brecha sale 0 y ninguna aula llega nunca a "cerrando".
  expect_true(all(metas > 0))
})

test_that("un aula lejos de su meta no se declara cerrando", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  unit_ids <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan = ho$monitoring_rows))
  d <- monitoreo_aulas_dashboard(ho$monitoring_rows, .costura_respuestas(unit_ids), cfg)

  estados <- stats::setNames(
    vapply(d$course_status, function(r) as.character(r$application_state %||% ""), character(1)),
    vapply(d$course_status, function(r) as.character(r$operational_code %||% ""), character(1))
  )

  # El control: comparando como TEXTO, "5" >= "30" es TRUE y esta aula se
  # declaraba "cerrando" con 5 de 30.
  expect_identical(unname(estados[["AULA-01"]]), "en_aplicacion")
  expect_identical(unname(estados[["AULA-04"]]), "pendiente")
})

test_that("brechas, estratos y reemplazos ven las respuestas, no solo el KPI", {
  # El emparejamiento estaba escrito DOS veces —en el dashboard y en
  # `course_status`—. Arreglar solo una dejaba brechas, avance por estrato y
  # reemplazos calculados sobre ceros, con el KPI global correcto: el tablero se
  # veia coherente en los numeros grandes y vacio donde se decide.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  plan <- ho$monitoring_rows
  uid <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))

  respuestas <- data.frame(collectorID = c(rep(uid[1], 5), rep(uid[2], 4)), stringsAsFactors = FALSE)
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan = plan))
  d <- monitoreo_aulas_dashboard(plan, respuestas, cfg)

  brecha_de <- stats::setNames(
    vapply(d$brechas, function(r) as.numeric(r$brecha %||% NA), numeric(1)),
    vapply(d$brechas, function(r) as.character(r$operational_code %||% ""), character(1))
  )
  # El control: antes toda brecha valia la meta entera, ignorando lo recogido.
  expect_identical(unname(brecha_de[["AULA-01"]]), 29 - 5)
  expect_identical(unname(brecha_de[["AULA-02"]]), 30 - 4)

  estrato <- d$avance_por_estrato[[1]]
  expect_identical(as.integer(estrato$respuestas_validas), 9L)

  # Y la cadena de reemplazos existe: el handoff arrastra `replacement_for`.
  expect_length(d$reemplazos, 3L)
  expect_true(all(nzchar(vapply(d$reemplazos, function(r) as.character(r$replacement_for %||% ""), character(1)))))
})

test_that("el emparejamiento por unidad vive en un solo sitio", {
  # Si vuelve a duplicarse, este aserto no lo impide — pero el helper existe
  # justo para que el dashboard y `course_status` no diverjan otra vez.
  filas <- data.frame(
    classroom_id = c("A-01", "A-02"),
    collection_unit_id = c("unit-1", "unit-2"),
    stringsAsFactors = FALSE
  )
  counts <- table(c("unit-1", "unit-1", "unit-2"))
  expect_identical(.monitoreo_aulas_contar_por_fila(filas, counts), c(2L, 1L))

  # `classroom_id` manda cuando casa; la unidad es el respaldo.
  counts2 <- table(c("A-01", "unit-2", "unit-2"))
  expect_identical(.monitoreo_aulas_contar_por_fila(filas, counts2), c(1L, 2L))
})

# --- Los avisos del tablero dicen algo -------------------------------------

.costura_validacion <- function(plan, respuestas, check) {
  cfg <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan = plan))
  d <- monitoreo_aulas_dashboard(plan, respuestas, cfg)
  hit <- Filter(function(r) identical(as.character(r$check), check), d$validation)
  if (!length(hit)) return(NULL)
  list(status = as.character(hit[[1]]$status), detail = as.character(hit[[1]]$detail))
}

test_that("una respuesta que no es de ninguna aula del plan se avisa", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  uid <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))

  limpio <- .costura_validacion(
    ho$monitoring_rows,
    data.frame(collectorID = rep(uid[1], 5), stringsAsFactors = FALSE),
    "unmapped_valid_responses"
  )
  huerfana <- .costura_validacion(
    ho$monitoring_rows,
    data.frame(collectorID = c(rep(uid[1], 5), "unit-fantasma"), stringsAsFactors = FALSE),
    "unmapped_valid_responses"
  )

  expect_identical(limpio$status, "ok")
  # El control: antes esto tambien valia "ok", porque el chequeo miraba si la
  # respuesta TENIA colector, no si ese colector era de alguna aula del plan.
  expect_identical(huerfana$status, "warning")
  expect_match(huerfana$detail, "^1 respuestas validas no corresponden")
})

test_that("un aula llena no se denuncia como colectores duplicados", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  uid <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))

  # 10 alumnos escanean el MISMO QR: es el diseno del estudio, no una anomalia.
  # El control: el chequeo viejo (`duplicate_collectors`) decia "review" aqui, o
  # sea siempre que un aula tuviera mas de una respuesta.
  lleno <- .costura_validacion(
    ho$monitoring_rows,
    data.frame(collectorID = rep(uid[1], 10), stringsAsFactors = FALSE),
    "duplicate_responses"
  )
  expect_identical(lleno$status, "ok")
  expect_null(.costura_validacion(ho$monitoring_rows, data.frame(collectorID = uid[1]), "duplicate_collectors"))

  # Lo anomalo es la misma RESPUESTA dos veces.
  repetida <- .costura_validacion(
    ho$monitoring_rows,
    data.frame(collectorID = rep(uid[1], 3), `_uuid` = c("a", "b", "b"),
               check.names = FALSE, stringsAsFactors = FALSE),
    "duplicate_responses"
  )
  expect_identical(repetida$status, "review")
  expect_match(repetida$detail, "^1 respuestas repetidas")
})

test_that("sin identificador de respuesta el aviso lo dice, no calla ni alarma", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .costura_sesion(sid)
  ho <- collection_handoff(sid, fx$instance$state_revision)
  uid <- vapply(fx$seeded$plan$units, function(u) u$unit_id, character(1))

  sin_id <- .costura_validacion(
    ho$monitoring_rows,
    data.frame(collectorID = rep(uid[1], 4), stringsAsFactors = FALSE),
    "duplicate_responses"
  )
  expect_identical(sin_id$status, "ok")
  expect_match(sin_id$detail, "no trae identificador de respuesta")
})
