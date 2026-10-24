# Checklist · T3: reportes de Mailchimp en Monitoreo (2026-10-22)

Tipo: Checklist de pedido con varias indicaciones
Estado: Vigente
Fecha: 2026-10-22
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo: «Dale con T3», sobre el diseño de
`docs/qa/diagnostico-monitoreo-acred-institucional-2026-10-22.md` §3 y §4.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| T3.1 | Lectura de Mailchimp para Monitoreo, solo GET: campañas enviadas, reporte por campaña, destinatarios con su token (`sent-to`), actividad (`email-activity`), bajas, quejas y contactos limpiados de la audiencia | `api/R/monitoreo_mailchimp_lectura.R` (nuevo); usa `.mc_call` sin editarlo | hecho: `.mcm_leer`, solo GET; reutiliza el detalle de los envíos cuya firma (enviados, rebotes, bajas, quejas, aperturas, clics) no cambió; lectura real del piloto en 3.1 s |
| T3.2 | Modelo puro: por envío y público, y por público con base alcanzable, tasas y semáforo de ritmo; atribución de respuestas al envío | `api/R/monitoreo_mailchimp_modelo.R` (nuevo) | hecho: `monitoreo_mailchimp_modelo`; a escala (45 mil personas, 9 envíos, 243 mil destinatarios) 4.6 s y 0.5 MB de JSON |
| T3.3 | Rutas: estado (GET), audiencias (GET), configuración (POST), actualizar (POST, job con avance) | `api/R/router_monitoreo_mailchimp.R` (nuevo) + montaje en `plumber_app.R` | hecho: `router_monitoreo_mailchimp.R` + `mount_monitoreo_mailchimp` en `plumber_app.R`; `E_MONITOREO_MAILCHIMP_AUDIENCIA` registrado |
| T3.4 | Pestaña Avance › Correo | `frontend/src/api/monitoreoMailchimp.ts`, `profiles/acreditacion/AvanceCorreo.tsx`, catálogo de navegación, montaje en la página | hecho (agente frontend-react): `monitoreoMailchimp.ts` + `AvanceCorreo*.tsx` + `avanceCorreoModelo.ts`; pestaña en el catálogo; montaje +3 líneas en la página (18,490 de 18,514); con una sola audiencia queda preseleccionada |
| T3.5 | Tests sin red (R con `.mc_http` simulado; vitest del normalizador y la vista) | `test-monitoreo-mailchimp.R`, `monitoreoMailchimp.test.ts` | R hecho: `test-monitoreo-mailchimp.R` 91 pass; gate del área 301 pass con los contratos transversales; ida y vuelta del `.pulso` sin correos en `state.rds`. Vitest: a cargo del front |
| T3.6 | Prueba real de solo lectura con la audiencia «PULSO PUCP» (dos campañas del piloto) y verificación en la app | `/ver-ui` con copia de trabajo | hecho en vivo (proyecto de 45 mil + piloto, 8877/5187): elegir audiencia → «Actualizar desde Mailchimp» → 2 envíos del piloto (7 y 5 entregados, 2 respuestas atribuidas a la invitación), 9 públicos «Sin envíos», 0 inválidos; `ui-quick-check` 1440x1000 y 1024x600: ok, 0 problemas, geometría declarada (2 grupos) |

## Contrato congelado

### Persistencia (sesión → `.pulso`)

`s$monitoreo_mailchimp`, sin correos (ADR 0005 y 0112: solo tokens y conteos):

```r
list(
  schema = "monitoreo_mailchimp_v1",
  list_id = "",                  # audiencia elegida
  leido_at = "",                 # última lectura completa (ISO)
  envios = list(<campaign_id> = list(
    campaign_id, titulo, asunto, enviado_at, etiqueta, excluye,   # etiqueta del segmento y la excluida
    tipo,                         # "invitacion" | "recordatorio" (excluye «Respondió» → recordatorio)
    enviados, rebotes_duros, rebotes_blandos, bajas, quejas,
    aperturas_unicas, aperturas_sin_proxy, clics_unicos,
    actividad_desde = ""          # corte de email-activity ya leído
  )),
  personas = data.frame(campaign_id, token, entrega, abrio, clic, clic_at),  # entrega: sent | hard | soft
  bajas = data.frame(campaign_id, token, fecha, motivo),
  quejas = data.frame(campaign_id, token, fecha),
  limpiados = data.frame(token, fecha, motivo)   # miembros `cleaned` de la audiencia
)
```

El token se extrae de cualquier campo de combinación con `?t=` o `&t=`. Se normaliza con
`.monitoreo_code_keys`, la misma regla de la llave de Monitoreo.

