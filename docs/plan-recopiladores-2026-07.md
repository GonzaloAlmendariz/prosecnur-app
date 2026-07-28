# Plan de Recopiladores — despliegue de recolección multicanal

Investigación y plan para convertir el generador de fichas QR en un módulo de
dominio que prepare accesos, materiales y handoffs de recolección para
SurveyMonkey, Kobo y fuentes manuales.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-07-27 |
| Estado | Propuesto; sujeto a aceptación del ADR 0046 |
| Alcance | Contrato de módulo, investigación oficial SurveyMonkey/Kobo, persistencia `.pulso`, adapters, UI, compatibilidad y fases de implementación |
| Fuera de alcance | Implementación, migración destructiva, llamadas autenticadas, creación real de collectors/assets, envío de correo/SMS y cambios de permisos remotos |
| ADR | [0046 — Recopiladores como despliegue de recolección](adrs/0046-recopiladores-despliegue-recoleccion.md) |

---

## 0. Tesis

Recopiladores debe poseer el **despliegue pre-campo de la recolección**:
transformar un plan operativo ya decidido y una revisión inmutable del
instrumento en accesos y materiales diseñados, verificables y listos para
entregar. Es un hub de canales, accesos y materiales de aplicación.

```text
plan/listado/marco decidido
+ revisión publicada del instrumento
+ actor y canal declarados
→ manifiesto de despliegue
→ vínculo unidad ↔ instrumento ↔ acceso
→ plantilla/preview/enlace/QR/ficha/instrucciones/paquete
→ handoff auditable a Monitoreo
```

El valor del módulo no es dibujar QR. Es poder responder, antes de recibir una
sola respuesta:

- qué instrumento y qué revisión se desplegaron;
- por qué canal y proveedor;
- qué unidad, audiencia o destinatario recibe cada acceso;
- qué identificador viajará con la respuesta;
- qué materiales se entregaron;
- qué versión exacta recibió Monitoreo;
- qué plantilla y qué revisión produjeron cada página o paquete.

El nombre visible puede mantenerse como **Recopiladores** por compatibilidad,
con el subtítulo **Canales, accesos y materiales de recolección**. El slug
`recopiladores` y la ruta `/recopiladores` permanecen estables.

## 1. Diagnóstico del sistema actual

La UI existente tiene identidad de módulo, pero no ownership de dominio:

- `frontend/src/lib/modules.ts` la define como “Fichas QR para
  cursos-horario”;
- `RecopiladoresPage.tsx` lee primero la agenda de Monitoreo y usa la selección
  de Cálculo de muestra como fallback;
- los borradores de enlaces viven en estado React;
- el resultado se guarda directamente en `/api/monitoreo/aulas/*`;
- la unidad transversal es `MonitoreoAulasPlanRow`, específica de curso,
  horario, docente, facultad y muestra;
- `d[collectorID]={curso_horario}` usa el nombre `collectorID` para una unidad
  operativa, mientras SurveyMonkey sí entrega `collector_id` con otro
  significado;
- el PDF actual es impresión del navegador; Word/PDF remotos son referencias
  opcionales, no artefactos generados y registrados;
- la arquitectura canónica no asigna todavía estado ni endpoints propios a
  Recopiladores.

También existe un segundo sistema de recopiladores dentro de Monitoreo:

- SurveyMonkey: discovery de collectors, detalle y recipients;
- configuración local `monitoreo_config$operational_model$link_collectors`;
- clasificación por uso operativo: correo, teléfono, presencial QR, SMS o
  mixto;
- lectura de `collector_id` en respuestas y reportes.

Ambos carriles comparten vocabulario, pero no identidad ni lifecycle. El plan
los integra mediante contratos explícitos, no trasladando el monolito de una
pantalla a otra.

## 2. Vocabulario canónico

| Concepto | Definición | Ejemplos |
|---|---|---|
| Instrumento | Revisión local e inmutable que define preguntas y variables de trazabilidad | XLSForm publicado, survey SurveyMonkey inspeccionado |
| Recopilador proveedor | Recurso remoto que un proveedor reconoce como canal de captura | Collector `weblink` o `email` de SurveyMonkey |
| Recopilador lógico | Instancia local de distribución que personaliza y traza un acceso aunque el proveedor no cree un recurso remoto por enlace | Link Kobo con `d[collectorID]=AULA-001` |
| Perfil de acceso | Configuración local que explica cómo se abrirá un instrumento cuando el proveedor no posee collectors remotos | Web form Kobo público parametrizado, Kobo autenticado por usuario |
| Uso operativo | Lectura metodológica local del canal | QR presencial, correo autoaplicado, teléfono asistido |
| Unidad de aplicación | Entidad sobre la que debe conservarse trazabilidad | Curso-horario, actor, establecimiento, lote, ruta, caso |
| Destinatario | Persona o contacto individual cuando el proveedor lo modela | Recipient de una invitación SurveyMonkey |
| Acceso | URL, token, QR o referencia que une unidad/destinatario con instrumento y canal | Link Kobo parametrizado, `survey_link` de recipient |
| Material | Artefacto entregable construido a partir de accesos | Ficha A4, manifiesto TSV, paquete ZIP |
| Plantilla de material | Receta semántica, versionada y reusable; no contiene valores resueltos de una unidad | `ficha_aplicacion_a4_v1` |
| Bloque | Componente permitido dentro de una plantilla, con presentación y binding tipados | QR de acceso, instrucciones, campos de unidad, registro manual |
| Instancia de material | Aplicación de una revisión de plantilla a un deployment y conjunto de unidades/accesos | 42 fichas resueltas para aulas |
| Recibo de artefacto | Evidencia inmutable del archivo generado, sus fuentes y checksums | PDF con `file_id`, SHA-256 y 42 páginas |
| Despliegue | Versión congelada de plan, target, bindings, artefactos y handoff | `collection_deployment/v1` |

Regla: `provider_collector_id`, `logical_collector_id`, `recipient_id`,
`unit_id`, `operator_id` y `access_id` son llaves distintas. Ningún adapter
puede reutilizar un campo para dos de esas identidades. Un campo del formulario
llamado `collectorID` puede transportar `logical_collector_id`, pero no se
interpreta automáticamente como `provider_collector_id`.

## 3. Investigación oficial: SurveyMonkey

