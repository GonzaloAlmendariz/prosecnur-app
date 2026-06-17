# ADR 0013: Importacion offline SurveyMonkey en multibase

## Estado

Aceptado.

## Fecha

2026-06-16.

## Contexto

Algunos proyectos de acreditacion reciben respuestas desde archivos exportados
por SurveyMonkey, no desde la API. El caso inicial es un Excel multihoja; el
caso posterior es un ZIP con archivos `.sav`, uno por carrera. En proyectos con
bases hermanas independientes, cada hoja o archivo representa una base/carrera
ya modelada en el `.pulso` con su XLSForm propio. El sistema necesita reemplazar
la data efectiva de esas bases sin crear instrumentos nuevos y sin pedir tokens.

## Decision

Se agrega una ruta offline bajo SurveyMonkey multibase:

- `POST /api/surveymonkey/multibase/workbook/inspect`;
- `POST /api/surveymonkey/multibase/workbook/import`.
- `POST /api/surveymonkey/multibase/sav-bundle/inspect`;
- `POST /api/surveymonkey/multibase/sav-bundle/import`.

La inspeccion recibe un `file_id`, lee las hojas del Excel y empareja cada hoja
con una base existente usando nombres normalizados. La importacion traduce
encabezados humanos de SurveyMonkey a columnas Kobo-like segun el XLSForm de la
base: metadata, preguntas simples, `select_multiple`, matrices y repetidos tipo
`Funcion N`.

La inspeccion del ZIP SAV lee las entradas `.sav` como streams seguros para no
depender de la codificacion interna del ZIP. Cada archivo se empareja con una
base existente por nombre de carrera normalizado o por mapeo explicito. La
operacion solo permite `replace_data`: no crea bases, no crea XLSForms, no
modifica XLSForms y no aplica cambios durante la inspeccion.

El endpoint de importacion del ZIP vuelve a ejecutar la inspeccion como
preflight y solo aplica si no hay bloqueos. Por cada base produce un
`change_plan` auditable con estado actual, estado entrante, deltas,
disponibilidad de variables, metadata detectada y efectos esperados:
XLSForm preservado, data reemplazada e invalidacion de validacion, analitica,
codificacion y graficos.

Las variables esperadas que no aparezcan en el workbook se crean como columnas
vacias y se registran como advertencia. Esta politica permite importar exports
sin datos personales como `p3`, `p4` o `p5` sin bloquear el flujo.

El `.pulso` conserva:

- el workbook original como input subido;
- el ZIP SAV original como input subido;
- la data normalizada generada por base;
- un snapshot JSON `surveymonkey_workbook_snapshot/1` con mapa de columnas,
  advertencias y conteos.
- un snapshot JSON `surveymonkey_sav_bundle_snapshot/1` con auditoria,
  advertencias, conteos y plan de actualizacion.

No se guardan secretos ni tokens en estos snapshots.

## Consecuencias

- La importacion offline es una actualizacion de proyecto existente, no un modo
  de crear proyectos desde cero.
- Las hojas sin match quedan bloqueadas hasta que el usuario corrija nombres o
  provea mapeo explicito.
- El importador reemplaza data efectiva e invalida resultados derivados de
  validacion, limpieza, codificacion, analitica y graficos para la base tocada.
- Los snapshots raw de la API SurveyMonkey siguen separados de los snapshots
  offline del workbook y del ZIP SAV.

## Cumplimiento

- Tests R cubren traduccion de headers humanos, lectura/importacion ZIP SAV,
  emparejamiento de 9 carreras y round-trip `.pulso`.
- Tests frontend cubren cliente API y estado visual de inspeccion para Excel y
  ZIP SAV.
- La UI expone inspeccion, advertencias y aplicacion desde `BasesPanel` en la
  familia de bases hermanas independientes.
