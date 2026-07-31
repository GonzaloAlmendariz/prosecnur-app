# Auditoría del ADR 0019 — Monitoreo de cursos-horario

Tipo: Auditoría QA
Estado: Vigente
Fecha: 2026-07-30
Autoridad: Evidencia de cumplimiento del ADR 0019; no sustituye la decisión arquitectónica

**Fecha:** 30 de julio de 2026
**Pregunta que la origina:** ¿el perfil de cursos-horario tiene todos los elementos que propone su ADR?
**Método:** lectura estática del backend R, el frontend y la suite de tests, contrastada cláusula por cláusula
contra [ADR 0019](../adrs/0019-monitoreo-aulas-universitarias.md). Sin corrida de la app.
**Veredicto:** la decisión está materializada; el bloque `Cumplimiento` del ADR **no** lo está por completo.

Este informe mide el perfil contra su ADR. La paridad funcional contra la operación histórica en Excel se mide
aparte, en [`docs/plan-monitoreo-aulas-2026-07.md`](../plan-monitoreo-aulas-2026-07.md) §10; los dos conjuntos de
pendientes son complementarios y ninguno reemplaza al otro.

## 1. Lo que la decisión sí tiene

| Cláusula del ADR | Dónde vive |
|---|---|
| Familia `aulas_universitarias` activa | `api/R/monitoreo_engine.R:24220`; modo `aulas` en `frontend/src/features/monitoreo/core/monitoreoRegistry.ts:66` |
| Familia de publicación `university_classroom_fieldwork` | `api/R/router_monitoreo.R:5850` |
| Frontera calc-muestra → Monitoreo por `selection_run_id`, sin pasar por acreditación | `POST /api/monitoreo/aulas/import-from-calc-muestra` (`api/R/router_monitoreo.R:5822`) |
| `monitoreo_config$aulas_universitarias`, `monitoreo_aulas_plan`, `monitoreo_aulas_snapshot`, `monitoreo_aulas_publication` | `api/R/session_schema.R:322-324`, las tres declaradas `persistible` |
| Caches grandes fuera del contrato `.pulso` | `monitoreo_aulas_snapshot` guarda dashboard compacto + `response_rows`, sin listas de identificadores estudiantiles |
| Agenda, estados de aula (11), motivos de reemplazo (9), brechas, cuotas sexo×facultad, representatividad efectiva | `api/R/monitoreo_aulas_universitarias.R` |
| Flujo anónimo sin `student_id` | control `student_id_required` en el bloque de validación del dashboard |
| Workbooks Sheets separados: cliente agregado, interno con agenda y trazabilidad | `api/R/monitoreo_engine.R:24277-24298` |

De los siete puntos del bloque `Cumplimiento`, cinco tienen prueba real:

1. Base madre vs dos bases producen el mismo marco — `api/tests/testthat/test-calc-muestra-aulas.R:1`
2. La selección no se hace por filas alumno-curso y penaliza repetidos — `test-calc-muestra-aulas.R:280`,
   `test-calc-muestra-aulas-descuento.R:55`
3. Importación desde `selection_run_id` sin acreditación — `test-monitoreo-aulas-universitarias.R:8`
4. Estados de agenda y reemplazos — `test-monitoreo-aulas-universitarias.R:86` *(ver §2.4: las brechas no)*
5. Agregación anónima por aula sin `student_id` — `test-monitoreo-aulas-universitarias.R:83`
7. El plan sobrevive build/load del `.pulso` — `test-collection-project-roundtrip.R:19-59` *(ver §2.5)*

## 2. Pendientes

### 2.1 La publicación a Sheets de esta familia no tiene ninguna prueba — **bloqueante para el ADR**

El punto 6 de `Cumplimiento` exige verificar que el workbook cliente no exponga PII y que el interno conserve
trazabilidad operativa. Los siete archivos de test de publicación (`test-monitoreo-publish-qa.R`,
`test-dashboard-publish-http.R`, `test-public-artifacts.R`, …) tienen **cero** menciones a `aulas` o `classroom`.

El código existe y separa audiencias (`.monitoreo_publication_aulas_model_frames`,
`api/R/monitoreo_engine.R:24394`), pero nadie comprueba que la separación se sostenga: la agenda interna trae
docente, correo del docente y responsable de campo, que son exactamente los campos que no deben cruzar al
workbook cliente.

