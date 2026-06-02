# ADR 0008: Proyecto canonico de auditoria reproducible

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

El diagnostico de fallas en Prosecnur podia mezclar evidencia de ventanas,
sesiones y proyectos distintos. Un caso tipico era validar una copia alterna
de un `.pulso` mientras Electron seguia mostrando el problema en otro backend,
otro `sid` o caches cargados antes de una reparacion.

La arquitectura local de Prosecnur depende de sesiones en memoria y proyectos
`.pulso` portables. Esa combinacion es correcta para el producto, pero exige
un flujo de auditoria que fije explicitamente que proyecto, sesion, puerto y
version se estan revisando.

## Decision

Prosecnur incorpora un proyecto sintetico de referencia, generado desde codigo,
llamado **Auditoria Canonica Prosecnur**. La semilla vive en
`api/inst/audit_reference/prosecnur_audit_reference.pulso` y cada corrida de
auditoria debe abrir una copia fresca bajo `outputs/audit-runs/<timestamp>/`.

El launcher acepta `PULSO_AUDIT_PROJECT` como alias de bootstrap local y, si se
provee `PULSO_AUDIT_RUN_MANIFEST`, escribe el `sid`, puerto, ruta del proyecto,
checksum y version en `audit-run.json`. El smoke de Electron usa ese manifest
para validar que las capturas pertenecen al mismo proyecto abierto.

En auditoria, Electron usa un directorio `userData` por corrida y omite el
single-instance lock normal de la app. Ese permiso queda limitado a
`PULSO_AUDIT_RUN_MANIFEST`/`PULSO_ALLOW_MULTI_INSTANCE`, porque el objetivo es
auditar una instancia aislada aunque el usuario tenga otra ventana abierta.

## Consecuencias

Se gana reproducibilidad, trazabilidad y una referencia comun para reportar
bugs. La evidencia deja de depender de capturas manuales tomadas sobre
proyectos vacios o sesiones equivocadas.

Se agrega mantenimiento: el fixture sintetico debe evolucionar cuando cambien
los contratos de modulos. Tambien se evita cubrir integraciones externas reales
en el flujo automatico para no introducir tokens ni dependencia de red.

## Cumplimiento

- `make audit-reference-build` debe regenerar la semilla desde codigo.
- `make desktop-audit` y `make audit-reference-run` deben abrir una copia
  aislada, no la semilla original.
- `make desktop-audit` debe usar `build-if-stale`, `PROSECNUR_USER_DATA_DIR`
  por corrida y puerto CDP dedicado.
- `audit-run.json` debe contener `sid`, `port`, `project_path`,
  `project_sha256`, `app_version` y `git_sha`.
- Los tests de `api/tests/testthat/test-audit-reference.R` verifican apertura,
  reapertura con `sid` fresco, paths reescritos y ausencia de outputs o
  secretos dentro del `.pulso`.
- Las capturas aceptadas para diagnostico deben estar listadas en el manifest.

## Notas

Relacionado con [ADR 0001](0001-app-local.md), [ADR 0002](0002-formato-pulso.md)
y [ADR 0005](0005-secretos-fuera-del-proyecto.md).
