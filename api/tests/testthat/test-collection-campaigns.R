# Campañas tipadas de Material de campo (ADR 0111): registro
# `material_campaigns/v1`, proyección de las de correo desde
# `collection_state$mail_campaigns`, migración en lectura sin dirty, una sola
# campaña de aulas, territorial no disponible, archivar, registro de
# exportación por envío y resumen del inicio del proyecto. Fixtures sintéticos.

.mct_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
.mct_status <- function(expr) tryCatch({ force(expr); NA_integer_ }, api_error = function(e) as.integer(e$status))

.mct_filas <- function(n = 3L) {
  lapply(seq_len(n), function(i) list(
    selection_run_id = "sel-campanas",
    classroom_id = sprintf("AULA-%02d", i),
    operational_code = sprintf("AULA %d", i),
    label = sprintf("Aula %d", i),
    wave = "M1",
    faculty = "Ingenieria",
    link = if (i < n) sprintf("https://kf.kobotoolbox.org/x/a?d%%5BcollectorID%%5D=AULA-%02d", i) else ""
  ))
}

# Sesión con plan de aulas sembrado.
.mct_con_plan <- function(logos = FALSE) {
  sid <- .cmail_fx_session(logos = logos)
  session_set(sid, "monitoreo_aulas_plan", .mct_filas())
  collection_state_seed(sid)
  sid
}

# Estado de antes de E1h: una plantilla singular en collection_state$mail_template.
.mct_legacy_mail <- function(sid, title = "Recuperación de estudiantes", edit = TRUE) {
  s <- session_get(sid)
  tpl <- .cmail_template_normalize(.cmail_preset_recuperacion(), revision = 3L)
  if (edit) tpl$title <- title
  tpl <- .cmail_template_normalize(tpl)
  if (!is.list(s$collection_state)) s$collection_state <- .collection_empty_state(7L)
  s$collection_state$mail_template <- tpl
  .session_env[[sid]] <- s
  invisible(tpl)
}

.mct_srev <- function(sid) as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
.mct_ids <- function(g) vapply(g$campaigns, `[[`, "", "id")

test_that("proyecto vacío: sin campañas, tipos con aulas y correo disponibles y territorial con motivo", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_campaigns_get(sid)
  expect_identical(g$schema, "material_campaigns/v1")
  expect_identical(g$registry_revision, 0L)
  expect_length(g$campaigns, 0L)
  tipos <- setNames(g$tipos, vapply(g$tipos, `[[`, "", "tipo"))
  expect_true(tipos$aulas$disponible)
  expect_true(tipos$correo$disponible)
  expect_false(tipos$territorial$disponible)
  expect_identical(tipos$territorial$motivo, "Requiere leer las UMP de Hojas de ruta (E2)")
  # La virtual `correo-1` no es tarjeta, y leer no escribe nada.
  expect_null(session_get(sid)$material_campaigns)
})

test_that("plan existente se proyecta como aulas.principal con su estado, sin escribir el registro", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  g <- collection_campaigns_get(sid)
  expect_identical(.mct_ids(g), "aulas.principal")
  a <- g$campaigns[[1]]
  expect_identical(a$tipo, "aulas")
  expect_identical(a$name, "Campo en aulas")
  expect_false(a$persisted)
  expect_false(a$archived)
  expect_true(is.na(a$created_at))
  expect_identical(a$estado$unidades, 3L)
  expect_identical(a$estado$titulares, 3L)
  expect_identical(a$estado$con_enlace, 2L)
  expect_false(a$estado$plan_desfasado)
  expect_true(is.character(a$estado$deployment_status))
  expect_identical(a$ref$plan_id, session_get(sid)$collection_state$plan$plan_id)
  expect_null(session_get(sid)$material_campaigns)
  tipos <- setNames(g$tipos, vapply(g$tipos, `[[`, "", "tipo"))
  expect_false(tipos$aulas$disponible)
})

