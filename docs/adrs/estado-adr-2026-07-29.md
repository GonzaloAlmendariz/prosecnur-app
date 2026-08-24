# Estado de los ADR al 2026-07-29

## Resumen ejecutivo

Este informe separa tres dimensiones que no deben confundirse:

1. **Estado documental:** el ciclo de vida declarado por el ADR y repetido en
   `docs/adrs/README.md`.
2. **Implementación observada:** evidencia estática localizada durante la
   revisión. No equivale a cobertura exhaustiva ni a una ejecución completa de
   tests.
3. **Deuda o decisión pendiente:** contradicciones, evidencia faltante o
   decisiones de gobierno todavía no ratificadas.

El inventario contiene **48 decisiones físicas y 47 identificadores**. Hay dos
archivos que se presentan como ADR 0035. Los estados documentales actuales son:

| Estado documental | Cantidad |
|---|---:|
| Aceptado | 41 |
| Reemplazado | 6 |
| Propuesto | 1 |
| **Total físico** | **48** |

La revisión del estado documental es exhaustiva. La implementación se describe
como **muestra estática** cuando se inspeccionaron contratos, fuentes o tests, y
como **no evaluada individualmente** cuando solo se contrastaron el ADR y el
índice. No se ejecutó una suite integral del producto para producir este
informe.

## Inventario completo