### Rutas

- `GET /api/monitoreo/mailchimp/estado` → `list(ok, conectado, list_id, leido_at, envios, publicos, invalidos, umbrales, avisos)` (forma abajo).
- `GET /api/monitoreo/mailchimp/audiencias` → `list(ok, conectado, audiencias = [{id, name, member_count}])`.
- `POST /api/monitoreo/mailchimp/config` `{list_id}` → estado.
- `POST /api/monitoreo/mailchimp/sync` → `{ok, job_id}`; kind `monitoreo.mailchimp_sync`; al terminar, el resultado se fusiona en `s$monitoreo_mailchimp`.

### Payload de estado

```
publicos: [{ actor, universo, invitados, invalidos, alcanzable, efectivas,
             tasa_universo, tasa_alcanzable,              # proporciones 0–1, con su base al lado
             bajas, quejas, envios,                         # envios = n de campañas que tocaron al público
             ultimo: { campaign_id, entregados, bajas, quejas, respuestas, tasa_baja, tasa_queja },
             ritmo: "seguir" | "espaciar" | "detener" | "sin_envios", ritmo_motivo }]
envios:   [{ campaign_id, titulo, asunto, enviado_at, etiqueta, tipo, orden,     # orden: 1 = invitación, 2.. = recordatorios
             actor,                     # público mayoritario de sus destinatarios (por token)
             enviados, entregados, rebotes_duros, rebotes_blandos,
             aperturas_sin_proxy, clics, bajas, quejas, respuestas,              # respuestas = efectivas atribuidas al envío
             tasa_apertura, tasa_clic, tasa_baja, tasa_queja,                    # sobre entregados
             por_actor: [{ actor, enviados, entregados, ... mismas cifras }] }]
invalidos: { total, por_actor: [{actor, n}], filas: [{ token, actor, motivo, campaign_id, fecha }] }   # motivo: rebote_duro | limpiado
umbrales:  { baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 }   # propuesta, decisión D4
avisos:    [ ... ]   # p. ej. tokens sin persona en el universo, cruce de Monitoreo aún no calculado
```

Reglas:

- **Público por token.** El público de cada destinatario es el actor de su token en el
  `case_rollup` de Monitoreo. Un token que no está en el universo cae en «Fuera del universo».
- **Inválidos.** Un correo es inválido si tuvo rebote duro en algún envío o si la audiencia lo marca
  `cleaned`. Sale del denominador solo si no respondió: `alcanzable = universo − inválidos sin efectiva`. Así la
  tasa sobre la base alcanzable nunca pasa de 100 %; `invalidos` sigue contando a todos para el listado de la DAA.
- **Atribución.** Una efectiva se atribuye al envío donde la persona hizo clic por primera vez. Sin
  clic registrado, va al último envío recibido antes de la respuesta. Sin envío previo, no se atribuye.
- **Ritmo, sobre el último envío del público:**
  - **detener** si la queja ≥ 0.3 %;
  - **espaciar** si la baja ≥ 0.5 %, si la queja ≥ 0.1 % o si hubo menos respuestas que bajas;
  - **seguir** en otro caso.
- **Las aperturas que se muestran** son las sin proxy de Apple.
- **Ningún correo** viaja en el payload ni se guarda.

## Notas

- **Primera pasada del verificador: rechazada (corregido).** Encontró que un envío sin destinatarios leídos tumbaba `/estado`, que un destinatario sin token heredaba el público de una fila del universo sin token, que la tasa sobre la base alcanzable podía pasar de 100 %, que una respuesta con solo fecha no se atribuía al envío de ese día, y que el job publicaba el snapshot entero. Las cinco se corrigieron, cada una con su test (110 pass; gate del área 404 pass); segunda pasada del verificador: aprueba.

- **Tipo de envío por orden, no por segmento**: el recordatorio del piloto (21/10) se armó a mano sin excluir «Respondió»; el tipo sale del orden dentro del público (1 = invitación).
- **Aperturas por público incluyen las automáticas de Apple**: Mailchimp no las separa por persona; la cifra sin Apple solo existe por envío (`aperturas_sin_proxy`).
- La clave vive en el proveedor `mailchimp` (`.connections_token_require("mailchimp", sid)`). El cliente
  `collection_mail_mailchimp.R` es de otra sesión y no se edita; se reutilizan `.mc_call` y `.mc_job_submit`.
- El borrador creado desde Material de campo no persiste su id de Mailchimp. Por eso el envío se
  identifica leyendo `/campaigns?status=sent` y el público se resuelve por token, no por la etiqueta.