test_that("plan desfasado contra el sorteo vigente se dice en el estado de aulas", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  sel <- data.frame(selection_run_id = "sel-otra", classroom_id = "AULA-01", stringsAsFactors = FALSE)
  session_set(sid, "calc_muestra_aulas_selection", list(selection = sel))
  a <- collection_campaigns_get(sid)$campaigns[[1]]
  expect_true(a$estado$plan_desfasado)
})

test_that("ids: correo.<campaign_id>, todos casan el patrón del ADR", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, .mct_srev(sid), name = "Egresados 2026", actor = "Egresados")
  g <- collection_campaigns_get(sid)
  expect_identical(.mct_ids(g), c("aulas.principal", "correo.egresados-2026"))
  expect_true(all(grepl("^(aulas|territorial|correo)\\.[a-z0-9][a-z0-9-]{0,39}$", .mct_ids(g))))
  c1 <- g$campaigns[[2]]
  expect_identical(c1$actor, "Egresados")
  expect_true(c1$persisted)
  expect_identical(c1$ref$campaign_id, "egresados-2026")
  expect_identical(c1$estado$platform, "mailchimp")
  expect_identical(c1$estado$envios, 1L)
  expect_gt(c1$estado$bloques, 0L)
  expect_false(c1$estado$recipients_loaded)
  expect_identical(c1$estado$envios_detalle[[1]]$send_id, "invitacion")
  expect_true(is.na(c1$estado$envios_detalle[[1]]$last_export_at))
})

test_that(".pulso viejo con plan y mail_template legado: abre con dos campañas y sin dirty", {
  sid <- .mct_con_plan(logos = TRUE); on.exit(session_delete(sid), add = TRUE)
  .mct_legacy_mail(sid, title = "Recuperación ciclo 2026-1")
  s <- session_get(sid)
  s$material_campaigns <- NULL
  .session_env[[sid]] <- s
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Campanas")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  lsid <- loaded$session_id
  antes <- session_get(lsid)
  expect_false(isTRUE(antes$project_dirty))

  g <- collection_campaigns_get(lsid)
  expect_identical(.mct_ids(g), c("aulas.principal", "correo.recuperacion-ciclo-2026-1"))
  expect_false(g$campaigns[[2]]$persisted)

  despues <- session_get(lsid)
  expect_false(isTRUE(despues$project_dirty))
  expect_null(despues$material_campaigns)
  expect_identical(despues$collection_state, antes$collection_state)
  expect_false(is.null(despues$collection_state$mail_template))
})

test_that("mail_template legado idéntico a la plantilla de fábrica no es tarjeta (sin contenido real)", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  .mct_legacy_mail(sid, edit = FALSE)
  expect_length(collection_campaigns_get(sid)$campaigns, 0L)
  # Con contenido propio, sí.
  .mct_legacy_mail(sid, title = "Invitación propia")
  expect_identical(.mct_ids(collection_campaigns_get(sid)), "correo.invitacion-propia")
})

test_that("aulas es única: POST con plan proyectado o con entrada guardada es 409", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mct_code(collection_campaign_create(sid, "aulas", "Otra")), "E_COLLECTION_CAMPAIGN_AULAS_UNICA")
  expect_identical(.mct_status(collection_campaign_create(sid, "aulas", "Otra")), 409L)

  sid2 <- session_create(); on.exit(session_delete(sid2), add = TRUE)
  r <- collection_campaign_create(sid2, "aulas", "Campo HSVG", expected_registry_revision = 0L)
  expect_identical(r$campaign$id, "aulas.principal")
  expect_true(r$campaign$persisted)
  expect_identical(r$registry_revision, 1L)
  expect_true(nzchar(r$campaign$created_at))
  expect_identical(r$campaign$estado$unidades, 0L)
  expect_identical(session_get(sid2)$material_campaigns$schema, "material_campaigns/v1")
  expect_identical(.mct_code(collection_campaign_create(sid2, "aulas", "Otra")), "E_COLLECTION_CAMPAIGN_AULAS_UNICA")
  # Con revisión vieja: 409 de registro.
  expect_identical(.mct_code(collection_campaign_meta_put(sid2, "aulas.principal", name = "X",
                                                          expected_registry_revision = 0L)),
                   "E_COLLECTION_CAMPAIGN_STALE")
  # Opciones de correo en aulas: 422.
  sid3 <- session_create(); on.exit(session_delete(sid3), add = TRUE)
  expect_identical(.mct_code(collection_campaign_create(sid3, "aulas", "A", platform = "surveymonkey")),
                   "E_COLLECTION_CAMPAIGN_INVALID")
})

