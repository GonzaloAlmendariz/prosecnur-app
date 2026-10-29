# ADR 0119: Hojas de ruta — el territorio cubre las ciudades principales y cada capa declara el año de su dato

Estado: Aceptado (§1–4 y §6; §5 sigue propuesto hasta la revisión metodológica)

Implementacion: En curso

Fecha: 2026-10-29

Fecha de decision: 2026-10-29. Gonzalo ratifica el ADR y, el mismo día, acota la cobertura: solo las provincias donde la capa cubre bien la ciudad (§1).

Reemplaza: —

Extiende: [ADR 0115](0115-hojas-de-ruta-marco-elegible.md) (marco elegible) y
[ADR 0117](0117-hojas-de-ruta-sorteo-pps-sistematico-por-distrito.md) (PPS por distrito: la medida de tamaño
`M_i` sale del marco que aquí se amplía).

## Contexto

Hojas de ruta solo sabe sortear en Lima Metropolitana y Callao. El supuesto está escrito en el código:

- `.hojas_ruta_cartografia_profile_for_ubigeo` (`api/R/hojas_ruta_engine.R` ~1082) reconoce solo `^1501` y `^0701`;
  cualquier otro ubigeo devuelve `NULL`.
- Marco, NSE, zonas, calles y contexto están empaquetados con cobertura «Lima Metropolitana y Callao» en
  `api/inst/hojas_ruta/` (68 MB, 330 archivos versionados en git).

Las fuentes para extenderlo ya existen y se revisaron el 2026-10-29:

| Capa | Fuente | Año del dato | Cobertura fuera de Lima |
|---|---|---|---|
| Polígono + NSE por manzana | GeoPeru/IDEP, capa `peru_estrato_nacional_` (INEI) | CPV 2017 + ENAHO 2017-18 | 267 846 filas, 231 distritos, 71 provincias; 128 157 manzanas con id fuera de Lima/Callao en 181 distritos |
| Viviendas por manzana | `MANZANAS PRINCIPALES CIUDADES CENSO 2017 con provnro.sav` (marco muestral INEI, Drive GIZ) | CPV 2017 | 135 115 manzanas, 126 distritos, 2,18 M viviendas |
| Viviendas por manzana (lo que falte) | REDATAM CPV 2017, base de manzana (el que ya usa `build_inei2017_lima_callao_frame.R`) | CPV 2017 | nacional |
| Totales por distrito | REDATAM CPV 2025, base `CPV2025DI` | CPV 2025 | nacional, **solo hasta distrito** |
| Crecimiento edificado | Google Open Buildings 2.5D Temporal | anual 2016–2023 | nacional (estimación satelital) |

No hay estratificación NSE por manzana posterior a 2017, ni conteos o cartografía del Censo 2025 por manzana.

Dos hechos que condicionan la decisión:

1. **El NSE que se muestra parece de 2026 y es de 2017.** `nse_geoperu_inei_lima_callao_manzanas.json` declara
   `"year": 2026`, que es la fecha de descarga; la clave es `IDMZ18`. El «Sin Data» es el 15 % de las manzanas en
   Lima y llega a 27–54 % en Piura, Sullana, Huaral o Cañete.
2. **El marco 2017 se quedó corto en la periferia.** Población censada CPV 2025 frente al marco 2017 de la app:
   Lima + Callao pasa de 9,05 M a 10,64 M (+17,7 %), pero Punta Negra +103 %, Santa Rosa +88 %, Pucusana +74 %,
   Cieneguilla +65 %, Ancón +63 %, Lurín +60 % y Carabayllo +45 %. Con PPS por viviendas (ADR 0117), esas zonas
   quedan con π menor que su peso real.

### Peso medido, no supuesto

Se generó la geometría de las 128 157 manzanas fuera de Lima/Callao, con el formato que ya usa la app (un
`<ubigeo>.geojson.gz` por distrito):

| Variante | Tamaño |
|---|---|
| Igual que hoy (15 decimales) | 16,1 MB |
| 6 decimales (~0,1 m) | 7,5 MB |

