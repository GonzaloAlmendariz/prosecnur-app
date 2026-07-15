# ADR 0036: Filtro manual de universo materializado en Carga

Estado: Aceptado

Fecha: 2026-07-14

## Contexto

Una base de campo puede conservar entrevistas de prueba junto con entrevistas
reales. Validación llegó a interpretar una configuración operativa tardía para
filtrarlas, pero eso hacía que Carga, Codificación y Analítica pudieran trabajar
con universos distintos. Además, `response_filter` ya describe el alcance que
entrega un conector (estados, colectores, fechas y consentimiento), por lo que
reutilizarlo para una decisión manual confundiría procedencia con curaduría.

El requisito es conservar siempre la fuente intacta, permitir que el usuario
elija explícitamente la variable y los valores reales/de prueba, y hacer que
todos los módulos posteriores consuman el mismo universo efectivo.

## Decisión

El filtro manual de entrevistas reales se define y aplica en **Carga**, por
base madre, antes de Validación, Codificación y Analítica.

- Su fuente de verdad es `base$universe_filter`, separada de
  `base$response_filter`.
- La configuración v1 contiene `enabled`, `variable`, `real_values`,
  `test_values`, `missing_policy = "exclude"` y
  `unassigned_policy = "unclassified"`.
- `base$universe_filter$source_data_file_id` apunta a la fuente intacta y
  `effective_data_file_id` al artefacto materializado. Mientras está activo,
  `base$data_file_id` apunta al efectivo. `original_data_file_id` conserva su
  semántica previa y no se reutiliza.
- Valores faltantes, desconocidos o no asignados se excluyen. Aplicar exige al
  menos un valor real, conjuntos real/prueba disjuntos y un universo resultante
  no vacío. La vista previa puede usar `real_values = []` para descubrir los
  valores observados sin aplicar nada.
- Las bases `repeat` no se configuran por separado: heredan el universo por su
  llave relacional y son de solo lectura. Si la relación no puede demostrarse,
  la operación falla cerrada y no muta los punteros activos.
- Una recarga o sincronización reemplaza las fuentes y reaplica la configuración
  guardada. Desactivar restaura los punteros a las fuentes.
- Validación conserva como controles operativos únicamente periodo de campo y
  duplicados. Una configuración legacy de `universe_filter` allí se puede leer,
  pero nunca vuelve a filtrar filas.

## Consecuencias

- Todos los módulos posteriores ven el mismo universo y los artefactos
  `.pulso` guardan tanto fuente como efectivo para reproducibilidad.
- El proyecto ocupa un archivo efectivo adicional por base y revisión.
- Un refresh con repeats requiere regenerar primero sus fuentes y solo después
  reaplicar el filtro de la madre.
- Las entrevistas excluidas no se borran: siguen disponibles en la fuente y
  pueden recuperarse al desactivar o reclasificar el filtro.

## Cumplimiento

- API de Carga: `GET /api/carga/universe-filter`, `POST
  /api/carga/universe-filter/preview` y `PUT /api/carga/universe-filter`.
- Pruebas de resumen disjunto, selección vacía solo en preview, universo cero,
  restauración, herencia repeat, fail-closed, refresh y round-trip `.pulso`.
- Pruebas de guardia para que Codificación y Analítica prefieran el efectivo
  incluso cuando solicitan la fuente "original".
- `rg` no debe encontrar aplicación tardía de universo en el router de
  Validación ni en su estado de ejecución.

## Notas

Relacionado: [0002](0002-formato-pulso.md),
[0030](0030-grupos-repeat-end-to-end.md) y
[0033](0033-reconciliacion-variables-data-xlsform.md).
