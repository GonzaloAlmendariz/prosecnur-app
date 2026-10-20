# ADR 0111: Material de campo se organiza por campañas tipadas

Estado: Aceptado

Implementacion: Pendiente (contrato congelado; la oleada entra cuando cierre el frontend de E1j–E1l)

Fecha: 2026-10-20

Fecha de decision: 2026-10-20 (Gonzalo: «debemos hacer tal que las campañas no se confundan, un proyecto puede tener
una campaña en campo, una campaña territorial con umps, una campaña por correos, y cada una tiene sus elementos
específicos, debe haber ese control inicial primero»)

Reemplaza: —

Enmienda: [ADR 0108](0108-material-de-campo-catalogo-de-materiales-por-unidad.md) §5.1 y §5.3 (el modo lo declaraba el
estudio y un proyecto tenía un solo modo) y §2 «Persistencia» (`collection_state/v2` indexado por `unit_type`);
[ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md) §1 «Modo», solo para Material de campo.

Extiende: [ADR 0110](0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md) (las campañas de correo
por actor de E1h pasan a ser campañas del proyecto).

## Contexto

Un mismo proyecto puede tener, a la vez, un campo presencial en aulas con fichas QR, un campo territorial sobre UMP de
Hojas de ruta y varias campañas por correo para distintos actores (egresados, empleadores, docentes). Hoy el módulo
supone un solo operativo: el plan de aulas es el estado del módulo y los correos cuelgan de Catálogo › Correos con su
propio selector. Con dos o tres operativos en el mismo proyecto, sus elementos se mezclan en las mismas secciones.

## Decisión

1. **La campaña es la entidad de primer nivel del módulo.** Tiene un tipo cerrado (`aulas`, `territorial` o `correo`),
   un nombre y sus propios elementos. Las campañas de correo por actor de E1h son, cada una, una campaña de tipo
   `correo` (decisión 2026-10-20).
2. **Control inicial primero.** `/material-campo` aterriza en la lista de campañas: tarjetas con tipo, nombre, estado y
   avance, y «Nueva campaña», donde se elige el tipo. Al abrir una campaña solo se ven sus secciones. Un proyecto sin
   campañas ve la lista vacía con «Nueva campaña» dentro de su superficie (C3).
3. **El modo es el tipo de la campaña abierta**, lo dice el registro y no un clic. Juegos de secciones:

   | Modo | Secciones · pestañas |
   |---|---|
   | `aulas` | unidades (lista, origen) · accesos (canales, vinculación) · catálogo (tipos, editor) · paquetes (armado) · entrega (traspaso). Sin `catalogo/correos` |
   | `correo` | una sección: el correo (editor), con identidad, destinatarios, plataforma, envíos, revisión e importar como paneles (decisión 2026-10-20) |
   | `territorial` | no se declara hasta E2 (`ump_territorial_v1`): en «Nueva campaña» aparece deshabilitado con su motivo |

4. **Dirección.** `campana` es un parámetro de alcance, como `pulso`, no una sexta dimensión:
   `/material-campo?modo=correo&campana=correo.<id>&seccion=correo&pestana=editor&foco=<bloque>`. Se tipa en
   `DireccionProsecnur`, entra en `mismaDireccion` y lo conserva `__pulsoNav.ir`. Si `campana` y `modo` discrepan, manda
   la campaña. Ids: `^(aulas|territorial|correo)\.[a-z0-9][a-z0-9-]{0,39}$`.
5. **Registro `material_campaigns/v1`** en `s$material_campaigns` (persistible en `state.rds`, registrado en
   `session_schema.R`). Guarda solo lo que no tiene otro dueño (id, tipo, nombre, creado, `archived`, `ref`); las
   campañas de correo se **proyectan** de `collection_state$mail_campaigns`, que sigue siendo su única fuente. La
   migración se resuelve al leer y no marca dirty: un plan de aulas existente se proyecta como `aulas.principal`, cada
   correo existente como `correo.<campaign_id>`. Un `.pulso` viejo abre igual; `collection_deployment/v1`, el
   traspaso y `monitoreo_aulas_plan` no cambian.
6. **Una sola campaña de aulas por proyecto** mientras `collection_state` sea único (plan, deployment y traspaso son
   singulares). Varias exigen `collection_state/v2` indexado por campaña: esto reemplaza el índice por `unit_type` del
   ADR 0108 §2.