test_that("territorial no disponible; tipo fuera del registro es 422; id inexistente 404", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mct_code(collection_campaign_create(sid, "territorial", "UMP Arequipa")),
                   "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE")
  expect_identical(.mct_status(collection_campaign_create(sid, "territorial", "UMP Arequipa")), 409L)
  expect_identical(.mct_code(collection_campaign_create(sid, "presencial", "X")), "E_COLLECTION_CAMPAIGN_TIPO")
  expect_identical(.mct_code(collection_campaign_create(sid, NULL, "X")), "E_COLLECTION_CAMPAIGN_TIPO")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "correo.no-existe", name = "X")),
                   "E_COLLECTION_CAMPAIGN_NOT_FOUND")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "Aulas.Principal", name = "X")),
                   "E_COLLECTION_CAMPAIGN_NOT_FOUND")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "territorial.x", name = "X")),
                   "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE")
})

test_that("archivar aulas proyectada la persiste, no borra el plan y se puede reabrir", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  plan_antes <- session_get(sid)$collection_state$plan
  r <- collection_campaign_meta_put(sid, "aulas.principal", archived = TRUE, expected_registry_revision = 0L)
  expect_true(r$campaign$archived)
  expect_true(r$campaign$persisted)
  expect_identical(r$registry_revision, 1L)
  expect_identical(session_get(sid)$collection_state$plan, plan_antes)
  tipos <- setNames(collection_campaigns_get(sid)$tipos, c("aulas", "territorial", "correo"))
  expect_match(tipos$aulas$motivo, "archivada")
  noop <- collection_campaign_meta_put(sid, "aulas.principal", archived = TRUE, expected_registry_revision = 1L)
  expect_true(noop$noop)
  expect_identical(noop$registry_revision, 1L)
  re <- collection_campaign_meta_put(sid, "aulas.principal", archived = FALSE, name = "Campo 2026-2",
                                     expected_registry_revision = 1L)
  expect_false(re$campaign$archived)
  expect_identical(re$campaign$name, "Campo 2026-2")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "aulas.principal", archived = "si")),
                   "E_COLLECTION_CAMPAIGN_INVALID")
  # Un correo no se archiva.
  collection_mail_campaign_create(sid, .mct_srev(sid), name = "Docentes")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "correo.docentes", archived = TRUE,
                                                          expected_state_revision = .mct_srev(sid))),
                   "E_COLLECTION_CAMPAIGN_INVALID")
})

test_that("nombre con correo se rechaza en aulas y en correo; correo delega crear y renombrar", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mct_code(collection_campaign_create(sid, "aulas", "Campo de ana@ejemplo.org")),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  expect_identical(.mct_code(collection_campaign_create(sid, "correo", "Para ana@ejemplo.org",
                                                        expected_state_revision = 0L)),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
  c1 <- collection_campaign_create(sid, "correo", "Empleadores", actor = "Empleadores", platform = "surveymonkey",
                                   expected_state_revision = 0L)
  expect_identical(c1$campaign$id, "correo.empleadores")
  expect_identical(c1$campaign$estado$platform, "surveymonkey")
  expect_identical(c1$state_revision, 1L)
  expect_identical(c1$registry_revision, 0L)
  expect_null(session_get(sid)$material_campaigns)
  # Revisión de collection_state vieja: el 409 del engine de correo.
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "correo.empleadores", name = "Otra",
                                                          expected_state_revision = 0L)),
                   "E_COLLECTION_STATE_STALE")
  m <- collection_campaign_meta_put(sid, "correo.empleadores", name = "Empleadores 2026",
                                    expected_state_revision = 1L)
  expect_identical(m$campaign$id, "correo.empleadores")
  expect_identical(m$campaign$name, "Empleadores 2026")
  expect_identical(.mct_code(collection_campaign_meta_put(sid, "correo.empleadores", name = "x@y.org",
                                                          expected_state_revision = m$state_revision)),
                   "E_COLLECTION_MAIL_CAMPAIGN_NAME")
})

