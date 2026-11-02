# Cartografía de departamentos del Perú

`peru_departamentos.geojson` — los 25 departamentos del Perú (Lima Metropolitana fundida en el departamento de Lima;
el Callao aparte), para el mapa de distribución de encuestados (`p_mapa_distribucion(area = "peru")`,
`api/R/graficos_mapa_distribucion_plan.R`).

- **Fuente:** Natural Earth, *Admin 1 – States, Provinces*, escala 1:10m, versión 5.1.2
  (`ne_10m_admin_1_states_provinces.geojson`, repositorio `nvkelso/natural-earth-vector`, etiqueta `v5.1.2`).
  SHA-256 del archivo descargado: `22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5`.
- **Licencia:** dominio público. Natural Earth declara: «All versions of Natural Earth raster + vector map data found on
  this website are in the public domain» (https://www.naturalearthdata.com/about/terms-of-use/). Se puede redistribuir
  y modificar sin permiso; se agradece citar «Made with Natural Earth».
- **Transformación:** `build_peru_departamentos.R` (en esta carpeta). Filtra el Perú, funde «Lima» y «Lima Province»,
  asigna el UBIGEO de departamento del INEI (2 dígitos), simplifica a ~300 m (UTM 18S) y redondea a 4 decimales.
  Descargado y construido el 2026-11-02.
- **Límites:** cartografía de escala pequeña, útil para pintar una distribución por departamento; no es cartografía
  oficial ni sirve para medir. Natural Earth sigue la representación de facto de los límites.