7. **La campaña de aulas no se borra, se archiva** (decisión 2026-10-20): sale de la lista sin perder plan, fichas ni
   traspaso, y se puede reabrir. Las de correo se borran como hoy, con su nombre como confirmación.
8. **Cada exportación de un envío deja registro** (decisión 2026-10-20): `last_export_at` y plataforma por envío en
   `mail_campaigns`, para que la tarjeta diga «Invitación exportada 02/09 · Recordatorio 1 pendiente». No guarda
   destinatarios ni direcciones.
9. **El inicio del proyecto resume por campaña** (decisión 2026-10-20): la tarjeta de Material de campo lista sus
   campañas con su avance; `normalizeProjectOverview` tolera que el campo no venga.

## Contrato

- `GET /api/recopiladores/campaigns` → `{ok, schema, registry_revision, state_revision, campaigns[], tipos[]}`; cada
  campaña con `id, tipo, name, actor?, created_at, archived, persisted, ref, estado`; `tipos[]` con `disponible` y
  `motivo`.
- `POST /api/recopiladores/campaigns` `{tipo, name, actor?, platform?, preset_id?, import_id?, expected_*}`: `correo`
  delega en `collection_mail_campaign_create`; `aulas` responde 409 si ya hay una; `territorial` 409 no disponible.
- `PUT /api/recopiladores/campaigns/meta` `{id, name?, actor?, platform?, archived?, expected_*}`.
- Errores: `E_COLLECTION_CAMPAIGN_NOT_FOUND` 404, `E_COLLECTION_CAMPAIGN_TIPO` 422,
  `E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE` 409, `E_COLLECTION_CAMPAIGN_AULAS_UNICA` 409,
  `E_COLLECTION_CAMPAIGN_STALE` 409.
- Los endpoints `/api/recopiladores/mail-*` quedan tal cual.

## Redirecciones

| Entrada | Aterriza en |
|---|---|
| `/material-campo` | la lista de campañas |
| `?seccion=unidades…entrega` sin campaña | la campaña de aulas si existe; si no, la lista |
| `?seccion=catalogo&pestana=correos&foco=<cid>[~<bloque>]` | `?modo=correo&campana=correo.<cid>&seccion=correo&pestana=editor&foco=<bloque>`; si no existe, la lista |
| `?seccion=catalogo&pestana=correos` sin foco | la única campaña de correo; con 0 o varias, la lista |
| `?modo=aulas|correo` sin campaña | la única de ese tipo; si no, la lista |
| `?panel=correo-campanas` | la lista con «Nueva campaña» abierto |

Los enlaces que entran desde Cálculo de muestra, Monitoreo y Diseño de estudio emiten `?modo=aulas`.

## Consecuencias

- **Defecto que esto destapa, corregido antes de la oleada:** crear un correo antes del sorteo dejaba `collection_state`
  sin plan y el plan de aulas ya no se podía sembrar (las guardas leían «existe el estado» como «hay plan»). Prueba:
  `test-collection-seed-tras-correo.R`.
- Un solo `state_revision` para aulas y correo: guardar un correo deja obsoleta una vista de aulas abierta en otra
  ventana. Se acepta mientras se vea una campaña a la vez; separarlas es parte de `collection_state/v2`.
- Del editor de correos quedan tal cual los paneles, la plataforma, los envíos y la importación; se retira
  `SelectorDeCampana` (duplicaría la lista) y crear, duplicar, renombrar y borrar pasan a la lista y a la cabecera de
  la campaña.
- Pruebas a actualizar: `modulesNavigation`, `auditReadyRoutes`, `vaults-check`, `navegacion.test.ts`, contratos de
  dirección (`direccion`, `runtime`, `manifiesto`, `aliasLegacyNoSeEscribe`, `direccionesRenombradasNoSeEscriben`,
  `destinoDeLosAtajos`, `lectoresDeDireccion`) y el catálogo visual.

## Alternativas descartadas

- Un selector de campaña en la barra que entra directo a la última abierta: esconde que hay varias y reproduce la
  confusión.
- Correo como módulo aparte: separa lo que el equipo vive como un mismo campo.
- Cuatro secciones para el correo (audiencia, correo, envíos, revisión): «Audiencia» no aplica igual en SurveyMonkey y
  una sección no puede aparecer según la plataforma.