Consulta realizada el 2026-07-27 sin credenciales ni mutaciones. Fuente
principal: [SurveyMonkey API v3](https://api.surveymonkey.com/v3/docs).

### 3.1 Modelo real

SurveyMonkey sí posee un `collector` remoto de primer nivel, subordinado a una
encuesta:

```text
Survey
└── Collector
    ├── tipo, nombre, estado y opciones
    ├── URL común, si es Web Link
    ├── Message[]
    │   └── Recipient[]
    │       └── survey_link individual
    ├── Response[]
    │   ├── collector_id
    │   ├── recipient_id, si corresponde
    │   └── custom_variables
    └── estadísticas
```

Los tipos creables por la API documentada son `weblink`, `email`, `sms`,
`popup_invitation`, `embedded_survey` y `popup_survey`. “WhatsApp”, “teléfono
asistido”, “ficha QR” y “presencial” no son tipos SurveyMonkey: son usos
operativos de Prosecnur.

### 3.2 Lifecycle y API

| Capacidad | Endpoint oficial | Implicación |
|---|---|---|
| Listar collectors | `GET /surveys/{survey_id}/collectors` | Discovery read-only y paginado |
| Crear o copiar | `POST /surveys/{survey_id}/collectors` | Efecto remoto; requiere preflight e idempotencia |
| Ver detalle | `GET /collectors/{collector_id}` | Fuente de tipo, estado, URL y opciones reales |
| Modificar/cerrar | `PATCH` o `PUT /collectors/{collector_id}` | Nunca como consecuencia de guardar localmente |
| Borrar | `DELETE /collectors/{collector_id}` | Destructivo; excluido del plan inicial |
| Crear mensajes | `POST /collectors/{id}/messages` | Solo para collectors compatibles y con permisos |
| Cargar recipients | `POST .../messages/{id}/recipients[/bulk]` | Transfiere PII y modifica Contacts |
| Enviar/programar | `POST .../messages/{id}/send` | Side effect separado con confirmación final |
| Leer respuestas | `/collectors/{id}/responses*` | Conserva `collector_id`, `recipient_id` y variables |
| Webhooks | `/webhooks` | Requiere callback HTTPS alcanzable; no encaja directamente con desktop local |

La documentación oficial exige scopes `collectors_read` o
`collectors_write`. Las Draft y Private apps empiezan con límites de 120
solicitudes por minuto y 500 por día; mensajes/contactos tienen límites
adicionales. Los planes y permisos efectivos deben inspeccionarse en runtime:
no se hardcodearán como capacidad garantizada.

### 3.3 Web Link y Custom Variables

SurveyMonkey documenta las
[Custom Variables](https://help.surveymonkey.com/en/surveymonkey/send/custom-variables/)
como el mecanismo para adjuntar trazabilidad a un Web Link:

- se definen primero en el diseño de la encuesta;
- los valores se insertan fuera de SurveyMonkey;
- admiten hasta 100 variables;
- la URL debería mantenerse por debajo de 2.000 caracteres;
- nombres y valores tienen restricciones;
- son case-sensitive;
- no crean recipients ni vuelven privado el enlace;
- no funcionan con recurrence;
- son una función sujeta al plan.

Prosecnur puede generar variantes por unidad, pero debe validar que las
variables existan y advertir que un Web Link sigue siendo público y reenviable.
Esto no requiere una llamada API por variante: si el usuario aporta el Web Link
existente y la plantilla de Custom Variables ya fue creada en SurveyMonkey,
Prosecnur sustituye los valores y genera los QR localmente. La API solo es
necesaria para descubrir/verificar el collector, crearlo o recuperar recursos
nativos que SurveyMonkey genera en servidor.

### 3.4 Email/SMS y recipients

Un
[Email Invitation Collector](https://help.surveymonkey.com/en/surveymonkey/send/email-invitation-collector/)
agrega mensajes, destinatarios, seguimiento de aperturas/clics y un enlace
individual por recipient. Los mensajes deben conservar tags obligatorios como
`[SurveyLink]` y `[OptOutLink]`, documentados en
[Required Data](https://help.surveymonkey.com/en/surveymonkey/send/required-data-email-invitations/).

Consecuencias:

- crear recipients no equivale a generar links locales: modifica contactos
  remotos y transfiere PII;
- `survey_link` individual puede comportarse como credencial bearer;
- anonymous responses puede retirar identidad de resultados, pero no elimina
  la sensibilidad del roster ni de los links;
- invitación, recordatorio y agradecimiento son operaciones distintas;
- consentimiento, anti-spam, opt-out, remitente verificado, rebotes y límites
  son parte del contrato, no detalles de UI.

V1 solo descubrirá y vinculará collectors/recipients existentes. Una futura
fase de envío debe usar el recorrido `preflight → preview → borrador →
recipients → validación → confirmación humana → send`.

### 3.5 Webhooks

SurveyMonkey publica eventos de respuestas, surveys y collectors. El callback
debe ser una URL única, aceptar `HEAD`, devolver 200 y validar la firma del
proveedor. Prosecnur desktop en `127.0.0.1` no es un receptor público estable.

Decisión: sincronización pull bajo acción explícita. Un relay HTTPS y cola
durable serían otra arquitectura y requerirían un ADR separado.

### 3.6 Estado actual y gaps de Prosecnur

`api/R/surveymonkey_api.R` ya lista collectors, obtiene detalle y recorre
recipients. `router_monitoreo.R` puede descubrirlos desde snapshot o refresco
remoto explícito. No existen primitives para crear/modificar/borrar
collectors, crear mensajes, cargar recipients, enviar invitaciones o crear
webhooks.

Gaps que deben entrar al backlog antes de ampliar el adapter:

1. recipients se limita a `100 × 50 = 5.000`, aunque collectors pagados pueden
   superar esa cifra;
2. `personalized_link_count` puede presentarse como estimado sin que se haya
   observado cada link;
3. el listado no solicita explícitamente todos los campos de estado/link que
   soporta el endpoint;
4. `custom_fields` puede llegar como objeto clave-valor y el parser actual no
   cubre todas las formas;
5. la heurística prioriza “tiene recipients = correo” y puede clasificar SMS
   como email;
6. cualquier Web Link con URL se sugiere como `presencial_qr`, aunque puede
   distribuirse por muchos canales.

La reparación de estos gaps es previa a cualquier promesa de aprovisionamiento
SurveyMonkey.

## 4. Investigación oficial: KoboToolbox

Consulta realizada el 2026-07-27 sin credenciales ni mutaciones. Fuentes
principales: [Getting started with the API](https://support.kobotoolbox.org/api.html),
[KoboToolbox Primary API](https://kf.kobotoolbox.org/api/v2/docs/) y
[Collecting data using web forms](https://support.kobotoolbox.org/data_through_webforms.html).

### 4.1 Links personalizados, sin collector remoto equivalente

Kobo no expone una entidad remota análoga al collector SurveyMonkey. Sí permite
crear múltiples links personalizados sobre el mismo web form y precargar en
cada uno un identificador como `collectorID`. Esos links pueden funcionar como
**recopiladores lógicos** de Prosecnur: distinguen aula, actor, establecimiento,
lote o canal y el valor viaja dentro de la submission.

La unidad remota central de Kobo sigue siendo el **project/asset**: formulario,
configuración y submissions. Al desplegar el asset se publica una versión del
formulario y aparecen modos/enlaces de recolección. Kobo no crea por cada URL
parametrizada un objeto remoto independiente con lifecycle, recipients o
estadísticas de distribución.

El equivalente funcional en Prosecnur será un perfil de acceso:

```text
asset_uid
+ deployment version
+ form URL opaca
+ collection mode
+ auth policy
+ prefill bindings
+ logical_collector_id
+ unit_id
+ kobo_username opcional
= collection_access local
```

En la UI puede llamarse **recopilador Kobo personalizado**. En el contrato se
conserva como `logical_collector_id` + `collection_access`, y nunca se confunde
con un `provider_collector_id` remoto.

### 4.2 Asset, deployment y versiones

Kobo documenta estados Draft, Deployed y Archived. Desplegar vuelve el
formulario apto para submissions; editar exige redeploy y los navegadores o
KoboCollect deben actualizar su copia. Véase
[Deploying forms](https://support.kobotoolbox.org/deploy_form_new_project.html).

Cada deployment debe registrar como mínimo:

- servidor/perfil de conexión no secreto;
- `asset_uid`;
- version ID o content hash observado;
- URL de formulario devuelta por el proveedor;
- política de autenticación observada o `unknown`;
- fecha de inspección.

La URL se trata como opaca. La documentación 2026 habla de Kobo web forms y
señala que antes se asociaban con Enketo. No se congelarán dominios `ee.*`,
rutas `/x/` ni heurísticas históricas como contrato público.

### 4.3 Modos de web form

Kobo documenta enlaces online-offline con múltiples submissions, online-only
múltiple, online-only single, once-per-browser/device, embeddable y view-only.
Son modos de acceso del mismo asset, no collectors independientes.

“Once per respondent” limita el navegador/dispositivo; no prueba identidad
cross-device ni crea una invitación revocable individual.

### 4.4 Prefill y trazabilidad

La personalización documentada usa:

```text
?d[data_column_name]=value
```

Por ejemplo, el flujo actual de aulas usa:

```text
?d[collectorID]=CURSO-HORARIO
```

Si `collectorID` existe en el XLSForm —normalmente como campo oculto— Kobo
guarda ese valor en la submission. Por tanto, no se elimina este mecanismo: se
generaliza para que el nombre del campo y la fuente del valor sean configurables
y queden registrados en el deployment.

Si la pregunta vive dentro de grupos debe usarse el path completo. Los
parámetros se combinan con `&`; `lang` selecciona idioma y `return_url` aplica
al modo single documentado.

El prefill es un default de formulario, no autorización ni firma. El usuario
puede reenviar o modificar la URL. Por eso:

- se permite para `unit_id`, `link_key`, canal o lote;
- el campo debe estar congelado en la revisión local del XLSForm;
- no se introduce PII o secreto en el QR;
- puede usarse `link_key` opaco en lugar de un identificador humano;
- revocar un link requiere una regla de formulario/estado externo o rotación,
  no una operación nativa de recipient.

### 4.5 Autenticación, permisos e identidad

Nuevos proyectos desplegados requieren autenticación por defecto. El permiso
`Add submissions` habilita captura autenticada y lleva identidad en
`_submitted_by`. Los permisos y sus límites se documentan en
[User-level permissions](https://support.kobotoolbox.org/managing_permissions.html).

Permitir submissions sin login es una configuración de proyecto distinta de
hacer públicos el formulario o los datos. Publicar submissions puede exponer
tabla, reportes, descargas y mapa, por lo que Recopiladores no debe activar
permisos de forma implícita. Véase
[Project-level sharing](https://support.kobotoolbox.org/project_sharing_settings.html).

Patrones soportables:

- aula anónima: submission pública + hidden `unit_id/link_key`;
- enumerador autenticado: cuenta Kobo + `Add submissions` + `_submitted_by`;
- híbrido: identidad del operador y unidad prefilled;
- campaña pública: link compartido sin identidad individual.

`_submitted_by` es operador/cuenta, no `collector_id` ni canal.

### 4.6 Offline

Web forms offline requieren una primera apertura y cache online; drafts y cola
viven en almacenamiento del navegador y pueden perderse si se borra. Un QR no
garantiza una primera apertura offline.

KoboCollect descarga el formulario antes de campo, permite captura offline y
envía al reconectar. Tras redeploy debe descargar la nueva versión.

Los paquetes deben indicar el modo esperado y verificarlo durante readiness;
no basta con comprobar que la URL responde.

### 4.7 API v2 y estado actual de Prosecnur

La documentación oficial indica que los endpoints v1 fueron retirados en junio
de 2026. El contrato nuevo usa `/api/v2/assets/*` y `/data/`; véase
[Migrating from v1 to v2](https://support.kobotoolbox.org/migrating_api.html).

Prosecnur ya puede:

- listar assets;
- importar XLSForm y esperar el resultado;
- desplegar un asset;
- resolver una URL candidata;
- descargar submissions paginadas;
- manejar perfiles Global/EU/otros y secretos fuera del `.pulso`.

No puede todavía:

- inspeccionar de forma contractual el modo/auth policy;
- administrar usuarios o permisos;
- crear recipients o campañas —entidades que Kobo no posee—;
- revocar un link parametrizado;
- garantizar que el fallback de URL sea una URL de submission y no la landing
  del asset.

La auditoría del cliente actual añade cuatro bloqueos previos a habilitar un
adapter Kobo nuevo:

1. `/#/forms/{uid}/landing` es una landing administrativa, no un web form de
   captura; parametrizarla después del fragmento `#` no entrega `d[]` al
   formulario;
2. el listado actual no pagina ni filtra contractualmente solo assets survey;
3. la descarga usa `page/page_size`, mientras el schema v2 vigente documenta
   `start/limit`;
4. import/deploy existen en el código, pero sus payloads y respuestas deben
   validarse contra fixtures del OpenAPI v2 antes de declararlos listos.

La generación de N links/QR para N unidades debe reutilizar un asset y un web
form base. No debe crear N assets.

### 4.8 Push y REST Services

Kobo REST Services puede enviar una submission nueva a otro servidor, pero
requiere un endpoint alcanzable y no cubre de igual forma todas las ediciones.
No se usará como mecanismo base del módulo local-first. La sincronización pull
incremental sigue siendo el contrato inicial.

## 5. Matriz comparativa de proveedores

| Dimensión | SurveyMonkey | Kobo | Contrato Prosecnur |
|---|---|---|---|
| Recurso remoto de canal | Collector real | No existe | `provider_collector` opcional |
| Recopilador lógico por unidad | Custom Variable o recipient link | Link `d[field]=value` | `logical_collector_id` |
| Formulario | Survey | Project/asset | `instrument_target` |
| Publicación | Collector open/closed | Asset deployment/version | `provider_state` tipado |
| Link común | Web Link collector | Web form URL/modo | `base_access_url` |
| Personalización | Custom Variables | `d[field]=value` | `prefill_bindings` con adapter |
| Destinatarios | Recipient real en email/SMS | No existe recipient nativo | `recipient_ref` opcional |
| Link individual nativo | Sí, para recipient | No | `access_ref` sensible según tipo |
| Identidad operador | No es función del collector | Usuario Kobo / `_submitted_by` | `operator_ref` separado |
| Mensajes/envío | API email/SMS | No | Capacidad opcional; no V1 |
| Tracking distribución | Send/open/click/bounce/opt-out | No equivalente | Señales por capability |
| Tracking respuesta | collector/recipient/custom vars | asset/submission/prefill/user | Handoff normalizado |
| Webhook/push | Webhooks públicos | REST Services | Pull local en V1 |
| Offline | Experiencia web según collector | Web form cache/KoboCollect | Readiness específico |
| Revocación individual | Posible vía recipient/collector según flujo | No para link `d[]` | Capability explícita |

Conclusión: el core se diseña por **capabilities**, no por una interfaz que
obligue a Kobo a fingir collectors o a SurveyMonkey a comportarse como un
simple link parametrizado.

### 5.1 Frontera local/API: no es binaria por proveedor

| Resultado | Generación local | Configuración remota previa | API externa necesaria |
|---|---|---|---|
| Kobo: N links `d[field]=value` y QR | Sí | Asset desplegado, campo existente, URL real y política de acceso | No, si la URL se pega; lectura opcional para descubrir/verificar |
| Kobo: crear/importar/desplegar asset | No | — | Sí, escritura autenticada; deshabilitada en V1 |
| Kobo: cambiar auth/permisos | No | — | Sí o acción equivalente en UI Kobo; deshabilitada en V1 |
| SurveyMonkey: N variantes de Web Link con Custom Variables | Sí | Web Link existente y variables definidas en el diseño | No por variante; lectura opcional para descubrir/verificar |
| SurveyMonkey: crear Web Link collector | No | Survey existente | Sí, `collectors_write`; deshabilitada en V1 |
| SurveyMonkey: obtener recipient links existentes | No se fabrican localmente; pueden importarse | Collector email/SMS, mensaje y recipients ya aprovisionados | Sí para recuperarlos desde el proveedor; no si se importan manualmente |
| SurveyMonkey: crear recipients o enviar | No | Plan, permisos, consentimiento y remitente | Sí, escritura autenticada; deshabilitada en V1 |
| QR, fichas, TSV y manifiesto desde cualquier URL final | Sí | URL válida | No |

Por tanto, V1 ofrece dos caminos por provider:

1. **Manual/local**: el usuario pega una URL base válida y declara la plantilla;
2. **Conectado/read-only**: Prosecnur usa la API para descubrir y comprobar el
   target, pero la multiplicación de links y materiales sigue siendo local.

Los enlaces nativos de recipient de SurveyMonkey son la excepción: no pueden
fabricarse con una plantilla local porque los emite el servidor para un
recipient remoto concreto.

## 6. Contratos de dominio

### 6.1 `collection_plan/v1`

Estado persistente y liviano:

```json
{
  "schema": "collection_plan/v1",
  "plan_id": "plan-...",
  "adapter": { "id": "aulas_v1", "version": 1 },
  "source_ref": {
    "module": "calc-muestra",
    "run_id": "...",
    "fingerprint": "sha256:..."
  },
  "instrument_ref": {
    "revision_id": "...",
    "sha256": "...",
    "provider": "kobo"
  },
  "unit_type": "classroom_course_schedule",
  "units": [],
  "revision": 1,
  "input_fingerprint": "sha256:..."
}
```

Las unidades contienen `unit_id`, label, rol, grupo, dimensiones operativas y
programación. Actores/canales se referencian por llaves estables del módulo
que los gobierna; Recopiladores no los renombra.

### 6.2 `collection_deployment/v1`

```json
{
  "schema": "collection_deployment/v1",
  "deployment_id": "deployment-...",
  "plan_id": "plan-...",
  "plan_fingerprint": "sha256:...",
  "target": {
    "provider": "kobo",
    "connection_profile_id": "profile-...",
    "remote_ref": { "asset_uid": "...", "version_id": "..." }
  },
  "capabilities": {},
  "bindings": [],
  "coverage": {},
  "sensitivity": { "access_urls": "operational" },
  "status": "prepared",
  "handoff": null
}
```

Estados: `draft → prepared → handed_off`. Pasa a `stale` si cambia el plan, la
selección, la revisión del instrumento o el target remoto observado.

### 6.3 Binding de acceso

```json
{
  "access_id": "access-...",
  "logical_collector_id": "logical-...",
  "unit_id": "unit-...",
  "provider_collector_id": null,
  "recipient_id": null,
  "operator_id": null,
  "access_kind": "parameterized_link",
  "access_ref": "local-redacted-or-external-ref",
  "prefill": { "collectorID": "opaque-key" },
  "status": "ready"
}
```

La persistencia de `access_ref` depende de sensibilidad. Los links de recipient
o con PII pueden persistirse solo como hash/referencia; el manifiesto completo
se exporta fuera del `.pulso`.

### 6.4 Interface de adapter

```text
supports(input)
normalize_plan(input)
inspect_target(connection_ref, target_ref)
preview_deployment(plan, target)
commit_deployment(preview, confirmation)
prepare_material_instances(deployment, template)
render_artifacts(instances)
handoff_to_monitoring(deployment)
```

Toda mutación remota implementa `preview` y `commit` separados. Guardar estado
local nunca ejecuta `commit`.

### 6.5 Capabilities

Cada adapter declara explícitamente, entre otras:

```text
remote_discovery
remote_create
remote_update
remote_delete
shared_link
prefill
native_recipients
native_individual_links
messages
send
delivery_stats
authenticated_operators
offline_first_load
individual_revocation
```

La UI solo ofrece acciones cuya capability fue observada en el target y
permitida por el alcance de la fase.

### 6.6 `collection_capability_preflight/v1`

No se usarán booleanos que mezclen soporte del proveedor, implementación y
autorización. Cada operación declara esas tres dimensiones por separado:

```json
{
  "schema": "collection_capability_preflight/v1",
  "adapter_id": "surveymonkey_weblink_existing_v1",
  "operation_policy": "v1_read_only",
  "capabilities": {
    "local_generation": {
      "provider_support": "supported",
      "implementation": "planned",
      "policy": "allowed_v1",
      "evidence": "observed"
    },
    "remote_read": {
      "provider_support": "supported",
      "implementation": "available",
      "policy": "allowed_explicit",
      "evidence": "observed"
    },
    "remote_write": {
      "provider_support": "supported",
      "implementation": "unavailable",
      "policy": "disabled_v1",
      "evidence": "current_code"
    }
  },
  "blocking": [],
  "warnings": []
}
```

Valores mínimos: `provider_support = supported | unsupported | unknown`,
`implementation = available | partial | planned | unavailable`, `policy =
allowed_v1 | allowed_explicit | disabled_v1 | future` y `evidence = observed |
declared | current_code | unknown`. `remote_write=disabled_v1` es una política
aunque el cliente subyacente —como Kobo import/deploy— ya tenga una
implementación parcial.

### 6.7 `collection_material_template/v1`

La plantilla es una receta de material de aplicación, no un PDF ni HTML
arbitrario:

```json
{
  "schema": "collection_material_template/v1",
  "template_id": "template-...",
  "revision": 3,
  "preset_id": "ficha_aplicacion_a4_v1",
  "material_kind": "application_sheet",
  "compatible_adapters": ["aulas_v1"],
  "page": { "size": "A4", "orientation": "portrait" },
  "pages": [{
    "layout_preset": "single_sheet",
    "blocks": [
      { "block_id": "qr", "type": "access_qr", "binding": "access.qr_payload", "required": true },
      { "block_id": "unit", "type": "field_grid", "fields": ["unit.label", "unit.schedule", "unit.venue"] },
      { "block_id": "instructions", "type": "instructions", "text": "Escanea el QR para responder" }
    ]
  }],
  "brand_ref": "pulso-default",
  "sensitivity_policy": "operational",
  "template_sha256": "sha256:..."
}
```

El registro V1 de bloques es cerrado: `brand_header`, `heading`, `body`,
`access_qr`, `field_grid`, `instructions`, `application_log`, `divider` y
`footer`. Los bindings solo pueden leer paths allowlisted de `project`,
`deployment`, `unit` y `access`. No admite HTML/CSS/JS, consultas, expresiones
ejecutables, fuentes remotas ni URLs arbitrarias.

El bloque QR es protegido: resuelve `access.qr_payload` mediante `access_id` y
permite configurar nivel de corrección, quiet zone, tamaño mínimo y estilo
dentro de límites legibles. No se convierte en una imagen o URL libre.

### 6.8 `collection_material_instance/v1`

```json
{
  "schema": "collection_material_instance/v1",
  "instance_id": "material-...",
  "template_ref": { "template_id": "template-...", "revision": 3, "sha256": "sha256:..." },
  "deployment_id": "deployment-...",
  "deployment_fingerprint": "sha256:...",
  "unit_refs": ["unit-..."],
  "access_refs": ["access-..."],
  "locale": "es-PE",
  "status": "ready",
  "sensitivity": "operational",
  "warnings": []
}
```

La instancia guarda receta y referencias; los valores sensibles se resuelven
solo durante preview/render. Cambiar template, deployment, instrumento o acceso
la vuelve `stale`.

### 6.9 `collection_artifact_receipt/v1`

```json
{
  "schema": "collection_artifact_receipt/v1",
  "receipt_id": "receipt-...",
  "artifact_id": "artifact-...",
  "instance_id": "material-...",
  "deployment_id": "deployment-...",
  "plan_fingerprint": "sha256:...",
  "deployment_fingerprint": "sha256:...",
  "template_ref": {
    "template_id": "template-...",
    "revision": 3,
    "sha256": "sha256:..."
  },
  "layout_fingerprint": "sha256:...",
  "file_id": "file-...",
  "media_type": "application/pdf",
  "filename": "fichas-aulas.pdf",
  "sha256": "sha256:...",
  "size_bytes": 123456,
  "page_count": 42,
  "generator": {
    "id": "collection-material-renderer",
    "version": 1,
    "fingerprint": "sha256:..."
  },
  "audience": "field_team",
  "sensitivity": "operational"
}
```

El recibo es el manifest canónico y único del artefacto; no se crea un
`manifest.json` paralelo. Un paquete puede agregar varios recibos por referencia,
sin duplicarlos. El binario queda fuera del `.pulso`; el proyecto conserva
únicamente el recibo permitido.

## 7. Ownership y dependencias

| Módulo | Entrega/consume | No debe hacer |
|---|---|---|
| Cálculo de muestra | Entrega selección, titulares/reservas y fingerprint | Crear accesos o ejecutar campo |
| Editor XLSForm | Entrega revisión local inmutable y hash | Generar paquetes por unidad |
| Hojas de Ruta | Entrega rutas/unidades y artefactos cartográficos | Ceder mapas o selección a Recopiladores |
| Recopiladores | Produce plan, deployment, accesos, materiales y handoff | Seleccionar muestra, editar instrumento o monitorear respuestas |
| Monitoreo | Consume deployment y gobierna agenda viva, reemplazos activados, avance, calidad y cierre | Regenerar accesos o redefinir el deployment entregado |
| Carga | Consume data/cortes resultantes | Preparar campo o materiales |
| Connections | Gobierna perfiles y secretos globales | Persistir tokens en el módulo/proyecto |
| Reportes / renderer | Compila una instancia válida a PDF/ZIP/TSV mediante job | Decidir bloques, bindings, copy operativo o unidades de Recopiladores |
| Archivos | Registra, descarga y guarda binarios mediante `file_id` | Interpretar templates, deployments o bindings |
| Gráficos | Conserva planes analíticos, slides y visualizaciones | Ser editor o renderer de materiales de aplicación en V1 |

ADR 0019 mantiene vigencia hasta que ADR 0046 sea aceptado e implementado. La
transición mueve solo preparación inicial de links/QR/fichas; Monitoreo conserva
agenda viva, reprogramaciones, reemplazos, sincronización, brechas y cierre.

## 8. Persistencia, privacidad y artefactos

Persisten en `.pulso`:

- plan, deployment y schema versionados;
- fingerprints, hashes y revisiones;
- IDs remotos no secretos y perfil de conexión referenciado;
- bindings mínimos o redactados;
- cobertura, readiness y recibo de handoff;
- decisiones de clasificación/uso operativo;
- plantillas, revisiones, recetas e instancias sin valores sensibles resueltos;
- recibos de artefacto permitidos, nunca sus binarios.

No persisten:

- tokens, client secrets ni credenciales;
- PDFs, Word, ZIP, QR o TSV generados;
- caches remotas regenerables;
- roster PII duplicado;
- links individuales sensibles sin política explícita.

Los artefactos se registran con `file_id`, nombre, tipo, checksum, tamaño,
deployment y manifiesto. Se descargan o guardan junto al proyecto mediante el
contrato de archivos; no viajan dentro del `.pulso`.

Políticas de access URL:

- `public`: link común sin PII;
- `operational`: link parametrizado con key opaca;
- `sensitive`: recipient link o URL con PII/capacidad bearer;
- `secret`: no permitido como artefacto ni estado de Recopiladores.

## 9. Arquitectura de UI

Jerarquía canónica:

```text
Módulo Recopiladores
├── Plan
│   ├── Fuente
│   └── Unidades
├── Accesos
│   ├── Canales
│   └── Vinculación
├── Materiales
│   ├── Diseño
│   ├── Vista previa
│   └── Paquetes
└── Entrega
    ├── Validación
    └── Monitoreo
```

Las cuatro secciones se registran en `modules.ts` y son enlazables por
`?seccion=&pestana=`. Los adapters cambian campos y materiales dentro del mismo
recorrido; no crean jerarquías paralelas.

Readiness común:

1. plan con fuente e instrumento fijados;
2. identidad única de unidades;
3. target inspeccionado y preflight de capabilities conocido;
4. URL de captura real validada: una landing administrativa Kobo no cuenta;
5. variable/path de trazabilidad existente, permitida y sin PII;
6. cobertura de accesos completa o excepciones justificadas;
7. artefactos generables;
8. deployment no stale;
9. handoff idempotente disponible;
10. `remote_write` deshabilitado en V1.

### 9.1 Editor profesional de materiales

La sección Materiales usa un workbench especializado:

```text
Command bar: preset · unidad de preview · undo/redo · zoom · guardar · generar
Outline: páginas y bloques
Canvas: página y safe area
Inspector: contenido · binding · presentación · visibilidad
```

Dirección ejemplo:
`/recopiladores?seccion=materiales&pestana=diseno&foco=block:<id>&panel=inspector`.
En viewports compactos, el inspector pasa a panel direccionable sin crear otro
nivel de navegación.

V1 permite duplicar presets curados, añadir/ocultar/reordenar bloques, editar
copy, elegir bindings permitidos, cambiar A4/carta/orientación/márgenes dentro
de presets, previsualizar una unidad y agrupar paquetes. Incluye undo/redo de
comandos semánticos, alternativa de teclado al drag, warnings de overflow,
safe area y estado `dirty | saving | saved | conflict`.

La preview DOM es feedback rápido. La preview autoritativa renderiza una página
con el mismo compilador y dispositivo del PDF final y la rasteriza a imagen;
se cachea por `layout_fingerprint`. `html-to-image` o `window.print()` no son el
motor final.

La preview autoritativa **no rasteriza el PDF**. El kit compartido
(`pulso_pdf_theme.R`) dibuja con `grid` sobre `grDevices::pdf()`; la preview
ejecuta el mismo código de dibujo cambiando únicamente el device a
`grDevices::png()` con las mismas dimensiones de página. Así "el mismo
compilador" es literal y no una aproximación, y no se introduce ninguna
dependencia de sistema.

Queda descartado `magick` como camino de la preview. Hoy se usa de forma
opcional en `router_graficos.R` bajo `requireNamespace()`, pero exige ImageMagick
instalado en el sistema y el R embebido de Electron no puede garantizarlo. Un
fallback silencioso a "sin preview" reintroduciría el problema que este módulo
existe para eliminar.

Fuera de V1: canvas libre tipo Canva, coordenadas arbitrarias, solapamiento,
rotación, fuentes/colores sin gobierno, HTML/SVG/scripts, importar o modificar
PDF existentes, OCR, firmas, anotaciones, formularios AcroForm, colaboración y
documentos genéricos.

### 9.2 Motor de QR y verificación de legibilidad

El QR se genera en el backend R. Hoy lo produce el paquete npm `qrcode` en el
frontend y el resultado se persiste como data-URL en el campo `qr` del plan de
aulas; eso impide que el job de render sea reproducible desde el `.pulso` y
contradice la regla de §8 de no persistir QR.

Dependencia elegida: el paquete CRAN **`qrcode`** (0.3.0). Es R puro —importa
solo `assertthat`, `stats` y `utils`—, no exige binarios ni librerías de sistema
y por tanto es seguro para el R embebido de Electron. La única dependencia
transitiva nueva del paquete es `assertthat`.

Consecuencias:

- el bloque `access_qr` resuelve `access.qr_payload` y dibuja la matriz dentro
  del mismo device `grid` que el resto de la página, no como imagen importada;
- el campo `qr` del plan legacy deja de escribirse y se migra: el estado guarda
  el `access_ref`, no el píxel;
- el frontend conserva `qrcode` npm solo para la preview DOM rápida, que no es
  autoritativa.

Verificación de legibilidad, en tres niveles:

1. **Geométrica**, en el compilador: quiet zone, contraste y tamaño mínimo en mm
   se validan antes de dibujar; violarlos es un error de layout, no un warning.
2. **Automática**, en el gate: el job emite el PNG de la página por el camino de
   §9.1 y un script Node decodifica el QR con `jsqr` —dependencia de desarrollo
   JS pura, en la raíz donde ya vive Playwright— y compara el payload decodificado
   contra el `access_ref` esperado de esa página.
3. **Física**, fuera del gate automático: el escaneo con dispositivo real no puede
   correr en CI y se registra como paso manual del checklist de release, no como
   criterio de aceptación automatizable.

## 10. Adapters iniciales

| Adapter | Alcance V1 | Mutación remota |
|---|---|---|
| `aulas_v1` | Preserva curso-horario, titulares/reservas, Kobo/manual, QR y ficha | No |
| `manual_links_v1` | Importa TSV/CSV, diagnostica matching y genera materiales offline | No |
| `kobo_existing_v1` | URL pegada o discovery read-only; valida web form/deployment/campo y genera `d[]`/QR localmente | Deshabilitada; import/deploy en fase posterior |
| `surveymonkey_weblink_existing_v1` | URL pegada o discovery read-only; valida Web Link/Custom Variables y genera variantes/QR localmente | Deshabilitada; no crea collector |
| `surveymonkey_recipient_existing_v1` | Lee por API o importa/vincula manualmente recipients y links nativos ya aprovisionados; trata URLs como sensibles y nunca las fabrica | Deshabilitada; no crea recipients ni envía |

Perfiles posteriores: acreditación multiactor, establecimientos/servicios,
lotes telefónicos cerrados y complemento territorial sin duplicar mapas.

## 11. Plan por fases

### 11.0 Secuencia de ejecución y unidades commiteables

La regla de parada de §14 define **cuándo V1 está terminado**, no cuánto trabajo
puede acumular el working tree. Las siete fases se ejecutan como una cadena de
unidades commiteables independientes, cada una con su propio gate parcial. El
orden lo fija la dependencia dura, no la numeración de fases.

| # | Unidad | Depende de | Gate parcial |
|---|---|---|---|
| 1 | Bloqueo de landing Kobo como URL de captura, en front y backend | — | Test de que una landing o URL con fragmento administrativo bloquea la generación |
| 2 | Extracción de `aulas_v1` desde `RecopiladoresPage.tsx`: normalización, matching, plantillas, manifiesto y QR | 1 | Paridad visual antes/después + unit tests del adapter y del parser manual |
| 3 | Separación de componentes, store y direcciones URL; cuatro secciones en `modules.ts` | 2 | Direcciones enlazables `?seccion=&pestana=`; QA visual |
| 4 | Schemas `collection_plan/v1` y `collection_deployment/v1` + fixtures + validadores | — | Fixtures válidos para aulas, acreditación y establecimientos |
| 5 | `router_recopiladores.R` y engine propio; seed desde `monitoreo_aulas_plan` | 3, 4 | Proyecto legacy abre, genera, guarda y reabre con el mismo manifiesto |
| 6 | Fingerprints, estado `stale` y round-trip `.pulso` | 5 | Cambiar selección, instrumento o versión remota invalida el deployment |
| 7 | Handoff idempotente a Monitoreo | 6 | Repetir handoff es no-op; Monitoreo no regenera accesos |
| 8 | Saneamiento de `kobo_api.R` y `surveymonkey_api.R` | — | Fixtures HTTP sin red; **gate ampliado a Carga y Monitoreo** |
| 9 | Adapters read-only detrás de capabilities + `collection_capability_preflight/v1` | 5, 8 | Ninguna capability se infiere falsamente |
| 10 | Spike de render: una ficha dibujada con el kit grid, sin schema congelado | 2 | Página PNG y PDF equivalentes; QR decodificable |
| 11 | Congelamiento de `collection_material_template/v1`, instancia, layout y recibo | 10 | Schemas revisados contra lo que el spike demostró renderizable |
| 12 | Compilador de layout: wrapping, cajas, paginación, overflow y mapa `page → unit_id/access_id` | 11 | Fixtures de texto extremo, URL máxima y acceso ausente |
| 13 | Job de render: PDF/ZIP/TSV con `file_id`, SHA-256, page count y manifest único | 12 | Artefactos verificados estructural y visualmente; nada entra al `.pulso` |
| 14 | Editor semántico de materiales: outline, canvas, inspector, undo/redo y preview | 13 | QA del editor en 1710×1107, 1024×600 y Windows 125/150%, incluido teclado |

Las unidades 1, 4, 8 y 10 no dependen de ninguna otra y pueden adelantarse. La
unidad 10 se ejecuta **antes** de congelar los schemas de material: un spike de
render que descubre que un bloque no es dibujable es barato; un schema congelado
que no lo es, no.

### Fase 0 — Gobernanza y fixtures

- aceptar o ajustar ADR 0046;
- congelar vocabulario, schemas y clasificación de sensibilidad;
- documentar la revisión parcial necesaria de ADR 0019;
- crear fixtures `collection_plan/v1` y `collection_deployment/v1` para aulas,
  acreditación y establecimientos;
- definir JSON Schema o validadores equivalentes.

Gate: contratos revisados, fixtures válidos y ownership sin duplicidad.

### Fase 1 — Extraer `aulas_v1` sin cambiar comportamiento

- extraer normalización, matching, plantillas, manifiesto y generación QR de
  `RecopiladoresPage.tsx`;
- separar componentes UI, store y direcciones URL;
- mantener outputs visualmente equivalentes, pero bloquear el fallback de
  landing Kobo como URL de captura;
- crear tests unitarios del adapter y del parser manual.

Gate: paridad funcional/visual salvo el bloqueo de seguridad de URL inválida;
ninguna mutación o schema nuevo todavía.

### Fase 2 — Estado y API propios

- crear engine/router `/api/recopiladores/*`;
- persistir plan y deployment versionados;
- sembrar `aulas_v1` desde `monitoreo_aulas_plan` cuando no exista estado nuevo;
- conservar keys/endpoints legacy;
- aplicar fingerprints y estado `stale`;
- añadir round-trip `.pulso` y handoff idempotente.

Gate: proyecto legacy abre, genera, guarda y reabre con el mismo manifiesto;
Monitoreo continúa operativo.

### Fase 3 — Providers read-only

- mover discovery Kobo/SurveyMonkey detrás de adapters;
- permitir URL pegada sin exigir conexión para Kobo y Web Link SurveyMonkey;
- separar Web Link SurveyMonkey de email/SMS recipients;
- reparar paginación/parsing/clasificación SurveyMonkey;
- alinear fixtures Kobo v2 para assets/data/deployment/import;
- inspeccionar URL real, versión, campo y auth policy Kobo;
- modelar resultados `observed | estimated | unknown`;
- mantener manual-links completamente offline.

Gate: fixtures HTTP sin red; ninguna capability se infiere falsamente.

### Fase 4 — Motor de artefactos y handoff

- congelar schemas de template, instancia, layout y recibo;
- crear presets built-in, empezando por `ficha_aplicacion_a4_v1` con paridad
  respecto de la ficha actual;
- construir editor semántico, preview rápida y preview autoritativa;
- compilar layout antes de dibujar: wrapping, cajas, páginas, overflow y mapa
  `page → unit_id/access_id`;
- producir PDF/ZIP/TSV reales mediante jobs;
- registrar `file_id`, MIME, SHA-256, tamaño, audiencia, sensibilidad y un solo
  manifest;
- mantener outputs fuera del `.pulso`;
- enviar deployment a Monitoreo con `deployment_id` y fingerprint;
- Monitoreo consume accesos en lectura y gobierna ejecución.

Gate: artefactos estructural y visualmente verificados, sin secretos; repetir
handoff es no-op; el mismo conjunto de fingerprints reproduce el mismo
manifiesto y un output equivalente.

### Fase 5 — Kobo apply explícito

- separar preview/import/poll/deploy/inspect;
- confirmar servidor, asset, versión y efecto;
- registrar evidencia no secreta del resultado;
- no cambiar permisos/publicidad automáticamente;
- ejecutar import/deploy como job cancelable o recuperable.

Gate: mocks de éxito, timeout, 429, partial failure e idempotencia; acción real
solo en pruebas manuales autorizadas.

### Fase 6 — SurveyMonkey provisioning opcional

- empezar por Web Link collector;
- preflight de scopes/plan y nombre idempotente;
- crear como borrador y vincular el ID remoto;
- dejar email/SMS, contacts, recipients y send en una subfase separada;
- exigir política PII/consentimiento/anti-spam antes de cualquier envío.

Gate: guardar nunca envía; preview y confirmación están separados; toda
mutación tiene recibo y recuperación.

### Fase 7 — Perfiles adicionales

Agregar un perfil por iteración, reutilizando schemas y cambiando solo adapter
de unidad/material. Orden sugerido:

1. acreditación multiactor;
2. establecimientos y servicios;
3. lotes telefónicos cerrados;
4. complemento territorial estrecho.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Falso modelo común SM/Kobo | Capabilities y `provider_collector_id` opcional |
| Doble autoridad con Monitoreo | Handoff inmutable; ejecución sigue en Monitoreo |
| Drift de instrumento/selección | Fingerprints y estado `stale` |
| Links con PII o bearer | Clasificación, redacción y export fuera de `.pulso` |
| Scope creep hacia Acrobat/Canva | Registro cerrado de bloques, bindings y presets |
| Drift entre canvas y PDF | Schema único + preview autoritativa del renderer final |
| QR ilegible tras imprimir | Quiet zone, contraste, tamaño en mm y decodificación desde página rasterizada |
| Texto largo/overflow | Compilación previa de layout, warnings y fixtures extremos |
| Material desactualizado | Fingerprints y estado `stale` para template/deployment/access |
| “Guardar” causa side effect | `preview`/`commit` separados y confirmación |
| Reintentos crean duplicados remotos | Idempotency key local + búsqueda por binding/receipt |
| Target compartido sin permisos | Probe de capabilities y fallos explicables |
| URL Kobo landing usada como formulario | Validación contractual del target antes de QR |
| Redeploy Kobo rompe campo | Versión fijada, warning y verificación de update/offline |
| SurveyMonkey rate/contact limits | Backoff, paginación completa, límites observados |
| Pérdida de compatibilidad `.pulso` | Migración aditiva; adapter legacy; no borrar keys v1 |
| Preview atada a una librería de sistema ausente en Electron | Mismo código `grid` con device PNG; `magick` descartado |
| Reparar los clientes SM/Kobo rompe Carga o Monitoreo | Son clientes compartidos: el gate de esa unidad incluye los tests de ambos módulos |
| Congelar el schema de material antes de saber qué es dibujable | Spike de render previo al congelamiento (unidad 10 de §11.0) |
| Data-URL de QR persistidos en el plan legacy | Migración explícita: el estado guarda `access_ref`, no el píxel |

## 13. Validación mínima de implementación

- `pnpm --dir frontend typecheck`;
- Vitest de adapters, normalización, parsing, fingerprints, stale y direcciones;
- testthat de schemas, migración legacy, round-trip `.pulso` e idempotencia;
- fixtures HTTP sin red para Kobo y SurveyMonkey;
- tests de paginación, 401/403/404/429/5xx y respuesta parcial;
- verificación PDF/ZIP/TSV estructural y visual;
- fixtures de template corto, texto extremo, URL máxima, acceso ausente/stale y
  sensibilidad alta;
- preview/final comparados desde páginas renderizadas por el mismo motor: mismo
  código `grid`, device PNG contra device PDF;
- PDF verificado en primera, intermedia y última página, con texto, bounding
  boxes, conteo de páginas y ausencia de overflow;
- QR decodificado con `jsqr` desde el PNG de página emitido por el propio job, y
  comparado contra el `access_ref` esperado; la prueba física de escaneo queda en
  el checklist manual de release, fuera del gate automático;
- tests de Carga y Monitoreo incluidos en el gate de la unidad que toca
  `kobo_api.R` o `surveymonkey_api.R`;
- QA del editor en 1710×1107, 1024×600 y Windows 125/150%, incluido teclado;
- búsqueda de tokens/PII en `.pulso`, manifests, logs y outputs;
- QA visual antes/después de `aulas_v1`;
- prueba de que cambiar selección, instrumento o versión remota invalida el
  deployment;
- prueba de que guardar o navegar nunca ejecuta efectos externos.
- prueba de que una landing Kobo o una URL con fragmento administrativo bloquea
  la generación;
- prueba de que Web Link SurveyMonkey con URL/variables válidas genera local sin
  API por unidad;
- prueba de que email/SMS nunca habilita generación local de recipient links.

## 14. Regla de parada

La primera unidad de trabajo termina cuando:

1. aulas conserva paridad funcional;
2. plan/deployment sobreviven round-trip `.pulso`;
3. Kobo y SurveyMonkey se inspeccionan sin mutar;
4. el manifiesto identifica unidad, instrumento, target y acceso sin ambigüedad;
5. Monitoreo recibe un handoff idempotente;
6. no entran secretos ni outputs al `.pulso`;
7. ningún flujo de UI puede enviar, desplegar o cambiar permisos al guardar;
8. la ficha actual se reproduce mediante una plantilla built-in;
9. el PDF final retorna `file_id`, SHA-256, page count y manifest único;
10. no existe una ruta desde Materiales hacia edición genérica de PDFs.

Crear collectors remotos, desplegar Kobo y enviar campañas son unidades de
trabajo posteriores; no forman parte de la definición de terminado de V1.

## 15. Fuentes oficiales consultadas

### SurveyMonkey

- [API v3](https://api.surveymonkey.com/v3/docs)
- [Ways to send a survey](https://help.surveymonkey.com/en/surveymonkey/getting-started/sending-your-survey/)
- [Web Link Collector](https://help.surveymonkey.com/en/surveymonkey/send/web-link-collector/)
- [Custom Variables](https://help.surveymonkey.com/en/surveymonkey/send/custom-variables/)
- [Email Invitation Collector](https://help.surveymonkey.com/en/surveymonkey/send/email-invitation-collector/)
- [Required Data in Email Invitations](https://help.surveymonkey.com/en/surveymonkey/send/required-data-email-invitations/)
- [Email invitation and contact limits](https://help.surveymonkey.com/en/surveymonkey/send/email-send-limits/)
- [Text Message Collector](https://help.surveymonkey.com/en/surveymonkey/send/text-message/)

### KoboToolbox

- [Getting started with the API](https://support.kobotoolbox.org/api.html)
- [KoboToolbox Primary API v2](https://kf.kobotoolbox.org/api/v2/docs/)
- [OpenAPI schema v2](https://kf.kobotoolbox.org/api/v2/schema/?format=json)
- [Migrating from v1 to v2](https://support.kobotoolbox.org/migrating_api.html)
- [Managing projects](https://support.kobotoolbox.org/managing_projects.html)
- [Deploying forms](https://support.kobotoolbox.org/deploy_form_new_project.html)
- [Collecting data using web forms](https://support.kobotoolbox.org/data_through_webforms.html)
- [Project-level sharing](https://support.kobotoolbox.org/project_sharing_settings.html)
- [User-level permissions](https://support.kobotoolbox.org/managing_permissions.html)
- [KoboCollect](https://support.kobotoolbox.org/data_collection_kobocollect.html)
- [REST Services](https://support.kobotoolbox.org/rest_services.html)

## 16. Limitaciones de esta investigación

- no se ejecutaron llamadas autenticadas;
- no se comprobaron scopes o entitlements de cuentas reales;
- servidores Kobo Global, EU o privados pueden exponer diferencias que deben
  descubrirse desde su schema/capabilities en runtime;
- las cifras de planes y límites pueden cambiar y no deben convertirse en
  constantes de producto;
- cualquier implementación deberá usar mocks en CI y reservar pruebas reales
  para una ejecución manual expresamente autorizada.
