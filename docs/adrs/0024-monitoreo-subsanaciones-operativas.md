# ADR 0024: Subsanaciones operativas en Monitoreo territorial

Estado: Aceptado

Fecha: 2026-06-25

## Contexto

Monitoreo territorial necesita distinguir dos decisiones distintas: corregir
errores de cruce mediante reconciliacion y resolver brechas operativas cuando
existen excedentes defendibles en otra UMP del mismo distrito. En campo puede
ocurrir que una manzana quede corta en una celda de sexo y edad mientras otra
manzana del mismo distrito tenga superavit compatible.

Resolver esto dentro de los datos crudos de Kobo seria riesgoso: romperia
trazabilidad, haria dificil auditar el corte y mezclaria fuente con lectura
operativa. Tambien seria costoso cargar otra capa pesada en Monitoreo.

## Decision

Monitoreo territorial agrega una capa de subsanaciones operativas para avance.
La capa vive en Consultas y se guarda como estado compacto en `.pulso` bajo
`territorial.operational_adjustments`, separado por fase `pilot` y `field`.

Una subsanacion solo puede usar respuestas excedentes cuando coinciden:
distrito, sexo y rango de edad. La respuesta origen y la manzana destino quedan
registradas con identificador, fecha, nota, responsable visible y estado
`active` o `reverted`. La capa no modifica respuestas Kobo, no cambia la
reconciliacion, no sincroniza fuentes externas y no genera entregables por si
misma.

El backend calcula sugerencias desde `route_quota_progress` y `response_audit`;
el frontend solo muestra el contrato y permite aplicar o revertir decisiones.

## Consecuencias

El avance puede presentar una lectura operativa mas cercana a la realidad de
campo sin perder la fuente original. Las decisiones quedan auditables y pueden
revertirse.

El costo es una nueva superficie de control que debe explicarse con cuidado: no
es una correccion de Kobo ni una autorizacion metodologica general para mover
casos. Si no hay coincidencia exacta de distrito, sexo y edad, no se sugiere
subsanacion.

El estado persistido es pequeno y regenerable a partir de respuestas, cuotas y
las decisiones guardadas. No contiene secretos ni caches pesadas.

## Cumplimiento

- Las subsanaciones se guardan en `.pulso` como entradas compactas por fase.
- El endpoint de aplicacion debe rechazar respuestas ya usadas en otra
  subsanacion activa.
- El payload de Consultas debe exponer `ready/suggestions/applied` sin requerir
  mapas, Plotly ni nuevas sincronizaciones.
- Las pruebas deben cubrir coincidencia por distrito, sexo y edad, y evitar uso
  duplicado de respuestas excedentes.
- Las publicaciones internas, PDF de avance y UI de Avance pueden incorporar la
  lectura operativa, pero deben conservar la posibilidad de auditar el crudo.

## Notas

Relacionado con ADR 0010 (Monitoreo como centro de control operativo), ADR 0016
(publicacion en Google Sheets), ADR 0021 (warm start local) y ADR 0022
(perfiles dinamicos de Monitoreo).
