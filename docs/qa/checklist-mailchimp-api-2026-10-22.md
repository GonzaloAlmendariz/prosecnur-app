# Checklist · Mailchimp por API en Material de campo (2026-10-22)

Pedido de Gonzalo: «Podemos hacer el punto 1 y 2, el punto 3 deberá ser su propia sesión… el 4 no hace falta, los contactos se pueden quitar en plataforma».

- Punto 1: reintentos, avance y carga de la audiencia por API.
- Punto 2: las campañas se crean como borrador desde la app.
- Punto 3 (reportes en Monitoreo): va en la sesión «monitoreo-acred-inst».
- Punto 4 (limpieza): se descarta.

Antecedente: commits 4b4447a93, 1ecebac07, 8ac86549f y e33003a18, con «Quién ya respondió», la sincronización SurveyMonkey → etiqueta en Mailchimp y la clave en Configuración › Conexiones.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1.1 | Reintentos en toda llamada a Mailchimp ante error de red, 429 y 500–504 | `api/R/collection_mail_mailchimp.R` (`.mc_call`, `.mc_http`) | hecho: pruebas sin red de 429, 503, curl y 400 sin reintento |
| 1.2 | «Actualizar quién respondió» corre como job con avance | `collection_mail_mailchimp.R` + router + `SincronizarRespuestas.tsx` | hecho |
| 1.3 | Cargar la audiencia de la campaña en Mailchimp por API (campos y etiqueta del público), como job con avance | `api/R/collection_mail_mailchimp_audiencia.R` (nuevo) | hecho: prueba real con 7 contactos actualizados, etiqueta «Prueba Acreditación» y campo CARRERA creado |
| 2.1 | Crear la campaña del envío como **borrador** en Mailchimp: asunto, preheader, remitente, segmento e imágenes alojadas en el File Manager | `api/R/collection_mail_mailchimp_borrador.R` (nuevo) | hecho: prueba real con borrador de invitación (7 destinatarios, 2 imágenes) y de recordatorio (5, sin quienes respondieron); nada enviado |
| 2.2 | La UI de Envíos ofrece las tres acciones para cualquier envío Mailchimp, con avance, resultado y enlace «Abrir en Mailchimp» | `frontend/.../correos/MailchimpPorApi.tsx` (nuevo); el montaje en `PanelEnvios.tsx` lo hace el lead | hecho: montado; un bloqueo por revisión dice su motivo |
| 2.3 | La app **nunca envía**: el botón «Send» se pulsa en Mailchimp | contrato | regla |

## Contrato congelado (no cambiar sin el lead)

### Cliente HTTP (1.1)
- `.mc_http(method, url, key, body = NULL)` devuelve `list(status, body, headers)`. `headers` es una lista con nombres en minúscula: alcanza con `retry-after`.
- `.mc_call` reintenta hasta **4 intentos en total** ante error de curl, 429 y 500/502/503/504. La espera es `retry-after` si viene, y si no 1 s, 2 s y 4 s. Usa `.mc_sleep(seconds)`, que es aislable en los tests.
- Los 400, 401, 403, 404 y 422 no se reintentan. Los errores de clave y de API se mantienen como hoy, con el `detail` sin correos.

### Jobs (1.2, 1.3)
- Patrón de la casa (`api/R/jobs.R`, `job_submit`, archivo de avance). La función del worker es top-level, con nombre, y toma `sid`.
- El avance se escribe con `job_progress_writer` en lotes: «Mailchimp: 1,500 de 45,078».
- `POST /api/recopiladores/mail-sync` acepta `{campaign_id, survey_id, list_id, tag, dry_run}` y responde `{ok, job_id}`. El resultado del job es el payload que existe hoy (`recipients…synced_at`).
- `POST /api/recopiladores/mail-sync/audience` acepta `{campaign_id, list_id, tag?}` y responde `{ok, job_id}`.
- El frontend consulta el job por la ruta estándar de jobs que ya usa el resto de la app.

### Audiencia (1.3), resultado del job
- Destinatarios efectivos, los mismos de `audiencia.csv` (`.cmail_recipients_resolve` + `tag_rows` + `.cmail_trato_resolve`). Hay que reutilizar la lógica de `.cmail_write_audience` (extraer un helper común, sin cambiar el CSV) para que la API y el ZIP digan exactamente lo mismo.
- Campos: Email Address → `email_address`; First Name → `FNAME`; cada etiqueta de la plantilla (`ENLACE`, …) y `SALUDO` (trato) → `merge_fields`. Antes de subir, `GET /lists/{id}/merge-fields`, y se crea cada etiqueta que falte con `{tag, name, type:"text"}`. Así ninguna columna llega como `MMERGE7`.
- Subida en lotes de 500 con `POST /lists/{id}` `{members:[{email_address, status_if_new:"subscribed", merge_fields}], update_existing:true}`. Se suman `new_members`, `updated_members` y `error_count`; los errores se agrupan por `error_code`, sin correos.
- Etiqueta del público: `tag` (por defecto `campaign$actor` y, si está vacío, `campaign$name`). Se aplica a todos con `.mc_tag_emails`.
- Resultado: `{ok, campaign_id, list_id, tag, recipients, created, updated, failed, failed_by_reason:{code:n}, tagged, merge_fields_created:[tags], uploaded_at}`. Sin correos.

### Borrador (2.1) — `POST /api/recopiladores/mail-sync/campaign`
- Body: `{campaign_id, send_id, list_id, from_name, reply_to, tag?, exclude_tag?}`.
  - `tag` por defecto: el del público, como en 1.3.
  - `exclude_tag`: por defecto «Respondió» si el envío es un recordatorio, y ninguno en la invitación.
- Es síncrono: son pocas llamadas.
- Usa el mismo render que el export Mailchimp del envío (`.cmail_template_for_send` + `.cmail_review_checks(..., scope="plantilla", send)`). Si la revisión trae errores, sale `E_COLLECTION_MAIL_REVIEW_BLOCKING`, igual que en el export.
- Imágenes locales: `POST /file-manager/files {name, file_data(base64)}` y se reemplaza su referencia en el HTML por `full_size_url`. Una imagen con `url` ya alojada se deja tal cual.
- `POST /campaigns`:
  - `type: "regular"`;
  - `recipients: {list_id, segment_opts: {match: "all", conditions: [{condition_type: "StaticSegment", field: "static_segment", op: "static_is", value: <id tag>}, (si exclude) {…, op: "static_not", value: <id exclude>}]}}`;
  - `settings: {subject_line, preview_text, title: "<campaña> · <envío>", from_name, reply_to}`.
- Después, `PUT /campaigns/{id}/content {html}` y un `GET` para leer `recipients.recipient_count`.
- Resultado: `{ok, mailchimp_campaign_id, web_id, edit_url: "https://<dc>.admin.mailchimp.com/campaigns/edit?id=<web_id>", recipient_count, subject, title, images_uploaded}`.
- **No hay ninguna ruta que envíe ni programe.**

### Códigos E_* nuevos
Los que hagan falta (por ejemplo `E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT`), registrados en `api/R/errors_registry.R` en el mismo commit.

## Gate
- R: `make gate-area AREA=collection-mail` (base 1446 pass), con tests nuevos sin red mockeando `.mc_http` y `.mc_sleep`.
- Front: `tsc` + `make gate-front AREA=recopiladores` (base 1166).
- Visual: la tarjeta en Envíos.
- Cierre: verificador.
- Prueba real: con la audiencia «PULSO PUCP» (8 contactos) y la campaña «Prueba recordatorio», creando un borrador, sin enviar.
