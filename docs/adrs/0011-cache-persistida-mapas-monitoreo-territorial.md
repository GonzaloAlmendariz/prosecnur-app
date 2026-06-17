# ADR 0011: Cache persistida de mapas y reportes de Monitoreo territorial

Estado: Aceptado

Fecha: 2026-06-15

## Contexto

Monitoreo territorial cruza respuestas Kobo con geometria de Hojas de Ruta para
mostrar rutas, puntos GPS, consultas internas, avance y validacion
georreferencial. Ese cruce puede requerir operaciones `sf` costosas y tambien
armar reportes derivados por scope. Al reabrir un proyecto `.pulso`, la primera
entrada a Hojas de ruta, Consultas internas o Validacion podia quedar bloqueada
mientras se reconstruia el mapa o el reporte de la vista.

El formato `.pulso` excluye caches grandes y regenerables por defecto, pero en
este caso la cache es una representacion compacta, versionada y local de
decisiones ya presentes en el proyecto: ruta territorial seleccionada,
snapshot local de respuestas y mapeos de validacion.

## Decision

Persistir en `.pulso` caches compactas separadas:

- `s$monitoreo_territorial_map_cache`, separada por fase `pilot`/`field` y por
  capa:

- `route_geometry`: hash/version de la ruta, manzanas seleccionadas, bounds,
  conteos e indice UMP.
- `gps_points`: hash/version del snapshot local, puntos GPS clasificados,
  `geo_results`, bounds y conteos.

- `s$monitoreo_snapshot$territorial_report_cache`, separada por fase, fuente y
  `report_scope`, con hash de snapshot, hash de ruta cuando aplica, hash de
  configuracion, metadata de payload y el dashboard territorial derivado para
  ese scope.

La cache no guarda secretos ni dispara sincronizaciones externas. Los endpoints
de Monitoreo exponen metadata liviana en `/api/monitoreo/state`, capas
especificas en `/api/monitoreo/territorial/map` y preparacion explicita en
`POST /api/monitoreo/territorial/map/prepare`.

## Consecuencias

La apertura de proyectos territoriales puede ser mas rapida porque la
validacion espacial puede reutilizar `geo_results` persistidos y las vistas
pueden abrir desde reportes por scope ya materializados. El archivo `.pulso`
puede crecer moderadamente, proporcional a las fases, respuestas territoriales
y scopes cacheados.

La cache queda invalidada por hashes: cambios de respuestas invalidan
`gps_points` y reportes dependientes del snapshot, cambios de Hojas de Ruta
invalidan `route_geometry` y reportes dependientes de geometria, y Piloto/Campo
se mantienen aislados. Una cache stale puede mostrarse si sigue siendo usable,
mientras una preparacion explicita la actualiza.

## Cumplimiento

El codigo debe mantener `/api/monitoreo/state` libre de features/puntos pesados.
Las pruebas enfocadas deben cubrir separacion de hashes, invalidacion por
snapshot/ruta, hits persistidos por scope y reutilizacion de `geo_results`. Los
cambios de `.pulso` deben preservar `s$monitoreo_territorial_map_cache` y
`s$monitoreo_snapshot$territorial_report_cache`, y seguir excluyendo caches
runtime no versionadas.

## Notas

Relacionado con [ADR 0002](0002-formato-pulso.md),
[ADR 0009](0009-hojas-ruta-fases-piloto-campo-real.md) y
[ADR 0010](0010-monitoreo-centro-control-operativo-sheets.md).
