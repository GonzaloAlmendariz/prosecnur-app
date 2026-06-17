# ADR 0012: Reportes de Monitoreo publicables como snapshots agregados

## Estado

Aceptado

## Fecha

2026-06-16

## Contexto

Monitoreo necesita compartir avances con clientes sin convertir Prosecnur en
SaaS ni exponer la aplicacion local completa. Los casos inmediatos son ACNUR
acreditacion, con avance por actor, y territorial, con avance por distrito y
ritmo diario. En ambos casos el cliente solo debe ver un corte agregado.

El publicador del dashboard ya usa Hugging Face Spaces, pero ese flujo compila
la app desde el repo del Space. Para Monitoreo el requerimiento de seguridad es
mas estricto: no subir el software completo ni habilitar sync, edicion o datos
de caso.

## Decision

Monitoreo publica Hugging Face Spaces separados como artefactos read-only de
snapshot:

- la app local calcula un payload agregado y sanitizado;
- el `.pulso` publicado incluye `public_artifact` y
  `public_artifact_payload$monitoreo_report`;
- el Space de Monitoreo usa un runtime R minimo que solo lee ese payload y sirve
  un HTML publico;
- el Space no contiene `frontend/` ni los routers completos de Prosecnur;
- las actualizaciones ocurren republicando desde la app local al mismo Space.

El contrato publico permite:

- descriptor `GET /api/public/artifact`;
- reporte agregado `GET /api/monitoreo/public-report`.

El contrato bloquea sync, Kobo/Sheets, PDF, exports, edicion, respuestas
individuales, GPS puntual, correos, telefonos, `response_id`,
`internal_queries`, auditorias de caso y trazabilidad cruda.

## Consecuencias

- Cada reporte compartible vive en su propio Space, por ejemplo
  `acnur-avance-territorial` y `acnur-avance-acreditacion`.
- El Space no se autosincroniza con fuentes externas; refleja el corte
  republicado desde Prosecnur local.
- Nuevas familias de Monitoreo agregan builders agregados al contrato
  `public_artifact_payload`, no endpoints operativos remotos.
- El dashboard conserva su flujo existente, pero en modo publico el backend
  monta solo la familia necesaria.

## Cumplimiento

- Tests verifican que el staging de Monitoreo usa el runtime publico minimo y no
  incluye `frontend/` ni routers locales no requeridos.
- Tests de whitelist verifican que endpoints mutables de Monitoreo quedan fuera
  de `PULSO_PUBLIC_MODE=1`.
- Tests de payload verifican que el endpoint publico puede servir desde el
  payload embebido, sin reconstruir desde datos crudos.
