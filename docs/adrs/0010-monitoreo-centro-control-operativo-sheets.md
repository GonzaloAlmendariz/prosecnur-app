# ADR 0010: Monitoreo como centro de control operativo con Google Sheets

Estado: Aceptado

Fecha: 2026-06-06

## Contexto

Monitoreo nacio como tablero de seguimiento digital para KoboToolbox y
SurveyMonkey. La operacion real de campo, especialmente en acreditaciones,
tambien vive en hojas de calculo compartidas: universos tratados, barridos
telefonicos, avances internos y reportes para cliente. Antes de Prosecnur,
dos Apps Script hermanos resolvian ese flujo con Google Sheets como superficie
operativa principal: uno multi-actor y otro segmentado por carrera.

La decision es arquitectonicamente significativa porque cambia el contrato del
modulo Monitoreo, agrega Google Sheets como integracion saliente fuerte,
afecta el formato persistido `.pulso`, introduce reglas de escritura
controlada y exige separar credenciales OAuth del proyecto portable.

## Decision

Monitoreo se define como un centro de control operativo local con tres capas:

- `core`: fuentes, snapshots, casos, cruces, metas, alertas, auditoria y
  exportaciones.
- `profiles`: `acreditacion`, `territorial`, `aulas_universitarias`,
  `telefonico` y `digital_general`.
- `surfaces`: Google Sheets, Excel local, SurveyMonkey, Kobo y hojas de ruta.

Cada proyecto `.pulso` de Monitoreo selecciona una sola ruta de perfil. La
seleccion ocurre al inicio en un hub de rutas y queda persistida en
`monitoreo_profile`; cambiar a otra familia despues no es una operacion normal
del flujo porque las fuentes, reglas, reportes y snapshots ya pertenecen a la
ruta elegida. Si se necesita otra ruta, se crea un proyecto nuevo o se reinicia
el monitoreo.

Google Sheets queda permitido como canal operativo externo. Prosecnur puede
leer pestanas vivas como snapshot local y puede publicar resultados solo en
pestanas propias de Prosecnur. No puede modificar la pestana viva de campo ni
usar Sheets como backend canonico.

Las autorizaciones que trascienden proyectos, incluyendo OAuth de Google
Sheets y tokens SurveyMonkey/Kobo, pertenecen a la Configuracion global de
Prosecnur. Monitoreo no solicita ni almacena credenciales: solo consume
conexiones ya autorizadas para registrar fuentes, sincronizar snapshots y
publicar salidas controladas.

El proyecto `.pulso` persiste configuracion, IDs de spreadsheets, nombres de
pestanas, rangos, mapeos, perfiles y ultimo snapshot reproducible. Nunca
persiste tokens OAuth, refresh tokens, secretos de SurveyMonkey/Kobo ni
credenciales de Google.

Los perfiles activos rectores son:

- `acreditacion`: monitoreo multi-actor o segmentado por carrera.
- `territorial`: monitoreo de campo con Kobo, Hojas de Ruta y mapas.
- `aulas_universitarias`: monitoreo de encuestas anonimas en aulas, importado
  desde seleccion de aulas de `calc-muestra`.

El perfil `acreditacion` tiene variantes:

- `multi_actor`: actores como administrativos, docentes, egresados y
  estudiantes.
- `segmentada_por_carrera`: actor principal con dimension de carrera,
  minimos por segmento y puente universo-barrido.

## Consecuencias

Beneficios:

- Monitoreo refleja mejor la operacion de campo sin obligar a supervisores o
  enumeradores a instalar Prosecnur.
- Los tableros de acreditacion dejan de depender de Apps Script copiado por
  proyecto y pasan a reglas versionadas, testeables y reproducibles.
- Sheets sigue siendo colaborativo para campo, mientras Prosecnur conserva el
  control metodologico local y auditable.

Costos y riesgos:

- La integracion OAuth agrega superficie de seguridad y estados de
  reautorizacion; por eso se centraliza en Configuracion global, no en cada
  modulo consumidor.
- La lectura de Sheets puede fallar por permisos, cambios de encabezado o
  pestañas renombradas.
- La escritura controlada exige verificar que Prosecnur solo toca pestanas
  propias.

## Cumplimiento

- `MonitoreoSourceKind` debe aceptar `google_sheets`.
- Toda fuente debe normalizar `role`, `integration_mode` y `sheet_binding`.
- Las rutas `/api/monitoreo/sheets/*` deben exponer estado, inspeccion,
  registro, sincronizacion y publicacion controlada.
- Las rutas `/api/connections/*` deben exponer estado y autorizacion global
  de APIs externas sin devolver secretos completos al frontend.
- Las pruebas deben cubrir normalizacion de fuentes Sheets, perfiles de
  acreditacion, reglas inspiradas en los Apps Script y ausencia de secretos en
  `.pulso`.
- Los checks de seguridad deben buscar que tokens OAuth no aparezcan en
  `.pulso`, logs, fixtures ni exportaciones.

## Notas

Relacionado con [ADR 0001](0001-app-local.md),
[ADR 0002](0002-formato-pulso.md),
[ADR 0005](0005-secretos-fuera-del-proyecto.md),
[ADR 0006](0006-modulos-por-dominio.md) y
[ADR 0007](0007-integraciones-salientes-dashboard-publicable.md).
