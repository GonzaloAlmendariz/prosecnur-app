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
| [0027](0027-diseno-estudio-bitacora-viva.md) | Aceptado | 2026-06-28 | Diseno del estudio reemplaza Enciclopedia como expediente y bitacora viva |
| [0028](0028-plan-trabajo-cronograma-sincronico.md) | Aceptado | 2026-06-29 | Plan de trabajo modela cronogramas sincronicos con evidencia operativa |

Ver tambien la [guia arquitectonica canonica](../arquitectura-prosecnur.md).