| ADR físico | Estado documental | Implementación observada | Deuda o decisión pendiente |
|---|---|---|---|
| [0001](0001-app-local.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0002](0002-formato-pulso.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0003](0003-motor-r-integrado.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0004](0004-monolito-modular-microkernel.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0005](0005-secretos-fuera-del-proyecto.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0006](0006-modulos-por-dominio.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0007](0007-integraciones-salientes-dashboard-publicable.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0008](0008-proyecto-canonico-auditoria.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0009](0009-hojas-ruta-fases-piloto-campo-real.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0010](0010-monitoreo-centro-control-operativo-sheets.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0011](0011-cache-persistida-mapas-monitoreo-territorial.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0012](0012-reportes-monitoreo-publicables.md) | Reemplazado por 0016 | Se conserva como registro histórico; implementación no reevaluada. | Estado correcto; no borrar y mantener enlace a 0016. |
| [0013](0013-importacion-workbook-surveymonkey-offline.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0014](0014-publicacion-dual-monitoreo.md) | Reemplazado por 0016 | Se conserva como registro histórico; implementación no reevaluada. | Estado correcto; no borrar y mantener enlace a 0016. |
| [0015](0015-monitoreo-space-cliente-sheets-interno.md) | Reemplazado por 0016 | Se conserva como registro histórico; implementación no reevaluada. | Estado correcto; no borrar y mantener enlace a 0016. |
| [0016](0016-monitoreo-solo-google-sheets.md) | Aceptado | Muestra estática consolidada: el runtime conserva una superficie `public-report` incompatible con la exclusividad de Google Sheets que declara el ADR. | Resolver la contradicción: retirar esa superficie o sustituir 0016 mediante una decisión explícita. No cambiar el estado sin esa decisión. |
| [0017](0017-base-panel-analitica.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0018](0018-paquete-compartible-graficos.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0019](0019-monitoreo-aulas-universitarias.md) | Aceptado | Muestra documental: conserva autoridad sobre agenda y links/QR de aulas hasta que se implemente el handoff idempotente aceptado por 0046. **Superado — ver addenda.** | Redactar el reemplazo parcial solo cuando el handoff entre en vigor. |
| [0020](0020-ficha-tecnica-contextos-metodologicos.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0021](0021-arranque-con-proyecto-y-warm-start.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0022](0022-monitoreo-perfiles-frontend-dinamicos.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0023](0023-acnur-kobo-mapas-cobertura-graficos.md) | Aceptado | Muestra estática consolidada: la conjunción de condiciones de cobertura definida por la decisión no se aplica completamente. | Completar la conjunción o actualizar la decisión con el comportamiento deliberado. |
| [0024](0024-monitoreo-subsanaciones-operativas.md) | Aceptado | Muestra estática consolidada: la validación de subsanaciones no contrasta completamente contra la verdad operativa actual. | Completar la validación antes de afirmar cumplimiento integral. |
| [0025](0025-monitoreo-anulacion-produccion-territorial.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0026](0026-guardado-explicito-guardia-salida.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0027](0027-diseno-estudio-bitacora-viva.md) | Reemplazado por 0029 | Se conserva como registro histórico; implementación no reevaluada. | Estado correcto; no borrar y mantener enlace a 0029. |
| [0028](0028-plan-trabajo-cronograma-sincronico.md) | Reemplazado por 0029 | Se conserva como registro histórico; implementación no reevaluada. | Estado correcto; no borrar y mantener enlace a 0029. |
| [0029](0029-reorientacion-por-proyecto-bitacora-y-overview.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Parte de su superficie evoluciona mediante 0047; no reemplazar antes de ratificar ese ADR. |
| [0030](0030-grupos-repeat-end-to-end.md) | Aceptado | No evaluada individualmente; estado e índice coherentes. | Sin cambio de estado propuesto. |
| [0031](0031-script-replicacion-base-analitica.md) | Aceptado | Muestra documental: conserva una nota `Pendiente` que ya no representa el avance observado. | Actualizar evidencia y añadir `Cumplimiento`; no cambiar el estado. |
| [0032](0032-handoff-instrumento-siempre-local.md) | Aceptado | Muestra estática consolidada: el código de error observado difiere del contrato documentado. | Alinear contrato o implementación y añadir `Cumplimiento`. |
| [0033](0033-reconciliacion-variables-data-xlsform.md) | Aceptado | Muestra estática: endpoints de revisión y tests de reconciliación por base materializan la decisión. | Añadir sección `Cumplimiento` con los checks existentes. |
| [0034](0034-label-overrides-etiquetas-por-proyecto.md) | Aceptado | Muestra estática: persistencia y tests materializan los overrides; parte de la resolución usa un entorno global ambiental. | Añadir `Cumplimiento` y revisar aislamiento por sesión/worker. |
| [0035 — Cálculo](0035-calc-muestra-mapeo-manual-exclusivo-por-hoja.md) | Aceptado | Muestra estática: existe mapeo manual exclusivo, pero los roles no mapeados conservan fallback fuzzy por compatibilidad. | Aclarar o restringir la excepción fuzzy. Comparte identificador con el ADR físico de Editor. |
| [0035 — Editor](0081-editor-xlsform-coleccion-multi-formulario.md) | Aceptado | Muestra estática: colección multi-formulario, espejo activo, persistencia y tests coherentes con la decisión. | Inconsistencia crítica de identidad: comparte 0035 con Cálculo. Regularizar sin borrar la historia. |
| [0036](0036-filtro-universo-manual-en-carga.md) | Aceptado | Muestra estática: materialización, persistencia, herencia a repeats y tests coherentes. | Sin cambio de estado propuesto. |
| [0037](0037-reporte-metodologico-validacion.md) | Aceptado | Muestra estática: endpoint, motor del informe y tests de fórmulas coherentes. | Sin cambio de estado propuesto. |
| [0038](0038-identidad-visual-v1-1.md) | Aceptado | Muestra estática: marca canónica consumida por shell, arranque y packaging. | Añadir `Cumplimiento` y evidencia de los gates visuales vigentes. |
| [0039](0039-agentic-os-multirepo-provider-neutral.md) | Aceptado | Verificación ejecutada: `node agentic/sync-agentic-os.mjs --check` terminó con código 0; informó dos skills externas no disponibles para Codex. | Resolver o retirar formalmente esas dos referencias externas; el estado sigue siendo correcto. |
| [0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md) | Aceptado | Muestra estática: revisiones, releases, batch acreditado y consolidado poseen contratos y tests. | Sin cambio de estado propuesto. |
| [0041](0041-shell-v3-sidebar-navegacion-unificado.md) | Reemplazado por 0042 | Muestra estática: 0042 enlaza el reemplazo y no se observaron restos de `AppSidebar`/`sidebar-v3`. | Estado correcto; conservar como registro histórico. |
| [0042](0042-chrome-modulo-uniforme-topbar.md) | Aceptado | Muestra estática: `ModuleCommandBar` y el contrato de excepciones materializan el chrome vigente. | Añadir `Cumplimiento` con cobertura por módulo y excepciones. |
| [0043](0043-proyectos-de-referencia-reales-anonimizados.md) | Aceptado | Muestra estática: cuatro fixtures, anonimización y verificación; los `.pulso` son read-only, pero los manifests no tienen el mismo permiso. | Añadir `Cumplimiento` y aclarar si 0444 también gobierna manifests. |
| [0044](0044-jerarquia-y-direcciones-de-navegacion.md) | Aceptado | Muestra estática: parser, runtime y manifiesto canónicos existen, pero todavía hay escritores de aliases antiguos (`tab` y `mesa`). | Eliminar emisiones legacy, conservar aliases solo en lectura y añadir `Cumplimiento`. |
| [0045](0045-monitoreo-actores-modelo-telefonia-explicita.md) | Aceptado | Muestra estática: Fuentes deriva actores/canales y los tests impiden que Modelo los cree o renombre. | Sin cambio de estado propuesto. |
| [0046](0046-recopiladores-despliegue-recoleccion.md) | Aceptado | Muestra documental: la decisión fue aceptada, pero mantiene expresamente la autoridad de 0019 hasta implementar el handoff. El cambio de estado estaba sin commit al tomar la instantánea. **Superado — ver addenda.** | Implementar y probar el handoff antes de transferir autoridad o revisar parcialmente 0019. |
| [0047](0047-bitacora-cronograma-canvas-vinculado.md) | Propuesto | Muestra estática: schemas, migración, cinco fases y superficies UI ya existen; el texto aún dice tres/cuatro vistas y seis/cinco fases. | Reconciliar la decisión final, añadir `Cumplimiento` y obtener ratificación explícita antes de cambiar a Aceptado. |

## Excepción de identidad: doble 0035

La duplicación no altera el conteo físico, pero impide que una referencia como
“ADR 0035” identifique una sola decisión. El índice documenta el accidente; no
lo resuelve.

La regularización recomendada es conservar Cálculo como ADR 0035 y asignar una
identidad nueva al ADR de Editor, preservando en la ruta antigua un alias
histórico. Esta acción requiere una decisión separada: este informe no renumera,
no mueve y no modifica ninguno de los dos ADR.

## Hallazgos priorizados

### P0

No se identificó un hallazgo P0 mediante esta auditoría documental y estática.

### P1

- ADR 0016 es autoritativo, pero la muestra de runtime conserva `public-report`,
  en contradicción con “solo Google Sheets”.
- El identificador 0035 representa dos decisiones distintas.
- ADR 0044 prohíbe escribir aliases antiguos, pero aún se emiten direcciones con
  `tab` y `mesa`.
- ADR 0047 sigue Propuesto aunque gran parte del contrato ya está persistido e
  implementado; además, su decisión interna no coincide con el resultado final.

### P2

- ADR 0023 no aplica completamente la conjunción de cobertura declarada.
- ADR 0024 no valida todas las subsanaciones contra la verdad actual.
- ADR 0032 y su implementación discrepan en el código de error.
- ADR 0035 — Cálculo conserva una compatibilidad fuzzy más amplia que su regla
  manual exclusiva.
- Nueve ADR carecen de sección `Cumplimiento`: 0031, 0032, 0033, 0034, 0038,
  0042, 0043, 0044 y 0047.

### P3

- ADR 0031 conserva una nota `Pendiente` obsoleta.
- El gate documental ya detecta deriva entre índice y documento y mantiene
  visible el doble 0035; todavía no valida reciprocidad ni ciclos de relaciones
  `Reemplaza`/`Extiende`.

## Decisiones pendientes

1. Resolver si 0016 vuelve a gobernar en forma estricta o será reemplazado por
   una decisión que permita otra superficie pública.
2. Aprobar una migración histórica segura para el segundo ADR 0035.
3. Corregir los escritores legacy de 0044 sin retirar sus aliases de lectura.
4. Reconciliar y ratificar 0047; la implementación por sí sola no constituye
   aceptación arquitectónica.
5. Completar el handoff de 0046 antes de revisar la autoridad de 0019.
6. Definir y ejecutar una migración documental para los nueve ADR sin
   `Cumplimiento`.

## Evidencia y límites

- Fuente de estados: encabezados de los 48 archivos y
  `docs/adrs/README.md` al 2026-07-29.
- La revisión estática inspeccionó selectivamente ADR, contratos, fuentes y tests;
  las filas marcadas “no evaluada individualmente” no deben interpretarse como
  certificación de implementación.
- Se ejecutó `node agentic/sync-agentic-os.mjs --check` sobre ADR 0039, con
  código 0 y warnings externos. Al sistematizar el informe también se ejecutó
  `node scripts/check-docs-governance.mjs`, que verificó estados, fechas,
  enlaces y alcance documental, y su suite focalizada con Node.
- No se ejecutó una suite integral, QA visual, red, publicación ni mutación de
  proyectos `.pulso`.
- El estado Aceptado de 0046 provenía de cambios concurrentes aún no commiteados;
  se preservó como parte de la instantánea y no se modificó desde este informe.

## Addenda del 2026-07-30 — 0019 y 0046

La instantánea de arriba se conserva tal como se tomó; esta addenda registra lo
que quedó atrás sin reescribirla.

- **El handoff de 0046 está implementado.** `.collection_monitoring_handoff`
  (`api/R/collection_engine.R:691-696`) proyecta el despliegue de Recopiladores
  de vuelta a `monitoreo_aulas_plan`, y `GET /api/monitoreo/dashboard` lo
  consume. Cae por tanto la condición «implementar y probar el handoff antes de
  revisar parcialmente 0019», y con ella el punto 5 de *Decisiones pendientes*.
- **0019 ya tiene su revisión parcial redactada**, fechada el 2026-07-30 en la
  sección `Notas` del propio ADR.
- **Aparece un pendiente nuevo que la instantánea no podía ver**, porque nace de
  evaluar `Cumplimiento` y no el estado documental: la publicación a Google
  Sheets de la familia de cursos-horario no tiene ninguna prueba, incluida la
  comprobación de que el workbook cliente no exponga PII. Detalle y orden de
  reparación en
  [la auditoría del 2026-07-30](../qa/auditoria-adr-0019-cursos-horario-2026-07-30.md).