**Reparación:** un `test-monitoreo-publicacion-aulas.R` que arme el modelo con `audience = "client"` y afirme que
ninguna pestaña contiene `teacher`, `teacher_email`, `responsible`, `collector_id` ni `link`; y con
`audience = "internal"` que afirme que `selection_run_id` y `frame_hash` sí viajan.

### 2.2 Los reemplazos no se pueden aplicar desde la app

`POST /api/monitoreo/aulas/reemplazo` (`api/R/router_monitoreo.R:5913`) existe y su engine está probado, pero
**ningún archivo del frontend lo llama**. La página solo consume `import-from-calc-muestra` y `sync`
(`AulasMonitoreoPage.tsx`). Lo mismo pasa con `/aulas/agenda` y `/aulas/config`: `frontend/src/api/monitoreo.ts`
declara las funciones y nadie las invoca.

Consecuencia concreta: `replacement_for` y `replacement_reason` son inescribibles desde la interfaz. Los
reemplazos se leen en Consultas pero se aplican por HTTP directo. El ADR asigna los reemplazos a Monitoreo
como control operativo vivo, no como lectura.

### 2.3 No hay flujo de cierre operativo

`cerrada` está en la taxonomía de estados (`monitoreo_aulas_estados()`), pero no existe endpoint de cierre ni
acción en la UI que lo produzca. El ADR lista el «cierre operativo» entre las responsabilidades del perfil.

### 2.4 El test de agenda no cubre brechas

El punto 4 de `Cumplimiento` pide «estados de agenda, reemplazos y brechas». El test cubre los dos primeros; el
dashboard sí calcula las brechas y expone su KPI, pero ninguna aserción las toca.

### 2.5 La reapertura del `.pulso` solo está probada para el plan

El punto 7 pide preservación de plan, estados, **semillas** y **hashes**, más regeneración de caches. Lo probado
es que `monitoreo_aulas_plan` sobrevive el roundtrip. `selection_run_id` y `frame_hash` viven en
`monitoreo_config$aulas_universitarias` y no hay prueba de que reabrir el proyecto los conserve.

### 2.6 Riesgo: dos superficies leen el plan de sitios distintos

Este no es un pendiente del ADR sino un defecto latente encontrado de paso.

- `GET /api/monitoreo/dashboard` lee `s$monitoreo_aulas_plan` (`api/R/router_monitoreo.R:2123`), que es donde el
  handoff de Recopiladores proyecta de vuelta (`api/R/collection_engine.R:691-696`).
- `POST /api/monitoreo/aulas/sync` reconstruye desde `cfg$aulas_universitarias$plan`
  (`api/R/router_monitoreo.R:5961` → `api/R/monitoreo_engine.R:15219`), que el handoff **no** toca.

Después de un despliegue desde Recopiladores, las dos superficies pueden mostrar agendas distintas para el mismo
corte. Merece una regresión antes de la reparación.

## 3. Deuda declarada, no defecto

**Los PDF del perfil están apagados a propósito.** Desde el 30-07-2026 la pestaña Salidas de cursos-horario
declara `pdfSupport={{ client: false, production: false }}`. El motivo está en
`.monitoreo_client_report_model_for_snapshot` (`api/R/router_monitoreo.R:3308`): solo ramifica para territorial y
telefónico, así que cursos-horario caería en el modelo de **acreditación** y el botón entregaría un documento con
actores y encuestas que este perfil no tiene. Levantar el apagado exige un modelo de reporte propio, no cambiar
la bandera.

## 4. Coherencia documental

`docs/adrs/estado-adr-2026-07-29.md:53` sigue diciendo que el reemplazo parcial del 0019 debe redactarse «solo
cuando el handoff entre en vigor», y la línea 81 registra el cambio de estado del 0046 como sin commitear. Las
dos observaciones quedaron atrás: el handoff está implementado (`.collection_monitoring_handoff`) y el ADR 0019
ya tiene su nota de revisión parcial fechada el 30-07-2026. El índice se corrige en esa misma fecha.

## 5. Orden sugerido

1. §2.1 — cierra el único punto de `Cumplimiento` sin ninguna cobertura y toca PII.
2. §2.6 — defecto latente con dos superficies en desacuerdo; regresión primero.
3. §2.2 — devuelve a la UI un control que el ADR asigna a Monitoreo.
4. §2.4 y §2.5 — completan el bloque `Cumplimiento` con tests acotados.
5. §2.3 — el cierre operativo es diseño nuevo, no reparación.