test_that("round-trip .pulso conserva material_campaigns", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  collection_campaign_meta_put(sid, "aulas.principal", name = "Campo HSVG", archived = TRUE)
  reg <- session_get(sid)$material_campaigns
  expect_true(isTRUE(session_get(sid)$project_dirty) || is.null(session_get(sid)$project_path))
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Campanas")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  expect_identical(session_get(loaded$session_id)$material_campaigns, reg)
  g <- collection_campaigns_get(loaded$session_id)
  expect_identical(g$registry_revision, 1L)
  expect_identical(g$campaigns[[1]]$name, "Campo HSVG")
  expect_true(g$campaigns[[1]]$archived)
  expect_true(g$campaigns[[1]]$persisted)
})

# Campaña SurveyMonkey exportable (imágenes alojadas y campos mapeados).
.mct_sm_campaign <- function(sid, name = "Arte FG") {
  c <- collection_mail_campaign_create(sid, .mct_srev(sid), name = name, platform = "surveymonkey")
  t <- c$campaign$template
  t$images$`logo-cliente`$url <- "https://pulsopucp.github.io/correo-/logo-cliente.png"
  t$images$pulso$url <- "https://pulsopucp.github.io/correo-/pulso.png"
  for (i in seq_along(t$fields)) {
    if (identical(t$fields[[i]]$key, "carrera")) t$fields[[i]]$sm <- "CustomData1"
    if (identical(t$fields[[i]]$key, "codigo")) t$fields[[i]]$sm <- "CustomData2"
  }
  collection_mail_template_put(sid, t, .mct_srev(sid), campaign_id = c$campaign$campaign_id)
  c$campaign$campaign_id
}

test_that("exportar un envío anota last_export_at y plataforma, sin subir la revisión y sin datos personales", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  id <- .mct_sm_campaign(sid)
  rev <- .mct_srev(sid)
  res <- collection_mail_export(sid, rev, id)
  expect_identical(res$export_recorded$send_id, "invitacion")
  expect_identical(res$export_recorded$last_export_platform, "surveymonkey")
  expect_match(res$export_recorded$last_export_at, "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z$")
  expect_identical(.mct_srev(sid), rev)

  send <- .cmail_sends_of(.cmail_campaigns_of(session_get(sid)$collection_state)$campaigns[[1]])[[1]]
  expect_identical(send$last_export_at, res$export_recorded$last_export_at)
  expect_identical(send$last_export_platform, "surveymonkey")
  expect_false(any(grepl("@", unlist(send), fixed = TRUE)))

  g <- collection_campaigns_get(sid)
  det <- g$campaigns[[1]]$estado$envios_detalle[[1]]
  expect_identical(det$last_export_at, res$export_recorded$last_export_at)

  # Guardar los envíos (con o sin las claves de servidor en el cuerpo) las conserva.
  sends_cliente <- .cmail_sends_of(.cmail_campaigns_of(session_get(sid)$collection_state)$campaigns[[1]])
  sends_cliente[[1]]$last_export_at <- "1999-01-01T00:00:00Z"
  sends_cliente[[2]] <- list(kind = "recordatorio", label = "Recordatorio 1", audience = "sin_respuesta")
  p <- collection_mail_template_put(sid, NULL, .mct_srev(sid), campaign_id = id, sends = sends_cliente)
  expect_identical(p$sends[[1]]$last_export_at, res$export_recorded$last_export_at)
  expect_null(p$sends[[2]]$last_export_at)
  # Un segundo export con la revisión vigente sigue funcionando y actualiza el registro del recordatorio.
  r2 <- collection_mail_export(sid, .mct_srev(sid), id, send_id = p$sends[[2]]$send_id)
  expect_identical(r2$export_recorded$send_id, p$sends[[2]]$send_id)

  # Duplicar no copia el registro.
  d <- collection_mail_campaign_duplicate(sid, .mct_srev(sid), id, name = "Copia")
  expect_true(all(vapply(d$campaign$sends, function(s) is.null(s$last_export_at), NA)))

  # La reconstrucción del plan conserva mail_campaigns entero (registro incluido).
  expect_true("mail_campaigns" %in% .COLLECTION_RESEED_CONSERVA)
})

