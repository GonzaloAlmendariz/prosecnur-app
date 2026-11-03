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

# Países vecinos del Perú

`peru_vecinos.geojson` — Ecuador, Colombia, Brasil, Bolivia y Chile recortados a una caja alrededor del Perú
(lon −83.5 a −66, lat −20.5 a 2), como tierra de contexto del mapa de departamentos, con el nombre en español y el punto
de su rótulo.

- **Fuente:** Natural Earth, *Admin 0 – Countries*, escala 1:50m, versión 5.1.2 (`ne_50m_admin_0_countries.geojson`,
  repositorio `nvkelso/natural-earth-vector`, etiqueta `v5.1.2`). SHA-256 del archivo descargado:
  `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`.
- **Licencia:** dominio público (la misma declaración de Natural Earth citada arriba).
- **Transformación:** `build_peru_vecinos.R` (en esta carpeta): recorte a la caja, simplificación a ~1 km (UTM 18S) y
  4 decimales. Descargado y construido el 2026-11-02.
