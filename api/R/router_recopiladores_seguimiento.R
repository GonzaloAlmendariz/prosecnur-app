# router_recopiladores_seguimiento.R — Material de campo › Correo › Seguimiento
#
#   GET  /api/recopiladores/mail-seguimiento                         configuración y campañas
#   PUT  /api/recopiladores/mail-seguimiento/config                  audiencia, archivar, antes de cada envío, encuestas
#   POST /api/recopiladores/mail-seguimiento/sync                    quién respondió en todas las campañas (job)
#   GET  /api/recopiladores/mail-seguimiento/programadas             campañas programadas en Mailchimp
#   POST /api/recopiladores/mail-seguimiento/antes-de-envio          la vista lo llama cada pocos minutos
#   PUT  /api/recopiladores/mail-seguimiento/horario                 públicos, oficina, etiquetas, horas
#   POST /api/recopiladores/mail-seguimiento/horario/sortear         grupos A/B con semilla
#   POST /api/recopiladores/mail-seguimiento/horario/etiquetar       etiquetas de los grupos en Mailchimp (job)
#   PUT  /api/recopiladores/mail-seguimiento/horario/plan            plan de recordatorios (o proponerlo)
#   POST /api/recopiladores/mail-seguimiento/horario/borrador        borrador de un grupo (no envía)
#   POST /api/recopiladores/mail-seguimiento/horario/leer-envios     hora real de cada borrador (sólo GET)
#   GET  /api/recopiladores/mail-seguimiento/horario/resultados      análisis
#   POST /api/recopiladores/mail-seguimiento/horario/informe         informe PDF
#   PUT  /api/recopiladores/mail-seguimiento/correo-personal         columna, proporción, inicio
#   POST /api/recopiladores/mail-seguimiento/correo-personal/sortear 80/20 con semilla
#   POST /api/recopiladores/mail-seguimiento/correo-personal/cargar  sube el 80 % a Mailchimp (job)
#   GET  /api/recopiladores/mail-seguimiento/correo-personal/efecto  80 contra 20
#
# Ninguna ruta envía ni programa campañas. Ninguna respuesta trae correos.

mount_recopiladores_seguimiento <- function(pr) {
  B <- "/api/recopiladores/mail-seguimiento"
  body_of <- function(req) .collection_parse_body(req)
  pr |>
    plumber::pr_get(B, wrap_endpoint(function(req, res, ...) {
      collection_mail_seguimiento_estado(session_header(req))
    })) |>
    plumber::pr_handle("PUT", paste0(B, "/config"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_seguimiento_config(session_header(req), list_id = b$list_id, tag = b$tag, archivar = b$archivar,
                                         antes_de_envio = b$antes_de_envio, encuestas = b$encuestas)
    })) |>
    plumber::pr_post(paste0(B, "/sync"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_seguimiento_sync_submit(session_header(req), archivar = b$archivar)
    })) |>
    plumber::pr_get(paste0(B, "/programadas"), wrap_endpoint(function(req, res, ...) {
      collection_mail_seguimiento_programadas(session_header(req))
    })) |>
    plumber::pr_post(paste0(B, "/antes-de-envio"), wrap_endpoint(function(req, res, ...) {
      collection_mail_seguimiento_antes_de_envio(session_header(req))
    })) |>
    plumber::pr_handle("PUT", paste0(B, "/horario"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_prueba_horario_config(session_header(req), campanas = b$campanas, oficina = b$oficina,
                                            etiquetas = b$etiquetas, horizonte_h = b$horizonte_h,
                                            oficina_desde = b$oficina_desde, oficina_hasta = b$oficina_hasta)
    })) |>
    plumber::pr_post(paste0(B, "/horario/sortear"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_prueba_horario_sortear(session_header(req), semilla = b$semilla, rehacer = isTRUE(b$rehacer))
    })) |>
    plumber::pr_post(paste0(B, "/horario/etiquetar"), wrap_endpoint(function(req, res, ...) {
      collection_mail_prueba_horario_etiquetar_submit(session_header(req))
    })) |>
    plumber::pr_handle("PUT", paste0(B, "/horario/plan"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_prueba_horario_plan(session_header(req), plan = b$plan, proponer = b$proponer)
    })) |>
    plumber::pr_post(paste0(B, "/horario/borrador"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_prueba_horario_borrador(session_header(req), campaign_id = b$campaign_id, ronda = b$ronda,
                                              grupo = b$grupo, from_name = b$from_name, reply_to = b$reply_to)
    })) |>
    plumber::pr_post(paste0(B, "/horario/leer-envios"), wrap_endpoint(function(req, res, ...) {
      collection_mail_prueba_horario_leer_envios(session_header(req))
    })) |>
    plumber::pr_get(paste0(B, "/horario/resultados"), wrap_endpoint(function(req, res, horizonte_h = NULL, ...) {
      collection_mail_prueba_horario_resultados(session_header(req), horizonte_h = horizonte_h)
    })) |>
    plumber::pr_post(paste0(B, "/horario/informe"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_prueba_horario_informe(session_header(req), horizonte_h = b$horizonte_h)
    })) |>
    plumber::pr_handle("PUT", paste0(B, "/correo-personal"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_correo_personal_config(session_header(req), columnas = b$columnas, proporcion = b$proporcion,
                                             etiqueta = b$etiqueta, desde = b$desde)
    })) |>
    plumber::pr_post(paste0(B, "/correo-personal/sortear"), wrap_endpoint(function(req, res, ...) {
      b <- body_of(req)
      collection_mail_correo_personal_sortear(session_header(req), semilla = b$semilla, rehacer = isTRUE(b$rehacer))
    })) |>
    plumber::pr_post(paste0(B, "/correo-personal/cargar"), wrap_endpoint(function(req, res, ...) {
      collection_mail_correo_personal_cargar_submit(session_header(req))
    })) |>
    plumber::pr_get(paste0(B, "/correo-personal/efecto"), wrap_endpoint(function(req, res, ...) {
      collection_mail_correo_personal_efecto(session_header(req))
    }))
}