Sumando marco, NSE, zonas y calles OSM, la cobertura nacional agrega del orden de **40–60 MB** a
`api/inst/hojas_ruta/`. El instalador de la v0.9.5 pesa 846 MB (dmg arm64) y 1,10 GB (Setup.exe): **+5 %**.
El costo que sí importa es otro: los datos viven en git sin LFS (`size-pack` 813 MiB) y cada regeneración agrega
blobs para siempre.

## Decisión

### 1. La cobertura se amplía dentro del instalador, solo donde la capa cubre bien la ciudad

Los datos de las ciudades principales se empaquetan en `api/inst/hojas_ruta/`, igual que hoy Lima. No se descargan
bajo demanda: la app sigue siendo local-first y sortea sin red (alternativa B, rechazada abajo).

No entran las 71 provincias de la capa: entra una provincia cuando la capa sostiene un sorteo creíble. Se mide sobre
los distritos que la capa cubre, con la población del REDATAM CPV 2017 por manzana y la población censada del CPV 2025:

- **cobertura cartográfica** = población 2017 en manzanas de la capa / población 2017 en manzanas del distrito.
  Mide cuánto de la ciudad de 2017 dibuja la capa;
- **captación** = población 2017 en manzanas de la capa / población censada 2025. Mide cuánto de la población de
  hoy cae en el marco. Por debajo de 55 %, la ciudad creció fuera de la cartografía 2017 y el marco promete más de lo
  que tiene;
- **tamaño** = población censada 2025 en esos distritos.

| Nivel | Tamaño | Captación | Cobertura cartográfica |
|---|---|---|---|
| 1 | ≥ 300 000 | ≥ 65 % | ≥ 75 % |
| 2 | ≥ 100 000 | ≥ 55 % | ≥ 65 % |

Una primera versión medía la captación con el campo `PERSON` de la capa GeoPeru. Ese campo subestima la población:
dejaba fuera a Cusco con 54 %, cuando con el REDATAM tiene 77 %.

**Se integran ahora los niveles 1 y 2** (25 provincias, 116 distritos, 92 057 manzanas, 6,43 M habitantes en 2017),
además de Lima y Callao, que ya están:

- **Nivel 1:** Arequipa, Trujillo, Chiclayo, Huancayo, Santa (Chimbote), Cusco, Maynas (Iquitos) y Tacna.
- **Nivel 2:** Piura, Ica, Coronel Portillo (Pucallpa), Sullana, Huánuco, Huamanga, Chincha, San Román (Juliaca),
  Huaura (Huacho), San Martín (Tarapoto), Huaraz, Pisco, Barranca, Puno, Tumbes, Jaén y Paita.

Quedan fuera, por ahora: Huaral (captación 54,9 %, cobertura 64,6 %), Cajamarca (captación 54 %, la ciudad creció
45 %), Cañete (49 %), Caylloma (26 %) y toda provincia con menos de 100 000 habitantes en los distritos cubiertos.
Entran si el marco 2025 estimado (§5) pasa la revisión metodológica, o si se acepta caso a caso con su cobertura
declarada (§7).

El builder calcula el nivel con estos umbrales y lo escribe en el registro; la lista no se mantiene a mano.

### 2. Un registro de territorios reemplaza los regex de ubigeo

Un manifiesto `api/inst/hojas_ruta/territorios.json` lista, por provincia: distritos, archivos por capa, fuente,
`anio_dato`, `descargado`, versión y checksum. `.hojas_ruta_cartografia_profile_for_ubigeo` y sus pares consultan
ese registro. Lima y Callao se migran al mismo registro sin cambiar sus archivos.

Esquema congelado (v1):

