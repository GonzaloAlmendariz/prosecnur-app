# Checklist — sinergia calc-muestra ↔ Monitoreo: el excel de agendación (2026-08-20)

Tipo: Checklist QA fechado
Estado: En curso
Fecha: 2026-08-20
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


Mandato textual de Gonzalo: «Ahora que finalizamos lo pendiente vamos con la
sinergia con monitoreo, debe comunicarse muy bien con él por ejemplo para poder
hacer que la selección y reemplazos generen el excel de agendación correcto.»

Trabajo coordinado entre dos sesiones: **calc-muestra** (esta) y **Monitoreo**
(peer `prosecnur-app-23`, dueño del generador del libro y su lector). Regla del
reparto: calc-muestra verifica y toca sus superficies; el peer toca
`carga_aulas_libro_generar.R` / `carga_aulas_agendadas.R`; nadie toca
`collection_*` sin palabra de Gonzalo. El plan del lado de Monitoreo vive en
`docs/qa/plan-validacion-aulas-2026-08-20.md`.

## El contrato (medido, no supuesto)

El excel de agendación **ya existe con un solo dueño**: lo escribe
`aulas_libro_hoja_agendadas(unidades)` (`api/R/carga_aulas_libro_generar.R`),
lo lee `aulas_agendadas_leer(path, hoja = "Aulas Agendadas")`
(`api/R/carga_aulas_agendadas.R`) y Monitoreo lo importa por
`/api/monitoreo/aulas/importar-libro`. Hoja ancha por cadena: `ID MATCH` +
bloque de 20 columnas literales × profundidad (el lector deduce la profundidad
del ancho real y resuelve por título). Fila = titular + reemplazos por
`replacement_order`.

**Secuencia correcta del libro con QR**: selección → Recopiladores
(plan + deployment + handoff; el handoff escribe `row$link` por binding,
`collection_engine.R` ≈735) → `/api/monitoreo/aulas/generar-libro`.

## La tabla

| # | Ítem | Dónde vive | Estado |
|---|------|-----------|--------|
| 1 | Contrato del excel identificado (un dueño, 20 títulos literales, ancho por cadena) | `carga_aulas_libro_generar.R` / `carga_aulas_agendadas.R` | ☑ verificado con el peer |
| 2 | Viaje selección→libro corrido de verdad sobre el plan 1b y auditado | endpoints `import-from-calc-muestra` + `generar-libro`; `libro_aulas_plan1b.xlsx` (scratchpad) | ☑ 951 filas datos × 241 col (prof 12), títulos exactos, identidad app llena, persona en blanco; el peer reprodujo 952×241 |
| 3 | Banco extra (761 aulas) entra disfrazado de cadenas de tamaño 1; propuesta: **hoja propia** | generador (zona del peer) | ⛔ decisión de Gonzalo — el peer ejecuta |
| 4 | Columnas `efectivas_esperadas` / `meta_origen` en el bloque de 20 (hoy la meta viaja solo por `.pulso`, verificado 2.616/2.616) | lector (zona del peer) | ⛔ decisión de Gonzalo — el peer extiende el lector |
| 5 | Enlace QR (`ENLACE DE LA FICHA` 0/951): NO se compone a mano — canon en `collection_adapters.R` (`/<asset_uid>/collectorID`, confirmado en producción); el handoff ya lo escribe | `collection_engine.R` (handoff) | ☑ mecanismo verificado · ☐ falta correr el handoff real con recopilador configurado (operativo, lo dispara Gonzalo desde la UI) |
| 6 | Plan de Recopiladores **anclado a la selección vieja** (2.468 unidades vs 2.616 del 1b): el seed es noop con estado existente, `apiRecopiladoresPlanPut` no tiene NINGÚN consumidor en la UI, y `PlanSection` muestra «Plan congelado» sin declarar el desfase | `collection_engine.R:412` + `frontend/src/features/recopiladores/PlanSection.tsx` | ⛔ decisión de Gonzalo — ¿vía de re-armado en la UI? ¿quién la construye? (zona `collection_*`) |
| 7 | `pendiente_enlace` ambiguo en Monitoreo: mismo rótulo para «no se generó» y «se generó contra otra selección» (una palabra, dos cosas); distinguirlas exige leer `input_fingerprint` de Recopiladores = contrato nuevo entre módulos | motor de materiales del peer | ⛔ decisión de Gonzalo — el peer se ofrece a implementarlo leyendo solo el fingerprint |
| 8 | `TELEFONO DE DOCENTE` vacío | libro (columna de la persona) | ☑ cerrado — no es defecto: la base DTI no lo trae y lo llena quien agenda |
| 9 | ¿Calc-muestra ofrece el libro desde su Entrega? Hoy: «Pase a Monitoreo» existe (`SalidasMonitoreoTab`) y Entregables descarga el workbook de auditoría, pero el libro de agendación solo se genera desde Monitoreo | `salidas/SalidasMonitoreoTab.tsx` / `SalidasEntregablesTab.tsx` | ⛔ decisión de Gonzalo — si sí: botón que llama al MISMO endpoint (`/api/monitoreo/aulas/generar-libro`), sin motor paralelo |

## La lectura conjunta de los ítems 6 y 7 (sube la prioridad)

Vistos por separado, el 6 es «no hay re-armado» y el 7 es «rótulo ambiguo».
Juntos son otra cosa: **un estado del que no se sale por la interfaz y que
además no se anuncia**. Si la selección se re-sortea después de adaptar el plan
de Recopiladores, no existe ninguna vía en la UI para re-alinearlo (seed noop,
`PlanPut` sin consumidor) y ninguna superficie lo declara: el contador de
materiales diría «179/196 con enlace» tan tranquilo, leyéndose como «faltan 17
QR» cuando 148 unidades del plan nuevo no existen en el plan congelado. No es
un rótulo que se pule: es una puerta cerrada sin cartel. Las decisiones 6 y 7
conviene tomarlas juntas.

## Lo aprendido que evita reinvestigar

- El header de la API es `X-Pulso-Session`; `X-Session-Id` no autentica y cae a
  sesión huérfana **sin error**.
- openpyxl no lee los xlsx de openxlsx (drawing fantasma + dimensión perezosa);
  auditar con `openxlsx::read.xlsx(colNames = FALSE)`.
- Monitoreo **no consume** el estado de Recopiladores (cero referencias en su
  motor/router): el flujo va Recopiladores→Monitoreo, nunca al revés. Si el
  contador de enlaces de Monitoreo no cuadra, la primera sospecha es el plan de
  Recopiladores anclado a otra selección, no QR sin generar.
- El copy del seed lo dice a propósito: «Puedes adaptarlo una sola vez» — el
  congelamiento del plan es diseño; lo que falta es **declarar el desfase**, no
  descongelar a ciegas.