test_that("exportar mailchimp (plantilla) también registra y marca dirty en un proyecto abierto", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, 0L, name = "Recuperación")
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Correo")
  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  lsid <- loaded$session_id
  expect_false(isTRUE(session_get(lsid)$project_dirty))
  res <- collection_mail_export(lsid, .mct_srev(lsid), "recuperacion", scope = "plantilla")
  expect_identical(res$export_recorded$last_export_platform, "mailchimp")
  expect_true(isTRUE(session_get(lsid)$project_dirty))
})

test_that("inicio del proyecto: facts material-campo trae campaigns sin perder las cifras de fichas", {
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, .mct_srev(sid), name = "Egresados")
  f <- .project_overview_payload(sid)$facts[["material-campo"]]
  expect_identical(f$titulares, 3L)
  expect_identical(f$with_link, 2L)
  expect_identical(vapply(f$campaigns, `[[`, "", "id"), c("aulas.principal", "correo.egresados"))
  expect_identical(f$campaigns[[1]]$resumen$unidades, 3L)
  expect_identical(f$campaigns[[2]]$resumen$platform, "mailchimp")
  expect_setequal(names(f$campaigns[[1]]), c("id", "tipo", "name", "archived", "resumen"))

  vacio <- session_create(); on.exit(session_delete(vacio), add = TRUE)
  fv <- .project_overview_payload(vacio)$facts[["material-campo"]]
  expect_length(fv$campaigns, 0L)
})

test_that("HTTP: GET/POST/PUT con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  sid <- .mct_con_plan(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  g <- .cmail_fx_call(pr, sid, "GET", "/api/recopiladores/campaigns")
  expect_identical(g$status, 200L)
  expect_match(g$raw, '"created_at":null', fixed = TRUE)
  expect_identical(g$body$campaigns[[1]]$id, "aulas.principal")

  c1 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/campaigns",
                       .cmail_fx_json(list(tipo = "correo", name = "Docentes", actor = "Docentes",
                                           expected_state_revision = g$body$state_revision)))
  expect_identical(c1$status, 200L, info = substr(c1$raw, 1, 600))
  expect_identical(c1$body$campaign$id, "correo.docentes")
  expect_match(c1$raw, '"last_export_at":null', fixed = TRUE)

  t <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/campaigns",
                      .cmail_fx_json(list(tipo = "territorial", name = "UMP")))
  expect_identical(t$status, 409L)
  expect_identical(t$body$error$code %||% t$body$code, "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE")

  u <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/campaigns/meta",
                      .cmail_fx_json(list(id = "aulas.principal", archived = TRUE,
                                          expected_registry_revision = 0L)))
  expect_identical(u$status, 200L, info = substr(u$raw, 1, 600))
  expect_true(u$body$campaign$archived)
  expect_identical(u$body$registry_revision, 1L)

  st <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/campaigns/meta",
                       .cmail_fx_json(list(id = "aulas.principal", name = "X", expected_registry_revision = 0L)))
  expect_identical(st$status, 409L)
})

test_that("registrar la exportación no pisa el registro de artefactos de la sesión", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  id <- .mct_sm_campaign(sid)
  res <- collection_mail_export(sid, .mct_srev(sid), id)
  files <- session_get(sid)$files
  for (a in res$artifacts) expect_true(file.exists(files[[a$file_id]]$path))
  expect_false(is.null(.cmail_sends_of(.cmail_campaigns_of(session_get(sid)$collection_state)$campaigns[[1]])[[1]]$last_export_at))
})