```json
{
  "schema_version": 1,
  "id": "hojas-ruta-territorios",
  "version": "hojas-ruta-territorios-v1",
  "generado": "2026-10-29T00:00:00Z",
  "provincias": [
    {
      "codigo": "0401",
      "departamento": "AREQUIPA",
      "provincia": "AREQUIPA",
      "distritos": ["040101", "040102"],
      "capas": {
        "manzanas": {
          "ruta": "cartografia/manzanas_inei2017_ciudades",
          "patron": "<ubigeo>.geojson.gz",
          "fuente": "GeoPeru/IDEP - INEI, peru_estrato_nacional_",
          "anio_dato": 2017,
          "descargado": "2026-10-29",
          "version": "inei2017-ciudades-manzanas-v1",
          "checksums": { "040101.geojson.gz": "<md5>" }
        },
        "marco": { "ruta": "inei2017_ciudades_manzanas.csv.gz", "filtro": "ubigeo", "...": "mismos campos" },
        "nse":   { "ruta": "nse_geoperu_inei_ciudades_manzanas.csv.gz", "filtro": "ubigeo", "...": "mismos campos" }
      }
    }
  ]
}
```

- `ruta` es relativa a `api/inst/hojas_ruta/`. Una capa con `patron` es un archivo por distrito; una con `filtro`
  es un archivo compartido que se filtra por `ubigeo`.
- Las capas obligatorias son `manzanas`, `marco` y `nse`. `zonas` y `calles` son opcionales: si faltan, se
  declara la ausencia y no se rellena con otra cosa.
- Cada capa lleva `fuente`, `anio_dato` (entero), `descargado` (`YYYY-MM-DD`), `version` y `checksums` (md5 por
  archivo).
- Un distrito pertenece a una sola provincia del registro.

La lógica nueva va en archivos nuevos (`hojas_ruta_territorios.R`, …): `hojas_ruta_engine.R` está congelado a
crecimiento (`agentic/manifest.json`).

### 3. Cada capa declara el año de su dato

`anio_dato` (año del dato) y `descargado` (fecha de obtención) son campos distintos y obligatorios en todo
manifiesto. La UI muestra el año del dato. El json actual del NSE GeoPeru se corrige a `anio_dato: 2017`.

### 4. «Sin estrato» no es «Bajo»

Una manzana sin dato de NSE se publica como `sin_estrato`, en su propio color y conteo. Nunca se imputa al estrato
más bajo.

### 5. Una actualización 2025 estimada, opcional y declarada

Se agrega una fuente de marco `inei2017_calibrado_cpv2025`:

- `viviendas_2025_i = viviendas_2017_i × g_i`, donde `g_i` es el crecimiento de edificaciones de la manzana
  (Open Buildings 2017→2023);
- luego se rastrilla (*raking*) para que cada distrito sume las viviendas y la población del CPV 2025.

Reglas:

- **Nunca es la fuente por defecto.** El estudio la elige y la muestra guarda `frame_version` (ya existe en la
  muestra, `hojas_ruta_engine.R` ~5023).
- **El NSE sigue siendo el de 2017.**
- Las manzanas que no existían en 2017 no entran al marco. Para cada distrito se informa la brecha entre la
  población CPV 2025 y la del marco.
- **Requiere revisión metodológica antes de pasar a `Aceptado`**, porque cambia `M_i` del PPS (misma regla D4
  del ADR 0115).

### 6. El ubigeo 2025 de Lima se traduce en la frontera

En el CPV 2025, Lima Metropolitana viene con el código `27xxxx`. La traducción `27 → 1501` ocurre en el script que
importa, nunca dentro del motor.

### 7. La cobertura se informa antes de elegir

El registro trae, por provincia y por distrito, `cobertura_cartografica`, `captacion`, `crecimiento`, `pob17_en_capa`,
`pob25` y el `nivel` (`1`, `2` o `fuera`), con la referencia CPV 2025 declarada. El promedio de una provincia esconde
distritos flojos (en Cusco, San Jerónimo capta 50 % mientras el Cercado capta 93 %), así que la cifra por distrito es
obligatoria.

- **En el mapa del Perú de Territorio**, cada provincia y cada distrito disponible se pinta por su nivel de cobertura,
  y al pasar por encima o seleccionarlo se lee su cobertura cartográfica y su captación. El analista la ve **antes**
  de elegir, no después del sorteo.
