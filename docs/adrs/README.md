# Architecture Decision Records

Este directorio contiene las decisiones arquitectonicas de Prosecnur.

Un ADR se crea cuando una decision afecta estructura, persistencia,
caracteristicas arquitectonicas, dependencias entre modulos, despliegue,
seguridad de datos o contratos publicos. Los ADRs no reemplazan la
documentacion tecnica: explican por que una direccion fue elegida y como se
verificara que el codigo siga obedeciendola.

## Formato

Usar la [plantilla ADR](0000-template.md). Cada decision debe incluir:

- contexto;
- decision;
- consecuencias;
- cumplimiento;
- fecha.

## Indice

| ADR | Estado | Fecha | Decision |
|---|---|---:|---|
| [0001](0001-app-local.md) | Aceptado | 2026-05-31 | Prosecnur es una aplicacion local de escritorio |
| [0002](0002-formato-pulso.md) | Aceptado | 2026-05-31 | El proyecto persistente usa formato `.pulso` |
| [0003](0003-motor-r-integrado.md) | Aceptado | 2026-05-31 | El motor R vive integrado en `prosecnurapp` |
| [0004](0004-monolito-modular-microkernel.md) | Aceptado | 2026-05-31 | La arquitectura base es monolito modular con orientacion microkernel |
| [0005](0005-secretos-fuera-del-proyecto.md) | Aceptado | 2026-05-31 | Los secretos se guardan fuera del proyecto |
| [0006](0006-modulos-por-dominio.md) | Aceptado | 2026-05-31 | Los modulos se organizan por dominio metodologico |
| [0007](0007-integraciones-salientes-dashboard-publicable.md) | Aceptado | 2026-05-31 | Prosecnur permite integraciones salientes y dashboard publicable sin dejar de ser local |
| [0008](0008-proyecto-canonico-auditoria.md) | Aceptado | 2026-05-31 | Prosecnur usa un proyecto canonico de auditoria reproducible |
| [0009](0009-hojas-ruta-fases-piloto-campo-real.md) | Aceptado | 2026-06-04 | Hojas de ruta separa fases piloto y campo real |
| [0010](0010-monitoreo-centro-control-operativo-sheets.md) | Aceptado | 2026-06-06 | Monitoreo opera como centro de control local con perfiles y Google Sheets |
| [0011](0011-cache-persistida-mapas-monitoreo-territorial.md) | Aceptado | 2026-06-15 | Monitoreo territorial persiste una cache compacta de mapas por fase |
| [0012](0012-reportes-monitoreo-publicables.md) | Reemplazado por 0016 | 2026-06-16 | Monitoreo publica reportes web como snapshots agregados sin subir la app completa |
| [0013](0013-importacion-workbook-surveymonkey-offline.md) | Aceptado | 2026-06-16 | SurveyMonkey multibase importa archivos offline contra bases existentes |
| [0014](0014-publicacion-dual-monitoreo.md) | Reemplazado por 0016 | 2026-06-18 | Monitoreo separa publicaciones cliente e internas por audiencia |
| [0015](0015-monitoreo-space-cliente-sheets-interno.md) | Reemplazado por 0016 | 2026-06-19 | Monitoreo publica Space cliente y Sheets separados |
| [0016](0016-monitoreo-solo-google-sheets.md) | Aceptado | 2026-06-19 | Monitoreo publica solo Google Sheets |
| [0017](0017-base-panel-analitica.md) | Aceptado | 2026-06-19 | Analitica genera bases panel wide por llave y ola |
| [0018](0018-paquete-compartible-graficos.md) | Aceptado | 2026-06-19 | Graficos comparte planes editables como paquete portable |
| [0019](0019-monitoreo-aulas-universitarias.md) | Aceptado | 2026-06-19 | Monitoreo de aulas universitarias separa seleccion muestral y campo |
| [0020](0020-ficha-tecnica-contextos-metodologicos.md) | Aceptado | 2026-06-22 | La ficha tecnica compone contexto metodologico desde modulos auxiliares |
| [0021](0021-arranque-con-proyecto-y-warm-start.md) | Aceptado | 2026-06-24 | Prosecnur arranca con proyecto obligatorio y warm start local |
| [0022](0022-monitoreo-perfiles-frontend-dinamicos.md) | Aceptado | 2026-06-24 | Monitoreo usa perfiles frontend dinamicos y desktop-fast evita typecheck estricto |
| [0023](0023-acnur-kobo-mapas-cobertura-graficos.md) | Aceptado | 2026-06-25 | ACNUR Kobo y mapas de cobertura entran al motor de Graficos |
| [0024](0024-monitoreo-subsanaciones-operativas.md) | Aceptado | 2026-06-25 | Monitoreo territorial guarda subsanaciones operativas auditables |
| [0025](0025-monitoreo-anulacion-produccion-territorial.md) | Aceptado | 2026-06-26 | Monitoreo territorial permite anular produccion localmente |
| [0026](0026-guardado-explicito-guardia-salida.md) | Aceptado | 2026-06-26 | Prosecnur guarda `.pulso` explicitamente y protege salidas con guardia comun |
| [0027](0027-diseno-estudio-bitacora-viva.md) | Reemplazado por 0029 | 2026-06-28 | Diseno del estudio reemplaza Enciclopedia como expediente y bitacora viva |
| [0028](0028-plan-trabajo-cronograma-sincronico.md) | Reemplazado por 0029 | 2026-06-29 | Plan de trabajo modela cronogramas sincronicos con evidencia operativa |
| [0029](0029-reorientacion-por-proyecto-bitacora-y-overview.md) | Aceptado | 2026-07-09 | Reorientacion por proyecto: modulo Bitacora unico, Home adaptativo y overview de proyecto |
| [0030](0030-grupos-repeat-end-to-end.md) | Aceptado | 2026-07-10 | Soporte de grupos repeat (begin_repeat) end-to-end: base hija long canonica y reconexion de la validacion multi-tabla |
| [0031](0031-script-replicacion-base-analitica.md) | Aceptado | 2026-07-10 | Analitica puede entregar un script R reproducible de la base final |
| [0032](0032-handoff-instrumento-siempre-local.md) | Aceptado | 2026-07-11 | El handoff Monitoreo a Procesamiento usa siempre un XLSForm local |
| [0033](0033-reconciliacion-variables-data-xlsform.md) | Aceptado | 2026-07-11 | Las variables extra de data se reconcilian explicitamente contra el XLSForm |
| [0034](0034-label-overrides-etiquetas-por-proyecto.md) | Aceptado | 2026-07-12 | Los overrides de etiquetas se conservan por proyecto |
| [0035](0035-calc-muestra-mapeo-manual-exclusivo-por-hoja.md) | Aceptado | 2026-07-14 | Calculo de muestra (aulas): definicion de datos manual, exclusiva y por hoja (sin fuzzy, sin data hardcodeada) |
| [0035 — Editor](0035-editor-xlsform-coleccion-multi-formulario.md) | Aceptado | 2026-07-14 | El Editor XLSForm mantiene una coleccion multi-formulario; comparte numero historico con el ADR de Calculo de muestra |
| [0036](0036-filtro-universo-manual-en-carga.md) | Aceptado | 2026-07-14 | El filtro manual real/prueba se materializa en Carga y se hereda a repeats |
| [0037](0037-reporte-metodologico-validacion.md) | Aceptado | 2026-07-14 | Validacion genera un reporte metodologico exhaustivo basado en el plan efectivo y distingue la naturaleza de cada formula |
| [0038](0038-identidad-visual-v1-1.md) | Aceptado | 2026-07-15 | Identidad visual v1.1 «La señal ordenada»: isotipo canonico unico, patrones maestros y paquete branding/ como referencia normativa |
| [0039](0039-agentic-os-multirepo-provider-neutral.md) | Aceptado | 2026-07-19 | Agentic OS multirepo neutral al proveedor: núcleo global namespaced, packs opt-in y overlays locales |
| [0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md) | Aceptado | 2026-07-20 | Acreditacion enlaza revisiones XLSForm, efectivos reconciliados, procesamiento independiente y un PPT consolidado |
| [0041](0041-shell-v3-sidebar-navegacion-unificado.md) | Reemplazado por 0042 | 2026-07-23 | Shell v3 con sidebar unificado para módulos, secciones y pestañas; revertido por el dueño el 2026-07-24 |
| [0042](0042-chrome-modulo-uniforme-topbar.md) | Aceptado | 2026-07-24 | Chrome de módulo uniforme: top bar de secciones + rail de pestañas re-ratificados (patrones #1–#3 del ADR 0038), uniformidad en los 8 módulos y pulido macOS-like; reemplaza al ADR 0041 |

Ver tambien la [guia arquitectonica canonica](../arquitectura-prosecnur.md).
