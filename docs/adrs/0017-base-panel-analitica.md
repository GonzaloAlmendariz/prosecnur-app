# ADR 0017: Base panel wide en Analitica

Estado: Aceptado

Fecha: 2026-06-19

## Contexto

Prosecnur ya distingue estudios multi-base y hermanos independientes, pero esos
flujos generan entregables por base o tablas multibase integradas. Los estudios
panel requieren otra semantica: varias olas representan mediciones de las
mismas personas y deben consolidarse por una llave comun en una tabla wide.

Esta decision afecta contratos API, persistencia `.pulso`, entregables
analiticos y la frontera entre Analitica y Hojas de Ruta. El NSE oficial debe
quedar disponible en los entregables panel, pero el mapeo geografico completo
desde manzana/zona/UMP pertenece al modulo Hojas de Ruta y queda como etapa
posterior.

## Decision

Agregar Base panel como capacidad dedicada de Analitica, separada de Tablas
multibase. La experiencia vive en `Analitica > Base panel` y usa endpoints
propios bajo `/api/analitica/panel/*`.

La configuracion panel se guarda dentro de `analitica_config$panel` para que
viaje en el `.pulso`: llave, olas, sufijos, NSE detectado/anexado, hojas del
paquete metodologico y opciones de exportacion de la base wide. Los archivos
generados siguen siendo entregables regenerables y no se guardan dentro del
`.pulso`.

El motor panel genera una fila por llave y variables separadas por sufijo de
ola. Las preguntas iguales no se fusionan automaticamente. Las inconsistencias
se reportan en una auditoria tabular.

Base panel ofrece dos familias de salida:

- Paquete metodologico XLSX: `base_wide`, `libro_codigos`, `frecuencias`,
  `auditoria_panel`, `cobertura_nse` y `configuracion`.
- Dataset wide exportable con la misma calidad que `Analitica > Bases`: Excel
  con hoja de codigos/etiquetas y fila de labels, CSV UTF-8 con opciones de
  codigos/etiquetas/multi-respuesta, y SPSS `.sav` con variable labels,
  value-labels y niveles de medida inferidos.

## Consecuencias

Beneficios:

- El flujo panel queda reusable para `n` olas y no queda hardcodeado a
  Polarizacion.
- Los reportes existentes de Analitica y Tablas multibase no cambian de
  significado.
- La salida wide, el libro de codigos, las frecuencias, la auditoria y la
  cobertura NSE se producen desde un contrato auditable.
- La base wide panel puede entregarse en los mismos formatos analiticos de
  Bases sin duplicar motores de escritura ni degradar metadatos.

Costos y riesgos:

- El motor panel lee todas las bases del estudio incluso cuando Analitica
  scopa otros reportes a una base activa en hermanos independientes.
- La etapa inicial solo audita/anexa NSE ya disponible; el mapeo oficial desde
  Hojas de Ruta debe implementarse como contrato posterior.
- Proyectos con llaves deficientes pueden generar auditorias extensas y deben
  revisarse antes de usar la base final.

## Cumplimiento

- Tests R del motor `analitica_panel.R` deben cubrir wide, duplicados, olas
  faltantes, `select_multiple`, cobertura NSE, paquete XLSX y exportaciones
  wide XLSX/CSV/SAV.
- La API panel debe usar jobs para exportar y registrar `analitica_panel_ok`.
- La UI debe estar dentro del shell de Analitica y verificarse con el proyecto
  `.pulso` real mediante `scripts/ui-quick-check.mjs`.
- Revisiones futuras no deben convertir Tablas multibase en panel ni mover el
  mapeo geografico NSE fuera de Hojas de Ruta sin nuevo ADR.

## Notas

Relacionado con ADR 0013 sobre importacion SurveyMonkey multibase offline y con
la arquitectura canonica de monolito modular local.
