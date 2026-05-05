# Cartografia detallada para hojas de ruta

## Diagnostico

El mapa de manzanas actual ya usa manzanas censales y una capa vial local de OpenStreetMap/Geofabrik, pero todavia no tiene una capa completa de contexto urbano. Para campo, eso no alcanza: las fichas y el mapa interactivo necesitan avenidas con continuidad visual, calles repetidas en tramos largos, areas verdes, agua/costa y puntos de referencia reconocibles.

## Fuentes evaluadas

### Geofabrik / OpenStreetMap

Geofabrik publica Peru completo en formatos listos para GIS. La pagina de Peru ofrece:

- `peru-latest.osm.pbf`, 228 MB al 2026-05-04.
- `peru-latest-free.shp.zip`, 548 MB al 2026-05-04.
- `peru-latest-free.gpkg.zip`, 559 MB al 2026-05-04.

La documentacion de Geofabrik indica capas utiles para Prosecnur: `roads`, `waterways`, `buildings`, `landuse`, `natural`, `places`, `pois` y poligonos de agua. Esta fuente es viable para funcionamiento local/offline, con licencia ODbL y atribucion visible.

Uso recomendado en Prosecnur:

- vias completas por distrito: `roads`;
- parques y areas verdes: `landuse`, `natural`, `pois/pois_a` con `park`, `playground`, `sports`;
- agua/costa/canales: `water`, `waterways`, `natural=water`;
- edificios o hitos solo cuando ayuden a ubicacion, no todos por defecto para no saturar;
- puntos de referencia: colegios, hospitales, comisarias, municipalidades, mercados, centros comerciales, estaciones y atractores relevantes.

### IMP / PLANMET 2040

El catalogo SIM PLANMET 2040 lista capas oficiales de Lima Metropolitana que son especialmente pertinentes:

- `B_1501_Red_vial`: red vial total, fuente MTC 2020.
- `B_1501_Hidrografia`: hidrografia, fuente IGN/ANA 2020.
- `D_1501_Areas_Verdes`, `D_1501_Areas_verdes_compl`, `D_1501_Espacios_publicos`, `D_1501_Equip_recreacion`, `D_1501_Playas`.
- `D_1501_Equip_educativo`, `D_1501_Equip_salud`, `D_1501_Equip_seguridad`, `D_1501_Equip_comercial`, `D_1501_Municipalidades`.
- `D_1501_Centros_atractores` y `D_1501_Centralidades_viales`.

Estas capas son mas institucionales y pueden dar un mapa mas profesional para Lima. Hay que confirmar descarga/servicio ArcGIS, licencia de reutilizacion y cobertura Callao antes de empaquetarlas.

## Recomendacion de arquitectura

Crear una nueva capa local `contexto_cartografico` por distrito, separada de `calles_osm`.

Orden de dibujo:

1. fondo neutro;
2. agua/costa;
3. areas verdes/parques/playas;
4. edificios o equipamientos importantes en gris muy suave;
5. vias con jerarquia y casing continuo;
6. etiquetas de avenidas/calles;
7. manzanas de contexto;
8. zona activa;
9. manzanas seleccionadas;
10. popup/detalle.

API sugerida:

- `/api/hojas-ruta/context-map?ubigeo=...`
- metadata en `state.context_cartography`

Archivos locales:

- `api/inst/hojas_ruta/cartografia/contexto_lima_callao/{ubigeo}.geojson.gz`
- `api/inst/hojas_ruta/cartografia_contexto_lima_callao.json`

## Mejoras necesarias en render

- Agrupar segmentos de una misma avenida por nombre para repetir etiqueta a lo largo del recorrido completo.
- No depender de un unico label por feature, porque OSM y shapefiles suelen partir vias en muchos segmentos.
- Dibujar casing e interior por clase vial con continuidad visual, usando el mismo orden para pantalla y PDF.
- Incluir una version de mapa para PDF con simbolizacion mas fuerte que la interactiva.
- Limitar POIs por importancia y zoom para que el mapa oriente sin volverse ruidoso.

## Decision recomendada

Para v1.1: usar Geofabrik como capa local base porque ya encaja con el flujo offline y cubre Lima/Callao.

Para v1.2: sumar capas oficiales PLANMET cuando se confirme acceso estable y licencia clara. PLANMET debe ser la fuente preferida para red vial oficial, areas verdes, hidrografia y equipamiento en Lima Metropolitana.