- Un distrito con captación bajo 55 % se puede elegir, pero con un aviso que dice cuánto de su población 2025 queda
  fuera del marco.
- El informe de diseño muestral y la ficha técnica repiten la cobertura de los distritos sorteados, para que quien
  interprete los resultados sepa que el marco no cubre el 100 %.
- Lima y Callao publican las mismas cifras: tampoco tienen cobertura completa (captación 84 % y 92 % con el marco oficial; en la periferia baja mucho más, p. ej. Punta Negra y Santa Rosa crecieron 103 % y 88 % desde 2017).

## Consecuencias

- Se pueden armar hojas de ruta en las principales ciudades sin red ni pasos manuales.
- El instalador crece cerca de 5 %. Bajar a 6 decimales también achica la cartografía de Lima (hoy 23 MB).
- Git crece con cada regeneración. Mitigación: se regenera solo si cambia la fuente, y con salida determinista
  (orden de filas y precisión fijos) para que una corrida sin cambios no produzca diff.
- Fuera de Lima no hay calles INEI ni zonas censales oficiales empaquetadas. Las zonas se derivan disolviendo
  manzanas por su código de zona en `IDMZ18`; las calles salen de OSM (extracto Geofabrik Perú). Es una calidad
  distinta a la de Lima y se declara así.
- La estimación 2025 introduce un supuesto de modelo (crecimiento edificado ≈ crecimiento de viviendas) que puede
  fallar en zonas de densificación vertical o de vivienda vacía (balnearios).

## Alternativas rechazadas

- **B. Paquete por ciudad descargado bajo demanda.** Ahorra unos 50 MB sobre un instalador de 850 MB a 1,1 GB, pero
  rompe el sorteo sin red y obliga a hospedar, versionar y validar descargas. Se reconsidera si la cobertura llega
  a cientos de MB (por ejemplo, rasters WorldPop o Open Buildings empaquetados) o si `size-pack` se vuelve un
  problema; en ese caso, primero se mueven los datos a git LFS o a un asset de release.
- **C. Esperar el CPV 2025 por manzana.** Sin fecha anunciada. Cuando salga, se reemplazan los insumos del paso 5
  y el registro del paso 2 no cambia.

## Cumplimiento

- Test de contrato: todo ubigeo que figura en `territorios.json` resuelve perfil de cartografía, marco y NSE, y sus
  checksums coinciden con los archivos.
- Test: un manifiesto sin `anio_dato`, o con `anio_dato` posterior al año de su fuente censal, falla.
- Test: una manzana con NSE ausente sale como `sin_estrato`, nunca como `bajo`.
- Test: el marco `inei2017_calibrado_cpv2025` suma, por distrito, los totales CPV 2025 (tolerancia 0).
- `rg '\^1501|\^0701' api/R/hojas_ruta*.R` sin coincidencias fuera del registro.
- La matriz de QA visual de Hojas de ruta incluye una ciudad fuera de Lima (Arequipa).
- Test: toda provincia y todo distrito del registro trae `nivel`, `cobertura_cartografica` y `captacion`; ninguna
  provincia `fuera` se empaqueta por defecto.
- Test de frontend: el selector de Territorio pinta el nivel y muestra la captación de cada distrito disponible.

## Notas

- Plan de ejecución: [`docs/qa/plan-hojas-ruta-ciudades-principales-2026-10-29.md`](../qa/plan-hojas-ruta-ciudades-principales-2026-10-29.md).
- Fuentes: [INEI, planos estratificados](https://m.inei.gob.pe/prensa/noticias/inei-publica-planos-estratificados-por-ingreso-a-nivel-de-manzanas-de-grandes-ciudades-12369/),
  [capa GeoPeru](https://descargas.geoperu.gob.pe/peru_estrato_nacional_.zip),
  [REDATAM CPV 2025](https://redatamcpv2025.inei.gob.pe/),
  [Open Buildings Temporal](https://sites.research.google/gr/open-buildings/temporal).
