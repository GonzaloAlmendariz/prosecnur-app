# ADR 0025: Monitoreo territorial permite anular produccion localmente

- Estado: Aceptado
- Fecha: 2026-06-26

## Contexto

En monitoreo territorial puede ocurrir que la supervision determine que toda la produccion de un Responsable Pulso no debe contar en avance. Borrar respuestas Kobo no es aceptable: rompe trazabilidad, depende de un servicio externo y elimina evidencia de auditoria. Tampoco basta con ocultar visualmente los casos, porque avance, cuotas, mapas, consultas, subsanaciones, Sheets y PDFs deben leer el mismo universo operativo.

## Decision

Monitoreo territorial guarda una capa local y reversible en `.pulso`: `territorial.production_annulments`, separada por fase (`pilot`, `field`). Cada registro identifica el Responsable Pulso, estado `active` o `reverted`, motivo, nota, fecha, impacto y auditoria de reversion.

La anulacion se aplica despues de reconciliar Responsable Pulso y UMP, y antes de calcular derivados operativos. Por tanto, las respuestas anuladas no alimentan avance, cuotas, mapas, consultas internas, subsanaciones, Sheets internos ni PDFs normales. Los datos anulados solo quedan visibles en la lista de encuestadores y en la pestaña/hoja de auditoria `Anulaciones`.

Los endpoints locales son:

- `POST /api/monitoreo/territorial/annulments/preview`
- `POST /api/monitoreo/territorial/annulments/apply`
- `POST /api/monitoreo/territorial/annulments/revert`

El payload base es `{ phase, responsible_key, responsible_label, reason, note }`. La aplicacion requiere motivo obligatorio. La reversion preserva el historial.

## Consecuencias

- Kobo y la data cruda no se modifican.
- La cache de dashboard y puntos GPS debe invalidarse al aplicar o revertir.
- La base tecnica y los reportes normales no deben reintroducir respuestas anuladas.
- Cualquier nueva vista territorial que use produccion operativa debe partir del `response_audit` filtrado o de derivados posteriores al filtro.
- La hoja interna `Anulaciones` es la unica salida normal donde se reportan respuestas tachadas.

## Cumplimiento

- Pruebas R verifican que una anulacion activa excluye produccion y que una reversion restaura los conteos.
- Revisiones de arquitectura deben comprobar que no se persisten secretos, que la capa es compacta/regenerable y que no se altera el contrato de sincronizacion Kobo.
