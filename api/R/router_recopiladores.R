# Router propio de Recopiladores (ADR 0046, unidades 5-7).
# Valida la forma HTTP y delega todas las transiciones al engine.

.collection_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw)) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% "{}"
  }
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(trimws(body_raw))) body_raw <- "{}"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_COLLECTION_BAD_JSON", "El body no contiene JSON válido.")
  )
}

.collection_adapter_or_stop <- function(adapter_id) {
  adapter <- collection_adapter_get(adapter_id)
  if (is.null(adapter)) {
    stop_api(422, "E_COLLECTION_ADAPTER_UNKNOWN", "adapter_id no pertenece al registry V1 de Recopiladores.")
  }
  adapter
}

mount_recopiladores <- function(pr) {
  pr |>
    plumber::pr_get("/api/recopiladores/state", wrap_endpoint(function(req, res, ...) {
      collection_state_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/seed", wrap_endpoint(function(req, res, ...) {
      collection_state_seed(session_header(req))
    })) |>
    # Rehacer el plan desde el sorteo vigente. `seed` no sirve para esto: no hace
    # nada si el plan ya existe, y sin este camino un proyecto se queda con el
    # plan de la primera corrida para siempre (medido: veinte dias de desfase en
    # HSVG2026). Exige `expected_revision` como el resto de escrituras.
    # `dry_run: true` previsualiza: el mismo `descartado`, sin mutar nada.
    # `expected_source_fingerprint` (opcional, E1e) es el `fingerprint_actual`
    # que Origen enseño: si la fuente cambio desde entonces, 409
    # E_COLLECTION_ORIGEN_CAMBIO en vez de rehacer con otra cosa.
    plumber::pr_post("/api/recopiladores/reseed", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_origen_assert_huella(session_header(req), body$expected_source_fingerprint)
      collection_state_reseed(session_header(req), body$expected_revision, dry_run = body$dry_run)
    })) |>
    # Unidades › Origen (E1e): de donde salen las unidades y que cambio en la
    # fuente desde que se sembro el plan. Lectura pura.
    plumber::pr_get("/api/recopiladores/origen", wrap_endpoint(function(req, res, nivel = "diferencias",
                                                                  limite = "200", ...) {
      collection_origen_get(session_header(req), nivel = nivel, limite = limite)
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/plan", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_plan_put(
        session_header(req),
        plan = body$plan %||% body$collection_plan,
        expected_revision = body$expected_revision
      )
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/deployment", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_deployment_put(
        session_header(req),
        deployment = body$deployment %||% body$collection_deployment,
        expected_revision = body$expected_revision
      )
    })) |>
    plumber::pr_post("/api/recopiladores/deployment/prepare", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_deployment_prepare(
        session_header(req),
        expected_revision = body$expected_revision,
        deployment = body$deployment %||% body$collection_deployment
      )
    })) |>
    plumber::pr_post("/api/recopiladores/reconcile", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_reconcile(
        session_header(req),
        expected_revision = body$expected_revision,
        observed = body$observed %||% list(
          plan_fingerprint = body$plan_fingerprint,
          instrument_sha256 = body$instrument_sha256,
          target_fingerprint = body$target_fingerprint,
          target = body$target,
          remote_ref = body$remote_ref
        )
      )
    })) |>
    plumber::pr_post("/api/recopiladores/handoff", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_handoff(
        session_header(req),
        expected_revision = body$expected_revision,
        deployment_fingerprint = body$deployment_fingerprint
      )
    })) |>
    plumber::pr_get("/api/recopiladores/material-template", wrap_endpoint(function(req, res, ...) {
      collection_material_template_get(session_header(req))
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/material-template", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_template_put(
        session_header(req),
        template = body$template,
        expected_revision = body$expected_revision
      )
    })) |>
    # Editor sobre la página real (ADR 0109 E1b): la cara pedida, compilada con
    # el borrador de la receta y una unidad del plan, más las zonas de cada
    # bloque. Lectura pura: sin expected_revision y sin tocar el estado.
    plumber::pr_post("/api/recopiladores/material-template/preview", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_template_preview(
        session_header(req),
        page = body$page %||% 1L,
        template = body$template,
        unit_id = body$unit_id,
        dpi = body$dpi
      )
    })) |>
    # Campañas tipadas del módulo (ADR 0111): aulas, territorial y correo. La
    # lista proyecta las de correo de mail_campaigns; crear y renombrar un
    # correo delegan en su engine (collection_campaigns.R).
    plumber::pr_get("/api/recopiladores/campaigns", wrap_endpoint(function(req, res, ...) {
      collection_campaigns_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/campaigns", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_campaign_create(session_header(req), tipo = body$tipo, name = body$name, actor = body$actor,
                                 platform = body$platform, preset_id = body$preset_id, template = body$template,
                                 import_id = body$import_id,
                                 expected_state_revision = body$expected_state_revision,
                                 expected_registry_revision = body$expected_registry_revision)
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/campaigns/meta", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_campaign_meta_put(session_header(req), id = body$id, name = body$name, actor = body$actor,
                                   platform = body$platform, archived = body$archived,
                                   expected_state_revision = body$expected_state_revision,
                                   expected_registry_revision = body$expected_registry_revision)
    })) |>
    # Correos para Mailchimp y SurveyMonkey (ADR 0110 §2, E1f; campañas E1h;
    # plataforma, envíos e importación de HTML E1j-E1l). Cada plantilla
    # vive en su campaña de collection_state$mail_campaigns; los destinatarios
    # en el tempdir de la sesión, por campaña, y en files/contactos/ del .pulso
    # (ADR 0112; nunca en state.rds). `campaign_id` va por consulta en GET/DELETE, en el cuerpo en
    # POST/PUT y como parte del multipart al importar.
    plumber::pr_get("/api/recopiladores/mail-presets", wrap_endpoint(function(req, res, ...) {
      collection_mail_presets_get(session_header(req))
    })) |>
    plumber::pr_get("/api/recopiladores/mail-campaigns", wrap_endpoint(function(req, res, ...) {
      collection_mail_campaigns_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/mail-campaigns", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_campaign_create(session_header(req), expected_revision = body$expected_revision,
                                      name = body$name, actor = body$actor, preset_id = body$preset_id,
                                      platform = body$platform, template = body$template, import_id = body$import_id)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-campaigns/duplicate", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_campaign_duplicate(session_header(req), expected_revision = body$expected_revision,
                                         campaign_id = body$campaign_id, name = body$name, actor = body$actor)
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/mail-campaigns/meta", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_campaign_meta_put(session_header(req), expected_revision = body$expected_revision,
                                        campaign_id = body$campaign_id, name = body$name, actor = body$actor,
                                        platform = body$platform)
    })) |>
    # Borrar es POST (no DELETE con cuerpo); confirm_name es la segunda confirmación.
    plumber::pr_post("/api/recopiladores/mail-campaigns/delete", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_campaign_delete(session_header(req), expected_revision = body$expected_revision,
                                      campaign_id = body$campaign_id, confirm_name = body$confirm_name)
    })) |>
    # «Mis secciones» del correo (ADR 0113): viven en el estudio. Borrar es POST, como las campañas.
    plumber::pr_get("/api/recopiladores/mail-sections", wrap_endpoint(function(req, res, ...) {
      collection_mail_sections_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/mail-sections", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_section_create(session_header(req), expected_revision = body$expected_revision,
                                     name = body$name, block = body$block, images = body$images,
                                     campaign_id = body$campaign_id)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-sections/delete", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_section_delete(session_header(req), expected_revision = body$expected_revision,
                                     section_id = body$section_id)
    })) |>
    # «Importar de otro estudio…» (ADR 0113): leer otro .pulso y copiar sus secciones con sus fotos.
    plumber::pr_post("/api/recopiladores/mail-sections/import/peek", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_sections_import_peek(session_header(req), path = body$path)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-sections/import", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_sections_import(session_header(req), expected_revision = body$expected_revision,
                                      path = body$path, section_ids = body$section_ids)
    })) |>
    # «Actualizar quién respondió»: SurveyMonkey → etiqueta en Mailchimp.
    plumber::pr_get("/api/recopiladores/mail-sync/options", wrap_endpoint(function(req, res, ...) {
      collection_mail_mailchimp_options(session_header(req))
    })) |>
    # ¿La encuesta recibe la variable con que la campaña genera los enlaces?
    plumber::pr_get("/api/recopiladores/mail-sync/check", wrap_endpoint(function(req, res, campaign_id = NULL,
                                                                          survey_id = NULL, ...) {
      collection_mail_mailchimp_check(session_header(req), campaign_id = campaign_id, survey_id = survey_id)
    })) |>
    # Job con avance: responde {ok, job_id}; el resultado se lee en /api/jobs/<id>.
    plumber::pr_post("/api/recopiladores/mail-sync", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      # `solo_marcar` (ADR 0112 §3) es el alias de `dry_run`: guarda quién
      # respondió en los contactos sin tocar Mailchimp ni pedir su clave.
      collection_mail_mailchimp_sync_submit(session_header(req), campaign_id = body$campaign_id, survey_id = body$survey_id,
                                            list_id = body$list_id, tag = body$tag,
                                            dry_run = isTRUE(body$dry_run) || isTRUE(body$solo_marcar))
    })) |>
    # Cargar la audiencia de la campaña en Mailchimp (job con avance).
    plumber::pr_post("/api/recopiladores/mail-sync/audience", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_mailchimp_audience_submit(session_header(req), campaign_id = body$campaign_id,
                                                list_id = body$list_id, tag = body$tag)
    })) |>
    # Crear el envío como BORRADOR en Mailchimp. No hay ruta que envíe ni programe.
    plumber::pr_post("/api/recopiladores/mail-sync/campaign", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_mailchimp_campaign_draft(session_header(req), campaign_id = body$campaign_id,
                                               send_id = body$send_id, list_id = body$list_id,
                                               from_name = body$from_name, reply_to = body$reply_to,
                                               tag = body$tag, exclude_tag = body$exclude_tag)
    })) |>
    plumber::pr_get("/api/recopiladores/mail-template", wrap_endpoint(function(req, res, ...) {
      collection_mail_template_get(session_header(req), campaign_id = .cmail_query_campaign(req))
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/mail-template", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_template_put(session_header(req), template = body$template,
                                   expected_revision = body$expected_revision, campaign_id = body$campaign_id,
                                   sends = body$sends, import_id = body$import_id)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-template/preview", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_preview(session_header(req), mode = body$mode %||% "preview",
                              recipient_index = body$recipient_index, template = body$template,
                              campaign_id = body$campaign_id, send_id = body$send_id, send = body$send)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-template/review", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_review(session_header(req), template = body$template, campaign_id = body$campaign_id,
                             scope = body$scope, send_id = body$send_id, send = body$send)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-template/export", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_export(session_header(req), expected_revision = body$expected_revision,
                             campaign_id = body$campaign_id, scope = body$scope, send_id = body$send_id)
    })) |>
    # Importar un HTML existente (E1l): lectura pura, no escribe el estado. JSON
    # {html, file_name, subject?} o multipart con la parte `file`.
    plumber::pr_post("/api/recopiladores/mail-template/import-html", wrap_endpoint(function(req, res, ...) {
      input <- .cmail_import_html_request(req)
      collection_mail_import_html(session_header(req), html = input$html, file_name = input$file_name,
                                  subject = input$subject, raw = input$raw)
    })) |>
    plumber::pr_post("/api/recopiladores/mail-recipients/import", wrap_endpoint(function(req, res, ...) {
      input <- .cmail_import_request(req)
      collection_mail_recipients_import(
        session_header(req), file_raw = input$file_raw, file_name = input$file_name,
        content_base64 = input$content_base64, mapping = input$mapping, campaign_id = input$campaign_id
      )
    })) |>
    plumber::pr_get("/api/recopiladores/mail-recipients", wrap_endpoint(function(req, res, ...) {
      collection_mail_recipients_get(session_header(req), campaign_id = .cmail_query_campaign(req))
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/mail-recipients/mapping", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_recipients_mapping_put(session_header(req), mapping = body$mapping,
                                             campaign_id = body$campaign_id)
    })) |>
    plumber::pr_handle("DELETE", "/api/recopiladores/mail-recipients", wrap_endpoint(function(req, res, ...) {
      collection_mail_recipients_delete(session_header(req), campaign_id = .cmail_query_campaign(req))
    })) |>
    # Pestaña Contactos (ADR 0112 §4): la lista CON correos (app local; el modo
    # público no monta este router), el tablero por variables de control, la
    # elección de esas variables y el enlace personal a la encuesta.
    plumber::pr_get("/api/recopiladores/mail-contacts", wrap_endpoint(function(req, res, campaign_id = NULL, q = NULL,
                                                                         estado = NULL, filtros = NULL,
                                                                         respondio = NULL, page = NULL,
                                                                         per_page = NULL, ...) {
      collection_mail_contacts_list(session_header(req), campaign_id = campaign_id, q = q, estado = estado,
                                    filtros = filtros, respondio = respondio, page = page, per_page = per_page)
    })) |>
    plumber::pr_get("/api/recopiladores/mail-contacts/perfil", wrap_endpoint(function(req, res, campaign_id = NULL,
                                                                                filtros = NULL, cruce = NULL, ...) {
      collection_mail_contacts_perfil(session_header(req), campaign_id = campaign_id, filtros = filtros, cruce = cruce)
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/mail-contacts/control", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_contacts_control_put(session_header(req), campaign_id = body$campaign_id,
                                           variables = body$variables)
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/mail-contacts/enlace", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_mail_enlace_put(session_header(req), campaign_id = body$campaign_id, url = body$url,
                                 variable = body$variable)
    })) |>
    # Catálogo › Tipos (ADR 0109 E1a): los tipos de material y su miniatura,
    # compilada por el MISMO motor del PDF contra una unidad de prueba. Lectura
    # pura: no toca el estado ni necesita expected_revision.
    plumber::pr_get("/api/recopiladores/material-catalog", wrap_endpoint(function(req, res, ...) {
      collection_material_catalog_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/material-catalog/preview", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_catalog_preview(
        session_header(req),
        preset_id = body$preset_id,
        page = body$page %||% 1L
      )
    })) |>
    plumber::pr_post("/api/recopiladores/materials/instances", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_instance_create(
        session_header(req),
        expected_revision = body$expected_revision,
        unit_refs = body$unit_refs,
        access_refs = body$access_refs,
        locale = body$locale %||% "es-PE"
      )
    })) |>
    plumber::pr_post("/api/recopiladores/materials/render", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_render_start(
        session_header(req),
        instance_id = body$instance_id,
        format = body$format,
        page = body$page %||% 1L,
        resolved_access = body$resolved_access,
        audience = body$audience %||% "field_team"
      )
    })) |>
    # B6(b): subir al Drive del operativo un artefacto YA renderizado (por su
    # file_id del recibo). Escritura de estado: exige expected_revision.
    plumber::pr_post("/api/recopiladores/materials/drive", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_drive_publicar(
        session_header(req),
        file_id = body$file_id,
        expected_revision = body$expected_revision
      )
    })) |>
    # El historico de fichas de prueba: que enlace tenia `CAPACITACION` y cuando
    # se hizo, para poder volver a abrirlo o reimprimir la hoja del taller.
    plumber::pr_get("/api/recopiladores/materials/pruebas", wrap_endpoint(function(req, res, ...) {
      collection_prueba_historico(session_header(req))
    })) |>
    # Ficha suelta con un identificador inventado (`PRUEBA_2026`,
    # `CAPACITACION`): mismo enlace del operativo, otro colector. NO pasa por
    # `materials/instances`, porque una ficha de prueba dentro de `plan$units`
    # moveria el conteo de unidades y el handoff. Queda en
    # `collection_state$pruebas`, que es una lista hermana.
    plumber::pr_post("/api/recopiladores/materials/prueba", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_prueba_start(
        session_header(req),
        codigo = body$codigo %||% body$code,
        etiqueta = body$etiqueta %||% body$label
      )
    })) |>
    plumber::pr_post("/api/recopiladores/provider-preflight", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      adapter <- .collection_adapter_or_stop(body$adapter_id)
      inspected <- adapter$inspect_target(
        connection_ref = body$connection_ref %||% list(),
        target_ref = body$target_ref %||% list()
      )
      preflight <- adapter$capability_preflight(
        operation = body$operation,
        target = list(
          connection_ref = body$connection_ref %||% list(),
          target = body$target_ref %||% list()
        )
      )
      list(
        ok = isTRUE(inspected$ok) && isTRUE(preflight$ok),
        adapter_id = body$adapter_id,
        inspect_target = inspected,
        capability_preflight = preflight
      )
    })) |>
    plumber::pr_post("/api/recopiladores/deployment/preview", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      sid <- session_header(req)
      adapter <- .collection_adapter_or_stop(body$adapter_id)
      plan <- body$plan %||% .collection_current(session_get(sid))$plan
      preview <- adapter$preview_deployment(plan = plan, target = body$target %||% list())
      list(ok = TRUE, adapter_id = body$adapter_id, deployment = preview)
    }))
}
